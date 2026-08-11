import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { setRequestId } from "./lib/request-context";
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  LOCALE_REDIRECT_COOKIE,
  LOCALE_PREF_COOKIE,
  stripLocalePrefix,
  getLocalizedPath,
  detectLocaleFromAcceptLanguage,
  isLikelyBot,
} from "./lib/i18n-routing";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE, isResumableAppPath } from "./lib/last-visited";

// Next 16's App Router marks a client-side navigation with the `rsc: 1`
// request header, adds `next-router-prefetch: 1` when it's only warming the
// cache, and appends a `_rsc=<hash>` cache-busting search param. Mirrored
// here as plain string literals rather than imported from
// next/dist/client/components/app-router-headers — that module is internal
// and not part of the public export surface.
const RSC_PREFETCH_HEADER = "next-router-prefetch";
const RSC_UNION_QUERY = "_rsc";

/**
 * Next 16 has NO special way for middleware to answer an RSC navigation with
 * a redirect: `x-nextjs-redirect` (see next/dist/server/web/adapter) is only
 * emitted for Pages-Router data requests, and App Router redirects travel as
 * an ordinary 3xx + `Location`. The router's own fetch() follows it, and
 * soft-navigates *only* if the followed response is a 2xx Flight payload —
 * otherwise it falls back to a full browser reload, which is exactly the
 * "had to reload the page" symptom being chased here. Two things therefore
 * have to hold for every redirect this proxy emits:
 *
 *  1. the destination must be a real App Router route (so the retry produces
 *     a Flight payload rather than a 404), and
 *  2. the response must never be cached anywhere — its destination depends
 *     entirely on the request's cookies, so a CDN or browser replaying it
 *     for a different session, or for the HTML request after the RSC one,
 *     sends someone to another user's page.
 *
 * `Vary` names the request dimensions that actually change the answer, so an
 * intermediary that ignores `no-store` still can't cross the wires.
 */
function markRedirectUncacheable(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set(
    "Vary",
    "Cookie, RSC, Next-Router-Prefetch, Next-Router-State-Tree, Next-Url"
  );
  return response;
}

// Marketing base paths (unprefixed) eligible for /id and /en locale
// rewriting — see src/lib/i18n-routing.ts. /compare/* is prefix-matched
// since it's an open-ended set of comparison pages.
const LOCALIZED_MARKETING_PATHS = new Set([
  "/",
  "/pricing",
  "/about",
  "/services",
  "/payments",
  "/contact",
  "/partners",
  "/careers",
  "/press",
  "/blog",
  "/docs",
  "/build-with-us",
  "/changelog",
  "/status",
  "/terms",
  "/privacy",
  "/gdpr",
  "/cookie-policy",
  "/refund-policy",
]);

/**
 * Marketing pages the resume-redirect must never fire on, because the app
 * itself sends signed-in users to them on purpose.
 *
 * `/pricing` is the dangerous one, and it is a hard infinite loop rather than
 * a cosmetic annoyance. `upgradeHrefFor` (src/lib/plans/entitlements.ts) points
 * every plan gate at `/pricing`, so: a merchant whose plan lapsed opens the app
 * -> resume redirects to their remembered `/store/{id}/finance` -> that route's
 * `requirePlan` redirects to `/pricing?upgrade=true` -> `/pricing` is a
 * marketing path, so resume fires again and sends them back to `/finance` ->
 * `requirePlan` bounces them to `/pricing` again. The browser gives up with
 * ERR_TOO_MANY_REDIRECTS, and the one page that could sell them the upgrade
 * is the exact page they can never reach.
 *
 * `/checkout` is exempt for the same structural reason: it is a destination
 * the app navigates to deliberately, mid-flow, with money involved.
 */
const RESUME_EXEMPT_PATHS = new Set(["/pricing", "/checkout"]);

/**
 * Query params that mark a marketing URL as somewhere the app sent the user
 * on purpose. Belt-and-braces alongside RESUME_EXEMPT_PATHS: a future upgrade
 * destination that isn't `/pricing` still won't become a redirect trap.
 */
const INTENT_QUERY_PARAMS = ["upgrade", "trial", "required", "callbackUrl", "checkout"];

/**
 * Whether the resume-redirect should stand down for this request. Deliberate
 * arrivals — an upgrade prompt, a checkout hand-off, anything carrying intent
 * in its query string — must win over "put me back where I was".
 */
function isResumeExemptPath(basePath: string, req: NextRequest): boolean {
  if (RESUME_EXEMPT_PATHS.has(basePath)) return true;
  for (const path of RESUME_EXEMPT_PATHS) {
    if (basePath.startsWith(`${path}/`)) return true;
  }
  return INTENT_QUERY_PARAMS.some((param) => req.nextUrl.searchParams.has(param));
}

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

  // Skip entirely for API routes - they handle authentication internally
  if (path.startsWith("/api/")) {
    const apiResponse = NextResponse.next();
    apiResponse.headers.set("x-request-id", requestId);
    setRequestId(requestId);
    return apiResponse;
  }

  // Resolve locale from the URL (/, /id/*, /en/* — fr is the default/
  // unprefixed market, see docs/STRATEGY.md §3) up front, so the public-route
  // check below matches on the unprefixed path regardless of locale prefix.
  const { locale, basePath } = stripLocalePrefix(path);
  // /compare/*, /blog/*, /docs/* are open-ended sets of pages (comparison
  // pages, blog posts, docs guides) — prefix-matched so a new one doesn't
  // require a proxy change, unlike the fixed single-page routes above.
  const isLocalizedMarketingPath =
    LOCALIZED_MARKETING_PATHS.has(basePath) ||
    basePath.startsWith("/compare") ||
    basePath.startsWith("/blog/") ||
    basePath.startsWith("/docs");

  // Resume a signed-in returning visitor straight to their last app page
  // instead of showing marketing content — checked here, before any
  // locale-routing logic below, so it fires on every marketing page (not
  // just "/") and never renders a page only to redirect away from it a
  // moment later (see LastVisitedTracker, which is what keeps these two
  // cookies current; this proxy only ever reads them).
  //
  // Skipped for prefetches: the App Router warms marketing links (the logo,
  // the footer) from inside the dashboard, and answering a prefetch of "/"
  // with a redirect would quietly fill the router cache for the marketing URL
  // with app content the visitor never asked to navigate to.
  const isPrefetchRequest = req.headers.get(RSC_PREFETCH_HEADER) === "1";
  if (isLocalizedMarketingPath && !isPrefetchRequest && !isResumeExemptPath(basePath, req)) {
    const remember = req.cookies.get(REMEMBER_PREF_COOKIE)?.value;
    const rawLastVisited = req.cookies.get(LAST_VISITED_COOKIE)?.value;
    if (remember === "true" && rawLastVisited) {
      let lastVisited: string | null = null;
      try {
        lastVisited = decodeURIComponent(rawLastVisited);
      } catch {
        lastVisited = null;
      }
      // isResumableAppPath, not just isSafeRedirectTarget: "starts with /" is
      // satisfied just as happily by a store that was sold last month or a
      // section deleted in a refactor, and either one turns "open the app"
      // into a 404. Cookies outlive routes — the shape has to be re-checked
      // against the routes that exist today, every time.
      if (lastVisited && isResumableAppPath(lastVisited)) {
        return markRedirectUncacheable(NextResponse.redirect(new URL(lastVisited, req.url)));
      }
    }
  }

  // Create a response object to modify headers later if needed
  const response = NextResponse.next();

  // Set request ID in response headers (works in Edge Runtime)
  // This allows request ID to be accessed in API routes and other handlers
  response.headers.set("x-request-id", requestId);

  // Try to set in global context (only works in Node.js runtime, not Edge Runtime)
  // This is safe - setRequestId checks if global is available
  setRequestId(requestId);

  // PUBLIC ROUTES - Always accessible without authentication
  // Marketing pages and auth pages should never be blocked
  const publicRoutes = [
    "/", // Home page
    "/services",
    "/pricing",
    "/contact",
    "/payments",
    "/about",
    "/partners",
    "/careers",
    "/press",
    "/blog", // /blog/* posts too, via startsWith
    "/docs", // /docs/* guides too, via startsWith
    "/build-with-us",
    "/changelog",
    "/status",
    "/compare", // /compare/* comparison pages
    "/terms",
    "/privacy",
    "/gdpr",
    "/cookie-policy",
    "/refund-policy",
    "/login",
    "/register",
    "/checkout/success",
    "/checkout/failed",
    "/onboarding", // Card validation step
    "/forgot-password",
    "/reset-password",
  ];

  // Check if current path is a public route — matched against basePath so
  // /id/about and /en/pricing are recognized the same as /about and /pricing.
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === "/") {
      return basePath === "/";
    }
    return basePath.startsWith(route);
  });

  // Also allow public storefront routes which start with /@
  const isStorefrontRoute = basePath.startsWith("/@");

  // Public digital receipt page (/r/[orderId]) — same trust model as
  // storefront routes: an unguessable cuid is the only gate, no session
  // required. This is the page the customer-facing WhatsApp receipt link
  // and the POS/storefront "View Receipt" actions point to.
  const isReceiptRoute = basePath.startsWith("/r/");

  // If it's a public route, storefront route, or receipt route, allow access
  // without authentication — attaching/rewriting for locale first.
  if (isPublicRoute || isStorefrontRoute || isReceiptRoute) {
    if (!isLocalizedMarketingPath) {
      return response;
    }
    // Locale must travel as a REQUEST header (not a response header) to be
    // readable via headers() in the (marketing) layout Server Component —
    // see src/app/(marketing)/layout.tsx.
    const localizedRequestHeaders = new Headers(req.headers);
    localizedRequestHeaders.set(LOCALE_HEADER, locale);
    localizedRequestHeaders.set("x-request-id", requestId);

    if (locale === DEFAULT_LOCALE) {
      // A visitor who has explicitly picked a language via LangSwitcher
      // outranks everything below — their own choice should keep winning on
      // every future unprefixed visit (bookmark, logo click, bare domain),
      // not just the page it was made on. Never for crawlers, same
      // reasoning as the Accept-Language guess below.
      const explicitChoice = req.cookies.get(LOCALE_PREF_COOKIE)?.value;
      if (!isLikelyBot(req.headers.get("user-agent"))) {
        if (explicitChoice === "id" || explicitChoice === "en") {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = getLocalizedPath(basePath, explicitChoice);
          return NextResponse.redirect(redirectUrl);
        }
        if (explicitChoice === DEFAULT_LOCALE) {
          // Explicitly chose fr — stay, and skip the Accept-Language guess
          // below entirely; it would otherwise second-guess a deliberate
          // pick for a browser whose language isn't French.
          return NextResponse.next({ request: { headers: localizedRequestHeaders } });
        }
      }

      // First-time visitor on the unprefixed (fr) site: offer to switch to
      // /en or /id based on browser language, once. Never for crawlers —
      // they must always see the canonical fr content at "/" (Google's own
      // guidance against language/geo auto-redirects breaking crawlability
      // — see isLikelyBot) — and never a second time for the same visitor
      // (LOCALE_REDIRECT_COOKIE), so it doesn't fight someone who
      // deliberately navigates back to the French pages afterwards.
      const alreadyDecided = req.cookies.has(LOCALE_REDIRECT_COOKIE);
      const cookieOpts = { maxAge: 60 * 60 * 24 * 365, path: "/" };
      if (!alreadyDecided && !isLikelyBot(req.headers.get("user-agent"))) {
        const detected = detectLocaleFromAcceptLanguage(req.headers.get("accept-language"));
        if (detected !== DEFAULT_LOCALE) {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = getLocalizedPath(basePath, detected);
          const redirectResponse = NextResponse.redirect(redirectUrl);
          redirectResponse.cookies.set(LOCALE_REDIRECT_COOKIE, "1", cookieOpts);
          return redirectResponse;
        }
        // Detected fr (or nothing useful) — stay, but remember the
        // decision so we don't re-parse Accept-Language on every request.
        const frResponse = NextResponse.next({ request: { headers: localizedRequestHeaders } });
        frResponse.cookies.set(LOCALE_REDIRECT_COOKIE, "1", cookieOpts);
        return frResponse;
      }
      // fr has no prefix, so the path already resolves to the right route.
      return NextResponse.next({ request: { headers: localizedRequestHeaders } });
    }
    // /id and /en: browser keeps the prefixed URL, rewritten internally to
    // the unprefixed route (no [locale] segment/folder exists — see
    // src/lib/i18n-routing.ts for why).
    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = basePath;
    return NextResponse.rewrite(rewriteUrl, { request: { headers: localizedRequestHeaders } });
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
    // Preserve the original URL as callbackUrl so user can return after login.
    // The real query string travels with it (a deep link into a filtered view
    // is worth keeping) minus `_rsc` — that value is a hash of the RSC request
    // that happened to trip this redirect, and echoing it back into a URL the
    // browser will later navigate to as HTML makes Next treat a page request
    // as a stale Flight request.
    const callbackParams = new URLSearchParams(req.nextUrl.search);
    callbackParams.delete(RSC_UNION_QUERY);
    const callbackQuery = callbackParams.toString();
    loginUrl.searchParams.set("callbackUrl", callbackQuery ? `${path}?${callbackQuery}` : path);

    // An RSC navigation needs nothing else from us: it re-requests /login with
    // the RSC header still attached (fetch keeps headers across a same-origin
    // redirect), /login is a real App Router page, so a Flight payload comes
    // back and the navigation stays soft. What breaks that is a cached or
    // dirty redirect, both handled above — see markRedirectUncacheable for why
    // there is no RSC-specific redirect header to set in Next 16.
    return markRedirectUncacheable(NextResponse.redirect(loginUrl));
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
     * - sw.js (service worker — must be fetchable by anonymous storefront
     *   visitors too, or registration fails for anyone without a session
     *   cookie, breaking PWA installability and push notifications)
     * - manifest.webmanifest (PWA manifest, same reasoning)
     * - offline.html (public/offline.html, the service worker's offline
     *   fallback page). It MUST stay anonymously fetchable: the SW precaches
     *   it at install time, and install runs on the storefront too, where
     *   there is no session cookie. Auth-redirect it and every install would
     *   cache the /login page under the name "offline.html" and show a login
     *   screen the moment the wifi drops mid-shift)
     * - sitemap.xml, robots.txt (Next.js-generated from src/app/sitemap.ts
     *   and robots.ts — crawlers don't carry a session cookie, so these
     *   must never hit the auth-redirect below)
     * - llms.txt (public/llms.txt, same crawler-facing reasoning)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|sitemap.xml|robots.txt|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml)$).*)",
  ],
};
