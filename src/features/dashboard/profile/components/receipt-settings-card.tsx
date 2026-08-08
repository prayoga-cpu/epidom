"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, RotateCw } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useReceiptSettings } from "../hooks/use-receipt-settings";
import { EditReceiptSettingsDialog } from "./edit-receipt-settings-dialog";

interface ReceiptSettingsCardProps {
  storeId: string;
  storeName?: string;
}

export function ReceiptSettingsCard({ storeId, storeName }: ReceiptSettingsCardProps) {
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useReceiptSettings(storeId);

  const socialCount = settings
    ? [settings.instagramHandle, settings.tiktokHandle, settings.facebookHandle].filter(Boolean)
        .length
    : 0;

  return (
    <>
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold">{t("profile.receiptSettings.title")}</CardTitle>
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
                {error instanceof Error ? error.message : t("profile.errors.receiptSettingsLoadFailed")}
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
                  {t("profile.receiptSettings.autoSendWhatsapp")}
                </p>
                <Badge variant={settings.autoSendWhatsappReceipt ? "default" : "secondary"}>
                  {settings.autoSendWhatsappReceipt
                    ? t("profile.feesAndTaxes.enabled")
                    : t("profile.feesAndTaxes.disabled")}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.receiptSettings.showSocialLinks")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.showSocialLinks ? "default" : "secondary"}>
                    {settings.showSocialLinks
                      ? t("profile.feesAndTaxes.enabled")
                      : t("profile.feesAndTaxes.disabled")}
                  </Badge>
                  {settings.showSocialLinks && socialCount > 0 && (
                    <span className="text-muted-foreground text-xs">{socialCount}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <p className="text-muted-foreground text-sm font-medium">
                  {t("profile.receiptSettings.footerMessage")}
                </p>
                <p className="text-sm whitespace-pre-line">
                  {settings.footerMessage || "Terima kasih!\nSilakan datang kembali"}
                </p>
              </div>

              <p className="text-muted-foreground text-xs sm:col-span-2">
                {t("profile.receiptSettings.brandingNote")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {settings && (
        <EditReceiptSettingsDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          storeId={storeId}
          settings={settings}
        />
      )}
    </>
  );
}
