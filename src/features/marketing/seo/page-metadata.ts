import type { Metadata } from "next";
import type { Locale } from "@/components/lang/i18n-provider";
import { getRequestLocale } from "@/features/marketing/legal/metadata";
import { LOCALE_PRICE_CURRENCY, formatPlanPrice } from "@/lib/constants/plan-pricing";
import { buildLocalizedMetadata } from "@/lib/seo";

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
 * "{price}" in a description is replaced with the POS monthly price in the
 * served locale's currency (fr EUR, en USD, id IDR).
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
  | "status"
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
        title: "Epidom — Online Store, Menu & POS for F&B Businesses",
        description:
          "A menu page, online orders and payments in one link, plus a POS cashier. Storefront free forever; POS with a 14-day free trial. For cafés, restaurants and warungs.",
        ogTitle: "Epidom — Online Store & POS for F&B",
        ogDescription:
          "Menu page, online orders and POS cashier in one link. Free storefront, forever.",
      },
      fr: {
        title: "Epidom — Vitrine en ligne, menu et caisse pour cafés et restaurants",
        description:
          "Une page menu, des commandes et des paiements en ligne dans un seul lien, plus une caisse POS. Vitrine gratuite à vie ; caisse POS avec 14 jours d'essai gratuit. Pour cafés, restaurants et warungs.",
        ogTitle: "Epidom — Vitrine en ligne et caisse POS pour le F&B",
        ogDescription:
          "Page menu, commandes en ligne et caisse POS dans un seul lien. Vitrine gratuite à vie.",
      },
      id: {
        title: "Epidom — Toko Online, Menu & Kasir POS untuk Bisnis F&B",
        description:
          "Halaman menu, pesanan online, dan pembayaran dalam satu link, plus kasir POS. Halaman toko gratis selamanya; POS dengan uji coba gratis 14 hari. Untuk kafe, restoran, dan warung.",
        ogTitle: "Epidom — Toko Online & Kasir POS untuk F&B",
        ogDescription:
          "Halaman menu, pesanan online, dan kasir POS dalam satu link. Halaman toko gratis selamanya.",
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
        title: "Pricing — EPIDOM",
        description:
          "Start free, grow as you need. Epidom plans for cafés, warungs and restaurants: free storefront forever, POS from {price}/mo after a 14-day free trial.",
        ogTitle: "Pricing — EPIDOM · Start Free",
        ogDescription:
          "Start free, grow as you need. Epidom pricing plans for cafés, restaurants and F&B businesses.",
      },
      fr: {
        title: "Tarifs — EPIDOM",
        description:
          "Commencez gratuitement, évoluez selon vos besoins. Forfaits Epidom pour cafés, warungs et restaurants : vitrine gratuite à vie, caisse POS à partir de {price}/mois après 14 jours d'essai gratuit.",
        ogTitle: "Tarifs — EPIDOM · Commencez gratuitement",
        ogDescription:
          "Commencez gratuitement, évoluez selon vos besoins. Les forfaits Epidom pour cafés, restaurants et établissements F&B.",
      },
      id: {
        title: "Harga — EPIDOM",
        description:
          "Mulai gratis, berkembang sesuai kebutuhan. Paket Epidom untuk kafe, warung, dan restoran: halaman toko gratis selamanya, POS mulai {price}/bulan setelah uji coba gratis 14 hari.",
        ogTitle: "Harga — EPIDOM · Mulai Gratis",
        ogDescription:
          "Mulai gratis, berkembang sesuai kebutuhan. Paket harga Epidom untuk kafe, restoran, dan bisnis F&B.",
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
          "Epidom est conçu par une petite équipe produit de Prionation, qui travaille depuis Bali et Paris avec des établissements F&B. Un seul lien pour votre menu, vos commandes et vos paiements.",
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
        title: "Features — EPIDOM",
        description:
          "Everything Epidom offers: a free menu page, POS cashier, kitchen display (KDS), inventory management, operational reports and multi-outlet, for F&B businesses.",
        ogTitle: "Full Features — EPIDOM F&B Platform",
        ogDescription:
          "From a free menu page to a POS cashier and operational reports. One platform for cafés, warungs and restaurants.",
      },
      fr: {
        title: "Fonctionnalités — EPIDOM",
        description:
          "Tout ce que propose Epidom : page menu gratuite, caisse POS, écran cuisine (KDS), gestion des stocks, rapports d'exploitation et multi-établissements, pour les établissements F&B.",
        ogTitle: "Toutes les fonctionnalités — la plateforme F&B EPIDOM",
        ogDescription:
          "De la page menu gratuite à la caisse POS et aux rapports d'exploitation. Une seule plateforme pour cafés, warungs et restaurants.",
      },
      id: {
        title: "Fitur — EPIDOM",
        description:
          "Semua yang ditawarkan Epidom: halaman menu gratis, kasir POS, kitchen display (KDS), manajemen stok, laporan operasional, dan multi-outlet untuk bisnis F&B.",
        ogTitle: "Fitur Lengkap — Platform F&B EPIDOM",
        ogDescription:
          "Dari halaman menu gratis hingga kasir POS dan laporan operasional. Satu platform untuk kafe, warung, dan restoran.",
      },
    },
  },

  partners: {
    path: "/partners",
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

  status: {
    path: "/status",
    copy: {
      en: {
        title: "Status — EPIDOM",
        description: "Current status of Epidom's core services, updated manually by the team.",
      },
      fr: {
        title: "État du système — EPIDOM",
        description:
          "État actuel des services principaux d'Epidom, mis à jour manuellement par l'équipe.",
      },
      id: {
        title: "Status Sistem — EPIDOM",
        description: "Status terkini layanan inti Epidom, diperbarui manual oleh tim.",
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
        title: "Compare Epidom — EPIDOM",
        description:
          "Factual, sourced comparisons between Epidom and the POS and ordering tools you already use.",
      },
      fr: {
        title: "Comparer Epidom — EPIDOM",
        description:
          "Des comparaisons factuelles et sourcées entre Epidom et les outils de caisse et de commande que vous utilisez déjà.",
      },
      id: {
        title: "Bandingkan Epidom — EPIDOM",
        description:
          "Perbandingan faktual dan bersumber antara Epidom dan alat kasir serta pemesanan yang sudah Anda pakai.",
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
    copy: {
      en: {
        title: "Epidom vs. GoFood, GrabFood, ShopeeFood & Delivery-App Commission",
        description:
          "Every order through a delivery app pays a commission. A storefront you own doesn't. Compare Epidom's commission-free online ordering with delivery-platform fees.",
      },
      fr: {
        title:
          "Epidom face aux commissions de GoFood, GrabFood, ShopeeFood et des applis de livraison",
        description:
          "Chaque commande passée par une appli de livraison supporte une commission. Une vitrine qui vous appartient n'en prélève pas. Comparez la commande en ligne d'Epidom, sans commission, aux frais des plateformes de livraison.",
      },
      id: {
        title: "Epidom vs. Komisi GoFood, GrabFood, ShopeeFood & Aplikasi Pengantaran",
        description:
          "Setiap pesanan lewat aplikasi pengantaran dikenai komisi. Toko online milik Anda sendiri tidak. Bandingkan pemesanan online Epidom tanpa komisi dengan biaya platform pengantaran.",
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
        title: "Blog — EPIDOM",
        description:
          "Guides, stories and tips for warung, café, and restaurant owners on running a smarter F&B business.",
      },
      fr: {
        // "Blog" is the word in all three languages.
        title: "Blog — EPIDOM",
        description:
          "Guides, récits et conseils pour les gérants de warungs, de cafés et de restaurants qui veulent mieux piloter leur établissement F&B.",
      },
      id: {
        title: "Blog — EPIDOM",
        description:
          "Panduan, cerita, dan tips untuk pemilik warung, kafe, dan restoran dalam menjalankan bisnis F&B yang lebih cerdas.",
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
  const { path, keywords, copy } = PAGES[page];
  const { title, description, ogTitle, ogDescription } = copy[locale];
  const fill = (text: string) => text.replace("{price}", posPrice(locale));

  return buildLocalizedMetadata({
    basePath: path,
    locale,
    title,
    description: fill(description),
    ogTitle,
    ogDescription: ogDescription && fill(ogDescription),
    keywords,
  });
}

/** `export const generateMetadata = pageMetadata("pricing")` in a page file. */
export function pageMetadata(page: MarketingMetaPage) {
  return async function generateMetadata(): Promise<Metadata> {
    return buildPageMetadata(page, await getRequestLocale());
  };
}
