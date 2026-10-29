"use client";

import { useState } from "react";
import { ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import { MCP_SCOPE_WRITE } from "@/lib/mcp/config";

interface ConsentStore {
  storeId: string;
  name: string;
  role: string;
  connectorEnabled: boolean;
}

interface ConsentScreenProps {
  /** False when the link is incomplete or the app was disabled. */
  valid: boolean;
  /** What the app called itself when it registered (unverified). */
  clientName: string | null;
  /** Where the person is sent back to — the one fact that can be trusted. */
  redirectHost: string | null;
  accountEmail: string;
  requestedScopes: string[];
  writeRequested: boolean;
  stores: ConsentStore[];
}

/**
 * "Allow Claude to use your Epidom account?" Reading is always granted;
 * changes are a separate, unticked choice. The answer goes to the OAuth
 * provider's /oauth2/consent with this page's signed query string, and the
 * provider answers with where to send the person next.
 */
export function ConsentScreen(props: ConsentScreenProps) {
  const { t } = useI18n();
  const [allowWrite, setAllowWrite] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function decide(accept: boolean) {
    setState("working");
    try {
      const scope = props.requestedScopes
        .filter((s) => s !== MCP_SCOPE_WRITE || allowWrite)
        .join(" ");
      // Always name the scopes when accepting: without `scope` the provider
      // grants everything originally requested, write included.
      if (accept && !scope) throw new Error("nothing to grant");
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept,
          ...(accept ? { scope } : {}),
          oauth_query: window.location.search.replace(/^\?/, ""),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        redirect_uri?: string;
      } | null;
      const next = data?.url ?? data?.redirect_uri;
      if (!res.ok || !next) throw new Error("consent failed");
      window.location.href = next;
    } catch {
      setState("error");
    }
  }

  const appName = props.clientName || t("claudeConnector.consent.unnamedApp");
  const enabledStores = props.stores.filter((store) => store.connectorEnabled);

  return (
    <div className="flex min-h-[calc(100dvh/var(--app-zoom,1))] items-center justify-center px-4 py-12">
      <div className="bg-card w-full max-w-md space-y-5 rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-center text-lg font-extrabold tracking-[0.2em]">EPIDOM</p>

        {!props.valid ? (
          <div className="space-y-3 text-center">
            <TriangleAlert className="text-destructive mx-auto size-8" aria-hidden />
            <h1 className="text-xl font-semibold">{t("claudeConnector.consent.invalidTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("claudeConnector.consent.invalidBody")}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <ShieldCheck className="text-primary mx-auto size-8" aria-hidden />
              <h1 className="text-xl font-semibold">
                {t("claudeConnector.consent.title").replace("{app}", appName)}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("claudeConnector.consent.signedInAs").replace("{email}", props.accountEmail)}
              </p>
            </div>

            {props.redirectHost && (
              <p className="bg-muted rounded-lg px-3 py-2 text-center text-sm">
                {t("claudeConnector.consent.redirectsTo")}{" "}
                <span className="font-semibold break-all">{props.redirectHost}</span>
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("claudeConnector.consent.canRead")}</p>
              {props.stores.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("claudeConnector.consent.noStores")}
                </p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {props.stores.map((store) => (
                    <li key={store.storeId} className="flex items-center gap-2 text-sm">
                      <Store className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{store.name}</span>
                      {!store.connectorEnabled && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {t("claudeConnector.consent.needsEnterprise")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {props.stores.length > 0 && enabledStores.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  {t("claudeConnector.consent.noneEnabled")}
                </p>
              )}
            </div>

            {props.writeRequested && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  checked={allowWrite}
                  onCheckedChange={(checked) => setAllowWrite(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {t("claudeConnector.consent.allowChanges")}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {t("claudeConnector.consent.allowChangesHint")}
                  </span>
                </span>
              </label>
            )}

            <p className="text-muted-foreground text-xs">{t("claudeConnector.consent.costNote")}</p>

            {state === "error" && (
              <p className="text-destructive text-sm" role="alert">
                {t("claudeConnector.consent.error")}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={state === "working"}
                onClick={() => decide(false)}
              >
                {t("claudeConnector.consent.deny")}
              </Button>
              <Button
                className="h-11 flex-1"
                disabled={state === "working"}
                onClick={() => decide(true)}
              >
                {state === "working"
                  ? t("claudeConnector.consent.working")
                  : t("claudeConnector.consent.allow")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
