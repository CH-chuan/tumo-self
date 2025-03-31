import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * API route to handle S3 media files
 * This route will either:
 * 1. Redirect to a signed S3 URL for direct access (if no static URL is configured)
 * 2. Redirect to the static S3 URL (if configured)
 */
export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    // In Next.js 15, we need to await the params
    const params = await context.params;

    // Check if we're using S3 storage
    const storageType = process.env.MEDIA_STORAGE_TYPE || "local";
    if (storageType !== "s3") {
      return NextResponse.json({ error: "S3 storage is not enabled" }, { status: 400 });
    }

    // Get S3 configuration
    const region = process.env.AWS_REGION;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const staticUrl = process.env.NEXT_PUBLIC_AWS_S3_STATIC_URL;

    if (!region || !bucketName) {
      return NextResponse.json({ error: "S3 configuration is incomplete" }, { status: 500 });
    }

    // Reconstruct the path from the params
    const pathParts = params.path || [];
    if (pathParts.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // The first part should be the userId, and the rest is the file path
    const userId = pathParts[0];
    const filePath = pathParts.slice(1).join("/");

    const s3Key = `${userId}/${filePath}`;
    console.log(`S3 key constructed: ${s3Key} [userId=${userId}, filePath=${filePath}]`);

    // If we have a static URL configured, redirect directly to it
    if (staticUrl) {
      const cleanStaticUrl = staticUrl.replace(/\/$/, "");
      const redirectUrl = `${cleanStaticUrl}/${s3Key}`;
      console.log(
        `Redirecting to S3 static URL: ${redirectUrl} [bucket=${bucketName}, key=${s3Key}]`
      );

      // Instead of redirecting, return the URL with CORS headers
      // This helps with cross-origin issues that might be causing the images not to load
      const response = NextResponse.json({ url: redirectUrl });

      // Add CORS headers
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");

      return response;
    }

    // Otherwise, generate a signed URL for temporary access
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    // Generate a signed URL that expires in 15 minutes
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Error serving S3 media:", error);
    return NextResponse.json({ error: "Failed to serve media from S3" }, { status: 500 });
  }
}
