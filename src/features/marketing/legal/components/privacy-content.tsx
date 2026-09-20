"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { LegalDocument, type LegalItem, type LegalSectionData } from "./legal-document";
import { CNIL_URL, PROVIDERS } from "../providers";

const range = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

export function PrivacyContent() {
  const { t, locale } = useI18n();
  const plain = (base: string, n: number): LegalItem[] =>
    range("item", n).map((k) => t(`${base}.${k}`));

  const link = (path: string, label: string) => ({ href: getLocalizedPath(path, locale), label });

  // French puts a no-break space before a colon.
  const colon = locale === "fr" ? "\u00a0: " : ": ";

  const processors: LegalItem[] = PROVIDERS.map((p) => {
    const text = `${t(`privacy.processors.${p.id}.name`)}${colon}${t(`privacy.processors.${p.id}.purpose`)}`;
    return "href" in p ? { text, link: { href: p.href, label: t("legal.providerPolicy") } } : text;
  });

  const s2 = plain("privacy.s2", 11);
  // Item 11 points at the Cookie Policy.
  s2[10] = { text: t("privacy.s2.item11"), link: link("/cookie-policy", t("footer.linkCookies")) };

  const s6 = plain("privacy.s6", 6);
  s6[3] = { text: t("privacy.s6.item4"), link: link("/terms", t("terms.title")) };

  const s7 = plain("privacy.s7", 8);
  s7[5] = { text: t("privacy.s7.item6"), link: link("/cookie-policy", t("footer.linkCookies")) };
  s7[6] = { text: t("privacy.s7.item7"), link: { href: CNIL_URL, label: "cnil.fr" } };

  const sections: LegalSectionData[] = [
    {
      id: "p1",
      title: t("privacy.s1.title"),
      body: t("privacy.s1.body"),
      items: plain("privacy.s1", 1),
    },
    { id: "p2", title: t("privacy.s2.title"), body: t("privacy.s2.body"), items: s2 },
    {
      id: "p3",
      title: t("privacy.s3.title"),
      body: t("privacy.s3.body"),
      items: plain("privacy.s3", 6),
    },
    { id: "p4", title: t("privacy.s4.title"), body: t("privacy.s4.body"), items: processors },
    {
      id: "p5",
      title: t("privacy.s5.title"),
      body: t("privacy.s5.body"),
      items: [{ text: t("privacy.s5.item1"), link: link("/gdpr", t("footer.linkGdpr")) }],
    },
    { id: "p6", title: t("privacy.s6.title"), body: t("privacy.s6.body"), items: s6 },
    { id: "p7", title: t("privacy.s7.title"), body: t("privacy.s7.body"), items: s7 },
    { id: "p8", title: t("privacy.s8.title"), body: t("privacy.s8.body") },
    { id: "p9", title: t("privacy.s9.title"), body: t("privacy.s9.body") },
    {
      id: "p10",
      title: t("privacy.s10.title"),
      body: t("privacy.s10.body"),
      contactLabel: t("legal.email"),
    },
  ];

  return (
    <LegalDocument
      title={t("privacy.title")}
      lastUpdated={`${t("legal.lastUpdated")} ${t("privacy.lastUpdatedDate")}`}
      intro={t("privacy.intro")}
      sections={sections}
      footerNote={t("privacy.footer")}
      glow="right"
    />
  );
}
