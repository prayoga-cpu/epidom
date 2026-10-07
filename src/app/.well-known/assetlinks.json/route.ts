import { NextResponse } from "next/server";
import { buildAssetLinks } from "@/lib/pwa/asset-links";

/**
 * Digital Asset Links for the Android app (a Trusted Web Activity built from
 * this site — see docs/OFFLINE_POS.md). Android only opens the app full-screen,
 * without a browser address bar, once this file vouches for the app's package
 * name and signing certificate. Until the operator sets
 * ANDROID_TWA_SHA256_FINGERPRINTS it answers `[]`: a valid file that associates
 * nothing.
 */
export function GET() {
  // The two variables by name, not `process.env` itself: Next's build-time
  // type check rejects ProcessEnv against this all-optional parameter ("no
  // properties in common"), which failed the 3.8.0 production build.
  const env = {
    ANDROID_TWA_PACKAGE_NAME: process.env.ANDROID_TWA_PACKAGE_NAME,
    ANDROID_TWA_SHA256_FINGERPRINTS: process.env.ANDROID_TWA_SHA256_FINGERPRINTS,
  };
  return NextResponse.json(buildAssetLinks(env), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
