import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Innovorder facts checked 2026-10 on the competitor's own site only:
// - https://www.innovorder.com/prix (Starter "à partir de" 79 €/mois, 1 point de
//   vente, "Facturé mensuellement, hors matériel", 1 caisse enregistreuse; Growth
//   "à partir de" 299 €/mois, 2 à 10 points de vente, lists borne de commande,
//   commande en ligne, fidélité, KDS, ODS; Grands Comptes >10 sites "Sur-mesure";
//   prices exclude hardware; register takes payments "même hors connexion";
//   customer service free 6 days a week by phone, email and chat)
// Third-party sources: not used. Features the page does not state (free trial,
// stock/recipe costing, staff scheduling) are deliberately NOT compared.
export const innovorderComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "innovorder",
    eyebrow: "Epidom vs. Innovorder",
    titleParts: [
      "Innovorder : caisse, bornes et plusieurs points de vente.",
      "Epidom : un seul commerce, du prix de départ clair.",
    ],
    lede: "Innovorder propose une caisse, des bornes de commande, la commande en ligne et un écran cuisine, avec des formules par nombre de points de vente. Epidom s'adresse plutôt à un café, une boulangerie ou un restaurant indépendant : une vitrine gratuite, puis une caisse à 13,99 € par mois, matériel libre.",
    colCompetitor: "Innovorder",
    rows: [
      {
        feature: "Prix publics",
        epidom: "Oui : Gratuit, POS 13,99 €/mois, Operations 27,99 €/mois (avant taxes)",
        competitor:
          "Oui : Starter à partir de 79 €/mois, Growth à partir de 299 €/mois, hors matériel",
      },
      {
        feature: "Formule d'entrée",
        epidom: "Vitrine gratuite pour toujours ; POS avec 14 jours d'essai gratuit",
        competitor: "Starter : 1 point de vente, 1 caisse enregistreuse, facturé mensuellement",
      },
      {
        feature: "Commande en ligne depuis votre page",
        epidom:
          "Incluse dans POS (13,99 €/mois, 14 jours d'essai) : sur place, à emporter, livraison par vous-même ; paiement à la caisse",
        competitor: "Commande en ligne listée dans la formule Growth (à partir de 299 €/mois)",
      },
      {
        feature: "Mode hors ligne",
        epidom: "Oui, dès POS : les ventes se synchronisent au retour de la connexion",
        competitor: "Oui : la caisse peut encaisser sans connexion internet",
      },
      {
        feature: "Matériel",
        epidom:
          "Navigateur, application Android, iPad/iPhone ou bureau ; imprimantes thermiques Bluetooth",
        competitor: "Prix affichés hors matériel",
      },
    ],
    note: "Données Innovorder vérifiées sur le site officiel (innovorder.com/prix) en octobre 2026. Comparaison limitée aux faits publiquement confirmés ; les points non publiés ne sont pas présumés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Innovorder",
    faqs: [
      {
        q: "Innovorder ou Epidom pour un seul restaurant ?",
        a: "Pour un seul commerce, Epidom affiche POS à 13,99 €/mois après 14 jours d'essai, et Innovorder Starter à partir de 79 €/mois, hors matériel. Les deux offres n'ont pas le même périmètre : Innovorder propose notamment des bornes de commande, qu'Epidom ne propose pas, et indique un service client gratuit six jours sur sept.",
      },
      {
        q: "J'ai besoin de bornes de commande. Que choisir ?",
        a: "Innovorder propose des bornes de commande (formule Growth) ; Epidom n'en propose pas. Si les bornes sont essentielles à votre service, Innovorder est le meilleur choix des deux.",
      },
      {
        q: "Et si je gère plusieurs points de vente ?",
        a: "Epidom couvre jusqu'à 3 points de vente avec une vue financière globale (Operations) ; au-delà, c'est un devis. Innovorder structure son offre autour de 2 à 10 points de vente (Growth) puis du sur-mesure. Pour un grand réseau, Innovorder peut être mieux adapté.",
      },
      {
        q: "Le prix du matériel est-il compris ?",
        a: "Chez Innovorder, les prix publiés sont hors matériel. Epidom fonctionne sur un appareil que vous possédez déjà (navigateur, tablette, téléphone) ; les imprimantes Bluetooth sont facultatives.",
      },
    ],
    ctaTitle: "Commencez par la vitrine gratuite.",
    ctaButton: "Essayer le POS 14 jours gratuitement →",
  },
  en: {
    slug: "innovorder",
    eyebrow: "Epidom vs. Innovorder",
    titleParts: [
      "Innovorder: POS, kiosks and several points of sale.",
      "Epidom: one independent shop, a clear starting price.",
    ],
    lede: "Innovorder offers a cash register, ordering kiosks, online ordering and a kitchen display, with plans organised by number of points of sale. Epidom is aimed at an independent café, bakery or restaurant: a free storefront, then a POS at $14.99 per month, on hardware you choose.",
    colCompetitor: "Innovorder",
    rows: [
      {
        feature: "Public pricing",
        epidom: "Yes: Free, POS $14.99/month, Operations $29.99/month (before tax)",
        competitor: "Yes: Starter from €79/month, Growth from €299/month, hardware excluded",
      },
      {
        feature: "Entry plan",
        epidom: "Free storefront forever; POS with a 14-day free trial",
        competitor: "Starter: 1 point of sale, 1 register, billed monthly",
      },
      {
        feature: "Online ordering from your own page",
        epidom:
          "Included in POS ($14.99/month, 14-day trial): dine-in, takeaway, delivery by the shop; pay at the cashier",
        competitor: "Online ordering listed under the Growth plan (from €299/month)",
      },
      {
        feature: "Offline mode",
        epidom: "Yes, from POS: sales sync when the connection returns",
        competitor: "Yes: the register can take payments without an internet connection",
      },
      {
        feature: "Hardware",
        epidom: "Browser, Android app, iPad/iPhone or desktop; Bluetooth thermal printers",
        competitor: "Published prices exclude hardware",
      },
    ],
    note: "Innovorder facts checked on the official site (innovorder.com/prix) in October 2026. Comparison limited to publicly confirmed facts; unpublished points are not assumed.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Innovorder",
    faqs: [
      {
        q: "Innovorder or Epidom for a single restaurant?",
        a: "For a single shop, Epidom lists POS at $14.99/month after a 14-day trial, and Innovorder lists Starter from €79/month, hardware excluded. The two offers do not cover the same scope: Innovorder lists ordering kiosks, which Epidom does not offer, and states free customer service six days a week.",
      },
      {
        q: "I need self-ordering kiosks. Which one?",
        a: "Innovorder lists ordering kiosks (Growth plan); Epidom does not offer them. If kiosks are essential to your service, Innovorder is the better fit of the two.",
      },
      {
        q: "What if I run several locations?",
        a: "Epidom covers up to 3 outlets with an all-outlets finance view (Operations); beyond that it is a custom quote. Innovorder builds its offer around 2 to 10 points of sale (Growth), then custom pricing. For a large chain, Innovorder may be the better fit.",
      },
      {
        q: "Is hardware included in the price?",
        a: "Innovorder's published prices exclude hardware. Epidom runs on a device you may already own (browser, tablet, phone); Bluetooth printers are optional.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
