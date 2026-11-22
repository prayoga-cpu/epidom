import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against tillersystems.com (2026-08): Tiller was acquired
// by SumUp in Feb 2021 and now operates/rebrands as "SumUp POS Pro" (site
// footer reads "© 2026 SumUp POS Pro"). No public pricing — demo/"talk to
// an expert" only. No customer-facing storefront feature found. Do not add
// claims beyond what's confirmed there.
// Epidom column corrected 2026-10-14: only the storefront page is free; online
// ordering is a POS-plan feature (14-day trial). No setup-time claims.
export const sumupPosProComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "sumup-pos-pro",
    eyebrow: "Epidom vs. SumUp POS Pro (ex-Tiller)",
    titleParts: ["Tiller est devenu SumUp POS Pro,", "sur devis. Epidom, prix public."],
    lede: "Tiller Systems, caisse iPad bien connue en France, a été racheté par SumUp en 2021 et opère aujourd'hui sous le nom SumUp POS Pro. Comme beaucoup de caisses professionnelles, l'accès se fait sur devis après une démo — pas de tarif public, pas de vitrine client incluse.",
    colCompetitor: "SumUp POS Pro (ex-Tiller)",
    rows: [
      { feature: "Tarifs publics", epidom: "Prix affichés, aucun appel commercial requis", competitor: "Non publiés — demande de démo obligatoire" },
      { feature: "Vitrine / menu en ligne", epidom: "Gratuite, pour toujours", competitor: "Non trouvée sur leur site" },
      { feature: "Mise en route", epidom: "En libre-service, sans démo ni devis", competitor: "Processus commercial (démo, devis)" },
      { feature: "Forfait gratuit", epidom: "Oui : la vitrine, sans limite de temps", competitor: "Non mentionné" },
    ],
    note: "Données SumUp POS Pro (ex-Tiller Systems) vérifiées sur tillersystems.com en août 2026 — le domaine historique tiller-systems.com n'est plus actif. Aucune page tarifaire publique trouvée ; comparaison limitée à ce qui est confirmé.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs SumUp POS Pro",
    faqs: [
      {
        q: "Tiller existe encore ?",
        a: "La marque Tiller a été rachetée par SumUp en 2021 et opère désormais sous le nom SumUp POS Pro — même produit, nouveau nom.",
      },
      {
        q: "Pourquoi Epidom affiche ses prix et pas SumUp POS Pro ?",
        a: "Les caisses pensées pour les grandes chaînes ou les besoins sur mesure passent souvent par un devis personnalisé. Epidom vise les petits établissements indépendants avec un tarif fixe et public, pas d'appel commercial nécessaire pour démarrer.",
      },
    ],
    ctaTitle: "Pas de devis, pas d'attente.",
    ctaButton: "Démarrer gratuitement →",
  },
  en: {
    slug: "sumup-pos-pro",
    eyebrow: "Epidom vs. SumUp POS Pro (formerly Tiller)",
    titleParts: ["Tiller became SumUp POS Pro,", "quote-only. Epidom: public pricing."],
    lede: "Tiller Systems, a well-known iPad POS in France, was acquired by SumUp in 2021 and now operates as SumUp POS Pro. Like many professional POS systems, access goes through a demo and a quote — no public pricing, no customer-facing storefront included.",
    colCompetitor: "SumUp POS Pro (formerly Tiller)",
    rows: [
      { feature: "Public pricing", epidom: "Prices shown, no sales call required", competitor: "Not published — demo request required" },
      { feature: "Online storefront/menu", epidom: "Free, forever", competitor: "Not found on their site" },
      { feature: "Getting started", epidom: "Self-serve, no demo or quote", competitor: "Sales-driven process (demo, quote)" },
      { feature: "Free plan", epidom: "Yes: the storefront, no time limit", competitor: "Not mentioned" },
    ],
    note: "SumUp POS Pro (formerly Tiller Systems) facts verified on tillersystems.com as of August 2026 — the historical tiller-systems.com domain is no longer active. No public pricing page was found; comparison limited to what's confirmed.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs SumUp POS Pro",
    faqs: [
      {
        q: "Does Tiller still exist?",
        a: "The Tiller brand was acquired by SumUp in 2021 and now operates as SumUp POS Pro — same product, new name.",
      },
      {
        q: "Why does Epidom publish pricing when SumUp POS Pro doesn't?",
        a: "POS systems built for large chains or custom needs often go through a tailored quote. Epidom targets small independent businesses with a fixed, public price — no sales call needed to get started.",
      },
    ],
    ctaTitle: "No quote, no waiting.",
    ctaButton: "Start free →",
  },
  th: {
    slug: "sumup-pos-pro",
    eyebrow: "Epidom vs. SumUp POS Pro (เดิมคือ Tiller)",
    titleParts: ["Tiller กลายเป็น SumUp POS Pro", "ขอใบเสนอราคาเท่านั้น Epidom ราคาเปิดเผย"],
    lede: "Tiller Systems ระบบ POS บน iPad ที่เป็นที่รู้จักในฝรั่งเศส ถูก SumUp เข้าซื้อกิจการในปี 2021 และปัจจุบันดำเนินงานในชื่อ SumUp POS Pro เช่นเดียวกับระบบ POS สำหรับมืออาชีพหลายราย การเริ่มใช้งานต้องผ่านการขอเดโมและใบเสนอราคา ไม่มีราคาเปิดเผย และไม่มีหน้าร้านออนไลน์สำหรับลูกค้ารวมอยู่ด้วย",
    colCompetitor: "SumUp POS Pro (เดิมคือ Tiller)",
    rows: [
      { feature: "ราคาเปิดเผย", epidom: "แสดงราคาชัดเจน ไม่ต้องคุยกับฝ่ายขาย", competitor: "ไม่เปิดเผย ต้องขอเดโม" },
      { feature: "หน้าร้านออนไลน์/เมนู", epidom: "ฟรีตลอดไป", competitor: "ไม่พบบนเว็บไซต์ของพวกเขา" },
      { feature: "การเริ่มต้นใช้งาน", epidom: "เริ่มได้เอง ไม่ต้องขอเดโมหรือใบเสนอราคา", competitor: "ผ่านกระบวนการของฝ่ายขาย (เดโม ใบเสนอราคา)" },
      { feature: "แพ็กเกจฟรี", epidom: "มี: หน้าร้านออนไลน์ ไม่จำกัดระยะเวลา", competitor: "ไม่ได้กล่าวถึง" },
    ],
    note: "ข้อมูลของ SumUp POS Pro (เดิมคือ Tiller Systems) ตรวจสอบบน tillersystems.com ณ เดือนสิงหาคม 2026 โดยโดเมนเดิม tiller-systems.com ไม่ได้ใช้งานแล้ว ไม่พบหน้าราคาที่เปิดเผยต่อสาธารณะ การเปรียบเทียบจึงจำกัดอยู่เฉพาะสิ่งที่ยืนยันได้",
    faqEyebrow: "คำถามที่พบบ่อย",
    faqTitle: "Epidom vs SumUp POS Pro",
    faqs: [
      {
        q: "Tiller ยังมีอยู่หรือไม่",
        a: "แบรนด์ Tiller ถูก SumUp เข้าซื้อกิจการในปี 2021 และปัจจุบันดำเนินงานในชื่อ SumUp POS Pro เป็นผลิตภัณฑ์เดิมในชื่อใหม่",
      },
      {
        q: "ทำไม Epidom เปิดเผยราคา แต่ SumUp POS Pro ไม่เปิดเผย",
        a: "ระบบ POS ที่สร้างมาสำหรับเครือข่ายร้านขนาดใหญ่หรือความต้องการเฉพาะ มักใช้ใบเสนอราคาที่จัดทำเฉพาะราย Epidom มุ่งเน้นธุรกิจอิสระขนาดเล็กด้วยราคาคงที่ที่เปิดเผย ไม่ต้องคุยกับฝ่ายขายก็เริ่มใช้งานได้",
      },
    ],
    ctaTitle: "ไม่ต้องขอใบเสนอราคา ไม่ต้องรอ",
    ctaButton: "เริ่มใช้ฟรี →",
  },
};
