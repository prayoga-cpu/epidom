"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Lock, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/use-confirm";
import { useI18n } from "@/components/lang/i18n-provider";
import { useConnectedApps, useRevokeConnectedApp } from "../hooks/use-connected-apps";

/**
 * Profile → "Claude": the connector URL to paste into Claude, how to add it,
 * and the connections this account has allowed, each revocable. The AI runs
 * on the person's own Claude plan; Epidom only answers its requests.
 */
export function ClaudeConnectorCard() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch, isRefetching } = useConnectedApps();
  const revoke = useRevokeConnectedApp();
  const { confirm, confirmDialog } = useConfirm();
  const [copied, setCopied] = useState(false);

  const enabledStores = data?.stores.filter((store) => store.connectorEnabled) ?? [];
  const locked = Boolean(data) && enabledStores.length === 0;

  async function copyUrl() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.connectorUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("claudeConnector.card.copyFailed"));
    }
  }

  async function onRevoke(clientId: string, name: string) {
    const ok = await confirm({
      title: t("claudeConnector.card.revokeTitle"),
      description: t("claudeConnector.card.revokeBody").replace("{app}", name),
      confirmText: t("claudeConnector.card.revoke"),
      variant: "destructive",
    });
    if (!ok) return;
    revoke.mutate(clientId, {
      onSuccess: () => toast.success(t("claudeConnector.card.revoked")),
      onError: (error) => toast.error(error.message),
    });
  }

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

  return (
    <>
      <Card className="border-2">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5" aria-hidden />
            {t("claudeConnector.card.title")}
          </CardTitle>
          <p className="text-muted-foreground text-sm">{t("claudeConnector.card.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{t("common.loading")}</p>
          ) : isError || !data ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-destructive text-sm">{t("claudeConnector.card.loadFailed")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                {t("common.actions.retry")}
              </Button>
            </div>
          ) : locked ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
              <Lock className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm">{t("claudeConnector.card.lockedBody")}</p>
              <Button asChild variant="outline" className="h-11 shrink-0">
                <Link href="/contact">{t("claudeConnector.card.talkToUs")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("claudeConnector.card.urlLabel")}</p>
                <div className="flex items-center gap-2">
                  <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2.5 text-sm">
                    {data.connectorUrl}
                  </code>
                  <Button
                    variant="outline"
                    className="h-11 w-11 shrink-0 p-0"
                    onClick={copyUrl}
                    aria-label={t("claudeConnector.card.copy")}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
                <li>{t("claudeConnector.card.step1")}</li>
                <li>{t("claudeConnector.card.step2")}</li>
                <li>{t("claudeConnector.card.step3")}</li>
              </ol>
              <p className="text-muted-foreground text-xs">
                {t("claudeConnector.card.claudeCode")}{" "}
                <code className="break-all">
                  claude mcp add --transport http epidom {data.connectorUrl}
                </code>
              </p>
              <p className="text-muted-foreground text-xs">
                {t("claudeConnector.card.enabledFor").replace(
                  "{stores}",
                  enabledStores.map((store) => store.name).join(", ")
                )}
              </p>
            </>
          )}

          {data && data.apps.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("claudeConnector.card.connections")}</p>
              <ul className="divide-y rounded-lg border">
                {data.apps.map((app) => {
                  const name = app.name || t("claudeConnector.consent.unnamedApp");
                  return (
                    <li
                      key={app.clientId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-muted-foreground text-xs">
                          {t("claudeConnector.card.connectedOn").replace(
                            "{date}",
                            date(app.connectedAt)
                          )}
                          {" · "}
                          {t("claudeConnector.card.lastUsed").replace(
                            "{date}",
                            date(app.lastUsedAt)
                          )}
                        </p>
                      </div>
                      <Badge variant={app.canWrite ? "default" : "secondary"}>
                        {app.canWrite
                          ? t("claudeConnector.card.readWrite")
                          : t("claudeConnector.card.readOnly")}
                      </Badge>
                      <Button
                        variant="outline"
                        className="h-10"
                        disabled={revoke.isPending}
                        onClick={() => onRevoke(app.clientId, name)}
                      >
                        {t("claudeConnector.card.revoke")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  );
}
