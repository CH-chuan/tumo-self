import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();

    return NextResponse.json(
      {
        setupRequired: userCount === 0,
        message: userCount === 0 ? "System setup required" : "System already set up",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking system setup status:", error);
    return NextResponse.json({ message: "Error checking system setup status" }, { status: 500 });
  }
}
