import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { getRequestLocale } from "@/features/marketing/legal/metadata";
import { LOCALE_PRICE_CURRENCY, formatPlanPrice } from "@/lib/constants/plan-pricing";
import { buildLocalizedMetadata } from "@/lib/seo";
import { STOREFRONT_ONLINE_PAYMENTS_ENABLED } from "@/config/storefront-ordering.config";

/**
 * Per-locale metadata for the marketing pages that are authored in fr, id and en
 * (the legal pages have their own module: features/marketing/legal/metadata.ts).
 * All the copy lives here so a reviewer can read every title and snippet in one
 * place. A page file is just `export const generateMetadata = pageMetadata("x")`.
 *
 * Copy rules, because these strings are what search results and link previews
 * show: nothing here may claim more than the page itself does. Only the
 * storefront tier is free forever; the POS is a paid plan after a 14-day trial
 * (src/lib/constants/plan-pricing.ts), so no line calls the cashier free. The
 * pricing snippet takes its price from the plan-pricing table for the language
 * of the page, never another language's currency.
 *
 * Titles lead with what a buyer searches for ("aplikasi kasir cafe", "commande
 * en ligne", "POS"), brand last; Google cuts titles past ~60 characters and
 * snippets past ~160, so page-metadata.test.ts holds every filled string to
 * that. French copy is for French readers: no "warung".
 *
 * "{price}" in a title or description is replaced with the POS monthly price
 * in the served locale's currency (fr EUR, en USD, id IDR).
 */
export type MarketingMetaPage =
  | "home"
  | "pricing"
  | "about"
  | "contact"
  | "services"
  | "partners"
  | "careers"
  | "press"
  | "changelog"
  | "compare"
  | "compare-delivery-commission"
  | "build-with-us"
  | "blog"
  | "docs";

interface PageCopy {
  title: string;
  description: string;
  /** Short social-card variants; fall back to title / description. */
  ogTitle?: string;
  ogDescription?: string;
}

interface PageDefinition {
  /** Unprefixed URL path. */
  path: string;
  /**
   * Placeholder pages with nothing to rank for yet (no open roles, no press
   * kit, no partner program): `noindex, follow`, and off the sitemap. Remove
   * the flag (and add the page back to src/app/sitemap.ts) once it has content.
   */
  noindex?: true;
  /** Kept in English for every locale, as before this module existed. */
  keywords?: string[];
  copy: Record<Locale, PageCopy>;
}

// The French strings below use non-breaking spaces (U+00A0, invisible in most editors)
// before : and ; . That is French typography, and it keeps a snippet from wrapping a
// colon onto its own line. page-metadata.test.ts fails on a plain space there.
export const PAGES: Record<MarketingMetaPage, PageDefinition> = {
  home: {
    path: "/",
    keywords: [
      "free pos app",
      "digital menu qr code",
      "online food ordering",
      "f&b storefront",
      "restaurant pos cashier",
      "qris payments",
      "kitchen display system",
      "epidom",
    ],
    copy: {
      en: {
        title: "POS & Online Ordering for Cafés and Restaurants — EPIDOM",
        description: STOREFRONT_ONLINE_PAYMENTS_ENABLED
          ? "A realtime POS, plus your menu, online orders and payments in one link. Storefront free forever; POS with a 14-day free trial. For cafés and restaurants."
          : "A realtime POS, plus your menu and online orders in one link. Storefront free forever; POS with a 14-day free trial. For cafés, bakeries and restaurants.",
        ogTitle: "Epidom — Realtime POS & Online Ordering",
        ogDescription:
          "A realtime POS, plus your menu and online orders in one link. Free storefront, forever.",
      },
      fr: {
        title: "Commande en ligne, menu QR et caisse pour cafés — EPIDOM",
        description: STOREFRONT_ONLINE_PAYMENTS_ENABLED
          ? "Une caisse en temps réel, plus votre menu, vos commandes et paiements en ligne dans un seul lien. Vitrine gratuite à vie ; caisse avec 14 jours d'essai."
          : "Une caisse en temps réel, plus votre menu et vos commandes en ligne dans un seul lien. Vitrine gratuite à vie ; caisse avec 14 jours d'essai gratuit.",
        ogTitle: "Epidom — Caisse en temps réel et commande en ligne",
        ogDescription:
          "Une caisse en temps réel, plus votre menu et vos commandes en ligne dans un seul lien. Vitrine gratuite à vie.",
      },
      id: {
        title: "Aplikasi Kasir Cafe & Restoran + Menu QR — EPIDOM",
        description: STOREFRONT_ONLINE_PAYMENTS_ENABLED
          ? "Kasir realtime, plus menu, pesanan online, dan pembayaran dalam satu link. Halaman toko gratis selamanya; POS dengan uji coba gratis 14 hari."
          : "Kasir realtime, plus menu dan pesanan online dalam satu link. Halaman toko gratis selamanya; POS dengan uji coba gratis 14 hari. Untuk kafe dan restoran.",
        ogTitle: "Epidom — Aplikasi Kasir Realtime & Pesanan Online",
        ogDescription:
          "Kasir realtime, plus menu dan pesanan online dalam satu link. Halaman toko gratis selamanya.",
      },
    },
  },

  pricing: {
    path: "/pricing",
    keywords: [
      "epidom pricing",
      "epidom plans",
      "pos cashier cost",
      "restaurant pos price",
      "free pos for restaurants",
      "epidom free plan",
      "harga aplikasi kasir",
      "moka pos vs epidom price",
    ],
    copy: {
      en: {
        title: "Pricing: POS from {price}/mo, Free Storefront — EPIDOM",
        description:
          "Start free, grow as you need: a storefront free forever, and a POS from {price}/mo after a 14-day free trial. Plans for cafés, bakeries and restaurants.",
        ogTitle: "Epidom Pricing — Start Free",
        ogDescription:
          "Start free, grow as you need. Epidom plans for cafés, bakeries and restaurants.",
      },
      fr: {
        title: "Tarifs caisse : dès {price}/mois, vitrine gratuite — EPIDOM",
        description:
          "Commencez gratuitement : vitrine gratuite à vie, caisse à partir de {price}/mois après 14 jours d'essai gratuit. Pour cafés, boulangeries et restaurants.",
        ogTitle: "Tarifs Epidom — Commencez gratuitement",
        ogDescription:
          "Commencez gratuitement, évoluez selon vos besoins. Les forfaits Epidom pour cafés, boulangeries et restaurants.",
      },
      id: {
        title: "Harga Aplikasi Kasir Cafe: mulai {price}/bulan — EPIDOM",
        description:
          "Mulai gratis: halaman toko gratis selamanya, kasir POS mulai {price}/bulan setelah uji coba gratis 14 hari. Paket untuk kafe, warung, dan restoran.",
        ogTitle: "Harga Epidom — Mulai Gratis",
        ogDescription:
          "Mulai gratis, berkembang sesuai kebutuhan. Paket Epidom untuk kafe, warung, dan restoran.",
      },
    },
  },

  about: {
    path: "/about",
    keywords: ["about epidom", "epidom team", "f&b storefront company"],
    copy: {
      en: {
        title: "About Epidom — F&B Storefront & POS",
        description:
          "Epidom is built by a small product team at Prionation, working from Bali and Paris with F&B operators. One link for your menu, orders and payments.",
        ogTitle: "About Epidom",
        ogDescription:
          "Built by a small Prionation team working from Bali and Paris. One link for menu, orders and payments.",
      },
      fr: {
        title: "À propos d'Epidom — Vitrine et caisse POS pour le F&B",
        description:
          "Epidom est conçu par une petite équipe de Prionation, entre Bali et Paris, avec des établissements F&B. Un seul lien pour menu, commandes et paiements.",
        ogTitle: "À propos d'Epidom",
        ogDescription:
          "Conçu par une petite équipe de Prionation, depuis Bali et Paris. Un seul lien pour le menu, les commandes et les paiements.",
      },
      id: {
        title: "Tentang Epidom — Toko Online & Kasir POS untuk F&B",
        description:
          "Epidom dibuat oleh tim produk kecil di Prionation, yang bekerja dari Bali dan Paris bersama pelaku F&B. Satu link untuk menu, pesanan, dan pembayaran Anda.",
        ogTitle: "Tentang Epidom",
        ogDescription:
          "Dibuat oleh tim kecil Prionation dari Bali dan Paris. Satu link untuk menu, pesanan, dan pembayaran Anda.",
      },
    },
  },

  contact: {
    path: "/contact",
    copy: {
      en: {
        title: "Contact — EPIDOM",
        description:
          "Message the Epidom team on WhatsApp or by email. We're here to help F&B businesses get started, upgrade, or just ask a question.",
        ogTitle: "Contact Epidom",
        ogDescription: "Reach the Epidom team on WhatsApp or by email.",
      },
      fr: {
        title: "Nous contacter — EPIDOM",
        description:
          "Écrivez à l'équipe Epidom sur WhatsApp ou par e-mail. Nous aidons les établissements F&B à démarrer, à changer de forfait ou simplement à poser une question.",
        ogTitle: "Contacter Epidom",
        ogDescription: "Joignez l'équipe Epidom sur WhatsApp ou par e-mail.",
      },
      id: {
        title: "Kontak — EPIDOM",
        description:
          "Hubungi tim Epidom lewat WhatsApp atau email. Kami siap membantu bisnis F&B untuk memulai, upgrade paket, atau sekadar bertanya.",
        ogTitle: "Hubungi Epidom",
        ogDescription: "Hubungi tim Epidom lewat WhatsApp atau email.",
      },
    },
  },

  services: {
    path: "/services",
    keywords: [
      "epidom features",
      "f&b pos app",
      "restaurant cashier app",
      "cafe inventory management",
      "digital menu page",
      "qris payments",
      "kitchen display system",
      "f&b operational reports",
    ],
    copy: {
      en: {
        title: "Features: POS, Kitchen Display, Stock & Staff — EPIDOM",
        description:
          "Everything Epidom offers: a free menu page, POS, kitchen display (KDS), stock and recipe costing, staff schedules, finance reports and multi-outlet.",
        ogTitle: "Epidom Features — POS, Kitchen & Back Office",
        ogDescription:
          "From a free menu page to a POS, kitchen display and back office. One platform for cafés, bakeries and restaurants.",
      },
      fr: {
        title: "Caisse, écran cuisine, stocks et planning d'équipe — EPIDOM",
        description:
          "Tout Epidom : page menu gratuite, caisse, écran cuisine (KDS), stocks et coût des recettes, planning d'équipe, rapports financiers et multi-établissements.",
        ogTitle: "Fonctionnalités Epidom — caisse, cuisine et back-office",
        ogDescription:
          "De la page menu gratuite à la caisse, à l'écran cuisine et au back-office. Une seule plateforme pour cafés, boulangeries et restaurants.",
      },
      id: {
        title: "Fitur Aplikasi Kasir: Dapur, Stok & Jadwal Staf — EPIDOM",
        description:
          "Semua fitur Epidom: halaman menu gratis, kasir POS, kitchen display (KDS), stok dan HPP resep, jadwal staf, laporan keuangan, dan multi-outlet.",
        ogTitle: "Fitur Epidom — Kasir, Dapur & Back Office",
        ogDescription:
          "Dari halaman menu gratis hingga kasir POS, layar dapur, dan back office. Satu platform untuk kafe, warung, dan restoran.",
      },
    },
  },

  partners: {
    path: "/partners",
    noindex: true,
    copy: {
      en: {
        title: "Partners — EPIDOM",
        description:
          "Partner with Epidom. Supplier partnerships, integrations, resellers and white-label programs.",
      },
      fr: {
        title: "Partenaires — EPIDOM",
        description:
          "Devenez partenaire d'Epidom : partenariats fournisseurs, intégrations, revendeurs et programmes en marque blanche.",
      },
      id: {
        title: "Mitra — EPIDOM",
        description:
          "Bermitra dengan Epidom. Kemitraan pemasok, integrasi, reseller, dan program white-label.",
      },
    },
  },

  careers: {
    path: "/careers",
    noindex: true,
    copy: {
      en: {
        title: "Careers — EPIDOM",
        description:
          "Epidom is built by a small, focused product team at Prionation. There are no open roles right now, but we're glad to hear from people who want to join.",
      },
      fr: {
        title: "Carrières — EPIDOM",
        description:
          "Epidom est conçu par une petite équipe produit de Prionation. Pas de poste ouvert pour le moment, mais nous sommes heureux d'échanger avec celles et ceux qui veulent nous rejoindre.",
      },
      id: {
        title: "Karir — EPIDOM",
        description:
          "Epidom dibuat oleh tim produk kecil dan fokus di Prionation. Belum ada lowongan saat ini, tetapi kami senang mendengar dari orang yang ingin bergabung.",
      },
    },
  },

  press: {
    path: "/press",
    noindex: true,
    copy: {
      en: {
        title: "Press — EPIDOM",
        description:
          "Media kit and press contacts for journalists covering Epidom: the basic facts, assets on request, and how to reach us.",
      },
      fr: {
        title: "Presse — EPIDOM",
        description:
          "Kit média et contacts presse pour les journalistes qui écrivent sur Epidom : informations essentielles, visuels sur demande et coordonnées.",
      },
      id: {
        title: "Pers — EPIDOM",
        description:
          "Media kit dan kontak pers untuk jurnalis yang meliput Epidom: fakta dasar, aset atas permintaan, dan cara menghubungi kami.",
      },
    },
  },

  changelog: {
    path: "/changelog",
    copy: {
      en: {
        title: "Changelog — EPIDOM",
        description: "What's new in Epidom: product updates, fixes and improvements.",
      },
      fr: {
        title: "Nouveautés — EPIDOM",
        description:
          "Les nouveautés d'Epidom : mises à jour du produit, corrections et améliorations.",
      },
      id: {
        title: "Pembaruan — EPIDOM",
        description: "Yang baru di Epidom: pembaruan produk, perbaikan, dan peningkatan.",
      },
    },
  },

  compare: {
    path: "/compare",
    copy: {
      en: {
        title: "Epidom vs. Moka, Pawoon, Zelty, Lightspeed & More — EPIDOM",
        description:
          "Factual comparisons, sourced from each tool's own site: Moka, Majoo, Pawoon, Qasir, Olsera, ESB, Zelty, L'Addition, Lightspeed, Innovorder and more.",
      },
      fr: {
        title: "Alternative à Zelty, L'Addition, Lightspeed, Sunday — EPIDOM",
        description:
          "Des comparatifs factuels, sourcés sur le site de chaque outil : Zelty, L'Addition, Lightspeed, Innovorder, Popina, Zettle, SumUp POS Pro, Sunday.",
      },
      id: {
        title: "Alternatif Moka, Majoo, Pawoon, Qasir & ESB — EPIDOM",
        description:
          "Perbandingan faktual, bersumber dari situs resmi tiap aplikasi: Moka, Majoo, Pawoon, Qasir, Olsera, ESB, Kasir Pintar, dan Klikit.",
      },
    },
  },

  "compare-delivery-commission": {
    path: "/compare/delivery-commission",
    keywords: [
      "gofood commission",
      "grabfood commission indonesia",
      "shopeefood commission",
      "commission free online ordering",
      "avoid delivery app fees",
      "deliveroo commission restaurant",
    ],
    // Each language's page is about its own market's apps: fr covers Uber Eats
    // and Deliveroo, id and en GoFood, GrabFood and ShopeeFood.
    copy: {
      en: {
        title: "GoFood, GrabFood, ShopeeFood Commission Compared — EPIDOM",
        description:
          "Every delivery-app order pays a commission; a storefront you own doesn't. Compare GoFood, GrabFood and ShopeeFood fees with Epidom's commission-free ordering.",
      },
      fr: {
        title: "Commission Uber Eats et Deliveroo : le coût réel — EPIDOM",
        description:
          "Chaque commande Uber Eats ou Deliveroo paie une commission ; une vitrine qui vous appartient, non. Comparez avec la commande en ligne Epidom, sans commission.",
      },
      id: {
        title: "Komisi GoFood, GrabFood, ShopeeFood: Bandingkan — EPIDOM",
        description:
          "Setiap pesanan lewat aplikasi pengantaran kena komisi; toko online milik Anda tidak. Bandingkan biaya GoFood, GrabFood, ShopeeFood dengan pemesanan Epidom.",
      },
    },
  },

  // The id copy on the page itself addresses the reader as "kamu", so this one does too.
  "build-with-us": {
    path: "/build-with-us",
    copy: {
      en: {
        title: "Build Your Own Epidom — EPIDOM × Prionation",
        description:
          "Epidom is a Prionation build. If you're building a production SaaS, talk to the team that built this one — based in Canggu, Bali.",
        ogTitle: "Build Your Own Epidom",
        ogDescription: "Epidom is a Prionation build. Talk to the team that built this one.",
      },
      fr: {
        title: "Construisez votre propre Epidom — EPIDOM × Prionation",
        description:
          "Epidom est un projet Prionation. Si vous construisez un SaaS en production, parlez à l'équipe qui a construit celui-ci, basée à Canggu, Bali.",
        ogTitle: "Construisez votre propre Epidom",
        ogDescription:
          "Epidom est un projet Prionation. Parlez à l'équipe qui a construit celui-ci.",
      },
      id: {
        title: "Bangun Epidom Versi Kamu — EPIDOM × Prionation",
        description:
          "Epidom dibangun oleh Prionation. Kalau kamu lagi bangun SaaS produksi, ngobrol sama tim yang bangun ini — berbasis di Canggu, Bali.",
        ogTitle: "Bangun Epidom Versi Kamu",
        ogDescription: "Epidom dibangun oleh Prionation. Ngobrol sama tim yang bangun ini.",
      },
    },
  },

  blog: {
    path: "/blog",
    keywords: ["epidom blog", "tips warung", "f&b business tips indonesia"],
    copy: {
      en: {
        title: "Blog: Guides for Cafés & Restaurants — EPIDOM",
        description:
          "Guides for café and restaurant owners: free QR code menus, delivery-app commission and running a smarter F&B business.",
      },
      fr: {
        title: "Blog : conseils pour cafés et restaurants — EPIDOM",
        description:
          "Guides et conseils pour les gérants de cafés et de restaurants : choisir sa caisse, menu QR code gratuit, commissions Deliveroo et Uber Eats.",
      },
      id: {
        title: "Blog: Tips Bisnis Kafe & Warung — EPIDOM",
        description:
          "Panduan dan tips untuk pemilik warung, kafe, dan restoran: sistem kasir digital, menu QR code gratis, dan komisi GoFood serta GrabFood.",
      },
    },
  },

  docs: {
    path: "/docs",
    copy: {
      en: {
        title: "Docs & Help Center — EPIDOM",
        description:
          "Step-by-step guides for setting up your storefront, menu, orders, and POS cashier.",
      },
      fr: {
        title: "Documentation et centre d'aide — EPIDOM",
        description:
          "Guides pas à pas pour configurer votre vitrine, votre menu, vos commandes et votre caisse POS.",
      },
      id: {
        title: "Dokumentasi & Pusat Bantuan — EPIDOM",
        description:
          "Panduan langkah demi langkah untuk menyiapkan toko online, menu, pesanan, dan kasir POS Anda.",
      },
    },
  },
};

const NBSP = String.fromCharCode(0xa0);

/** The POS monthly price in the currency of `locale`, with non-breaking spaces. */
function posPrice(locale: Locale): string {
  return formatPlanPrice("POS", LOCALE_PRICE_CURRENCY[locale], "monthly").replace(/ /g, NBSP);
}

/**
 * Metadata for one marketing page in one locale. Pure of request state, so
 * tests can walk every page in every locale.
 */
export function buildPageMetadata(page: MarketingMetaPage, locale: Locale): Metadata {
  const { path, keywords, copy, noindex } = PAGES[page];
  const { title, description, ogTitle, ogDescription } = copy[locale];
  const fill = (text: string) => text.replace("{price}", posPrice(locale));

  return buildLocalizedMetadata({
    basePath: path,
    locale,
    title: fill(title),
    description: fill(description),
    ogTitle: ogTitle && fill(ogTitle),
    ogDescription: ogDescription && fill(ogDescription),
    keywords,
    noindex,
  });
}

/** `export const generateMetadata = pageMetadata("pricing")` in a page file. */
export function pageMetadata(page: MarketingMetaPage) {
  return async function generateMetadata(): Promise<Metadata> {
    return buildPageMetadata(page, await getRequestLocale());
  };
}
