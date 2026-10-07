/** The Android app's package name unless the operator overrides it. */
export const DEFAULT_ANDROID_PACKAGE_NAME = "fr.epidom.pos";

/** Uppercase hex pairs joined by colons — what Play Console and keytool print. */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

/**
 * The `/.well-known/assetlinks.json` body. Fingerprints come comma-separated
 * from ANDROID_TWA_SHA256_FINGERPRINTS — usually two: the upload key's, and Play
 * App Signing's (Play re-signs the app, so its key is the one devices see).
 * Anything malformed is dropped rather than published.
 */
export function buildAssetLinks(env: {
  ANDROID_TWA_PACKAGE_NAME?: string;
  ANDROID_TWA_SHA256_FINGERPRINTS?: string;
}): AssetLinkStatement[] {
  const fingerprints = (env.ANDROID_TWA_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
  if (fingerprints.length === 0) return [];

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: env.ANDROID_TWA_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
