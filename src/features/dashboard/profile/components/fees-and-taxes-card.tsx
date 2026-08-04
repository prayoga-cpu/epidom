"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, RotateCw } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useFinanceSettings } from "../hooks/use-finance-settings";
import { EditFeesAndTaxesDialog } from "./edit-fees-and-taxes-dialog";

interface FeesAndTaxesCardProps {
  storeId: string;
  storeName?: string;
}

export function FeesAndTaxesCard({ storeId, storeName }: FeesAndTaxesCardProps) {
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useFinanceSettings(storeId);

  const enabledMethodCount = settings ? Object.keys(settings.feeRates).length : 0;

  return (
    <>
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold">{t("profile.feesAndTaxes.title")}</CardTitle>
              {settings && (
                <Badge variant={settings.syncFinanceWithBusiness ? "default" : "outline"}>
                  {settings.syncFinanceWithBusiness
                    ? t("profile.feesAndTaxes.scope.integrated")
                    : t("profile.feesAndTaxes.scope.storeOnly")}
                </Badge>
              )}
            </div>
            {storeName && <p className="text-muted-foreground text-sm">{storeName}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            disabled={isLoading || !settings}
            className="h-9 w-9 gap-0 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:px-3"
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">{t("profile.actions.edit")}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground py-4 text-center text-sm">
              {t("common.loading") ?? "Loading..."}
            </div>
          ) : isError || !settings ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-destructive text-sm">
                {error instanceof Error ? error.message : t("profile.errors.feesAndTaxesLoadFailed")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                {t("common.actions.retry") ?? "Retry"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.feesAndTaxes.tax.rate")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.taxEnabled ? "default" : "secondary"}>
                    {settings.taxEnabled
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.notConfigured")}
                  </Badge>
                  {settings.taxEnabled && (
                    <span className="text-base font-semibold">
                      {(settings.taxRate * 100).toFixed(2)}%
                      {settings.taxLabel ? ` — ${settings.taxLabel}` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.feesAndTaxes.serviceCharge.rate")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.serviceChargeEnabled ? "default" : "secondary"}>
                    {settings.serviceChargeEnabled
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.notConfigured")}
                  </Badge>
                  {settings.serviceChargeEnabled && (
                    <span className="text-base font-semibold">
                      {(settings.serviceChargeRate * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.feesAndTaxes.payLater.title")}
                </p>
                <Badge variant={settings.payLaterEnabled ? "default" : "secondary"}>
                  {settings.payLaterEnabled
                    ? t("profile.feesAndTaxes.enabled")
                    : t("profile.feesAndTaxes.disabled")}
                </Badge>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.feesAndTaxes.processingFee.title")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.processingFeeEnabled ? "default" : "secondary"}>
                    {settings.processingFeeEnabled
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.disabled")}
                  </Badge>
                  {settings.processingFeeEnabled && (
                    <span className="text-muted-foreground text-sm">
                      {t("profile.feesAndTaxes.processingFee.perMethod").replace(
                        "{count}",
                        String(enabledMethodCount)
                      )}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground text-xs sm:col-span-2">
                {t("profile.feesAndTaxes.appliesToNewOrdersOnly")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {settings && (
        <EditFeesAndTaxesDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          storeId={storeId}
          syncedWithBusiness={settings.syncFinanceWithBusiness}
          settings={settings}
          payLaterEnabled={settings.payLaterEnabled}
        />
      )}
    </>
  );
}
