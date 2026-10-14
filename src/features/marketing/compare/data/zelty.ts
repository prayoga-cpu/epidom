import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against zelty.fr (2026-08): no pricing page exists in
// their nav (a /tarifs URL returns 404), sales contact only. Zelty
// includes Click & Collect online ordering integrated into the POS, but
// whether it's free/included or a paid add-on is not stated — we do not
// claim either way. Do not add claims beyond what's confirmed there.
// Epidom column corrected 2026-10-14: only the storefront page is free; online
// ordering is a POS-plan feature (14-day trial). No setup-time claims.
export const zeltyComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "zelty",
    eyebrow: "Epidom vs. Zelty",
    titleParts: ["Zelty : contactez les ventes.", "Epidom : le prix est sur la page."],
    lede: "Zelty propose une caisse iPad complète avec Click & Collect intégré et plus de 80 intégrations. Leur site ne propose aucune page tarifaire publique — tout passe par un contact commercial. Epidom affiche ses prix directement, sans étape intermédiaire.",
    colCompetitor: "Zelty",
    rows: [
      { feature: "Page tarifaire publique", epidom: "Oui, prix affichés directement", competitor: "Aucune trouvée — contact commercial uniquement" },
      { feature: "Forfait gratuit", epidom: "Oui : la vitrine (page menu + QR code), gratuite pour toujours", competitor: "Non mentionné sur leur site" },
      { feature: "Commande en ligne (Click & Collect)", epidom: "Incluse dans le forfait POS (13,99 €/mois, 14 jours d'essai)", competitor: "Proposée, conditions tarifaires non précisées publiquement" },
      { feature: "Mise en route", epidom: "En libre-service, sans rendez-vous commercial", competitor: "Numéro de téléphone dédié aux ventes" },
    ],
    note: "Données Zelty vérifiées sur zelty.fr en août 2026 — aucune page /tarifs active trouvée dans leur navigation. Comparaison limitée à ce qui est publiquement confirmé ; ne pas présumer de prix non publiés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Zelty",
    faqs: [
      {
        q: "Le Click & Collect de Zelty est-il gratuit ?",
        a: "Ce n'est pas précisé publiquement sur leur site — contactez leur équipe commerciale pour le savoir. Chez Epidom, la commande en ligne est incluse dans le forfait POS, à 13,99 €/mois, avec 14 jours d'essai.",
      },
      {
        q: "Pourquoi comparer sans connaître le prix de Zelty ?",
        a: "C'est justement la différence à souligner : vous ne pouvez pas savoir ce que Zelty coûte sans passer un appel commercial, alors que le prix d'Epidom est visible immédiatement sur la page tarifs.",
      },
    ],
    ctaTitle: "Le prix, sans appel commercial.",
    ctaButton: "Démarrer gratuitement →",
  },
  en: {
    slug: "zelty",
    eyebrow: "Epidom vs. Zelty",
    titleParts: ["Zelty: contact sales.", "Epidom: the price is on the page."],
    lede: "Zelty offers a full iPad POS with integrated Click & Collect ordering and 80+ integrations. Their site has no public pricing page — everything goes through a sales contact. Epidom shows its prices directly, no intermediate step.",
    colCompetitor: "Zelty",
    rows: [
      { feature: "Public pricing page", epidom: "Yes, prices shown directly", competitor: "None found — sales contact only" },
      { feature: "Free plan", epidom: "Yes: the storefront (menu page + QR code), free forever", competitor: "Not mentioned on their site" },
      { feature: "Online ordering (Click & Collect)", epidom: "Included in the POS plan ($14.99/mo, 14-day trial)", competitor: "Offered, pricing terms not stated publicly" },
      { feature: "Getting started", epidom: "Self-serve, no sales call", competitor: "Dedicated sales phone number" },
    ],
    note: "Zelty facts verified on zelty.fr as of August 2026 — no active /tarifs page found in their navigation. Comparison limited to what's publicly confirmed; unpublished pricing is not assumed.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Zelty",
    faqs: [
      {
        q: "Is Zelty's Click & Collect free?",
        a: "It's not stated publicly on their site — contact their sales team to find out. At Epidom, online ordering is included in the POS plan, $14.99/month with a 14-day trial.",
      },
      {
        q: "Why compare without knowing Zelty's price?",
        a: "That's exactly the point worth noting: you can't know what Zelty costs without a sales call, while Epidom's price is visible immediately on the pricing page.",
      },
    ],
    ctaTitle: "The price, no sales call.",
    ctaButton: "Start free →",
  },
};
