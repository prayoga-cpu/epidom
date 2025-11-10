import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Authentication & Subscription Middleware
 *
 * Protects routes defined in matcher configuration.
 * - Redirects unauthenticated users to /login
 * - Checks subscription status for dashboard access
 * - Redirects users with inactive subscriptions to /billing
 *
 * Protected routes are configured below in the matcher array.
 */
export default withAuth(
  async function middleware(req: NextRequest & { nextauth?: { token?: any } }) {
    const token = req.nextauth?.token;
    const path = req.nextUrl.pathname;

    // Allow access to billing page, pricing, and payment pages without subscription check
    const allowedPaths = ["/billing", "/pricing", "/payments", "/profile"];
    const isAllowedPath = allowedPaths.some((allowedPath) => path.includes(allowedPath));

    if (isAllowedPath) {
      return NextResponse.next();
    }

    // Check if accessing dashboard routes (requires active subscription)
    const isDashboardRoute =
      path.includes("/dashboard") ||
      path.includes("/tracking") ||
      path.includes("/data") ||
      path.includes("/management") ||
      path.includes("/alerts") ||
      path.includes("/stores");

    if (isDashboardRoute && token?.sub) {
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
          if (!data.hasSubscription || data.subscription?.status !== "ACTIVE") {
            // Redirect to subscribe required page
            const url = new URL("/subscribe-required", req.url);
            return NextResponse.redirect(url);
          }
        }
      } catch (error) {
        console.error("[Middleware] Error checking subscription:", error);
        // Allow access if subscription check fails (fail open for now)
        // In production, you might want to fail closed
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

/**
 * Middleware matcher configuration
 *
 * List all protected routes that require authentication.
 * To add a new protected route, add it to this array.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/management/:path*",
    "/tracking/:path*",
    "/data/:path*",
    "/alerts/:path*",
    "/stores/:path*",
    "/billing/:path*", // Billing page requires auth but not active subscription
  ],
};
