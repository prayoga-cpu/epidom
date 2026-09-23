"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  PlaceholderCta,
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
import { trackConversion } from "@/lib/analytics";
import { SUPPORT_EMAIL_DISPLAY, supportMailto } from "@/lib/constants/contact";
import { SupplierApplication } from "./supplier-application";

export function PartnersClient() {
  const { t } = useI18n();

  return (
    <PlaceholderPage
      eyebrow={t("partners.eyebrow")}
      title={t("partners.title")}
      body={t("partners.body")}
      actions={<SupplierApplication />}
    >
      <PlaceholderSection
        title={t("partners.types.title")}
        items={[
          t("partners.types.integration"),
          t("partners.types.reseller"),
          t("partners.types.whiteLabel"),
          t("partners.types.referral"),
          t("partners.types.consultants"),
        ]}
        footer={
          <div className="flex flex-col items-stretch gap-4 sm:items-start">
            <p className="text-[15px] leading-relaxed text-[rgba(251,249,228,0.65)]">
              {t("partners.types.hint")}
            </p>
            <PlaceholderCta
              href={supportMailto(t("partners.types.emailSubject"))}
              variant="secondary"
              onClick={() => trackConversion("contact_email", { event_label: "partners_other" })}
            >
              {t("partners.types.emailCta")}
            </PlaceholderCta>
            <p className="text-[13px] leading-relaxed text-[rgba(251,249,228,0.5)]">
              {t("partners.emailFallback").replace("{emails}", SUPPORT_EMAIL_DISPLAY)}
            </p>
          </div>
        }
      />
      <PlaceholderSection
        title={t("partners.integrations.title")}
        items={[
          t("partners.integrations.stripe"),
          t("partners.integrations.xendit"),
          t("partners.integrations.whatsapp"),
        ]}
      />
    </PlaceholderPage>
  );
}
