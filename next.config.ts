import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year cache for static images
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Performance optimizations
    unoptimized: false,
    loader: "default",
    // Allow images from Vercel Blob Storage
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  // Optimize production builds
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  // Performance optimizations
  experimental: {
    optimizeCss: true,
  },
  // Enable compression
  compress: true,

  // Deployment-skew protection.
  //
  // Every deploy rotates the content hashes under `_next/static/`, so a tab left
  // open across a deploy still points at chunk URLs the new deployment no longer
  // serves — the ChunkLoadError that `src/lib/utils/stale-chunk-reload.ts` catches
  // after the fact. Stamping the build with Vercel's deployment id addresses the
  // cause instead of the symptom: Next appends `?dpl=<id>` to every static asset
  // URL and echoes the id back on RSC navigations, which lets Vercel's Skew
  // Protection route those requests to the deployment that actually produced
  // them, and lets the client degrade to a clean full page load (not a broken
  // chunk fetch) when the ids genuinely diverge.
  //
  // NOTE: Next 16 does NOT read `VERCEL_DEPLOYMENT_ID` on its own — verified
  // against the installed `next/dist/server/config-shared.d.ts`, where
  // `deploymentId` is a plain optional top-level string with no Vercel default —
  // so the wiring has to be explicit here. Guarding on the variable's presence
  // keeps local dev and any non-Vercel host on the previous behaviour: the value
  // is `undefined` there, so no `?dpl=` query strings and no extra headers.
  //
  // The routing half additionally requires "Skew Protection" to be switched on in
  // the Vercel project settings (Settings → Advanced); that is a plan-gated
  // dashboard toggle (Pro/Enterprise) and cannot be set from this file.
  //
  // Hence the gate on VERCEL_SKEW_PROTECTION_ENABLED rather than setting this
  // unconditionally. Vercel injects that variable as "1" only when the toggle is
  // actually on, so the two halves can never drift apart. This matters because
  // setting `deploymentId` while the platform side is OFF is strictly negative:
  // Next appends `?dpl=<id>` to every `_next/static` URL, Vercel ignores it and
  // serves the latest deployment anyway (so it fixes no skew), and meanwhile the
  // query string changes on every deploy — which, since Cache Storage keys on the
  // full URL, makes the service worker re-download and re-store a duplicate copy
  // of the entire static bundle each release. All of the cost, none of the fix.
  //
  // On this account today the toggle is off (Hobby plan), so this resolves to
  // `undefined` and the client-side recovery in src/lib/utils/stale-chunk-reload.ts
  // is what catches a deploy landing under an open tab. The day the plan is
  // upgraded and the toggle is flipped, this activates on the next deploy with no
  // code change. See the Developer / Operator To-Do list in STATUS.md.
  deploymentId:
    process.env.VERCEL_SKEW_PROTECTION_ENABLED === "1"
      ? process.env.VERCEL_DEPLOYMENT_ID
      : undefined,

  // Security Headers for production
  headers: async () => [
    {
      // Apply to all routes
      source: "/:path*",
      headers: [
        // Prevent clickjacking attacks
        { key: "X-Frame-Options", value: "DENY" },
        // Prevent MIME type sniffing
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Control referrer information
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Restrict browser features
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        // XSS Protection (legacy browsers)
        { key: "X-XSS-Protection", value: "1; mode=block" },
      ],
    },
    {
      // Stricter CSP for API routes
      source: "/api/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ],
    },
  ],
};

export default nextConfig;
