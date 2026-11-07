"use client";

import Link from "next/link";
import { ChevronRight, MonitorSmartphone } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

/** Settings → the customer display's own page (promo banners, background, thank-you). */
export function CustomerDisplayCard({ storeId }: { storeId: string }) {
  const { t } = useI18n();
  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex min-w-0 items-start gap-3">
          <MonitorSmartphone className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <CardTitle className="text-xl font-bold">
              {t("pos.customerDisplay.editor.title")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("pos.customerDisplay.editor.cardDesc")}
            </CardDescription>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-10 shrink-0 gap-1">
          <Link href={`/store/${storeId}/customer-display`}>
            <span className="hidden sm:inline">{t("pos.customerDisplay.editor.customize")}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
    </Card>
  );
}
