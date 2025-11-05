"use client";

import { useI18n } from "@/components/lang/i18n-provider";

// TODO: This component needs to be updated to use real API data
export function AlertsToggle() {
  const { t } = useI18n();

  return (
    <section className="space-y-6">
      <h2 className="sr-only">{t("pages.alertsTitle")}</h2>
      <div className="text-muted-foreground py-8 text-center">{t("common.noData")}</div>
    </section>
  );
}
