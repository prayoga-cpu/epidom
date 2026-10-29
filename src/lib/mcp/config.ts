import { servingAppUrl } from "@/lib/app-url";

/**
 * Fixed facts about the Claude connector, shared by the OAuth provider
 * (src/lib/auth.ts), the discovery documents under /.well-known and the MCP
 * route. Client-safe: no server imports.
 */

/** Reading anything the account can see in Epidom. Every token has it. */
export const MCP_SCOPE_READ = "epidom:read";
/** Changing data. Optional on the consent screen; write tools require it. */
export const MCP_SCOPE_WRITE = "epidom:write";

export const MCP_SCOPES = [MCP_SCOPE_READ, MCP_SCOPE_WRITE] as const;

/** OAuth scopes the provider accepts: ours plus refresh tokens. */
export const OAUTH_PROVIDER_SCOPES = ["offline_access", ...MCP_SCOPES];

export const MCP_PATH = "/api/mcp";

/** Where the authorize step sends a visitor who must sign in first. */
export const OAUTH_SIGN_IN_PAGE = "/oauth/sign-in";
/** Where the authorize step asks the account what Claude may do. */
export const OAUTH_CONSENT_PAGE = "/oauth/consent";

/**
 * The connector URL people paste into Claude, which is also the OAuth
 * resource (token audience). Always the host that serves without a redirect:
 * Claude drops the Authorization header on a cross-host redirect.
 */
export function mcpResourceUrl(): string {
  return `${servingAppUrl()}${MCP_PATH}`;
}
