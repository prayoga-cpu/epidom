import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ConnectedAppRow {
  clientId: string;
  name: string | null;
  canWrite: boolean;
  connectedAt: string | null;
  lastUsedAt: string | null;
}

export interface ConnectorOverview {
  connectorUrl: string;
  stores: Array<{ storeId: string; name: string; plan: string; connectorEnabled: boolean }>;
  apps: ConnectedAppRow[];
}

const KEY = ["claude-connector", "connected-apps"] as const;

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error?.message || fallback);
  return result.data as T;
}

export function useConnectedApps() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      parse<ConnectorOverview>(
        await fetch("/api/user/connected-apps"),
        "Failed to load connections"
      ),
  });
}

export function useRevokeConnectedApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) =>
      parse<{ revoked: true }>(
        await fetch("/api/user/connected-apps", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        }),
        "Failed to revoke"
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
