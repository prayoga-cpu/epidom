import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { setRequestId } from "./lib/request-context";

/**
 * Authentication & Subscription Middleware
 *
 * Protects routes defined in matcher configuration.
 * - Redirects unauthenticated users to /login ONLY for protected routes
 * - Checks subscription status for dashboard access
 * - Redirects users with inactive subscriptions to /pricing
 * - Marketing pages (/, /services, /pricing, /contact, etc.) are ALWAYS accessible without authentication
 *
 * Protected routes are configured below in the matcher array.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Generate unique request ID for logging and tracing
  const requestId = crypto.randomUUID();

  // Create a response object to modify headers later if needed
  const response = NextResponse.next();

  // Set request ID in response headers (works in Edge Runtime)
  // This allows request ID to be accessed in API routes and other handlers
  response.headers.set("x-request-id", requestId);

  // Try to set in global context (only works in Node.js runtime, not Edge Runtime)
  // This is safe - setRequestId checks if global is available
  setRequestId(requestId);

  // Skip middleware for API routes - they handle authentication internally
  if (path.startsWith("/api/")) {
    return response;
  }

  // PUBLIC ROUTES - Always accessible without authentication
  // Marketing pages and auth pages should never be blocked
  const publicRoutes = [
    "/", // Home page
    "/services",
    "/pricing",
    "/contact",
    "/payments",
    "/terms",
    "/refund-policy",
    "/login",
    "/register",
    "/checkout/success",
    "/checkout/failed",
    "/onboarding", // Card validation step
    "/forgot-password",
    "/reset-password",
  ];

  // Check if current path is a public route
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      return path === "/";
    }
    return path.startsWith(route);
  });

  // If it's a public route, allow access without authentication
  if (isPublicRoute) {
    return response;
  }

  // PROTECTED ROUTES - Require authentication
  // Check for Better Auth session cookie
  // In production, Better Auth uses __Secure- prefix
  const sessionCookie =
    req.cookies.get("better-auth.session_token") ||
    req.cookies.get("__Secure-better-auth.session_token");

  // If no token and trying to access protected route, redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the original URL as callbackUrl so user can return after login
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // TODO: Re-implement subscription status check using Better Auth session data or DB check
  // For now, we allow access if authenticated.
  // To implement this efficiently in middleware without DB calls, we might need to use JWT strategy
  // or cache the subscription status in the session cookie.

  return response;
}

/**
 * Middleware matcher configuration
 *
 * List all routes that should be checked by middleware.
 * - Public routes (marketing pages) are handled in middleware logic above
 * - Protected routes require authentication
 * - API routes are excluded (they handle auth internally)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
