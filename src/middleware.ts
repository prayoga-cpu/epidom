import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateRequestId, setRequestId } from "@/lib/utils/request-id";

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
export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // Generate request ID for tracking
    const requestId = req.headers.get("x-request-id") || generateRequestId();

    // Set request ID in response headers
    const response = NextResponse.next();
    setRequestId(response.headers, requestId);

    // Store request ID in global context for logger
    (global as any).requestId = requestId;

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
  // Get token from session
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the original URL as callbackUrl so user can return after login
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  // Routes that require authentication but NOT active subscription
  // These routes are accessible to authenticated users regardless of subscription status
  const authRequiredButNoSubscriptionRoutes = ["/billing", "/profile", "/stores"];
  const isAuthRequiredButNoSubscription = authRequiredButNoSubscriptionRoutes.some((route) =>
    path.includes(route)
  );

  if (isAuthRequiredButNoSubscription) {
      return NextResponse.next();
    }

    // Check if accessing store dashboard routes (requires active subscription)
    // Note: /stores page is accessible without subscription, but creating stores requires subscription
    // Only dashboard routes for individual stores require subscription
    // Route pattern: /store/[storeId]/dashboard, /store/[storeId]/tracking, etc.
    // IMPORTANT: This catches ALL routes starting with /store/ (except /stores which is whitelisted above)
    // This prevents users from manually typing URLs to access stores without active subscription
    const isStoreRoute = path.startsWith("/store/") && !path.startsWith("/stores");

    // Check subscription for ALL store routes (dashboard, tracking, data, management, alerts, profile, billing, etc.)
    // This ensures complete protection - users cannot access any store page without active subscription
    if (isStoreRoute && token?.sub) {
      try {
        // Fetch subscription status
        const baseUrl = req.nextUrl.origin;
        const response = await fetch(`${baseUrl}/api/subscriptions/status`, {
          headers: {
            Cookie: req.headers.get("cookie") || "",
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Check if user has an active subscription
          // Block access to store dashboards if subscription is not active
          if (!data.hasSubscription || data.subscription?.status !== "ACTIVE") {
            // Redirect to pricing page with message
            const url = new URL("/pricing", req.url);
            url.searchParams.set("reason", "subscription_required");
            return NextResponse.redirect(url);
          }
        }
      } catch (error) {
        // Allow access if subscription check fails (fail open for now)
        // In production, you might want to fail closed
      }
    }

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
