import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildRequestMeta } from "@/lib/audit/request-meta";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { MCP_PATH, MCP_SCOPES, mcpResourceUrl } from "@/lib/mcp/config";
import { readBearerToken, resolveMcpPrincipal } from "@/lib/mcp/principal";
import { createMcpServer } from "@/lib/mcp/server";
import { servingAppUrl } from "@/lib/app-url";

/**
 * The Claude connector: a remote MCP server (Streamable HTTP, stateless JSON
 * responses) that a user's own Claude calls with an OAuth access token issued
 * by Epidom (src/lib/auth.ts, oauthProvider). Design and tool catalog:
 * docs/MCP.md.
 */

export const dynamic = "force-dynamic";
// A tool call is a few queries; finance summaries are the slowest. Claude
// itself gives up after 240 s.
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The 401 that starts Claude's sign-in: it must carry the protected resource
 * metadata location (RFC 9728) and the scopes to ask for.
 */
function unauthorized(description: string): Response {
  const metadataUrl = `${servingAppUrl()}/.well-known/oauth-protected-resource${MCP_PATH}`;
  return withCors(
    new Response(JSON.stringify({ error: "invalid_token", error_description: description }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}", scope="${MCP_SCOPES.join(" ")}"`,
      },
    })
  );
}

async function handle(request: Request): Promise<Response> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return unauthorized("Sign in to Epidom to use this connector.");

  let principal: Awaited<ReturnType<typeof resolveMcpPrincipal>>;
  try {
    principal = await resolveMcpPrincipal(token);
  } catch (error) {
    // The database, not the token: say "try again", never "sign in again".
    console.error("[mcp] token lookup failed:", error);
    return withCors(
      new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "5" },
      })
    );
  }
  if (!principal) return unauthorized("The Epidom sign-in has expired or was revoked.");

  const limit = await checkRateLimit(`user:${principal.userId}`, MCP_PATH);
  if (!limit.success) {
    return withCors(
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))),
        },
      })
    );
  }

  const meta = buildRequestMeta(request);
  const server = await createMcpServer({
    principal,
    meta: { ...meta, userAgent: `Claude connector (${principal.clientName ?? "MCP client"})` },
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: every request is self-contained, so any serverless
    // instance can answer it and nothing is kept between requests.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      authInfo: {
        token,
        clientId: principal.clientId,
        scopes: principal.scopes,
        resource: new URL(mcpResourceUrl()),
        extra: { userId: principal.userId },
      },
    });
    return withCors(response);
  } finally {
    await server.close().catch(() => undefined);
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
