import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcryptjs from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    // Check if any users exist already
    const userCount = await prisma.user.count();

    // If users already exist, prevent setup
    if (userCount > 0) {
      return NextResponse.json(
        { message: "Setup already completed. Admin user already exists." },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create admin user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    // Return success without exposing sensitive user data
    return NextResponse.json({ message: "Admin user created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error during admin setup:", error);
    return NextResponse.json({ message: "Something went wrong during setup" }, { status: 500 });
  }
}
