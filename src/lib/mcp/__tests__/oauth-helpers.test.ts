import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { admitLocalhostPort } from "../loopback-redirect";
import { redirectHost, resumeAuthorizePath } from "../oauth-flow";
import { configuredAppUrl, servingAppUrl } from "@/lib/app-url";
import { maskEmail, maskPhone } from "../tools/customers";

describe("admitLocalhostPort (Claude Code's per-session callback port)", () => {
  const registered = ["https://claude.ai/api/mcp/auth_callback", "http://localhost:3118/callback"];

  it("admits the same localhost callback on a new port, replacing the old port", () => {
    expect(admitLocalhostPort(registered, "http://localhost:51234/callback")).toEqual([
      "https://claude.ai/api/mcp/auth_callback",
      "http://localhost:51234/callback",
    ]);
  });

  it("changes nothing for an exact match", () => {
    expect(admitLocalhostPort(registered, "http://localhost:3118/callback")).toBeNull();
  });

  it("never admits another path, scheme or host", () => {
    expect(admitLocalhostPort(registered, "http://localhost:51234/other")).toBeNull();
    expect(admitLocalhostPort(registered, "https://localhost:51234/callback")).toBeNull();
    expect(admitLocalhostPort(registered, "http://evil.example:3118/callback")).toBeNull();
    expect(
      admitLocalhostPort(["https://claude.ai/api/mcp/auth_callback"], "http://localhost:1/callback")
    ).toBeNull();
  });
});

describe("resumeAuthorizePath", () => {
  it("drops the signature parameters and keeps the authorize request", () => {
    const query = new URLSearchParams({
      response_type: "code",
      client_id: "abc",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_challenge: "xyz",
      code_challenge_method: "S256",
      state: "s1",
      sig: "signature",
      exp: "123",
      ba_iat: "1",
      ba_pl: "x",
    });
    query.append("ba_param", "client_id");
    const path = resumeAuthorizePath(query);
    const params = new URL(path, "https://www.epidom.fr").searchParams;
    expect(path.startsWith("/api/auth/oauth2/authorize?")).toBe(true);
    for (const name of ["sig", "exp", "ba_iat", "ba_pl", "ba_param"])
      expect(params.has(name)).toBe(false);
    expect(params.get("redirect_uri")).toBe("https://claude.ai/api/mcp/auth_callback");
    expect(params.get("code_challenge")).toBe("xyz");
  });

  it("removes the login prompt that sent the visitor here, so it can't loop", () => {
    const only = new URL(resumeAuthorizePath(new URLSearchParams({ prompt: "login" })), "https://x")
      .searchParams;
    expect(only.has("prompt")).toBe(false);
    const mixed = new URL(
      resumeAuthorizePath(new URLSearchParams({ prompt: "login consent" })),
      "https://x"
    ).searchParams;
    expect(mixed.get("prompt")).toBe("consent");
  });
});

describe("redirectHost", () => {
  it("shows only the host the person will be sent to", () => {
    expect(redirectHost("https://claude.ai/api/mcp/auth_callback")).toBe("claude.ai");
    expect(redirectHost("http://localhost:3118/callback")).toBe("localhost:3118");
    expect(redirectHost("not a url")).toBeNull();
    expect(redirectHost(undefined)).toBeNull();
  });
});

describe("servingAppUrl", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("uses www for the production apex, which only redirects", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://epidom.fr/";
    expect(configuredAppUrl()).toBe("https://epidom.fr");
    expect(servingAppUrl()).toBe("https://www.epidom.fr");
  });

  it("keeps every other host as it is", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.epidom.fr";
    expect(servingAppUrl()).toBe("https://dev.epidom.fr");
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(servingAppUrl()).toBe("http://localhost:3000");
  });
});

describe("customer contact masking", () => {
  it("keeps only enough to recognise the contact", () => {
    expect(maskPhone("+628123456789")).toBe("•••••••••6789");
    expect(maskPhone("123")).toBe("••••");
    expect(maskPhone(null)).toBeNull();
    expect(maskEmail("budi@example.com")).toBe("b•••@example.com");
    expect(maskEmail(null)).toBeNull();
  });
});
