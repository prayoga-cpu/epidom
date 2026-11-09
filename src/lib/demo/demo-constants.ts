/**
 * Import-free constants for the public demo (src/lib/demo/demo-cafe.ts), shared
 * with src/proxy.ts, which must not load Prisma.
 */

/** Every demo session token starts with this: the cookie IS the session, so it cannot be dropped to write. */
export const DEMO_TOKEN_PREFIX = "demo_";

/** The demo is read-only: what a blocked write answers. */
export const DEMO_READ_ONLY = {
  code: "DEMO_READ_ONLY",
  message:
    "This is a read-only demo: nothing can be changed. Start your free trial to try it for real.",
} as const;

/** The public demo storefront's link: epidom.fr/@your-cafe. */
export const DEMO_SLUG = "your-cafe";

/** Writes a demo session may still make: signing out, anonymous page analytics, and live-update subscriptions. */
export const DEMO_WRITE_ALLOWLIST: readonly string[] = [
  "/api/auth/sign-out",
  "/api/public/tracking-events",
  // Realtime channel auth: it grants a subscription (live orders), it changes nothing.
  "/api/pusher/auth",
];
