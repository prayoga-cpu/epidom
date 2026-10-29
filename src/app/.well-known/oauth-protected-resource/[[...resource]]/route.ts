import { servingAppUrl } from "@/lib/app-url";
import { MCP_SCOPES, mcpResourceUrl } from "@/lib/mcp/config";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for /api/mcp. The 401
 * from /api/mcp points here (…/oauth-protected-resource/api/mcp); Claude reads
 * which authorization server to sign in with and which scopes to ask for.
 * `resource` must equal the connector URL exactly, and the first
 * authorization server is the only one Claude uses.
 */

export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

export function GET(): Response {
  return new Response(
    JSON.stringify({
      resource: mcpResourceUrl(),
      authorization_servers: [`${servingAppUrl()}/api/auth`],
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "Epidom",
    }),
    { status: 200, headers: HEADERS }
  );
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
