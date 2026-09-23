"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { LegalDocument, type LegalItem, type LegalSectionData } from "./legal-document";
import { COOKIE_LINKS } from "../providers";

export function CookiePolicyContent() {
  const { t, locale } = useI18n();
  const items = (base: string, n: number): LegalItem[] =>
    Array.from({ length: n }, (_, i) => t(`${base}.item${i + 1}`));
  // Most links point at the provider's privacy policy; Google, Meta and Stripe are linked
  // to their cookie pages instead, and the label says which one the reader is getting.
  const policyLink = (href: string) => ({ href, label: t("legal.providerPolicy") });
  const cookiesLink = (href: string) => ({ href, label: t("legal.providerCookies") });

  const sections: LegalSectionData[] = [
    { id: "c1", title: t("cookiePolicy.s1.title"), body: t("cookiePolicy.s1.body") },
    {
      id: "c2",
      title: t("cookiePolicy.s2.title"),
      body: t("cookiePolicy.s2.body"),
      items: items("cookiePolicy.s2", 4),
    },
    {
      id: "c3",
      title: t("cookiePolicy.s3.title"),
      body: t("cookiePolicy.s3.body"),
      items: items("cookiePolicy.s3", 3),
    },
    {
      id: "c4",
      title: t("cookiePolicy.s4.title"),
      body: t("cookiePolicy.s4.body"),
      items: items("cookiePolicy.s4", 3),
    },
    {
      id: "c5",
      title: t("cookiePolicy.s5.title"),
      body: t("cookiePolicy.s5.body"),
      items: [
        { text: t("cookiePolicy.s5.item1"), link: cookiesLink(COOKIE_LINKS.google) },
        t("cookiePolicy.s5.item2"),
        { text: t("cookiePolicy.s5.item3"), link: policyLink(COOKIE_LINKS.vercel) },
      ],
    },
    {
      id: "c6",
      title: t("cookiePolicy.s6.title"),
      body: t("cookiePolicy.s6.body"),
      items: [{ text: t("cookiePolicy.s6.item1"), link: cookiesLink(COOKIE_LINKS.meta) }],
    },
    {
      id: "c7",
      title: t("cookiePolicy.s7.title"),
      body: t("cookiePolicy.s7.body"),
      items: [
        { text: t("cookiePolicy.s7.item1"), link: cookiesLink(COOKIE_LINKS.stripe) },
        { text: t("cookiePolicy.s7.item2"), link: policyLink(COOKIE_LINKS.googleAccount) },
      ],
    },
    {
      id: "c8",
      title: t("cookiePolicy.s8.title"),
      body: t("cookiePolicy.s8.body"),
      items: [
        {
          text: t("cookiePolicy.s8.item1"),
          link: { href: getLocalizedPath("/privacy", locale), label: t("footer.linkPrivacy") },
        },
      ],
      contactLabel: t("legal.email"),
    },
  ];

  return (
    <LegalDocument
      title={t("cookiePolicy.title")}
      lastUpdated={`${t("legal.lastUpdated")} ${t("cookiePolicy.lastUpdatedDate")}`}
      intro={t("cookiePolicy.intro")}
      sections={sections}
      footerNote={t("cookiePolicy.footer")}
      glow="right"
    />
  );
}
