import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Lightspeed Restaurant (K-Series) facts, checked 2026-10 on Lightspeed's own help centre.
// lightspeedhq.fr and lightspeedhq.com marketing/pricing pages returned HTTP 403 to our
// fetcher, so NO price, plan, trial, contract or online-ordering claim is made.
//  - https://k-series-support.lightspeedhq.com/hc/en-us/articles/53028167251867-Offline-POS-functionality
//    (offline: orders, kitchen/bar tickets to local printers, cash/manual payments,
//    staff clock-in/out keep working on the local network; integrated card payments need
//    a terminal in standalone 4G/LTE mode; third-party integrations incl. delivery and
//    online ordering do not work offline; needs a LAN/Wi-Fi network)
//  - https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804658089-About-POS-devices
//    (POS app installed "on a supported iPad or iPhone"; no Android mentioned there)
//  - Help centre search results (2026-10) also list a Kitchen Display System that needs
//    its own iPad (k-series-support.lightspeedhq.com ... Setting-up-the-Kitchen-Display-System-1-0).
// Third-party sources (independant.io etc.): not used.
export const lightspeedComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "lightspeed",
    eyebrow: "Epidom vs. Lightspeed Restaurant",
    titleParts: [
      "Lightspeed\u00a0: une caisse sur iPad et iPhone.",
      "Epidom\u00a0: une caisse dans le navigateur, dès 13,99 € par mois.",
    ],
    lede: "Lightspeed Restaurant (K-Series) est une caisse pour restaurants, bars et cafés, qui s'installe sur iPad et iPhone et continue de fonctionner hors ligne sur le réseau local. Epidom vise les petits commerces de bouche\u00a0: une caisse dans le navigateur, une vitrine gratuite et une commande en ligne incluse dans le forfait POS.",
    colCompetitor: "Lightspeed Restaurant",
    rows: [
      {
        feature: "Appareils",
        epidom:
          "Navigateur sur téléphone, tablette ou ordinateur\u00a0; application Windows, macOS, Linux ou Android\u00a0; écran d'accueil d'un iPad ou iPhone",
        competitor: "Application installée sur un iPad ou un iPhone compatible",
      },
      {
        feature: "Mode hors ligne",
        epidom:
          "Inclus dans le forfait POS\u00a0: les ventes sont gardées sur l'appareil et se synchronisent au retour d'internet",
        competitor:
          "Prises de commande, tickets cuisine et bar vers les imprimantes locales et paiements manuels (espèces, chèque) fonctionnent hors ligne sur le réseau local\u00a0; paiements par carte intégrés et intégrations tierces (livraison, commande en ligne) non disponibles hors ligne",
      },
      {
        feature: "Écran cuisine",
        epidom:
          "Inclus dans le forfait POS (un écran)\u00a0; plusieurs écrans par poste dans Operations",
        competitor: "Écran cuisine (KDS) sur un iPad dédié",
      },
      {
        feature: "Pointage du personnel",
        epidom: "Pointage par PIN dans le forfait Operations (27,99 € par mois)",
        competitor: "Pointage entrée/sortie du personnel, utilisable aussi hors ligne",
      },
    ],
    note: "Données Lightspeed relevées en octobre 2026 sur le centre d'aide officiel de Lightspeed (k-series-support.lightspeedhq.com)\u00a0; leurs pages de tarifs n'étaient pas consultables, aucun prix n'est donc comparé. Comparaison limitée aux faits publiquement confirmés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Lightspeed",
    faqs: [
      {
        q: "Lightspeed est-il plus complet qu'Epidom\u00a0?",
        a: "Pour un restaurant de plusieurs salles, un groupe ou un besoin d'applications spécialisées, Lightspeed peut être un meilleur choix. Epidom s'adresse aux petits commerces qui veulent une caisse, une commande en ligne et un suivi de stock sans multiplier les modules.",
      },
      {
        q: "Faut-il du matériel Apple avec Epidom\u00a0?",
        a: "Non. Epidom fonctionne dans le navigateur d'un téléphone, d'une tablette ou d'un ordinateur, et s'installe aussi comme application Windows, macOS, Linux, Android ou sur l'écran d'accueil d'un iPad. L'application Lightspeed Restaurant s'installe, elle, sur un iPad ou un iPhone.",
      },
      {
        q: "Puis-je continuer à encaisser sans internet\u00a0?",
        a: "Avec Epidom, oui\u00a0: le forfait POS inclut un mode hors ligne, et les ventes se synchronisent au retour de la connexion. Lightspeed propose aussi un fonctionnement hors ligne sur le réseau local, avec des limites décrites dans son centre d'aide (par exemple pour les paiements par carte intégrés).",
      },
      {
        q: "Comment tester Epidom sans risque\u00a0?",
        a: "La vitrine avec votre menu est gratuite pour toujours, et le forfait POS démarre par 14 jours d'essai gratuit.",
      },
    ],
    ctaTitle: "Une caisse à prix affiché, à essayer d'abord.",
    ctaButton: "Essayer le POS 14 jours gratuitement →",
  },
  en: {
    slug: "lightspeed",
    eyebrow: "Epidom vs. Lightspeed Restaurant",
    titleParts: [
      "Lightspeed: a POS on iPad and iPhone.",
      "Epidom: a browser-based POS from $14.99 a month.",
    ],
    lede: "Lightspeed Restaurant (K-Series) is a POS for restaurants, bars and cafés that installs on iPad and iPhone and keeps working offline on the local network. Epidom targets small food businesses: a browser-based POS, a free storefront, and online ordering included in the POS plan.",
    colCompetitor: "Lightspeed Restaurant",
    rows: [
      {
        feature: "Devices",
        epidom:
          "Browser on a phone, tablet or computer; Windows, macOS, Linux or Android app; iPad or iPhone home screen",
        competitor: "App installed on a supported iPad or iPhone",
      },
      {
        feature: "Offline mode",
        epidom: "Included in POS: sales are kept on the device and sync when the internet returns",
        competitor:
          "Order taking, kitchen and bar tickets to local printers, and manual payments (cash, check) work offline on the local network; integrated card payments and third-party integrations (delivery, online ordering) do not work offline",
      },
      {
        feature: "Kitchen display",
        epidom: "Included in POS (one screen); several screens by station in Operations",
        competitor: "Kitchen display (KDS) on a dedicated iPad",
      },
      {
        feature: "Staff clock-in",
        epidom: "PIN clock-in in the Operations plan ($29.99 per month)",
        competitor: "Staff clock-in and clock-out, also available offline",
      },
    ],
    note: "Lightspeed facts collected in October 2026 from Lightspeed's official help centre (k-series-support.lightspeedhq.com); their pricing pages could not be read, so no prices are compared. Comparison limited to publicly confirmed facts.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Lightspeed",
    faqs: [
      {
        q: "Is Lightspeed more complete than Epidom?",
        a: "For a multi-room restaurant, a group, or a need for specialized apps, Lightspeed may be the better fit. Epidom is for small food businesses that want a POS, online ordering and stock tracking without stacking modules.",
      },
      {
        q: "Do I need Apple hardware with Epidom?",
        a: "No. Epidom runs in the browser on a phone, tablet or computer, and also installs as a Windows, macOS, Linux or Android app, or on an iPad home screen. The Lightspeed Restaurant app installs on an iPad or iPhone.",
      },
      {
        q: "Can I keep selling without internet?",
        a: "With Epidom, yes: the POS plan includes an offline mode, and sales sync when the connection returns. Lightspeed also works offline on the local network, with limits described in its help centre (for example for integrated card payments).",
      },
      {
        q: "How can I try Epidom with no risk?",
        a: "The storefront with your menu is free forever, and the POS plan starts with a 14-day free trial.",
      },
    ],
    ctaTitle: "A POS with the price on the page, free to try first.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
