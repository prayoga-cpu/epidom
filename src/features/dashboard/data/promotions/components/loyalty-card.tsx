"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import type { LoyaltySettingsDto } from "@/types/api/cashier";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { LoyaltySettingsDialog } from "./loyalty-settings-dialog";
import { PromotionBlock, PromotionBlockState } from "./promotion-block";

interface LoyaltyCardProps {
  storeId: string;
  query: UseQueryResult<LoyaltySettingsDto, Error>;
}

/**
 * Loyalty points, in the receipt-settings-card mould: a status badge, one
 * plain-language summary of the rules, and an Edit button that opens the dialog.
 */
export function LoyaltyCard({ storeId, query }: LoyaltyCardProps) {
  const { t } = useI18n();
  const { formatMoney } = usePromotionFormat();
  const [editOpen, setEditOpen] = useState(false);

  const settings = query.data;
  // An amount of 0 is what an unconfigured store reads back; there is nothing to
  // describe until the owner has chosen both.
  const isConfigured = !!settings && settings.spendPerPoint > 0 && settings.pointValue > 0;

  const summary = settings
    ? [
        t("promotions.loyalty.summaryEarn").replace(
          "{amount}",
          formatMoney(settings.spendPerPoint)
        ),
        t("promotions.loyalty.summaryValue").replace("{amount}", formatMoney(settings.pointValue)),
        settings.minRedeemPoints > 0
          ? t("promotions.loyalty.summaryMinRedeem").replace(
              "{count}",
              String(settings.minRedeemPoints)
            )
          : t("promotions.loyalty.summaryNoMinimum"),
      ].join(" · ")
    : "";

  return (
    <>
      <PromotionBlock
        title={t("promotions.loyalty.title")}
        description={t("promotions.loyalty.description")}
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full sm:w-auto"
            onClick={() => setEditOpen(true)}
            disabled={!settings}
          >
            <Pencil className="h-4 w-4" />
            {t("common.actions.edit")}
          </Button>
        }
      >
        {query.isLoading ? (
          <PromotionBlockState>
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
          </PromotionBlockState>
        ) : query.isError || !settings ? (
          <PromotionBlockState>
            <p className="text-destructive text-sm">
              {query.error?.message || t("promotions.loyalty.loadFailed")}
            </p>
            <Button variant="outline" size="sm" className="h-10" onClick={() => query.refetch()}>
              {t("common.actions.retry")}
            </Button>
          </PromotionBlockState>
        ) : (
          <div className="space-y-3">
            <Badge variant={settings.enabled ? "default" : "secondary"}>
              {settings.enabled
                ? t("promotions.loyalty.enabled")
                : t("promotions.loyalty.disabled")}
            </Badge>
            {isConfigured ? (
              <p className="text-sm">{summary}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("promotions.loyalty.notConfigured")}
              </p>
            )}
            <p className="text-muted-foreground text-xs">{t("promotions.loyalty.note")}</p>
          </div>
        )}
      </PromotionBlock>

      {settings && (
        <LoyaltySettingsDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          storeId={storeId}
          settings={settings}
        />
      )}
    </>
  );
}
