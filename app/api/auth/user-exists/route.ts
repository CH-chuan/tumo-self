import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      exists: userCount > 0,
      count: userCount,
    });
  } catch (error) {
    console.error("Error checking if users exist:", error);
    return NextResponse.json(
      {
        error: "Failed to check if users exist",
      },
      { status: 500 }
    );
  }
}
