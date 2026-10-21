import { describe, it, expect } from "vitest";
import nextConfig from "../../../next.config";

describe("Permissions-Policy header", () => {
  it("lets our own pages use the camera and location (attendance selfie + clock-in location)", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const policies = rules
      .flatMap((rule) => rule.headers)
      .filter((header) => header.key.toLowerCase() === "permissions-policy")
      .map((header) => header.value);

    expect(policies.length).toBeGreaterThan(0);
    for (const value of policies) {
      // "camera=()" silently disables getUserMedia on every page, prompt included.
      expect(value).toMatch(/(^|,\s*)camera=\(self\)/);
      expect(value).toMatch(/(^|,\s*)geolocation=\(self\)/);
    }
  });
});
