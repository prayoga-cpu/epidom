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
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
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
