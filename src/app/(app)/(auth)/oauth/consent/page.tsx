import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MCP_SCOPE_WRITE } from "@/lib/mcp/config";
import { redirectHost } from "@/lib/mcp/oauth-flow";
import { listConnectorStores } from "@/lib/mcp/stores";
import { ConsentScreen } from "@/features/claude-connector/components/consent-screen";

/**
 * The OAuth provider's consent page for the Claude connector: which app is
 * asking, where it will send the person back, which stores it will reach and
 * whether it may change data. The decision is posted to /oauth2/consent with
 * this page's signed query, which the provider verifies.
 */
export const dynamic = "force-dynamic";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const session = await getSession();
  if (!session?.user) {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((v) => [key, v])
      )
    );
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/consent?${query.toString()}`)}`);
  }

  const clientId = one("client_id");
  const client = clientId
    ? await prisma.oauthClient.findUnique({
        where: { clientId },
        select: { name: true, disabled: true },
      })
    : null;

  const stores = await listConnectorStores(session.user.id);
  const requestedScopes = (one("scope") ?? "").split(" ").filter(Boolean);

  return (
    <ConsentScreen
      valid={Boolean(client && !client.disabled && one("sig"))}
      clientName={client?.name ?? null}
      redirectHost={redirectHost(one("redirect_uri"))}
      accountEmail={session.user.email}
      requestedScopes={requestedScopes}
      writeRequested={requestedScopes.includes(MCP_SCOPE_WRITE)}
      stores={stores.map((store) => ({
        storeId: store.storeId,
        name: store.name,
        role: store.role,
        connectorEnabled: store.connectorEnabled,
      }))}
    />
  );
}
