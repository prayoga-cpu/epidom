"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { LegalDocument, type LegalItem, type LegalSectionData } from "./legal-document";
import { CNIL_URL, PROVIDERS } from "../providers";

export function GdprContent() {
  const { t, locale } = useI18n();
  const items = (base: string, n: number): LegalItem[] =>
    Array.from({ length: n }, (_, i) => t(`${base}.item${i + 1}`));

  // Names only: what each provider does is described once, in the Privacy Policy.
  const providers: LegalItem[] = PROVIDERS.map((p) => {
    const name = t(`privacy.processors.${p.id}.name`);
    return "href" in p
      ? { text: name, link: { href: p.href, label: t("legal.providerPolicy") } }
      : name;
  });

  const privacyLink = {
    href: getLocalizedPath("/privacy", locale),
    label: t("footer.linkPrivacy"),
  };

  const sections: LegalSectionData[] = [
    { id: "g1", title: t("gdpr.s1.title"), body: t("gdpr.s1.body"), items: items("gdpr.s1", 3) },
    { id: "g2", title: t("gdpr.s2.title"), body: t("gdpr.s2.body"), items: items("gdpr.s2", 7) },
    {
      id: "g3",
      title: t("gdpr.s3.title"),
      body: t("gdpr.s3.body"),
      items: [{ text: t("gdpr.s3.item1"), link: { href: CNIL_URL, label: "cnil.fr" } }],
    },
    { id: "g4", title: t("gdpr.s4.title"), body: t("gdpr.s4.body"), items: providers },
    { id: "g5", title: t("gdpr.s5.title"), body: t("gdpr.s5.body"), items: items("gdpr.s5", 2) },
    {
      id: "g6",
      title: t("gdpr.s6.title"),
      body: t("gdpr.s6.body"),
      items: [{ text: t("gdpr.s6.item1"), link: privacyLink }],
      contactLabel: t("legal.email"),
    },
  ];

  return (
    <LegalDocument
      title={t("gdpr.title")}
      lastUpdated={`${t("legal.lastUpdated")} ${t("gdpr.lastUpdatedDate")}`}
      intro={t("gdpr.intro")}
      sections={sections}
      footerNote={t("gdpr.footer")}
      glow="right"
    />
  );
}
