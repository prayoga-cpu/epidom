import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Define helper to check if path matches a protected route
  // We want to protect all dashboard routes, stores, etc.
  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/stores") ||
    path.startsWith("/onboarding") ||
    // Protect profile routes
    path.startsWith("/profile");

  // Define helper to check for auth routes (login/register)
  // We want to redirect away from these if already logged in
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path === "/"; // Optional: redirect root to dashboard if logged in? Maybe keep root as landing page.

  // Get session token from cookie
  // better-auth typically uses "better-auth.session_token"
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;

  // 1. Protect private routes
  if (isProtectedRoute && !sessionToken) {
    const url = new URL("/login", request.url);
    // Add return URL to redirect back after login
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // 2. Redirect away from auth routes if already logged in
  if ((path === "/login" || path === "/register") && sessionToken) {
    // Default to stores page as the entry point for authenticated users
    return NextResponse.redirect(new URL("/stores", request.url));
  }

  return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder content (images, etc)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
