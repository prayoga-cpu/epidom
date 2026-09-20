"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  PlaceholderCta,
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
import { trackConversion } from "@/lib/analytics";
import { SUPPORT_EMAIL_DISPLAY, supportMailto } from "@/lib/constants/contact";

export function CareersClient() {
  const { t } = useI18n();

  return (
    <PlaceholderPage
      eyebrow={t("careers.eyebrow")}
      title={t("careers.title")}
      body={t("careers.body")}
      actions={
        <PlaceholderCta
          href={supportMailto(t("careers.emailSubject"))}
          onClick={() => trackConversion("contact_email", { event_label: "careers" })}
        >
          {t("careers.cta")}
        </PlaceholderCta>
      }
    >
      <PlaceholderSection
        title={t("careers.how.title")}
        items={[t("careers.how.team"), t("careers.how.noRoles")]}
      />
      <PlaceholderSection
        title={t("careers.apply.title")}
        items={[t("careers.apply.send").replace("{emails}", SUPPORT_EMAIL_DISPLAY)]}
      />
    </PlaceholderPage>
  );
}
