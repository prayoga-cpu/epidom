"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function PosOrdersPageHeader() {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-bold tracking-tight">{t("nav.posOrders")}</h1>
      <p className="text-muted-foreground">{t("pages.posOrdersDesc")}</p>
    </div>
  );
}

export function KdsPageHeader() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between border-b px-6 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t("pages.kdsTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("pages.kdsDesc")}</p>
      </div>
    </div>
  );
}

export function TablesPageHeader() {
  const { t } = useI18n();
  return (
    <div className="border-b px-6 py-4">
      <h1 className="text-xl font-bold tracking-tight">{t("pos.tables.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("pages.tablesDesc")}</p>
    </div>
  );
}
