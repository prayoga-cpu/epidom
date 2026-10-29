import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resumeAuthorizePath } from "@/lib/mcp/oauth-flow";

/**
 * GET /oauth/sign-in — the OAuth provider's login page for the Claude
 * connector (see src/lib/mcp/oauth-flow.ts). Signed in: carry on with the
 * authorize request. Not signed in: sign in first and come back here.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const session = await getSession();

  if (!session?.user) {
    // The proxy normally does this before the route runs; this covers a stale
    // cookie that the proxy saw but that no longer matches a session.
    const login = new URL("/login", url);
    login.searchParams.set("callbackUrl", `${url.pathname}${url.search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(resumeAuthorizePath(url.searchParams), url));
}
