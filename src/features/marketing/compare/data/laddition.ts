import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts checked 2026-10 on L'Addition's own site only:
// - https://www.laddition.com/ : iPad cash register, Click & Collect, L'Addition achats,
//   online reservation, digital menu, reporting, "Nos TPE", Tap to Pay on iPhone;
//   no prices ("Je veux un devis !"), demo offered ("Obtenir une démo").
// - https://www.laddition.com/prix : no published prices; configurable items: iPad /
//   iPad Pro register, Epson thermal printer (wired or wireless), L'Addition Pay+
//   payment terminal, mobile order-taking on iPad Mini or iPhone.
// Third-party figures (e.g. independant.io): not used. Features the site does not
// mention (offline, stock, scheduling, trial) are deliberately NOT compared.
export const ladditionComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "laddition",
    eyebrow: "Epidom vs. L'Addition",
    titleParts: [
      "L'Addition\u00a0: un devis sur mesure.",
      "Epidom\u00a0: les prix sont sur la page.",
    ],
    lede: "L'Addition propose une caisse iPad pensée pour la restauration, avec des modules de Click & Collect, de réservation en ligne, de menu digital et des terminaux de paiement. Son site ne publie pas de tarifs\u00a0: tout passe par un devis. Epidom affiche ses forfaits et ses prix directement, et démarre par une vitrine gratuite.",
    colCompetitor: "L'Addition",
    rows: [
      {
        feature: "Tarifs publics",
        epidom: "Oui\u00a0: Gratuit, POS 13,99 €/mois, Operations 27,99 €/mois (avant taxes)",
        competitor: "Non publiés sur leur site (vérifié en octobre 2026) — sur devis",
      },
      {
        feature: "Commande en ligne depuis votre page",
        epidom: "Incluse dans POS (13,99 €/mois, 14 jours d'essai)",
        competitor: "Module Click & Collect proposé",
      },
      {
        feature: "Réservation de tables",
        epidom: "Incluse dans POS",
        competitor: "Module de réservation en ligne proposé",
      },
      {
        feature: "Matériel",
        epidom:
          "Navigateur, tablette, téléphone ou ordinateur\u00a0; imprimantes thermiques Bluetooth",
        competitor:
          "Caisse iPad, imprimante thermique, terminal de paiement (L'Addition Pay+), prise de commande mobile sur iPad Mini ou iPhone",
      },
    ],
    note: "Données L'Addition vérifiées sur le site officiel (laddition.com et laddition.com/prix) en octobre 2026. Comparaison limitée aux faits publiquement confirmés\u00a0; les prix non publiés ne sont pas présumés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs L'Addition",
    faqs: [
      {
        q: "Combien coûte L'Addition\u00a0?",
        a: "Leur site ne publie pas de tarifs\u00a0: il faut demander un devis, l'offre se composant d'éléments configurables (caisse, imprimante, terminal de paiement). Nous ne pouvons donc pas comparer de chiffres. Chez Epidom, POS est à 13,99 €/mois et Operations à 27,99 €/mois, avant taxes.",
      },
      {
        q: "L'Addition est-elle un meilleur choix pour mon restaurant\u00a0?",
        a: "Cela dépend de vos besoins. Si vous voulez une caisse iPad avec un terminal de paiement proposé par l'éditeur, L'Addition offre cela. Si vous préférez des prix affichés, démarrer par une vitrine gratuite et gérer stock, recettes et planning dans un seul outil, Epidom peut mieux convenir.",
      },
      {
        q: "Puis-je prendre des commandes en ligne avec Epidom\u00a0?",
        a: "Oui, avec le forfait POS (13,99 €/mois, 14 jours d'essai gratuit)\u00a0: sur place avec numéro de table, à emporter ou livraison par vos soins. Les commandes de la page sont à régler à la caisse. La vitrine seule, gratuite, ne prend pas de commandes.",
      },
      {
        q: "Epidom fournit-il les terminaux de paiement par carte\u00a0?",
        a: "Non, Epidom ne vend ni ne traite de paiements par carte. L'Addition propose des terminaux de paiement\u00a0; si cet équipement fourni par l'éditeur compte pour vous, demandez-leur un devis.",
      },
    ],
    ctaTitle: "Commencez par la vitrine gratuite.",
    ctaButton: "Essayer POS gratuitement pendant 14 jours →",
  },
  en: {
    slug: "laddition",
    eyebrow: "Epidom vs. L'Addition",
    titleParts: ["L'Addition: a custom quote.", "Epidom: prices are on the page."],
    lede: "L'Addition offers an iPad register built for restaurants, with Click & Collect, online reservation and digital menu modules, plus card payment terminals. Its site publishes no prices; everything goes through a quote. Epidom shows its plans and prices directly and starts with a free storefront.",
    colCompetitor: "L'Addition",
    rows: [
      {
        feature: "Public pricing",
        epidom: "Yes: Free, POS $14.99/month, Operations $29.99/month (before tax)",
        competitor: "Not published on their site (checked October 2026) — by quote",
      },
      {
        feature: "Online ordering from your own page",
        epidom: "Included in POS ($14.99/month, 14-day trial)",
        competitor: "Click & Collect module offered",
      },
      {
        feature: "Table reservations",
        epidom: "Included in POS",
        competitor: "Online reservation module offered",
      },
      {
        feature: "Hardware",
        epidom: "Browser, tablet, phone or computer; Bluetooth thermal printers",
        competitor:
          "iPad register, thermal printer, payment terminal (L'Addition Pay+), mobile order-taking on iPad Mini or iPhone",
      },
    ],
    note: "L'Addition facts checked on the official site (laddition.com and laddition.com/prix) in October 2026. Comparison limited to publicly confirmed facts; unpublished pricing is not assumed.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs L'Addition",
    faqs: [
      {
        q: "How much does L'Addition cost?",
        a: "Their site publishes no prices; you request a quote, and the offer is built from configurable items (register, printer, payment terminal). So we can't compare figures. At Epidom, POS is $14.99/month and Operations is $29.99/month, before tax.",
      },
      {
        q: "Is L'Addition a better fit for my restaurant?",
        a: "It depends. If you want an iPad register with a payment terminal offered by the vendor, L'Addition offers that. If you prefer posted prices, a free storefront to start, and stock, recipes and scheduling in one tool, Epidom may fit better.",
      },
      {
        q: "Can I take online orders with Epidom?",
        a: "Yes, on the POS plan ($14.99/month, 14-day free trial): dine-in with a table number, takeaway, or delivery by your own team. Orders are paid at the cashier. The free storefront alone doesn't take orders.",
      },
      {
        q: "Does Epidom supply card payment terminals?",
        a: "No, Epidom does not sell or process card payments. L'Addition offers payment terminals; if vendor-supplied payment hardware matters to you, ask them for a quote.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
