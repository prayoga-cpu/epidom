"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  LegalDocument,
  type LegalSectionData,
} from "@/features/marketing/legal/components/legal-document";
import { SUPPORT_EMAIL_DISPLAY } from "@/lib/constants/contact";

const SECTIONS = [
  { id: "r1", key: "section1", items: ["item1", "item2", "item3"] },
  { id: "r2", key: "section2", items: ["step1", "step2", "step3", "step4"], ordered: true },
  { id: "r3", key: "section3" },
  { id: "r4", key: "section4", items: ["item1", "item2", "item3"] },
  { id: "r5", key: "section5" },
  { id: "r6", key: "section6" },
  { id: "r7", key: "section7", contact: true },
] as const;

/** Section ids (r1..r7) are public anchors, so they stay put. */
export function RefundPolicyContent() {
  const { t } = useI18n();

  const sections: LegalSectionData[] = SECTIONS.map((s) => {
    const base = `refundPolicy.${s.key}`;
    return {
      id: s.id,
      title: t(`${base}.title`),
      body: t(`${base}.content`),
      items:
        "items" in s
          ? // The support addresses live in one constant, so the copy carries a placeholder.
            s.items.map((k) => t(`${base}.${k}`).replace("{email}", SUPPORT_EMAIL_DISPLAY))
          : undefined,
      ordered: "ordered" in s ? true : undefined,
      contactLabel: "contact" in s ? t(`${base}.email`) : undefined,
    };
  });

  return (
    <LegalDocument
      title={t("refundPolicy.title")}
      lastUpdated={`${t("refundPolicy.lastUpdated")} ${t("refundPolicy.lastUpdatedDate")}`}
      intro={t("refundPolicy.introduction")}
      sections={sections}
      footerNote={t("refundPolicy.footer")}
      glow="left"
      aside={{ title: t("refundPolicy.keyPolicyTitle"), body: t("refundPolicy.keyPolicyBody") }}
    />
  );
}
