import type { Article } from "@/features/marketing/shared/content/article-types";

export const frPosts: Article[] = [
  {
    slug: "reduire-commission-deliveroo-uber-eats",
    locale: "fr",
    title: "Comment réduire sa dépendance aux commissions Deliveroo et Uber Eats",
    description:
      "Les apps de livraison restent utiles pour se faire découvrir, mais chaque commande qui passe par elles coûte une commission. Voici comment construire un canal de commande direct sans pour autant tout arrêter du jour au lendemain.",
    date: "2026-06-02",
    readMinutes: 6,
    category: "Commerce direct",
    blocks: [
      {
        type: "p",
        text: "La plupart des restaurateurs et gérants de café ne quittent jamais complètement les apps de livraison — et ce n'est pas ce qu'on vous propose ici. Le problème n'est pas Deliveroo ou Uber Eats en soi, c'est de ne dépendre que d'elles pour chaque commande, y compris celles de vos habitués qui vous connaissent déjà.",
      },
      { type: "h2", text: "Ce que coûte réellement une commande via une app" },
      {
        type: "p",
        text: "Chaque commande passée par une plateforme de livraison paie une commission prélevée avant même que vous ne voyiez l'argent. À cela s'ajoute un détail qu'on oublie souvent : la donnée client — qui a commandé, quand, quoi — reste à la plateforme. Vous ne pouvez pas recontacter directement un client qui a adoré son plat la semaine dernière.",
      },
      { type: "h2", text: "Le canal direct : pas un remplacement, un complément" },
      {
        type: "list",
        items: [
          "Une vitrine en ligne à vous — un lien que vous mettez dans votre bio Instagram, sur un QR code de table, ou dans un statut WhatsApp",
          "Zéro commission sur les commandes qui passent par ce lien",
          "Vous gardez le contact direct (WhatsApp) avec le client, pour les commandes récurrentes",
          "Ça ne remplace pas votre présence sur les apps de livraison — les deux coexistent très bien",
        ],
      },
      {
        type: "quote",
        text: "L'objectif n'est pas de \"battre\" les apps de livraison. C'est de ne plus être totalement dépendant d'elles pour les clients qui vous connaissent déjà.",
      },
      { type: "h2", text: "Par où commencer" },
      {
        type: "p",
        text: "Le plus simple : créez une vitrine gratuite avec votre menu, partagez le lien partout où vos clients vous trouvent déjà (bio Instagram, table, réseaux), et laissez les deux canaux — direct et plateformes — cohabiter. Aucune configuration technique nécessaire.",
      },
    ],
  },
  {
    slug: "menu-qr-code-gratuit-restaurant-guide",
    locale: "fr",
    title: "Menu QR code gratuit pour restaurant : le guide complet",
    description:
      "Tout ce qu'il faut savoir avant de mettre en place un menu QR code : ce que ça change vraiment pour vos clients, les pièges à éviter, et comment le faire sans dépenser un centime.",
    date: "2026-06-16",
    readMinutes: 5,
    category: "Mise en place",
    blocks: [
      {
        type: "p",
        text: "Le menu QR code s'est banalisé depuis 2020, mais beaucoup d'établissements en sont restés à la version la plus basique : un PDF scanné, illisible sur mobile, jamais mis à jour. Un vrai menu QR code, c'est autre chose.",
      },
      { type: "h2", text: "Un PDF n'est pas un menu QR code" },
      {
        type: "p",
        text: "Scanner votre carte papier et la mettre en PDF derrière un QR code règle un problème (éviter le contact du menu physique) mais en crée un autre : c'est illisible sur petit écran, impossible à mettre à jour sans tout refaire, et ça ne permet aucune commande directe.",
      },
      { type: "h2", text: "Ce qu'un vrai menu QR code doit permettre" },
      {
        type: "list",
        items: [
          "Lisible et rapide sur mobile, sans zoomer",
          "Modifiable en quelques secondes — un plat en rupture, un prix qui change",
          "Photos par article, catégories claires",
          "Idéalement, la commande directement depuis le menu, sans repasser par une app tierce",
        ],
      },
      { type: "h2", text: "Le mettre en place gratuitement" },
      {
        type: "p",
        text: "Vous n'avez pas besoin de développeur ni de budget design. Une vitrine en ligne gratuite avec menu structuré, QR code téléchargeable et lien partageable prend environ 5 minutes à créer — le plus long, c'est de rentrer vos plats et leurs prix.",
      },
    ],
  },
  {
    slug: "caisse-enregistreuse-cafe-guide-choix",
    locale: "fr",
    title: "Caisse enregistreuse pour café : ce qu'il faut savoir avant de choisir",
    description:
      "Entre la caisse enregistreuse classique et un système de caisse POS moderne, le choix dépend surtout de votre volume de commandes et de votre équipe. Voici comment trancher.",
    date: "2026-07-01",
    readMinutes: 5,
    category: "Opérations",
    blocks: [
      {
        type: "p",
        text: "Un café qui démarre avec un seul gérant n'a pas les mêmes besoins qu'un établissement avec plusieurs services et une équipe en rotation. Avant de choisir un système de caisse, il vaut mieux se poser la bonne question : à partir de quand une caisse enregistreuse classique devient un frein plutôt qu'un outil ?",
      },
      { type: "h2", text: "Les signes qu'il est temps de passer à un vrai système de caisse" },
      {
        type: "list",
        items: [
          "Vous embauchez un premier employé en caisse et devez lui déléguer sans tout superviser",
          "Le rapprochement de caisse en fin de journée prend plus de 15 minutes",
          "Vous perdez du temps à recompter manuellement les tickets papier",
          "Vous voulez suivre vos ventes par article, pas juste un total en fin de journée",
        ],
      },
      { type: "h2", text: "Ce qu'un système de caisse moderne change concrètement" },
      {
        type: "p",
        text: "Au-delà de l'encaissement, un système de caisse pensé pour la restauration relie la commande, le paiement, et l'impression du ticket en un seul geste — sur tablette ou téléphone, sans matériel dédié coûteux au démarrage.",
      },
      {
        type: "p",
        text: "Le bon réflexe : commencer par la vitrine et la commande en ligne (gratuites), puis ajouter la caisse seulement quand le volume le justifie. Pas l'inverse.",
      },
    ],
  },
];
