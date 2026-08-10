import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against sundayapp.com and sundayapp.com/fr/tarifs/
// (2026-08): Sunday is a payment/ordering layer on top of an existing POS
// (no native POS of its own), no free tier, France pricing 29-199€/month
// plus per-transaction fees (0% bank/EU cards conditional on >30%
// adoption, 2% Amex/international, +0.5% penalty across all types below
// that threshold). Do not add claims beyond what's confirmed there.
export const sundayComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "sunday",
    eyebrow: "Epidom vs. Sunday",
    titleParts: ["Sunday s'ajoute à votre caisse.", "Epidom est votre caisse."],
    lede: "Sunday est une couche de paiement et de commande qui vient se greffer sur une caisse que vous avez déjà — ce n'est pas une caisse en soi. Epidom est la vitrine, la commande et la caisse, gratuit pour démarrer, sans commission sur les transactions.",
    colCompetitor: "Sunday",
    rows: [
      { feature: "Système de caisse", epidom: "Inclus (forfait POS)", competitor: "Aucun — nécessite une caisse existante (Toast, Clover, Square...)" },
      { feature: "Vitrine / menu en ligne", epidom: "Gratuite, pour toujours", competitor: "Non proposée — Sunday est une couche de paiement, pas une vitrine client" },
      { feature: "Abonnement mensuel", epidom: "0 € (gratuit), forfaits payants dès 13,99 €/mois", competitor: "À partir de 29 €/mois (France)" },
      { feature: "Commission par transaction", epidom: "Aucune", competitor: "0 % cartes bancaires/UE (sous condition), 2 % Amex/international (+0,5 % de pénalité globale si le taux d'adoption carte est sous 30 %)" },
      { feature: "Essai / démo", epidom: "Gratuit, en libre-service", competitor: "Démo sur demande, pas d'essai libre-service" },
    ],
    note: "Données Sunday vérifiées sur sundayapp.com/fr/tarifs/ en août 2026 (forfaits France : Starter 29 €, Standard 99 €, Premium 199 €/mois ; frais de location terminal 35 €/mois sur engagement 36 mois). Tarifs et conditions susceptibles de changer — se référer à leur site officiel.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Sunday",
    faqs: [
      {
        q: "Est-ce que je peux utiliser Sunday et Epidom en même temps ?",
        a: "Techniquement oui puisque Sunday s'ajoute à une caisse existante — mais si vous n'avez pas encore de caisse, Epidom vous évite d'avoir à en acheter une séparément avant de pouvoir utiliser un outil comme Sunday.",
      },
      {
        q: "Pourquoi Epidom n'a pas de frais de transaction ?",
        a: "Le forfait payant Epidom est un abonnement fixe, pas un pourcentage sur chaque paiement — vous savez exactement ce que vous payez chaque mois, quel que soit votre volume de ventes.",
      },
    ],
    ctaTitle: "La caisse et la vitrine, sans commission.",
    ctaButton: "Démarrer gratuitement →",
  },
  en: {
    slug: "sunday",
    eyebrow: "Epidom vs. Sunday",
    titleParts: ["Sunday sits on top of your POS.", "Epidom is your POS."],
    lede: "Sunday is a payment and ordering layer that plugs into a POS you already have — it isn't a POS itself. Epidom is the storefront, ordering, and cashier, free to start, with no per-transaction commission.",
    colCompetitor: "Sunday",
    rows: [
      { feature: "POS/cashier system", epidom: "Included (POS plan)", competitor: "None — requires an existing POS (Toast, Clover, Square...)" },
      { feature: "Online storefront/menu", epidom: "Free, forever", competitor: "Not offered — Sunday is a payment layer, not a customer storefront" },
      { feature: "Monthly fee", epidom: "$0 (free), paid plans from $14.99/mo", competitor: "From 29€/month (France)" },
      { feature: "Per-transaction commission", epidom: "None", competitor: "0% bank/EU cards (conditional), 2% Amex/international (+0.5% penalty across all card types if adoption is under 30%)" },
      { feature: "Trial / demo", epidom: "Free, self-serve", competitor: "Demo on request, no self-serve trial" },
    ],
    note: "Sunday facts verified on sundayapp.com/fr/tarifs/ as of August 2026 (France plans: Starter 29€, Standard 99€, Premium 199€/month; terminal rental 35€/month on a 36-month contract). Pricing and terms may change — check their official site.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Sunday",
    faqs: [
      {
        q: "Can I use Sunday and Epidom together?",
        a: "Technically yes, since Sunday layers onto an existing POS — but if you don't have a POS yet, Epidom means you don't need to buy one separately before using a tool like Sunday.",
      },
      {
        q: "Why doesn't Epidom charge a transaction fee?",
        a: "Epidom's paid plan is a fixed subscription, not a percentage of each payment — you know exactly what you're paying each month regardless of your sales volume.",
      },
    ],
    ctaTitle: "POS and storefront, no commission.",
    ctaButton: "Start free →",
  },
};
