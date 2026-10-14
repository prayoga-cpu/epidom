import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts checked 2026-10 on the competitor's own pages (France):
// - https://www.zettle.com/fr/tarifs -> "Commission sur transaction de 1,75 %";
//   "notre application sans frais supplémentaires"; card reader from 29 EUR "Hors
//   TVA" (new business users only; extra reader 79 EUR); terminal from 199 EUR and
//   POS system from 229 EUR, both "Hors TVA"; "Aucun contrat ni aucuns frais
//   récurrents"; "Gestion des produits et du stock" in the POS software.
// - https://www.zettle.com/fr -> product being renamed "PayPal Point of Sale".
// Online ordering, offline mode, recipes and rosters are not stated on the pages
// checked: deliberately NOT compared. Third-party sources: not used.
// We compare under the name "Zettle by PayPal (PayPal POS)".
export const zettleComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "zettle",
    eyebrow: "Epidom vs. Zettle",
    titleParts: [
      "Zettle\u00a0: une appli gratuite, payée à la transaction.",
      "Epidom\u00a0: une caisse pour tout le service.",
    ],
    lede: "Zettle by PayPal (en cours de renommage en PayPal Point of Sale) propose une application de caisse sans frais d'abonnement, un lecteur de carte à partir de 29 € HT et aucun contrat. C'est une solution simple pour encaisser. Epidom est un abonnement mensuel qui ajoute, autour de l'encaissement, la page de commande de votre établissement, la cuisine, les recettes et le suivi du personnel.",
    colCompetitor: "Zettle by PayPal",
    rows: [
      {
        feature: "Prix de l'application de caisse",
        epidom: "Gratuit pour la vitrine\u00a0; caisse POS à 13,99 €/mois (14 jours d'essai)",
        competitor: "Application « sans frais supplémentaires »",
      },
      {
        feature: "Coût des paiements par carte",
        epidom: "Non applicable\u00a0: Epidom n'encaisse pas les cartes à votre place",
        competitor: "1,75 % par transaction par carte",
      },
      {
        feature: "Matériel",
        epidom:
          "Navigateur sur téléphone, tablette ou ordinateur\u00a0; imprimantes thermiques Bluetooth prises en charge",
        competitor:
          "Lecteur à partir de 29 € HT (nouveaux clients professionnels), terminal à partir de 199 € HT, système de caisse à partir de 229 € HT",
      },
      {
        feature: "Contrat et frais récurrents",
        epidom: "Abonnement mensuel ou annuel ; essai de 14 jours pour le forfait POS",
        competitor: "Aucun contrat ni frais récurrents, selon leur page tarifs",
      },
      {
        feature: "Stock, recettes et coût de revient",
        epidom:
          "Inclus dans Operations (27,99 €/mois) : recettes, coût par plat, stock déduit automatiquement",
        competitor: "Gestion des produits et du stock incluse dans le logiciel de caisse",
      },
    ],
    note: "Données Zettle by PayPal vérifiées sur le site officiel (zettle.com/fr/tarifs) en octobre 2026\u00a0; les prix et frais peuvent changer. Comparaison limitée aux faits publiquement confirmés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Zettle",
    faqs: [
      {
        q: "Zettle est-il moins cher qu'Epidom\u00a0?",
        a: "Pour encaisser seulement, c'est possible\u00a0: l'application est sans frais supplémentaires et vous payez 1,75 % par transaction par carte, plus le lecteur à partir de 29 € HT. Epidom coûte 13,99 € par mois (forfait POS) mais ne traite pas les paiements par carte et n'y prélève donc aucune commission. À vous de comparer avec votre volume de ventes par carte.",
      },
      {
        q: "Puis-je utiliser Epidom avec le lecteur de carte Zettle\u00a0?",
        a: "Nous ne le garantissons pas. Epidom enregistre les paiements dans la caisse, mais n'est pas un service d'encaissement par carte. Vérifiez comment vous comptez encaisser les cartes avant de choisir.",
      },
      {
        q: "Quand Zettle est-il le meilleur choix\u00a0?",
        a: "Si vous voulez surtout un lecteur de carte, sans contrat ni frais récurrents, pour un stand ou une boutique à l'offre simple, Zettle répond bien au besoin. Epidom est plus adapté si vous gérez un service avec commandes, cuisine, recettes et équipe.",
      },
      {
        q: "Puis-je essayer Epidom sans payer d'abord\u00a0?",
        a: "Vous pouvez commencer sans payer\u00a0: la page vitrine avec votre menu est gratuite, et le forfait POS démarre par 14 jours d'essai gratuit.",
      },
    ],
    ctaTitle: "Une caisse pensée pour le service.",
    ctaButton: "Essayer la caisse 14 jours →",
  },
  en: {
    slug: "zettle",
    eyebrow: "Epidom vs. Zettle",
    titleParts: [
      "Zettle: a free app, paid per transaction.",
      "Epidom: a POS for the whole service.",
    ],
    lede: "Zettle by PayPal (being renamed PayPal Point of Sale) offers a POS app with no subscription fee, a card reader from 29 € excl. VAT and no contract. It is a simple way to take payments. Epidom is a monthly subscription that adds, around the till, your venue's ordering page, the kitchen, recipes and staff tracking.",
    colCompetitor: "Zettle by PayPal",
    rows: [
      {
        feature: "Price of the POS app",
        epidom: "Storefront free; POS at $14.99/month (14-day trial)",
        competitor: 'App with "no additional fees" (sans frais supplémentaires)',
      },
      {
        feature: "Card payment cost",
        epidom: "Not applicable: Epidom does not process card payments for you",
        competitor: "1.75% per card transaction",
      },
      {
        feature: "Hardware",
        epidom: "Browser on a phone, tablet or computer; Bluetooth thermal printers supported",
        competitor:
          "Reader from 29 € excl. VAT (new business users), terminal from 199 € excl. VAT, POS system from 229 € excl. VAT",
      },
      {
        feature: "Contract and recurring fees",
        epidom: "Monthly or annual subscription; 14-day trial on the POS plan",
        competitor: "No contract and no recurring fees, per their pricing page",
      },
      {
        feature: "Stock, recipes and cost per dish",
        epidom:
          "Included in Operations ($29.99/month): recipes, cost per dish, stock deducted automatically",
        competitor: "Product and stock management included in the POS software",
      },
    ],
    note: "Zettle by PayPal facts checked on the official site (zettle.com/fr/tarifs, French market) in October 2026; prices and fees can change. Comparison limited to publicly confirmed facts.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Zettle",
    faqs: [
      {
        q: "Is Zettle cheaper than Epidom?",
        a: "For taking payments only, it can be: the app has no additional cost and you pay 1.75% per card transaction, plus a reader from 29 € excl. VAT. Epidom costs $14.99 per month (POS plan) but does not process card payments and so takes no commission on them. Compare it with your own card sales volume.",
      },
      {
        q: "Can I use Epidom with a Zettle card reader?",
        a: "We do not guarantee it. Epidom records payments at the POS but is not a card processing service. Check how you plan to take cards before choosing.",
      },
      {
        q: "When is Zettle the better choice?",
        a: "If you mainly want a card reader with no contract or recurring fees, for a stall or a shop with a simple offer, Zettle fits well. Epidom suits you better if you run a service with orders, a kitchen, recipes and a team.",
      },
      {
        q: "Can I try Epidom without paying first?",
        a: "Yes. The storefront page with your menu is free, and the POS plan starts with a 14-day free trial.",
      },
    ],
    ctaTitle: "A POS built for service.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
