import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import {
  BreadcrumbStructuredData,
  ClaudeConnectorStructuredData,
  HowToStructuredData,
  WebPageStructuredData,
} from "@/components/seo/structured-data";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { BREADCRUMB_LABELS } from "@/lib/seo";
import { LandingPageView } from "./components/landing-page-view";
import { getLandingPage } from "./content";
import { buildLandingMetadata, landingUrl } from "./metadata";
import { landingLinksFor } from "./registry";

/** What the Claude connector does, per language, for its SoftwareApplication markup. */
const CONNECTOR_FEATURES = {
  en: [
    "Ask Claude about sales, orders, best sellers and finance reports from your own POS data",
    "Check stock alerts and prepare supplier order proposals",
    "Review the menu, the roster, hours and overtime",
    "Read-only from the Operations plan; changes (Enterprise) only with explicit approval",
    "Sign-in with OAuth 2.1 and PKCE; revoke access at any time",
  ],
  fr: [
    "Interroger Claude sur les ventes, les commandes, les meilleures ventes et les rapports financiers de votre caisse",
    "Consulter les alertes de stock et préparer des propositions de commandes fournisseurs",
    "Passer en revue la carte, le planning, les heures et les heures supplémentaires",
    "Lecture seule dès l'offre Operations ; modifications (Enterprise) uniquement avec accord explicite",
    "Connexion OAuth 2.1 avec PKCE ; accès révocable à tout moment",
  ],
  id: [
    "Tanya Claude soal penjualan, pesanan, menu terlaris, dan laporan keuangan dari data kasir Anda",
    "Cek peringatan stok dan siapkan usulan pesanan pemasok",
    "Tinjau menu, jadwal staf, jam kerja, dan lembur",
    "Hanya baca mulai paket Operations; perubahan (Enterprise) hanya dengan persetujuan jelas",
    "Login OAuth 2.1 dengan PKCE; akses bisa dicabut kapan saja",
  ],
} as const satisfies Record<Locale, readonly string[]>;

/** `export const generateMetadata = landingMetadata("kalkulator-hpp")` in a route file. */
export function landingMetadata(slug: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const page = getLandingPage(slug);
    return page ? buildLandingMetadata(page) : { title: "Not found | Epidom" };
  };
}

/**
 * The route body for a landing page. The proxy only lets the page's own
 * language through (other prefixes get a 308 to it), so the marketing
 * layout's i18n is already in the page's language here.
 */
export function LandingRoute({ slug, locale }: { slug: string; locale: Locale }) {
  const page = getLandingPage(slug);
  // Prerendered for every language segment; only its own language is a page
  // (the proxy 308s the others before they get here).
  if (!page || page.locale !== locale) notFound();

  // Other pages in the same language: tools first, then businesses, then features.
  const related = landingLinksFor(page.locale)
    .filter((link) => link.slug !== page.slug)
    .slice(0, 8)
    .map((link) => ({ href: getLocalizedPath(`/${link.slug}`, page.locale), label: link.label }));

  const url = landingUrl(page.slug, page.locale);
  const steps = page.blocks.find((block) => block.type === "steps");

  return (
    <>
      <WebPageStructuredData
        url={url}
        name={page.metaTitle}
        description={page.metaDescription}
        inLanguage={page.locale}
        dateModified={page.updated}
      />
      {steps?.type === "steps" && <HowToStructuredData name={page.h1} steps={steps.items} />}
      {page.group === "claude-connector" && (
        <ClaudeConnectorStructuredData
          url={url}
          inLanguage={page.locale}
          featureList={CONNECTOR_FEATURES[page.locale]}
        />
      )}
      <BreadcrumbStructuredData
        items={[
          {
            name: BREADCRUMB_LABELS[page.locale].home,
            url: `https://epidom.fr${getLocalizedPath("/", page.locale)}`,
          },
          { name: page.h1, url: landingUrl(page.slug, page.locale) },
        ]}
      />
      <LandingPageView page={page} related={related} />
    </>
  );
}
