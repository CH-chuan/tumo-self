import { NextRequest, NextResponse } from "next/server";
import { ImageModel, experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { replicate } from "@ai-sdk/replicate";
import { ProviderKey } from "@/lib/provider-config";
import { GenerateImageRequest } from "@/lib/api-types";
import { MediaType } from "@/lib/media-storage";
import { auth } from "@/lib/auth";
import { ServerMediaStorageService } from "@/lib/server/server-media-storage";
import { prisma } from "@/lib/db";

/**
 * Intended to be slightly less than the maximum execution time allowed by the
 * runtime so that we can gracefully terminate our request.
 */
const TIMEOUT_MILLIS = 55 * 1000;

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_ASPECT_RATIO = "1:1";

// Initialize the media storage service
const mediaStorage = new ServerMediaStorageService();

interface ProviderConfig {
  createImageModel: (modelId: string) => ImageModel;
  dimensionFormat: "size" | "aspectRatio";
}

const providerConfig: Record<ProviderKey, ProviderConfig> = {
  openai: {
    createImageModel: openai.image,
    dimensionFormat: "size",
  },
  replicate: {
    createImageModel: replicate.image,
    dimensionFormat: "size",
  },
};

const withTimeout = <T>(promise: Promise<T>, timeoutMillis: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        const timeoutError = new Error("Request timed out");
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, timeoutMillis)
    ),
  ]);
};

// We'll rely on database queries instead of in-memory caching

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const {
    prompt,
    provider,
    modelId,
    userId: requestUserId,
  } = (await req.json()) as GenerateImageRequest;

  // Get the authenticated user (if available)
  const session = await auth();
  const authenticatedUserId = session?.user?.id;

  // Use provided userId or fall back to authenticated user or 'anonymous'
  const userId = requestUserId || authenticatedUserId || "anonymous";

  // Track the generation ID for database persistence
  let generationId: string | null = null;

  // Create a generation record in the database if we have an authenticated user
  if (authenticatedUserId) {
    try {
      // Check for an existing generation with the same prompt from this user in the last minute
      const existingGeneration = await prisma.generation.findFirst({
        where: {
          userId: authenticatedUserId,
          prompt,
          // We're using recent timestamp (within last minute) for related generations
          timestamp: {
            gt: new Date(Date.now() - 60000),
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      });

      if (existingGeneration) {
        generationId = existingGeneration.id;
        console.log(
          `Reusing existing DB generation record [id=${generationId}] with prompt="${prompt.slice(0, 30)}..."`
        );
      } else {
        console.log(`No existing DB generation found for prompt="${prompt.slice(0, 30)}..."`);
      }

      // If no existing generation was found, create a new one
      if (!generationId) {
        // Create a new generation record
        const generation = await prisma.generation.create({
          data: {
            userId: authenticatedUserId,
            prompt,
          },
        });

        generationId = generation.id;
        console.log(
          `Created NEW generation record [id=${generationId}] with prompt="${prompt.slice(0, 30)}..."`
        );
      }
    } catch (dbError) {
      console.error(`Failed to create/find generation record: ${dbError}`);
      // Continue without failing the request - we'll still generate the image
    }
  }

  try {
    if (!prompt || !provider || !modelId || !providerConfig[provider]) {
      const error = "Invalid request parameters";
      console.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    const config = providerConfig[provider];
    const startstamp = performance.now();
    const generatePromise = generateImage({
      model: config.createImageModel(modelId),
      prompt,
      ...(config.dimensionFormat === "size"
        ? { size: DEFAULT_IMAGE_SIZE }
        : { aspectRatio: DEFAULT_ASPECT_RATIO }),
      ...(provider !== "openai" && {
        seed: Math.floor(Math.random() * 1000000),
      }),
      // Set provider-specific options if needed
      providerOptions: {},
    }).then(async ({ image, warnings }) => {
      if (warnings?.length > 0) {
        console.warn(
          `Warnings [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
          warnings
        );
      }

      const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);
      console.log(
        `Completed image request [requestId=${requestId}, provider=${provider}, model=${modelId}, elapsed=${elapsed}s].`
      );

      // Save the image to storage
      let mediaPath = "";
      let mediaUrl = "";
      try {
        mediaPath = await mediaStorage.saveMedia(image.base64, {
          userId,
          provider,
          modelId,
          prompt,
          mediaType: MediaType.IMAGE,
          fileExtension: ".png",
        });

        // Verify the media path was generated correctly
        if (!mediaPath) {
          throw new Error("Failed to generate valid media path");
        }

        // Get the media URL and validate it
        const storageType = mediaStorage.getStorageType();

        // For S3 storage, use the proxy URL to avoid CORS issues
        mediaUrl =
          storageType === "s3"
            ? mediaStorage.getMediaUrl(mediaPath, true) // Use proxy URL for S3
            : mediaStorage.getMediaUrl(mediaPath); // Use direct URL for local storage

        if (!mediaUrl) {
          throw new Error("Failed to generate valid media URL");
        }

        // Log success with storage type for debugging
        const directUrl = mediaStorage.getMediaUrl(mediaPath, false);
        console.log(
          `Image saved to storage [type=${storageType}, userId=${userId}, path=${mediaPath}, url=${directUrl}, proxyUrl=${mediaUrl}]`
        );

        // Save media item to database if we have a generation record
        if (generationId && authenticatedUserId) {
          try {
            await prisma.mediaItem.create({
              data: {
                generation: {
                  connect: { id: generationId },
                },
                provider,
                modelId,
                mediaType: "IMAGE",
                mediaPath,
                mediaUrl,
              },
            });

            console.log(`Saved media item to database [generationId=${generationId}]`);
          } catch (dbError) {
            console.error(`Failed to save media item to database: ${dbError}`);
            // Continue without failing the request
          }
        }
      } catch (storageError) {
        console.error(
          `Failed to save image to storage [type=${mediaStorage.getStorageType()}]: ${storageError}`
        );
        // Continue without failing the request, we'll still return the base64 data
      }

      return {
        provider,
        image: image.base64,
        imagePath: mediaPath,
        imageUrl: mediaUrl,
        generationId: generationId || null, // Return the database generationId to the client
      };
    });

    const result = await withTimeout(generatePromise, TIMEOUT_MILLIS);
    return NextResponse.json(result, {
      status: "image" in result ? 200 : 500,
    });
  } catch (error: any) {
    // Log full error detail on the server, but return a more specific error message
    // based on the type of error, without leaking sensitive information.
    console.error(
      `Error generating image [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
      error
    );

    // Determine the appropriate status code and error message
    let status = 500;
    let errorMessage = "Failed to generate image. Please try again later.";

    // Handle specific error types
    if (error.name === "TimeoutError") {
      status = 504; // Gateway Timeout
      errorMessage =
        "Image generation took too long. Please try a simpler prompt or try again later.";
    } else if (error.message?.includes("rate limit") || error.message?.includes("quota")) {
      status = 429; // Too Many Requests
      errorMessage = "Rate limit exceeded. Please try again later.";
    } else if (error.message?.includes("content policy") || error.message?.includes("safety")) {
      status = 400; // Bad Request
      errorMessage =
        "Your prompt may violate content policies. Please modify your prompt and try again.";
    }

    // Create a more detailed error response with information that helps debugging
    // but doesn't expose sensitive details
    const errorResponse = {
      error: errorMessage,
      requestId,
      provider,
      model: modelId,
      errorType: error.name || "UnknownError",
      // Include a timestamp for correlation with server logs
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status });
  }
}
