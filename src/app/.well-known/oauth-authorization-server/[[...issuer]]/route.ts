import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414) for the Claude
 * connector. The issuer is Better Auth's base path (…/api/auth), so the spec
 * location is /.well-known/oauth-authorization-server/api/auth; the bare path
 * answers too, for clients that try the root first.
 */

export const dynamic = "force-dynamic";

const metadata = oauthProviderAuthServerMetadata(auth, {
  headers: { "Access-Control-Allow-Origin": "*" },
});

export function GET(request: Request): Promise<Response> {
  return metadata(request);
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
