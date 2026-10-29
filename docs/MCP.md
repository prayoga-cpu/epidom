# Claude connector (remote MCP server)

An Epidom user connects **their own Claude** (claude.ai web, desktop or mobile, or Claude Code) to
their Epidom login. Claude can then read and change the store's data through tools.

The user's Claude plan pays for all model inference. Epidom only answers tool calls (database
queries). Claude has no MCP *sampling*, so Epidom's own screens cannot borrow the user's Claude: the
AI work happens in the Claude chat.

- **Connector URL:** `https://www.epidom.fr/api/mcp`. Always use the www host: the apex 308-redirects,
  and Claude drops the `Authorization` header on a cross-host redirect.
- **Plan:** Enterprise only (`FEATURE_MIN_PLAN.claudeConnector`). The plan is checked on every tool
  call against the store's plan.
- **Who can connect:** any Epidom login. That means owners, and linked staff accounts limited to
  their role and page grants.
- **Code:** `src/lib/mcp/`. The route is `src/app/api/mcp/route.ts`, and the OAuth pieces live in
  `src/lib/auth.ts` (`oauthProvider`).

## Authentication

Epidom is the OAuth 2.1 authorization server, through `@better-auth/oauth-provider` (pinned to the
same 1.6.x as `better-auth`).

| Step | Where |
|---|---|
| A call without a valid token gets `401` + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp", scope="epidom:read epidom:write"` | `src/app/api/mcp/route.ts` |
| Protected-resource metadata (RFC 9728). `resource` must equal the connector URL | `src/app/.well-known/oauth-protected-resource/[[...resource]]/route.ts` |
| Authorization-server metadata (RFC 8414) at `/.well-known/oauth-authorization-server/api/auth` | `src/app/.well-known/oauth-authorization-server/[[...issuer]]/route.ts` |
| Claude registers itself through dynamic client registration (public client, PKCE S256). Each connection creates a new `oauth_client` row | plugin `/api/auth/oauth2/register` |
| A visitor without a session goes to `/oauth/sign-in`, which goes to `/login?callbackUrl=…` and back, then resumes the authorize request | `src/app/(app)/(auth)/oauth/sign-in/route.ts`, `src/lib/mcp/oauth-flow.ts` |
| Consent screen: the app name, the **redirect host**, the stores it can reach, and an unticked "Also allow changes" box | `src/app/(app)/(auth)/oauth/consent/page.tsx`, `src/features/claude-connector/components/consent-screen.tsx` |
| Tokens are opaque and stored hashed. `/api/mcp` looks each one up in `oauth_access_token`, so a revoked connection stops on its next call | `src/lib/mcp/principal.ts` |

Token lifetimes:
- access tokens last 1 hour;
- refresh tokens last 30 days and rotate.

Production fact:
- `NEXT_PUBLIC_APP_URL` is the apex `https://epidom.fr`.
- `baseURL` uses `servingAppUrl()` (www), so the issuer and every OAuth endpoint are on www.
- Google sign-in stays pinned to the apex callback (`socialProviders.google.redirectURI`), because
  that is the one registered on the Google OAuth client. The www callback is not registered there.

Claude Code signs in through `http://localhost:<random port>/callback`, and the port changes every
session. The provider only ignores the port for `127.0.0.1`, so `src/lib/mcp/loopback-redirect.ts`
admits the new `localhost` port for a client that already registered the same callback.

## Permissions

Every store tool runs `authorizeMcpStore` (`src/lib/mcp/authorize.ts`). It checks, in this order:

1. **Write scope:** write tools need `epidom:write`. Write tools are not even listed without it.
2. **Store access:** `verifyStoreAccess`. Owner or linked staff, checked live on every call.
3. **Plan:** the store's plan must include `claudeConnector`, plus the tool's own feature (`finance`,
   `supplierManagement`, `staffOperations`).
4. **Staff rules:** the owner passes. A linked staff account passes only if its role and pages allow
   the tool (`pages` any-of, `managerOnly`, `ownerOnly`). A tool that names no pages is denied to
   staff.

A staff-only account (one that owns no business) sees only the tools it can use.

The cookie guards (`getSession`, PIN persona, `requireManagerOrOwnerApi`) are **not** used: a Claude
call has no cookies.

## Tools

| Area | Tools | Staff access |
|---|---|---|
| Context | `list_stores`, `get_store_profile` | any |
| Sales & finance | `get_sales_summary`, `get_top_items`, `get_sales_breakdown`, `list_expenses` | `/finance` |
| | `record_expense` (W) | `/finance`, manager |
| | `get_all_outlets_summary` | owner |
| Orders | `list_orders`, `get_order` | `/pos/orders` or `/dashboard` |
| Inventory | `get_stock_alerts`, `list_inventory`, `list_stock_movements` | `/management`, `/data` or `/alerts` |
| | `adjust_stock` (W), `record_waste` (W) | `/management` |
| Suppliers | `list_suppliers`, `list_supplier_orders`, `propose_supplier_order` | `/data` or `/management` |
| | `create_supplier_order`, `receive_supplier_order`, `cancel_supplier_order` (W) | `/data` or `/management` |
| Menu | `get_menu` | `/menu` or `/storefront` |
| | `create_menu_items`, `update_menu_item`, `delete_menu_item` (W) | `/menu` or `/storefront` |
| Import | `import_catalog` (W; preview then commit) | `/data` |
| Staff | `get_roster` (non-managers: their own published shifts) | `/schedule` or `/pos/schedule` |
| | `get_hours_and_overtime` | `/schedule`, manager |
| | `create_roster_entries` (W), `publish_roster` (W), `decide_overtime` (W) | `/schedule`, manager |
| | `get_payroll` | owner |
| Customers | `list_customers` (contacts masked), `get_customer` | `/customers` |
| | `upsert_customer` (W) | `/customers` |

Prompts: `weekly_review`, `restock_check`, `roster_plan`, `menu_review`, `import_menu_photo` (write
connections only). See `src/lib/mcp/prompts.ts`.

### How tools handle data

- **Money:**
  - Every amount is a decimal string in the store's currency.
  - Material, product, supplier-price and supplier-order costs are stored in base IDR. The tools
    convert them both ways (`baseCurrency` in `tools/shared.ts`).
  - `MenuItem.price` and expenses are literal amounts in the store's currency.
- **Periods:**
  - Periods are resolved in `Business.timezone` (`src/lib/mcp/range.ts`) and are inclusive.
  - The Finance page buckets by UTC day, so figures for days near midnight can differ slightly from
    the page. That is a known, separate issue.
- **One source of truth:** tools call the same services as the app's routes. Logic that used to sit
  inline in a route was moved into a service, and the route now calls it too:
  - `src/lib/finance/top-items.ts`
  - `src/lib/services/store-alerts.service.ts`
  - `stock-adjust.service.ts`
  - `supplier-order.service.ts`
  - `roster.service.ts`
  - `expense.service.ts`
  - `catalog-import.service.ts` (the Data page's importer, moved out of the `"use server"` actions
    file so it isn't exposed as an unauthenticated server action)

### Audit and usage

- **Audit:** every write runs inside an audit scope with the real person as actor, and leaves an
  `ActivityEvent` with action code `mcp.<tool>`, shown in the Activity log.
- **Usage:** each call writes one `mcp_tool_call` row: tool, user, client, store, ok/error, duration.
  The row never holds arguments or results.
- **Rate limits:**
  - 120 requests a minute per account (`/api/mcp`);
  - 30 writes a minute on top of that (`/api/mcp#write`);
  - 10 client registrations a minute per IP (Better Auth `rateLimit.customRules`).
- **Abandoned registrations:** every new registration deletes self-registered clients older than 7 days that never got a consent or a token (`src/lib/mcp/client-cleanup.ts`).
- **Admin → Claude connector** (`/admin/claude-connector`, grantable) shows calls, errors, accounts, stores and connections over 7, 30 or 90 days, by tool, by day and by store, plus recent errors.
- **Data page:** for a store whose plan includes the connector, Smart Import’s Quick Start adds a “Do it in Claude” line.
- **Privacy policy:** section “Who receives it” explains that a connected assistant gets data at the user’s request, under the user’s own provider (Anthropic is not an Epidom processor here).

## Never exposed (v1)

These are left out on purpose:
- creating, settling, refunding, cancelling or merging POS orders;
- till shifts and cash movements;
- clock-in/out;
- staff PIN, pay, role or invites;
- billing and plan changes;
- deleting a store or transferring ownership;
- sending anything to customers or suppliers;
- storefront publish and order toggles.

## Testing

- **Unit tests:** `src/lib/mcp/__tests__/`.
- **Local, Claude Code:** `claude mcp add --transport http epidom-local http://localhost:3000/api/mcp`,
  then `/mcp` to sign in. This needs the migration applied to the database the dev server uses.
- **Local, Inspector:** `npx @modelcontextprotocol/inspector`, URL `http://localhost:3000/api/mcp`.
- **Real Claude:** deploy a preview with a public HTTPS URL (dev.epidom.fr), then claude.ai → Settings
  → Connectors → Add custom connector → that `/api/mcp` URL. Give the test account's store Enterprise
  first (Admin → Users).
