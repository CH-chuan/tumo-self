import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Retrieve generations for the currently authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Get the authenticated user (if available)
    const session = await auth();
    const authenticatedUserId = session?.user?.id;

    // Return 401 if not authenticated
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get query parameters for pagination
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Fetch generations with their associated media items
    // Using bracket notation to access the model
    const generations = await prisma.generation.findMany({
      where: {
        userId: authenticatedUserId,
      },
      include: {
        mediaItems: true,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Also get the total count for pagination
    const totalCount = await prisma.generation.count({
      where: {
        userId: authenticatedUserId,
      },
    });

    return NextResponse.json({
      generations,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
  }
}
