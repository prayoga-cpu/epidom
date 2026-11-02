import { afterEach, describe, expect, it, vi } from "vitest";
import { authBaseUrl, configuredAppUrl, servingAppUrl } from "../app-url";

/**
 * Better Auth's base URL is the OAuth issuer the Claude connector advertises,
 * so it must be the host that answers without the apex → www redirect, even
 * when BETTER_AUTH_URL overrides the configured URL.
 */
afterEach(() => vi.unstubAllEnvs());

describe("app URLs", () => {
  it("serves the production apex from www, everything else as configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://epidom.fr/");
    expect(configuredAppUrl()).toBe("https://epidom.fr");
    expect(servingAppUrl()).toBe("https://www.epidom.fr");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(servingAppUrl()).toBe("http://localhost:3000");
  });

  it("uses BETTER_AUTH_URL as the auth base when set, still served from www", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://epidom.fr");
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(authBaseUrl()).toBe("https://www.epidom.fr");
    vi.stubEnv("BETTER_AUTH_URL", "https://epidom.fr//");
    expect(authBaseUrl()).toBe("https://www.epidom.fr");
    vi.stubEnv("BETTER_AUTH_URL", "https://dev.epidom.fr");
    expect(authBaseUrl()).toBe("https://dev.epidom.fr");
  });
});
