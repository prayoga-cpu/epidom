import type { Article } from "@/features/marketing/shared/content/article-types";

export const frGuides: Article[] = [
  {
    slug: "demarrage",
    locale: "fr",
    title: "Créer votre vitrine gratuite en 5 minutes",
    description:
      "Les étapes pour publier votre première page menu et commencer à recevoir des commandes, sans configuration technique.",
    date: "2026-05-10",
    readMinutes: 4,
    category: "Démarrage",
    blocks: [
      {
        type: "p",
        text: "Votre vitrine Epidom est la page que vos clients verront — dans votre bio Instagram, sur un QR code de table, ou partagée directement. Voici comment la publier.",
      },
      { type: "h2", text: "1. Créer votre compte" },
      {
        type: "p",
        text: "Inscrivez-vous avec votre email. Aucune carte bancaire n'est demandée pour le forfait gratuit.",
      },
      { type: "h2", text: "2. Renseigner votre établissement" },
      {
        type: "list",
        items: [
          "Nom de l'établissement et lien personnalisé (epidom.fr/@votre-nom)",
          "Logo et couleur de thème",
          "Description courte et horaires d'ouverture",
        ],
      },
      { type: "h2", text: "3. Ajouter vos premiers plats" },
      {
        type: "p",
        text: "Créez au moins une catégorie, puis ajoutez vos articles avec photo, prix et description. Vous pourrez toujours en ajouter plus tard — inutile d'avoir toute la carte prête pour publier.",
      },
      { type: "h2", text: "4. Publier" },
      {
        type: "p",
        text: "Une fois publiée, votre vitrine est accessible immédiatement à son adresse. Téléchargez le QR code depuis les réglages pour l'imprimer sur vos tables ou votre vitrine.",
      },
    ],
  },
  {
    slug: "configurer-le-menu",
    locale: "fr",
    title: "Configurer votre menu : catégories, articles, options",
    description:
      "Comment organiser votre carte pour qu'elle soit claire pour vos clients et rapide à mettre à jour pour vous.",
    date: "2026-05-14",
    readMinutes: 4,
    category: "Configuration",
    blocks: [
      {
        type: "p",
        text: "Un menu bien structuré se lit en quelques secondes sur mobile. Voici comment l'organiser.",
      },
      { type: "h2", text: "Catégories" },
      {
        type: "p",
        text: "Regroupez vos articles par catégorie logique (Entrées, Plats, Boissons...). Vous pouvez réordonner les catégories à tout moment — l'ordre affiché suit l'ordre que vous définissez.",
      },
      { type: "h2", text: "Articles" },
      {
        type: "list",
        items: [
          "Photo — un article avec photo se vend mieux qu'un article sans",
          "Prix et description courte",
          "Marquer un article \"en rupture\" le masque temporairement sans le supprimer",
          "Mettre en avant vos meilleures ventes avec le badge \"populaire\"",
        ],
      },
      { type: "h2", text: "Options et suppléments" },
      {
        type: "p",
        text: "Pour les articles avec des variantes (taille, niveau de piment, suppléments), ajoutez des groupes d'options — le client les sélectionne directement au moment de la commande.",
      },
    ],
  },
  {
    slug: "recevoir-des-commandes",
    locale: "fr",
    title: "Recevoir des commandes et être notifié sur WhatsApp",
    description:
      "Ce qui se passe entre le moment où un client passe commande sur votre vitrine et le moment où vous la préparez.",
    date: "2026-05-19",
    readMinutes: 4,
    category: "Opérations",
    blocks: [
      {
        type: "p",
        text: "Une fois votre menu en ligne, les clients peuvent commander directement depuis votre vitrine — sur place, à emporter, ou en livraison selon ce que vous activez.",
      },
      { type: "h2", text: "Le parcours de commande" },
      {
        type: "list",
        items: [
          "Le client ajoute des articles à son panier et valide sa commande",
          "Vous recevez une notification WhatsApp immédiate avec le détail",
          "Le tableau de bord affiche la commande en temps réel",
          "Le client reçoit une confirmation automatique",
        ],
      },
      { type: "h2", text: "Paiement" },
      {
        type: "p",
        text: "Selon votre marché, vous pouvez activer le paiement par carte, ou laisser le règlement en espèces à la remise de la commande. Vous configurez les moyens de paiement acceptés dans les réglages de votre vitrine.",
      },
    ],
  },
  {
    slug: "partager-sa-vitrine",
    locale: "fr",
    title: "Partager votre vitrine : QR code, bio Instagram, liens",
    description:
      "Une vitrine publiée ne sert à rien si personne ne la trouve. Voici où la partager en priorité.",
    date: "2026-05-24",
    readMinutes: 3,
    category: "Croissance",
    blocks: [
      {
        type: "p",
        text: "Le lien de votre vitrine (epidom.fr/@votre-nom) fonctionne partout où vous pouvez coller un lien ou afficher un QR code.",
      },
      { type: "h2", text: "Où le mettre en priorité" },
      {
        type: "list",
        items: [
          "Bio Instagram et Facebook — remplace un lien Linktree",
          "QR code imprimé sur les tables ou en vitrine",
          "Statut WhatsApp et messages aux clients réguliers",
          "Google Maps, dans la section \"site web\" de votre fiche établissement",
        ],
      },
      { type: "h2", text: "Le QR code" },
      {
        type: "p",
        text: "Téléchargez-le depuis les réglages de votre vitrine, en haute résolution, prêt à imprimer. Il pointe directement vers votre menu — pas besoin de le régénérer si vous mettez à jour vos plats, le lien reste le même.",
      },
    ],
  },
  {
    slug: "passer-a-la-caisse-pos",
    locale: "fr",
    title: "Passer à la caisse POS : quand et comment",
    description:
      "Le forfait gratuit couvre la vitrine et les commandes en ligne. Voici comment savoir si vous êtes prêt pour la caisse POS.",
    date: "2026-05-29",
    readMinutes: 3,
    category: "Montée en gamme",
    blocks: [
      {
        type: "p",
        text: "Le forfait POS ajoute la caisse enregistreuse, la file de commandes unifiée (sur place + en ligne), les reçus, et un écran cuisine basique.",
      },
      { type: "h2", text: "Signes qu'il est temps de passer au POS" },
      {
        type: "list",
        items: [
          "Vous embauchez un premier employé en caisse",
          "Vous gérez des commandes sur place en plus des commandes en ligne",
          "Vous voulez imprimer des tickets de caisse",
        ],
      },
      { type: "h2", text: "La transition" },
      {
        type: "p",
        text: "Aucune perte de données : votre menu, vos commandes passées et vos réglages restent identiques. Le passage au forfait payant depuis votre tableau de bord prend moins d'une minute.",
      },
    ],
  },
];
