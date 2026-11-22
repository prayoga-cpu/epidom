import type { Metadata } from "next";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";
import type { Locale } from "@/components/lang/i18n-provider";
import { generateMetadata as buildSeoMetadata, type SEOConfig } from "@/lib/seo";
import { DEFAULT_LOCALE, LOCALES, getLocalizedPath } from "@/lib/i18n-routing";

export type LegalPage = "privacy" | "cookie-policy" | "gdpr" | "terms" | "refund-policy";

const SITE = "https://epidom.fr";

const COPY: Record<LegalPage, Record<Locale, { title: string; description: string }>> = {
  privacy: {
    en: {
      title: "Privacy Policy — EPIDOM",
      description: "How Epidom collects, uses and protects your data.",
    },
    fr: {
      title: "Politique de confidentialité — EPIDOM",
      description: "Comment Epidom collecte, utilise et protège vos données.",
    },
    id: {
      title: "Kebijakan Privasi — EPIDOM",
      description: "Cara Epidom mengumpulkan, menggunakan, dan melindungi data Anda.",
    },
    th: {
      title: "นโยบายความเป็นส่วนตัว — EPIDOM",
      description: "วิธีที่ Epidom เก็บรวบรวม ใช้ และปกป้องข้อมูลของคุณ",
    },
  },
  "cookie-policy": {
    en: {
      title: "Cookie Policy — EPIDOM",
      description:
        "What Epidom stores in your browser, which third-party tools can run on the site, and how to control them.",
    },
    fr: {
      title: "Politique des cookies — EPIDOM",
      description:
        "Ce qu'Epidom enregistre dans votre navigateur, quels outils tiers peuvent fonctionner sur le site et comment les contrôler.",
    },
    id: {
      title: "Kebijakan Cookie — EPIDOM",
      description:
        "Apa yang disimpan Epidom di browser Anda, alat pihak ketiga yang dapat berjalan di situs, dan cara mengendalikannya.",
    },
    th: {
      title: "นโยบายคุกกี้ — EPIDOM",
      description:
        "สิ่งที่ Epidom จัดเก็บในเบราว์เซอร์ของคุณ เครื่องมือของบุคคลที่สามที่อาจทำงานบนเว็บไซต์ และวิธีควบคุมการใช้งาน",
    },
  },
  gdpr: {
    en: {
      title: "GDPR — EPIDOM",
      description:
        "Your rights under the GDPR, the legal bases Epidom relies on, and how to reach us.",
    },
    fr: {
      title: "RGPD — EPIDOM",
      description:
        "Vos droits au titre du RGPD, les bases légales d'Epidom et comment nous joindre.",
    },
    id: {
      title: "GDPR — EPIDOM",
      description:
        "Hak Anda berdasarkan GDPR, dasar hukum yang digunakan Epidom, dan cara menghubungi kami.",
    },
    th: {
      title: "GDPR — EPIDOM",
      description:
        "สิทธิของคุณภายใต้ GDPR ฐานทางกฎหมายที่ Epidom ใช้ และวิธีติดต่อเรา",
    },
  },
  terms: {
    en: {
      title: "Terms & Conditions — EPIDOM",
      description:
        "Read EPIDOM's Terms and Conditions. Understand the terms of service, user responsibilities, and legal agreements.",
    },
    fr: {
      title: "Conditions Générales — EPIDOM",
      description:
        "Lisez les Conditions Générales d'EPIDOM : conditions du service, responsabilités des utilisateurs et engagements juridiques.",
    },
    id: {
      title: "Syarat dan Ketentuan — EPIDOM",
      description:
        "Baca Syarat dan Ketentuan EPIDOM: ketentuan layanan, tanggung jawab pengguna, dan perjanjian hukum.",
    },
    th: {
      title: "ข้อกำหนดและเงื่อนไข — EPIDOM",
      description:
        "อ่านข้อกำหนดและเงื่อนไขของ EPIDOM: ข้อกำหนดการให้บริการ ความรับผิดชอบของผู้ใช้ และข้อตกลงทางกฎหมาย",
    },
  },
  "refund-policy": {
    en: {
      title: "Refund Policy — EPIDOM",
      description:
        "Read EPIDOM's Refund Policy. Understand our refund and cancellation terms, eligibility criteria, and how to request a refund.",
    },
    fr: {
      title: "Politique de Remboursement — EPIDOM",
      description:
        "Lisez la Politique de Remboursement d'EPIDOM : conditions de remboursement et d'annulation, critères d'admissibilité et démarche pour demander un remboursement.",
    },
    id: {
      title: "Kebijakan Pengembalian Dana — EPIDOM",
      description:
        "Baca Kebijakan Pengembalian Dana EPIDOM: ketentuan pengembalian dana dan pembatalan, kriteria kelayakan, dan cara mengajukan pengembalian dana.",
    },
    th: {
      title: "นโยบายการคืนเงิน — EPIDOM",
      description:
        "อ่านนโยบายการคืนเงินของ EPIDOM: เงื่อนไขการคืนเงินและการยกเลิก เกณฑ์คุณสมบัติ และวิธีขอคืนเงิน",
    },
  },
};

const OG_LOCALE: Record<Locale, string> = { en: "en_US", fr: "fr_FR", id: "id_ID", th: "th_TH" };

/** The site-wide share image, so overriding openGraph here doesn't drop it. */
type SeoImages = NonNullable<NonNullable<SEOConfig["openGraph"]>["images"]>;
const DEFAULT_OG_IMAGES = (buildSeoMetadata({}).openGraph as { images?: SeoImages } | null)?.images;

/**
 * Metadata for one of the legal pages, in the language the visitor is reading.
 * The canonical and Open Graph URL point at the locale that is actually served
 * (fr unprefixed, /id and /en prefixed), and the hreflang set lists all three.
 * Pure of request state: pass `locale` in tests.
 */
export function buildLegalMetadata(page: LegalPage, locale: Locale): Metadata {
  const { title, description } = COPY[page][locale];
  const basePath = `/${page}`;
  const url = `${SITE}${getLocalizedPath(basePath, locale)}`;

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `${SITE}${getLocalizedPath(basePath, l)}`;
  languages["x-default"] = languages[DEFAULT_LOCALE];

  return buildSeoMetadata({
    title,
    description,
    canonical: url,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, locale: OG_LOCALE[locale], images: DEFAULT_OG_IMAGES },
  });
}

/** `export const generateMetadata = legalMetadata("privacy")` in a page file. */
export function legalMetadata(page: LegalPage) {
  return async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
    return buildLegalMetadata(page, await routeLocale(params));
  };
}
