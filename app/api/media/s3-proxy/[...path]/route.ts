import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

/**
 * This API route acts as a proxy for S3 objects, fetching them server-side and returning them
 * with proper CORS headers to avoid cross-origin issues when loading images directly from S3.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  // In Next.js 15, we need to await the params
  const params = await context.params;
  try {
    // Get the S3 configuration from environment variables
    const region = process.env.AWS_REGION;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    // Validate required configuration
    if (!region || !bucketName || !accessKeyId || !secretAccessKey) {
      console.error("Missing required S3 configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Construct the S3 key from the path parameter
    const pathParts = params.path;
    if (!pathParts || pathParts.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Join the path parts to create the S3 key
    const s3Key = pathParts.join("/");
    console.log(`S3 proxy fetching: ${s3Key} from bucket ${bucketName}`);

    // Create a GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    // Get the object from S3
    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    // Convert the response body to a buffer
    const stream = response.Body as Readable;
    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }

    const buffer = Buffer.concat(chunks);

    // Determine the content type
    const contentType = response.ContentType || "application/octet-stream";

    // Create a response with the file content and appropriate headers
    const nextResponse = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

    return nextResponse;
  } catch (error) {
    console.error("Error proxying S3 object:", error);
    return NextResponse.json({ error: "Failed to retrieve object" }, { status: 500 });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  // In Next.js 15, we need to await the params (even though we don't use them)
  await context.params;

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
