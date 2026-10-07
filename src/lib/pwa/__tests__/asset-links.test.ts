import { describe, it, expect } from "vitest";
import { buildAssetLinks, DEFAULT_ANDROID_PACKAGE_NAME } from "../asset-links";

const FP_A = Array.from({ length: 32 }, (_, i) => (i % 16).toString(16).repeat(2)).join(":");
const FP_B = Array.from({ length: 32 }, () => "AB").join(":");

describe("buildAssetLinks", () => {
  it("publishes nothing until a fingerprint is configured", () => {
    expect(buildAssetLinks({})).toEqual([]);
    expect(buildAssetLinks({ ANDROID_TWA_SHA256_FINGERPRINTS: "" })).toEqual([]);
  });

  it("vouches for the app's package and every configured certificate", () => {
    const [statement] = buildAssetLinks({
      ANDROID_TWA_SHA256_FINGERPRINTS: ` ${FP_A.toLowerCase()} , ${FP_B} `,
    });
    expect(statement.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(statement.target.package_name).toBe(DEFAULT_ANDROID_PACKAGE_NAME);
    expect(statement.target.sha256_cert_fingerprints).toEqual([FP_A.toUpperCase(), FP_B]);
  });

  it("drops malformed fingerprints and honors a package override", () => {
    const [statement] = buildAssetLinks({
      ANDROID_TWA_PACKAGE_NAME: "com.example.pos",
      ANDROID_TWA_SHA256_FINGERPRINTS: `nope,${FP_B}`,
    });
    expect(statement.target.package_name).toBe("com.example.pos");
    expect(statement.target.sha256_cert_fingerprints).toEqual([FP_B]);
  });
});
