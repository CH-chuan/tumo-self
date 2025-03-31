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
 * Delete a specific generation and all others with the same prompt
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Get the parameter from the URL
    const { id: generationId } = await context.params;

    // Get the authenticated user (if available)
    const session = await auth();
    const authenticatedUserId = session?.user?.id;

    // Return 401 if not authenticated
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check if the generation belongs to the authenticated user
    const generation = await prisma.generation.findUnique({
      where: {
        id: generationId,
      },
      include: {
        mediaItems: true,
      },
    });

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    if (generation.userId !== authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete media files for this generation using the ServerMediaStorageService
    const mediaStorageService = new ServerMediaStorageService();

    for (const mediaItem of generation.mediaItems) {
      if (mediaItem.mediaPath) {
        try {
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
    }

    // Delete this specific generation from the database
    // This will cascade delete the associated media items
    await prisma.generation.delete({
      where: {
        id: generationId,
      },
    });

    console.log(`Deleted generation: "${generationId}"`);

    return NextResponse.json({
      success: true,
      deleted: 1,
    });
  } catch (error) {
    console.error("Error deleting generations:", error);
    return NextResponse.json({ error: "Failed to delete generations" }, { status: 500 });
  }
}
