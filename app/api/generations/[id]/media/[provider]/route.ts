import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";
import { ServerMediaStorageService } from "@/lib/server/server-media-storage";

// Define interfaces for database models
interface MediaItem {
  id: string;
  generationId: string;
  provider: string;
  modelId?: string | null;
  mediaType: string;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  timestamp: Date;
}

interface Generation {
  id: string;
  userId: string;
  prompt: string;
  timestamp: Date;
  mediaItems: MediaItem[];
}

/**
 * Delete a specific media item from a generation
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; provider: string }> }
) {
  try {
    // Get the parameters from the URL
    const { id: generationId, provider } = await context.params;

    console.log(`DELETE request for media: generationId=${generationId}, provider=${provider}`);

    // Get the authenticated user (if available)
    const session = await auth();
    const authenticatedUserId = session?.user?.id;

    // Return 401 if not authenticated
    if (!authenticatedUserId) {
      console.error(`Authentication required: userId=${authenticatedUserId}`);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // First check if the generation belongs to the authenticated user
    const generation = await prisma.generation.findUnique({
      where: {
        id: generationId,
      },
      include: {
        mediaItems: true,
      },
    });

    if (!generation) {
      console.error(
        `Generation not found: generationId=${generationId}, userId=${authenticatedUserId}`
      );
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    if (generation.userId !== authenticatedUserId) {
      console.error(
        `Unauthorized: generationUserId=${generation.userId}, requestUserId=${authenticatedUserId}`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Find the media item to delete
    const mediaItem = generation.mediaItems.find((item) => item.provider === provider);

    if (!mediaItem) {
      console.error(
        `Media item not found: generationId=${generationId}, provider=${provider}, availableProviders=${generation.mediaItems.map((item) => item.provider).join(",")}`
      );
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    // Delete the file from disk or S3 if it exists
    if (mediaItem.mediaPath) {
      try {
        // Use the ServerMediaStorageService to handle deletion based on storage type
        const mediaStorageService = new ServerMediaStorageService();
        const success = await mediaStorageService.deleteMedia(mediaItem.mediaPath);

        if (success) {
          console.log(`Successfully deleted media: ${mediaItem.mediaPath}`);
        } else {
          console.warn(`Failed to delete media: ${mediaItem.mediaPath}`);
        }
      } catch (error) {
        console.error(`Error deleting media at ${mediaItem.mediaPath}:`, error);
        // Continue deletion even if file removal fails
      }
    }

    // Delete the media item from the database
    await prisma.mediaItem.delete({
      where: {
        id: mediaItem.id,
      },
    });

    // Check if the generation has any remaining media items
    const remainingMedia = await prisma.mediaItem.count({
      where: {
        generationId,
      },
    });

    // If no media items remain, delete the generation as well
    if (remainingMedia === 0) {
      await prisma.generation.delete({
        where: {
          id: generationId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting media item:", error);
    return NextResponse.json({ error: "Failed to delete media item" }, { status: 500 });
  }
}
