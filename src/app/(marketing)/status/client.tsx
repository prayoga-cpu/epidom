"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";

export function StatusClient() {
  const { t } = useI18n();

  return (
    <PlaceholderPage
      eyebrow={t("status.eyebrow")}
      title={t("status.title")}
      body={t("status.body")}
    >
      <PlaceholderSection
        title={t("status.services.title")}
        items={[
          t("status.services.api"),
          t("status.services.storefront"),
          t("status.services.payments"),
          t("status.services.whatsapp"),
        ]}
      />
      <PlaceholderSection title={t("status.report.title")} items={[t("status.report.body")]} />
    </PlaceholderPage>
  );
}
