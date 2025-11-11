"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";

// Generic item type for display components
type Item = {
  id: string;
  name: string;
  category?: string | null;
  unit?: string;
  minStock?: number;
  currentStock?: number;
  [key: string]: any;
};

interface DetailsPanelProps {
  item?: Item;
}

export function DetailsPanel({ item }: DetailsPanelProps) {
  const { t } = useI18n();
  return (
    <Card className="shadow-md transition-shadow hover:shadow-lg lg:sticky lg:top-[5rem]">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{item?.name ?? t("pages.ingredient")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="from-primary/5 flex items-center gap-3 rounded-lg bg-gradient-to-r to-transparent p-3">
          <div
            className="from-primary/20 to-primary/10 flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br"
            aria-hidden
          >
            <span className="text-primary text-lg font-bold">{item?.name?.[0] ?? "?"}</span>
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">
              {t("pages.productSheet")}
            </div>
            <div className="mt-1 text-sm font-medium">
              {t("data.productDesignation")}: {item?.name ?? "—"}
            </div>
          </div>
        </div>
        <div className="from-card to-muted/20 space-y-2 rounded-lg border bg-gradient-to-br p-4">
          <div className="text-foreground text-sm font-bold">{t("pages.supplier")}</div>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{t("data.supplierName")}:</span>{" "}
            {item?.note ?? "Example Supplier"}
          </div>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{t("data.supplierEmail")}:</span> supplier@example.com
          </div>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{t("data.supplierPhone")}:</span> +33 01 23 45 67 89
          </div>
        </div>
        <div className="from-card to-muted/20 space-y-2 rounded-lg border bg-gradient-to-br p-4">
          <div className="text-foreground text-sm font-bold">{t("pages.stockSheet")}</div>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{t("pages.inStock")}:</span> 120.0 Kg
          </div>
          <div className="text-muted-foreground text-sm">
            <span className="font-medium">{t("pages.avgPrice")}:</span> €3.60
          </div>
        </div>
        <div className="text-muted-foreground text-sm font-semibold">{t("pages.history")}</div>
      </CardContent>
    </Card>
  );
}
