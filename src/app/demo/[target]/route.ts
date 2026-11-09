import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { DEMO_TOKEN_PREFIX } from "@/lib/demo/demo-constants";
import { ensureDemoCafe } from "@/lib/demo/demo-cafe";
import { createDemoSession } from "@/lib/demo/demo-session";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

/**
 * GET /demo/phone-orders | /demo/pos | /demo/dashboard
 *
 * The home page's "No login, live demo" links (each opens in a new tab).
 * Makes sure the shared demo café exists and is fresh, then:
 *  - phone-orders: its public storefront (epidom.fr/@your-cafe), no session;
 *  - pos / dashboard: starts a read-only session on the demo account (see
 *    src/lib/demo/) and goes to the till or the dashboard.
 *
 * A visitor who is already signed in is never switched into the demo (that
 * would sign them out of their own account): they land on their store list.
 */
export async function GET(request: Request, { params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const base = new URL(request.url);

  const limited = await rateLimitMiddleware(request, "/demo");
  if (limited && !limited.success) {
    return new NextResponse("Too many demo visits. Try again in a minute.", { status: 429 });
  }

  // "Close the demo" (and "Start free") on the demo frame: end the demo session
  // and go back to the website (or on to sign-up).
  if (target === "exit") {
    const to = new URL(request.url).searchParams.get("to") === "register" ? "/register" : "/";
    const response = NextResponse.redirect(new URL(to, base), 302);
    const [plain, secure] = sessionCookieNames(process.env.VERCEL_ENV);
    const raw = request.headers
      .get("cookie")
      ?.split(/;\s*/)
      .map((c) => c.split("="))
      .find(([name]) => name === plain || name === secure)?.[1];
    const token = raw ? decodeURIComponent(raw).split(".")[0] : "";
    // Only ever a demo session: a real visitor's session is left alone.
    if (token.startsWith(DEMO_TOKEN_PREFIX)) {
      await prisma.session.deleteMany({ where: { token } });
      for (const name of [plain, secure]) response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (target !== "phone-orders" && target !== "pos" && target !== "dashboard") {
    return NextResponse.redirect(new URL("/", base), 302);
  }

  let storeId: string;
  let userId: string;
  try {
    ({ storeId, userId } = await ensureDemoCafe());
  } catch (error) {
    console.error("[DEMO_ENTRY_ERROR]", error);
    return NextResponse.redirect(new URL("/", base), 302);
  }

  if (target === "phone-orders") {
    return NextResponse.redirect(new URL("/demo/view/phone-orders", base), 302);
  }

  // The live app inside the demo window (src/app/demo/view/[target]/page.tsx).
  const destination = `/demo/view/${target}?s=${storeId}`;
  const [plain, secure] = sessionCookieNames(process.env.VERCEL_ENV);
  const cookie = (name: string) =>
    request.headers
      .get("cookie")
      ?.split(/;\s*/)
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  const existing = cookie(plain) ?? cookie(secure);
  if (existing) {
    const isDemo = decodeURIComponent(existing).startsWith(DEMO_TOKEN_PREFIX);
    return NextResponse.redirect(new URL(isDemo ? destination : "/stores", base), 302);
  }

  const session = await createDemoSession(userId, {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });
  const response = NextResponse.redirect(new URL(destination, base), 302);
  response.cookies.set(session.cookieName, session.value, session.options);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
