"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, Download, LogIn, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { downloadJSON } from "@/lib/utils/export";
import { offlineOrderNumber } from "@/lib/pwa/offline-queue";
import { useOfflineSyncContext } from "@/features/dashboard/shared/offline-sync-provider";
import type { QueuedEntryKind } from "../hooks/use-offline-sync";

interface QueueRow {
  kind: QueuedEntryKind;
  id: string;
  title: string;
  detail: string | null;
  queuedAt: string;
  needsAttention: boolean;
  error: string | null;
}

/**
 * Everything this device is still holding for the server: sales rung up and
 * production logged while the connection was down.
 *
 * Nothing in the queue is ever deleted on its own any more. An entry the server
 * keeps refusing is parked here as "Needs attention" until a person tries it
 * again, keeps a copy (Download), or discards it on purpose — it is money that
 * was already taken, or stock that physically exists.
 */
export function OfflineQueueReview() {
  const { t, formatDateTime } = useI18n();
  const pathname = usePathname();
  const {
    storeId,
    queuedSales,
    queuedProductionLogs,
    attentionCount,
    needsSignIn,
    isOnline,
    isSyncing,
    retryParked,
    discardQueued,
  } = useOfflineSyncContext();
  const [discarding, setDiscarding] = useState<QueueRow | null>(null);

  const rows = useMemo<QueueRow[]>(() => {
    const sales: QueueRow[] = queuedSales.map((entry) => ({
      kind: "sale",
      id: entry.id,
      title: t("pos.offline.saleLabel").replace("{number}", offlineOrderNumber(entry.id)),
      detail: t("pos.offline.saleItems").replace(
        "{count}",
        String(entry.order.items.reduce((sum, item) => sum + item.quantity, 0))
      ),
      queuedAt: entry.queuedAt,
      needsAttention: !!entry.needsAttention,
      error: entry.lastError?.message ?? null,
    }));
    const logs: QueueRow[] = queuedProductionLogs.map((entry) => ({
      kind: "production",
      id: entry.id,
      title: t("pos.offline.productionLabel").replace("{quantity}", String(entry.quantity)),
      detail: null,
      queuedAt: entry.queuedAt,
      needsAttention: !!entry.needsAttention,
      error: entry.lastError?.message ?? null,
    }));
    return [...sales, ...logs].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  }, [queuedSales, queuedProductionLogs, t]);

  const handleDownload = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadJSON(
      {
        storeId,
        exportedAt: new Date().toISOString(),
        sales: queuedSales,
        productionLogs: queuedProductionLogs,
      },
      `epidom-unsynced-${stamp}`
    );
  };

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("pos.offline.reviewEmpty")}</p>;
  }

  return (
    <div className="space-y-3">
      {needsSignIn && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>{t("pos.offline.signInHint")}</p>
          <Button asChild size="sm" className="h-10">
            <Link href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}>
              <LogIn className="size-4" />
              {t("pos.offline.signIn")}
            </Link>
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {attentionCount > 0 && (
          <Button
            size="sm"
            className="h-10"
            onClick={() => void retryParked()}
            disabled={isSyncing || !isOnline}
          >
            <RotateCcw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
            {t("pos.offline.retry")}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-10" onClick={handleDownload}>
          <Download className="size-4" />
          {t("pos.offline.download")}
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={`${row.kind}:${row.id}`} className="flex items-start gap-3 p-3">
            {row.needsAttention ? (
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium">{row.title}</span>
                <Badge variant={row.needsAttention ? "destructive" : "secondary"}>
                  {row.needsAttention
                    ? t("pos.offline.statusNeedsAttention")
                    : t("pos.offline.statusWaiting")}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {[
                  row.detail,
                  t("pos.offline.savedAt").replace("{date}", formatDateTime(row.queuedAt)),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.needsAttention && row.error && (
                <p className="text-destructive text-xs break-words">
                  {t("pos.offline.refusedWith").replace("{message}", row.error)}
                </p>
              )}
            </div>
            {row.needsAttention && (
              <Button
                size="icon"
                variant="ghost"
                className="size-10 shrink-0"
                aria-label={t("pos.offline.discard")}
                title={t("pos.offline.discard")}
                onClick={() => setDiscarding(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmationDialog
        open={!!discarding}
        onOpenChange={(open) => !open && setDiscarding(null)}
        title={t("pos.offline.discardTitle")}
        description={t("pos.offline.discardBody")}
        confirmText={t("pos.offline.discard")}
        cancelText={t("common.actions.cancel")}
        variant="destructive"
        onConfirm={async () => {
          if (discarding) await discardQueued(discarding.kind, discarding.id);
        }}
      />
    </div>
  );
}

/** The review list on its own, for surfaces that don't host the Offline & Sync panel. */
export function OfflineQueueDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(85dvh/var(--app-zoom,1))] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("pos.offline.reviewTitle")}</DialogTitle>
          <DialogDescription>{t("pos.offline.reviewIntro")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <OfflineQueueReview />
        </div>
      </DialogContent>
    </Dialog>
  );
}
