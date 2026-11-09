// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { DEMO_READ_ONLY, DEMO_TOKEN_PREFIX } from "@/lib/demo/demo-constants";

const [COOKIE] = sessionCookieNames(undefined);

function call(
  method: string,
  path: string,
  token: string | null,
  headers: Record<string, string> = {}
) {
  const h = new Headers(headers);
  // As the browser sends it: the signed value, URL-encoded once.
  if (token) h.set("cookie", `${COOKIE}=${encodeURIComponent(`${token}.c2lnbmF0dXJl`)}`);
  return proxy(new NextRequest(`http://localhost:3000${path}`, { method, headers: h }));
}

const DEMO = `${DEMO_TOKEN_PREFIX}abc123`;

describe("proxy: the public demo session is read-only", () => {
  it.each([
    ["POST", "/api/stores/s1/orders"],
    ["PUT", "/api/stores/s1/products/p1"],
    ["PATCH", "/api/auth/update-user"],
    ["DELETE", "/api/stores/s1/customers/c1"],
  ])("%s %s is refused with the demo message", async (method, path) => {
    const res = await call(method, path, DEMO);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: DEMO_READ_ONLY.code });
  });

  it("refuses a server action too (a POST to a page with the Next-Action header)", async () => {
    const res = await call("POST", "/store/s1/data", DEMO, { "next-action": "abc" });
    expect(res.status).toBe(403);
  });

  it("lets a demo session read, sign out, send page analytics and subscribe to live updates", async () => {
    for (const [method, path] of [
      ["GET", "/api/stores/s1/products"],
      ["POST", "/api/auth/sign-out"],
      ["POST", "/api/public/tracking-events"],
      ["POST", "/api/pusher/auth"],
    ]) {
      expect((await call(method, path, DEMO)).status, `${method} ${path}`).not.toBe(403);
    }
  });

  it("never touches a real session: the same write goes through", async () => {
    expect((await call("POST", "/api/stores/s1/orders", "realtoken123")).status).not.toBe(403);
    expect((await call("POST", "/api/stores/s1/orders", null)).status).not.toBe(403);
  });

  it("the demo entry route is public, so a signed-out visitor is not sent to the login wall", async () => {
    const res = await call("GET", "/demo/pos", null);
    expect(res.status).not.toBe(307);
  });

  it.each(["/register", "/login", "/stores", "/en", "/en/pricing"])(
    "a demo session that leaves the demo (%s) is ended: cookie cleared, same page served signed out",
    async (path) => {
      const res = await call("GET", path, DEMO);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe(path);
      expect(res.headers.get("set-cookie") ?? "").toMatch(/session_token=;/);
    }
  );

  it("stays signed in while it is inside the demo, and a prefetch never ends it", async () => {
    for (const path of ["/store/s1/pos", "/store/s1/home", "/@your-cafe", "/demo/pos"]) {
      expect((await call("GET", path, DEMO)).status, path).not.toBe(307);
    }
    const prefetch = await call("GET", "/stores", DEMO, { "next-router-prefetch": "1" });
    expect(prefetch.headers.get("set-cookie") ?? "").not.toMatch(/session_token=;/);
  });

  it("leaves a real session alone on the same pages", async () => {
    const res = await call("GET", "/register", "realtoken123");
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/session_token=;/);
  });
});
