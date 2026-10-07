import type { Article } from "@/features/marketing/shared/content/article-types";
import { STOREFRONT_ONLINE_PAYMENTS_ENABLED } from "@/config/storefront-ordering.config";

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
        text: STOREFRONT_ONLINE_PAYMENTS_ENABLED
          ? "Selon votre marché, vous pouvez activer le paiement par carte, ou laisser le règlement en espèces à la remise de la commande. Vous configurez les moyens de paiement acceptés dans les réglages de votre vitrine."
          : "Les commandes de la vitrine se règlent au comptoir : chacune arrive sur la caisse marquée à encaisser, et le caissier encaisse puis la marque payée.",
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
  {
    slug: "caisse-et-operationnel",
    locale: "fr",
    title: "Mode Caisse : le Système de caisse et la page Opérationnel",
    description:
      "Tout ce qui se trouve sur la tablette du comptoir : la caisse, la file de commandes, Cuisine & Bar et les tables, puis le quart, les plannings et le pointage.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Opérations",
    blocks: [
      {
        type: "p",
        text: "Le Mode Caisse, c'est la partie d'Epidom qui tourne sur la tablette du comptoir. Il réunit deux espaces : le Système de caisse, pour vendre et servir, et la page Opérationnel, pour le quart et l'équipe. Il est inclus dans le forfait POS, que vous pouvez essayer gratuitement pendant 14 jours.",
      },
      { type: "h2", text: "Le Système de caisse" },
      {
        type: "p",
        text: "Quatre onglets en bas de l'écran. Chaque membre de l'équipe ne voit que ceux que son rôle lui ouvre.",
      },
      {
        type: "list",
        items: [
          "Caisse : choisissez Nourriture ou Boissons, puis une catégorie, puis l'article. L'addition se construit à chaque geste : mettez-la en attente, divisez-la, fusionnez-la ou réglez-la avec plusieurs moyens de paiement.",
          "File de commandes : les commandes passées en caisse et celles de votre vitrine, chacune dans son onglet, affichées sur la journée en cours. L'onglet Journal garde toutes les commandes passées.",
          "Cuisine & Bar : un écran pour la cuisine, un autre pour le bar. Les articles arrivent dès que la commande est passée et se marquent prêts un par un.",
          "Tables : vos tables avec leur état (libre, occupée, réservée, en nettoyage) et les réservations à venir.",
        ],
      },
      { type: "h2", text: "La page Opérationnel" },
      {
        type: "p",
        text: "Elle s'ouvre depuis le menu Epidom, sans la barre d'onglets de la caisse. Ses rubriques dépendent de la personne connectée :",
      },
      {
        type: "list",
        items: [
          "Quart : ouvrez la caisse avec son fond de caisse, notez les entrées et sorties d'espèces, puis clôturez le quart.",
          "Mon planning : les créneaux d'un membre de l'équipe, et l'image du planning si le manager en a publié une.",
          "Planning de l'équipe : le planning publié de toute l'équipe, pour le propriétaire et les managers (forfait Operations).",
          "Pointage : chacun choisit son nom, saisit son code PIN et prend un selfie (forfait Operations).",
        ],
      },
      { type: "h2", text: "Un seul quart pour tout l'établissement" },
      {
        type: "p",
        text: "Le quart appartient à l'établissement, pas à une tablette ni à un caissier. Tous les appareils et toute l'équipe encaissent dans le même quart ouvert. Il se clôture une seule fois, avec un comptage à l'aveugle : on compte la caisse avant de voir le montant attendu.",
      },
      { type: "h2", text: "Le menu Epidom" },
      {
        type: "p",
        text: "Le bouton Epidom, en haut à droite du Mode Caisse, ouvre un menu qui regroupe tout ce qui n'a pas besoin d'un onglet :",
      },
      {
        type: "list",
        items: [
          "Passer du Système de caisse à la page Opérationnel et, pour le propriétaire et les managers, au Back-Office",
          "Synchroniser les ventes : envoyer les ventes encaissées hors ligne et rafraîchir la copie du menu et des commandes sur cet appareil",
          "Activer l'écran client et l'ouvrir sur un second écran",
          "Réglages du matériel : les imprimantes et le lecteur de codes-barres de cet appareil",
          "La langue, le thème et la taille d'affichage de l'appareil, le changement de compte et la déconnexion",
        ],
      },
    ],
  },
  {
    slug: "stock-et-commandes-fournisseurs",
    locale: "fr",
    title: "Le stock et les commandes fournisseurs",
    description:
      "Gardez un stock juste, déclarez les pertes et commandez à vos fournisseurs en deux temps : vous créez la commande, puis vous la marquez Reçue.",
    date: "2026-09-27",
    readMinutes: 4,
    category: "Opérations",
    blocks: [
      {
        type: "p",
        text: "La gestion du stock est incluse dans le forfait Operations. La page Gestion compte trois onglets : Articles, Commandes fournisseurs et Journal.",
      },
      { type: "h2", text: "Articles : ce que vous avez" },
      {
        type: "list",
        items: [
          "Chaque matière première et chaque produit avec son niveau actuel, affichés en grille, en colonnes ou en liste",
          "« Ajuster le stock » corrige un article après un inventaire ; l'ajustement en masse en met plusieurs à jour d'un coup",
          "Déclarez une perte avec son motif : ce qui part à la poubelle apparaît dans vos rapports",
          "Les articles du menu reliés à un produit ou à une recette déduisent du stock ce qu'ils consomment, à chaque vente",
        ],
      },
      { type: "h2", text: "Commandes fournisseurs : commander en deux temps" },
      { type: "p", text: "Une commande fournisseur se fait en deux étapes." },
      {
        type: "list",
        items: [
          "Créez la commande : le fournisseur, les articles et les quantités, et le jour de livraison prévu. Envoyez-la par e-mail ou WhatsApp, ou imprimez-la.",
          "À la livraison, appuyez sur Reçue et confirmez. Les articles s'ajoutent au stock.",
        ],
      },
      {
        type: "p",
        text: "D'ici là, la commande attend dans « En attente de livraison » et s'affiche d'elle-même comme prévue aujourd'hui ou en retard une fois le jour passé. Si elle n'arrivera jamais, annulez-la : rien n'est ajouté au stock.",
      },
      { type: "h2", text: "Journal : chaque mouvement" },
      {
        type: "p",
        text: "Le Journal liste chaque mouvement de stock, du plus récent au plus ancien : livraisons, ventes, production, ajustements, pertes et retours, avec le solde qui en résulte.",
      },
      { type: "h2", text: "Où se trouvent fournisseurs et ingrédients" },
      {
        type: "p",
        text: "Fournisseurs, matières premières, recettes et produits se configurent sur la page Données. Ajoutez-y d'abord un fournisseur : vous pourrez le choisir en créant une commande.",
      },
    ],
  },
  {
    slug: "equipe-plannings-et-quarts",
    locale: "fr",
    title: "L'équipe, les plannings et les quarts",
    description:
      "Ajoutez votre équipe avec ses codes PIN et ses accès, publiez le planning, et suivez les pointages et chaque quart de caisse.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Opérations",
    blocks: [
      {
        type: "p",
        text: "Personnel, Planning et Quarts de travail sont inclus dans le forfait Operations. Dans le menu du Back-Office, Personnel et Planning se trouvent dans la section « Operations », et les Quarts de travail dans « Reports ».",
      },
      { type: "h2", text: "Le personnel" },
      {
        type: "list",
        items: [
          "Donnez un rôle à chacun : Manager, Caissier ou Cuisine. Ajoutez si besoin un intitulé comme Serveur, Barman ou Hôte d'accueil, ou écrivez le vôtre",
          "Chaque personne reçoit un code PIN à 4 chiffres pour la tablette partagée. Les sessions PIN se ferment à minuit, heure de l'établissement",
          "Les accès aux pages partent du modèle du rôle ; cochez ou décochez des pages pour les ajuster",
          "Invitez quelqu'un par e-mail à se connecter avec son propre compte Epidom. Pour l'instant, les comptes de l'équipe fonctionnent uniquement en Mode Caisse",
        ],
      },
      { type: "h2", text: "Le planning" },
      {
        type: "list",
        items: [
          "Créez des blocs de quart (Matin, 07:00–15:00, par exemple) et placez-les sur la grille, ou appliquez un bloc à plusieurs personnes et plusieurs jours d'un coup",
          "Publiez la semaine : chacun retrouve ses créneaux dans « Mon planning », en Mode Caisse",
          "Vous pouvez aussi importer une photo de votre planning pour les dates affichées : toute l'équipe la voit dans « Mon planning »",
          "L'historique liste les arrivées, les départs et les absences, avec la photo prise au pointage",
        ],
      },
      { type: "h2", text: "Le pointage" },
      {
        type: "p",
        text: "L'équipe pointe à l'arrivée et au départ sur la page Opérationnel, en Mode Caisse : chacun choisit son nom, saisit son code PIN et prend un selfie. La position de l'appareil est enregistrée aussi, s'il la partage.",
      },
      { type: "h2", text: "Les quarts de travail" },
      {
        type: "p",
        text: "La page Quarts de travail liste chaque session de caisse : qui l'a tenue, le fond de caisse de départ, et la clôture — montant attendu, montant compté et écart. L'onglet Journal de caisse détaille chaque mouvement d'espèces : pourboires, apports au fond de caisse, sorties et dépôts au coffre.",
      },
      {
        type: "p",
        text: "Le quart lui-même s'ouvre et se clôture en Mode Caisse, sur la page Opérationnel.",
      },
    ],
  },
  {
    slug: "materiel-imprimantes-et-scanner",
    locale: "fr",
    title: "Le matériel : imprimantes et lecteur de codes-barres",
    description:
      "Associez à un appareil vos imprimantes de reçus, de cuisine, de bar et d'étiquettes, et vérifiez que votre lecteur de codes-barres fonctionne.",
    date: "2026-09-27",
    readMinutes: 3,
    category: "Configuration",
    blocks: [
      {
        type: "p",
        text: "Les réglages du matériel sont propres à chaque appareil : chaque tablette ou ordinateur garde ses imprimantes et son lecteur. En Mode Caisse, ouvrez le menu Epidom, puis Réglages du matériel. L'impression est incluse dans le forfait POS.",
      },
      { type: "h2", text: "Les imprimantes" },
      {
        type: "p",
        text: "Associez jusqu'à quatre imprimantes, une par usage. Activez celles dont vous vous servez ; les autres restent éteintes.",
      },
      {
        type: "list",
        items: [
          "Imprimante de reçus : le reçu avec les prix et le total, l'addition et le rapport de quart",
          "Imprimante cuisine : les bons de commande pour la cuisine, sans les prix",
          "Imprimante bar : les articles du bar uniquement. Désactivée, ces articles sortent sur l'imprimante cuisine",
          "Imprimante d'étiquettes : une étiquette par article commandé, pour les gobelets et les emballages",
        ],
      },
      {
        type: "p",
        text: "Les imprimantes se connectent en Bluetooth, ce qui demande Chrome sur Android ou sur ordinateur. Un iPad ne peut pas envoyer les reçus, les bons cuisine et bar ni les étiquettes à une imprimante. Sur iPad, le bouton Imprimer affiché à la clôture d'un quart ouvre le rapport de quart dans la fenêtre d'impression, et un ancien reçu s'imprime depuis sa page : ouvrez la commande dans l'onglet Journal de la File de commandes, puis le lien vers le reçu. Le papier peut faire 58 ou 80 mm. Lancez une impression test sur chaque imprimante après l'avoir associée : l'impression d'étiquettes, en particulier, n'est pas vérifiée sur tous les modèles.",
      },
      { type: "h2", text: "Le lecteur de codes-barres" },
      {
        type: "list",
        items: [
          "Tester votre lecteur : scannez n'importe quel code-barres, Epidom vous dit s'il l'a bien lu et à quel article du menu il correspond. Rien n'est ajouté à la vente",
          "Choisissez si un scan compte partout sur l'écran ou seulement dans le champ de recherche",
          "Si des scans se perdent, passez la vitesse sur Lent / Bluetooth",
        ],
      },
      {
        type: "p",
        text: "Pour vérifier les codes par rapport à votre menu, ouvrez d'abord la caisse une fois sur cet appareil.",
      },
    ],
  },
];
