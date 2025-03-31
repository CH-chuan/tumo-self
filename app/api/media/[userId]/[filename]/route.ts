import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { auth } from "@/lib/auth";

/**
 * Serve media files stored outside the public directory
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string; filename: string }> }
) {
  try {
    // In Next.js 15, we need to ensure params are properly awaited
    const { userId, filename } = await context.params;

    // Get the authenticated user (if available)
    const session = await auth();
    const authenticatedUserId = session?.user?.id;

    // Return 401 if not authenticated
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Security check: users can only access their own media
    // unless they are an admin (could add admin check here in the future)
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Resolve the file path
    const storagePath = process.env.MEDIA_STORAGE_PATH || "./generated-media";
    const filePath = path.join(process.cwd(), storagePath, userId, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file and determine content type
    const fileData = fs.readFileSync(filePath);
    let contentType = "application/octet-stream";

    // Set content type based on file extension
    if (filename.endsWith(".png")) {
      contentType = "image/png";
    } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    } else if (filename.endsWith(".gif")) {
      contentType = "image/gif";
    } else if (filename.endsWith(".mp3")) {
      contentType = "audio/mpeg";
    } else if (filename.endsWith(".mp4")) {
      contentType = "video/mp4";
    } else if (filename.endsWith(".glb")) {
      contentType = "model/gltf-binary";
    }

    // Return the file with proper content type
    return new NextResponse(fileData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("Error serving media file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
