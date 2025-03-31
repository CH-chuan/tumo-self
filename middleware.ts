import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./lib/auth";

export async function middleware(request: NextRequest) {
  // Define paths that are accessible without authentication
  const publicPaths = ["/login", "/api/auth", "/setup", "/logo"];

  // Check if the current path is public
  const isPublicPath =
    publicPaths.some((path) => request.nextUrl.pathname.startsWith(path)) ||
    request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|svg|ico)$/) ||
    request.nextUrl.pathname.includes("_next");

  // Allow access to media API endpoint in development mode
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && request.nextUrl.pathname.startsWith("/api/media")) {
    return NextResponse.next();
  }

  // If it's a public path, allow access
  if (isPublicPath) {
    return NextResponse.next();
  }

  // For protected routes, check auth status using a cookie
  const authCookie = request.cookies.get("next-auth.session-token");

  // If no auth cookie, redirect to login or setup
  if (!authCookie) {
    // First check if any users exist by calling our API
    try {
      const response = await fetch(new URL("/api/auth/user-exists", request.url));
      if (!response.ok) throw new Error("Failed to check if users exist");

      const data = await response.json();

      // If no users exist, redirect to setup
      if (!data.exists) {
        return NextResponse.redirect(new URL("/setup", request.url));
      }

      // Otherwise redirect to login
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    } catch (error) {
      // If we can't determine if users exist, default to login
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } else {
    // User is authenticated, check if they're trying to access setup page
    if (request.nextUrl.pathname === "/setup") {
      // Redirect authenticated users away from setup page to home
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

// Configure which paths this middleware will run on
export const config = {
  matcher: [
    // Apply to specific routes that need authentication
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
    "/profile/:path*",
  ],
};
