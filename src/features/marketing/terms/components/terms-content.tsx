"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  LegalDocument,
  type LegalSectionData,
} from "@/features/marketing/legal/components/legal-document";

const SECTIONS = [
  { id: "s1", key: "section1" },
  { id: "s2", key: "section2" },
  { id: "s3", key: "section3", items: 4 },
  { id: "s4", key: "section4", items: 4 },
  { id: "s5", key: "section5", items: 4 },
  { id: "s6", key: "section6" },
  { id: "s7", key: "section7" },
  { id: "s8", key: "section8" },
  { id: "s9", key: "section9" },
  { id: "s10", key: "section10", contact: true },
  { id: "s11", key: "section11", items: 4 },
] as const;

/** Section ids (s1..s11) are public anchors, so they stay put. */
export function TermsContent() {
  const { t } = useI18n();

  const sections: LegalSectionData[] = SECTIONS.map((s) => {
    const base = `terms.${s.key}`;
    return {
      id: s.id,
      title: t(`${base}.title`),
      body: t(`${base}.content`),
      items:
        "items" in s
          ? Array.from({ length: s.items }, (_, i) => t(`${base}.item${i + 1}`))
          : undefined,
      contactLabel: "contact" in s ? t(`${base}.email`) : undefined,
    };
  });

  return (
    <LegalDocument
      title={t("terms.title")}
      lastUpdated={`${t("terms.lastUpdated")} ${t("terms.lastUpdatedDate")}`}
      intro={t("terms.introduction")}
      sections={sections}
      footerNote={t("terms.footer")}
      glow="right"
    />
  );
}
