"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  PlaceholderCta,
  PlaceholderPage,
  PlaceholderSection,
} from "@/features/marketing/shared/components/placeholder-page";
import { trackConversion } from "@/lib/analytics";
import { SUPPORT_EMAIL_DISPLAY, supportMailto } from "@/lib/constants/contact";

export function PressClient() {
  const { t } = useI18n();

  return (
    <PlaceholderPage
      eyebrow={t("press.eyebrow")}
      title={t("press.title")}
      body={t("press.body")}
      actions={
        <PlaceholderCta
          href={supportMailto(t("press.emailSubject"))}
          onClick={() => trackConversion("contact_email", { event_label: "press" })}
        >
          {t("press.cta")}
        </PlaceholderCta>
      }
    >
      {/* No "Founded" line on purpose: the only dated source in the repo is the
          first commit (Oct 2025), which doesn't back the "2024" this page used
          to claim. Add it back once the operator confirms the real year. */}
      <PlaceholderSection
        title={t("press.about.title")}
        items={[t("press.about.builtBy"), t("press.about.focus"), t("press.about.markets")]}
      />
      {/* "Available on request" is literal: there is no asset pack in the repo,
          so nothing here may link to a file. */}
      <PlaceholderSection
        title={t("press.assets.title")}
        items={[
          t("press.assets.logos"),
          t("press.assets.screenshots"),
          t("press.assets.headshots"),
        ]}
      />
      <PlaceholderSection
        title={t("press.contact.title")}
        items={[t("press.contact.reach").replace("{emails}", SUPPORT_EMAIL_DISPLAY)]}
      />
    </PlaceholderPage>
  );
}
