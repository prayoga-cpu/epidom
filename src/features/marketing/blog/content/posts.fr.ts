import type { BlogPost } from "./types";

export const frPosts: BlogPost[] = [
  {
    slug: "reduire-commission-deliveroo-uber-eats",
    locale: "fr",
    title: "Réduire sa dépendance aux commissions Deliveroo et Uber Eats",
    description:
      "Les apps de livraison aident à se faire découvrir, mais chaque commande coûte une commission. Comment ouvrir un canal de commande direct sans tout arrêter.",
    date: "2026-06-02",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Commerce direct",
    related: ["calcul-commission-uber-eats", "commande-en-ligne-restaurant"],
    blocks: [
      {
        type: "p",
        text: "La plupart des restaurateurs et des gérants de café ne quittent jamais complètement les apps de livraison, et ce n'est pas ce que nous vous proposons ici. Le problème n'est pas Deliveroo ou Uber Eats en soi. Le problème, c'est de ne dépendre que d'elles pour chaque commande, y compris celles de vos habitués, qui vous connaissent déjà et qui seraient venus de toute façon.",
      },
      { type: "h2", text: "Ce que coûte réellement une commande via une app" },
      {
        type: "p",
        text: "Chaque commande passée par une plateforme de livraison paie une commission, prélevée avant que vous ne voyiez l'argent. Le taux dépend de votre contrat et des options choisies (livraison par la plateforme ou par vous, visibilité mise en avant, etc.) : regardez votre relevé plutôt que de vous fier à un chiffre entendu en conversation.",
      },
      {
        type: "p",
        text: "Prenons un exemple volontairement simple, avec des chiffres inventés. Un panier de 20 € avec une commission de 25 % laisse 15 € avant le coût des ingrédients, de l'emballage et du temps de préparation. Si les matières et l'emballage représentent 7 €, il reste 8 € pour payer le loyer, les salaires et votre propre rémunération. Le même panier commandé directement chez vous, sans commission de plateforme, laisserait 13 €. L'écart de 5 € par commande paraît modeste, mais multiplié par plusieurs dizaines de commandes par semaine, il pèse sur la marge d'un mois.",
      },
      {
        type: "p",
        text: "À cela s'ajoute un point qu'on oublie souvent : la relation avec le client. Qui a commandé, à quelle fréquence, quel plat il a aimé : ces informations restent chez la plateforme. Vous ne pouvez pas recontacter directement quelqu'un qui a adoré votre quiche la semaine dernière.",
      },
      { type: "h2", text: "D'abord, mesurer ce que vous payez vraiment" },
      {
        type: "p",
        text: "Avant de changer quoi que ce soit, sortez les chiffres d'un mois : nombre de commandes par plateforme, chiffre d'affaires, commissions prélevées, remboursements. Divisez les commissions par le chiffre d'affaires de chaque plateforme, vous obtenez votre taux réel. Le taux effectif peut différer de celui du contrat une fois les frais annexes ajoutés.",
      },
      {
        type: "p",
        text: "Dans Epidom, avec le forfait Opérations, vous pouvez saisir à la caisse une commande venue d'une app de livraison comme un canal à part entière. Le rapport financier affiche alors le chiffre d'affaires et la commission de chaque plateforme. Epidom ne se connecte pas directement aux apps de livraison : la saisie se fait à la main, mais elle donne une vue claire de ce que chaque canal vous rapporte. Notre calculateur de commission Uber Eats fait aussi le calcul pour un panier type.",
      },
      { type: "h2", text: "Le canal direct : un complément, pas un remplacement" },
      {
        type: "p",
        text: "L'idée est d'avoir un lien à vous, que vous partagez partout où vos clients vous trouvent déjà : bio Instagram, statut WhatsApp, vitrine du magasin, QR code sur le comptoir ou sur les sacs. Ce que cela donne concrètement selon votre forfait :",
      },
      {
        type: "list",
        items: [
          "Forfait gratuit : une page publique à votre nom avec votre menu, vos photos, vos horaires, vos liens (WhatsApp, Instagram, Google Maps) et un QR code imprimable. Les clients voient votre carte et vous contactent sur WhatsApp. Il n'y a pas de commande en ligne dans ce forfait.",
          "Forfait POS : la commande en ligne depuis cette page (sur place avec numéro de table, à emporter, ou livraison assurée par vous-même) et les réservations de table. Les commandes passées depuis la page sont à régler à la caisse : le client ne paie pas en ligne, votre caisse est alertée et vous marquez la commande comme payée. Le forfait POS coûte 13,99 € par mois (11,49 € en abonnement annuel), avec 14 jours d'essai.",
          "Aucune commission de plateforme n'est prélevée sur les commandes passées par votre propre page. Vous gardez le lien direct avec le client.",
        ],
      },
      {
        type: "quote",
        text: "L'objectif n'est pas de « battre » les apps de livraison. C'est de ne plus être totalement dépendant d'elles pour les clients qui vous connaissent déjà.",
      },
      { type: "h2", text: "Comment amener vos habitués vers votre lien" },
      {
        type: "p",
        text: "Un canal direct ne se remplit pas tout seul. Les clients ont déjà l'habitude de leur app, et il faut leur donner une raison simple de passer chez vous. Quelques leviers qui marchent sans promesse excessive :",
      },
      {
        type: "list",
        items: [
          "Mettez le QR code là où la décision se prend : sur le comptoir, sur le sac de livraison, sur le ticket, sur la porte.",
          "Dites-le à voix haute : « La prochaine fois, vous pouvez commander directement chez nous avec ce code. » Une phrase au moment de l'encaissement fait plus que dix publications.",
          "Proposez un petit avantage réservé au canal direct, par exemple un café offert à la dixième commande ou une viennoiserie à emporter. Le forfait Opérations propose des coupons et des points de fidélité pour cela.",
          "Gardez la même carte et les mêmes prix partout, pour ne pas créer de frustration. Si vous décidez d'ajuster les prix sur les apps pour couvrir la commission, faites-le avec prudence et selon les règles de la plateforme.",
          "Épinglez le lien en tête de votre profil Instagram et dans votre fiche Google Maps.",
        ],
      },
      { type: "h2", text: "Un exemple sur une semaine" },
      {
        type: "p",
        text: "Imaginons une boulangerie-café qui reçoit 60 commandes par semaine via une app, dont 20 viennent de clients qui commandent chaque semaine. Si, en un mois, la moitié de ces habitués passe par le lien direct, cela représente une dizaine de commandes hebdomadaires qui échappent à la commission. Sur un panier de 20 € et une commission de 25 %, cela fait environ 50 € de marge récupérée par semaine. Ce n'est pas une transformation, mais c'est un loyer partiel sur l'année, obtenu sans perdre la visibilité que l'app vous apporte pour les nouveaux clients.",
      },
      {
        type: "p",
        text: "Ces chiffres sont un exemple pour réfléchir, pas une prévision : votre résultat dépendra de votre clientèle, de votre quartier et du temps que vous consacrez à en parler.",
      },
      { type: "h2", text: "Les erreurs à éviter" },
      {
        type: "list",
        items: [
          "Quitter une plateforme d'un coup. Vous perdez la visibilité et les nouveaux clients avant que le canal direct ne tienne.",
          "Promettre un paiement en ligne que votre page n'offre pas. Dites clairement que le règlement se fait à la caisse.",
          "Négliger la livraison. Si vous livrez vous-même, définissez une zone et un délai réalistes, sinon la déception retombe sur votre marque.",
          "Ne jamais regarder les chiffres. Sans mesure, impossible de savoir si le canal direct progresse.",
        ],
      },
      { type: "h2", text: "Par où commencer" },
      {
        type: "p",
        text: "Le plus simple : créez votre page gratuite avec votre menu et votre QR code, partagez-la partout où vos clients vous trouvent déjà, et laissez les deux canaux, direct et plateformes, cohabiter. Quand vous voyez que des clients demandent à commander directement, passez au forfait POS pour activer la commande en ligne, en profitant des 14 jours d'essai pour vérifier que cela vous convient. Aucune connaissance technique n'est nécessaire, et vous pouvez revenir en arrière à tout moment.",
      },
    ],
  },
  {
    slug: "menu-qr-code-gratuit-restaurant-guide",
    locale: "fr",
    title: "Menu QR code gratuit pour restaurant : le guide complet",
    description:
      "Ce qu'un menu QR code change pour vos clients, les pièges à éviter et comment créer le vôtre gratuitement : vitrine, photos, QR code imprimable.",
    date: "2026-06-16",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Mise en place",
    related: ["menu-qr-code-gratuit", "commande-en-ligne-restaurant"],
    blocks: [
      {
        type: "p",
        text: "Le menu QR code s'est banalisé depuis 2020, mais beaucoup d'établissements en sont restés à la version la plus basique : un PDF scanné, illisible sur mobile, jamais mis à jour. Un vrai menu QR code, c'est autre chose, et il peut se mettre en place sans budget. Ce guide explique ce qu'il doit permettre, comment le construire et ce qu'il ne fait pas, pour que vous n'ayez pas de mauvaise surprise.",
      },
      { type: "h2", text: "Un PDF n'est pas un menu QR code" },
      {
        type: "p",
        text: "Scanner votre carte papier et la placer en PDF derrière un QR code règle un problème, celui du menu physique qui passe de main en main, mais en crée trois autres. Le PDF est illisible sur un petit écran, car il faut zoomer et faire défiler en tous sens. Il est impossible à mettre à jour sans tout refaire, donc il se périme au premier changement de prix. Enfin, il n'offre ni photos par plat, ni options, ni lien vers vos réseaux.",
      },
      { type: "h2", text: "Ce qu'un vrai menu QR code doit permettre" },
      {
        type: "list",
        items: [
          "Une lecture rapide et confortable sur mobile, sans zoomer.",
          "Une modification en quelques secondes : un plat en rupture, un prix qui change, un plat du jour.",
          "Des photos par article et des catégories claires (boissons, viennoiseries, plats, desserts).",
          "Des options lisibles, comme la taille d'un café ou les suppléments.",
          "Vos horaires et vos moyens de contact au même endroit, pour que le client n'ait pas à chercher ailleurs.",
        ],
      },
      { type: "h2", text: "Ce qui est gratuit, et ce qui ne l'est pas" },
      {
        type: "p",
        text: "Soyons précis, parce que c'est là que les malentendus naissent. Avec Epidom, la vitrine publique de votre commerce est gratuite, sans limite de durée : votre page à votre nom, votre menu avec catégories, photos, prix, descriptions et options, un interrupteur « épuisé » pour chaque article, vos horaires, vos liens (Instagram, TikTok, WhatsApp, Google Maps) et un QR code imprimable qui ouvre cette page. Vous pouvez aussi suivre quelques statistiques simples : vues de la page, vues du menu, clics WhatsApp.",
      },
      {
        type: "p",
        text: "En revanche, la commande en ligne n'est pas incluse dans la vitrine gratuite. Elle fait partie du forfait POS (13,99 € par mois, 11,49 € en abonnement annuel, avec 14 jours d'essai). Avec ce forfait, vos clients peuvent commander depuis la page, sur place avec un numéro de table, à emporter ou en livraison assurée par vous. Les commandes sont réglées à la caisse : il n'y a pas de paiement en ligne sur la page. Votre caisse reçoit une alerte sonore et vous marquez la commande comme payée une fois encaissée.",
      },
      { type: "h2", text: "Créer son menu QR code, étape par étape" },
      {
        type: "list",
        items: [
          "Rassemblez vos informations : liste des produits, prix, descriptions courtes, photos, horaires, numéro WhatsApp.",
          "Créez votre page : nom, logo, couleurs, photo de couverture, une phrase d'accroche.",
          "Saisissez le menu par catégories. Le plus long est de rentrer vos plats et leurs prix : prévoyez un moment calme pour le faire sans interruption.",
          "Ajoutez une photo par produit au moins pour vos dix meilleures ventes. Une bonne photo prise à la lumière du jour suffit.",
          "Relisez la page sur votre propre téléphone, puis sur celui d'un proche, comme le ferait un client.",
          "Téléchargez le QR code, imprimez-le et placez-le là où l'on attend : table, comptoir, vitrine, sac, ticket.",
        ],
      },
      { type: "h2", text: "Où placer le QR code pour qu'il serve vraiment" },
      {
        type: "p",
        text: "Un QR code caché ne sert à rien. Les meilleurs emplacements sont ceux où le client a déjà le temps de sortir son téléphone : la table, la file d'attente, la vitrine pour les passants qui hésitent. Mettez-le assez grand pour être scanné à bout de bras (environ 4 à 5 cm de côté est un repère raisonnable), avec un fond uni et une phrase d'invitation du type « Scannez pour voir la carte ». Faites un test d'impression avant d'imprimer cinquante exemplaires, et testez le scan avec deux téléphones différents.",
      },
      {
        type: "p",
        text: "Prévoyez des supports résistants aux taches : plastification, chevalet ou sous-verre. Quelques euros suffisent, selon la qualité choisie.",
      },
      { type: "h2", text: "Les pièges les plus fréquents" },
      {
        type: "list",
        items: [
          "Un menu jamais mis à jour. Un client qui voit un prix périmé perd confiance. Habituez-vous à corriger la page dès que le prix change, et à utiliser l'interrupteur « épuisé » plutôt que de laisser un plat indisponible affiché.",
          "Des photos trop lourdes ou trop sombres. Elles ralentissent la page et donnent une mauvaise impression.",
          "Aucune alternative papier. Certains clients n'ont pas de téléphone ou pas de batterie. Gardez quelques cartes papier ou une ardoise.",
          "Un QR code trop petit, trop bas ou sur une surface brillante qui reflète.",
          "Oublier les informations utiles : horaires, adresse, mode de contact. La page doit répondre aux trois questions qu'on vous pose le plus souvent.",
        ],
      },
      { type: "h2", text: "Ce que ça change dans une journée de service" },
      {
        type: "p",
        text: "Dans un café, le premier gain est le temps. Le serveur n'a plus à répondre dix fois par service à la question « Vous avez quoi comme boissons sans lait ? », puisque la réponse est à portée de téléphone. Le second gain est la souplesse : le jour où la machine à glace tombe en panne ou que les croissants sont épuisés à 10 h, vous modifiez la carte en deux gestes, sans réimprimer. Le troisième est la mémoire : vos clients retrouvent votre menu et vos horaires en quelques secondes, ce qui fait gagner des appels.",
      },
      {
        type: "p",
        text: "Si vous activez ensuite la commande en ligne avec le forfait POS, la même page devient un point d'entrée pour les commandes à emporter ou sur place, et la caisse se charge du reste. Mais commencez par la vitrine : c'est gratuit, et vous verrez rapidement si vos clients l'utilisent grâce aux statistiques de vues.",
      },
      { type: "h2", text: "À retenir" },
      {
        type: "p",
        text: "Un bon menu QR code, c'est une page lisible sur mobile, à jour, avec des photos et un QR code bien placé. La vitrine et son QR code sont gratuits chez Epidom, sans limite de durée. La commande en ligne est une étape suivante, dans le forfait POS, avec règlement à la caisse. Commencez simple, mesurez, puis décidez.",
      },
    ],
  },
  {
    slug: "caisse-enregistreuse-cafe-guide-choix",
    locale: "fr",
    title: "Caisse enregistreuse pour café : ce qu'il faut savoir avant de choisir",
    description:
      "Caisse classique ou système de caisse sur tablette : comment choisir selon votre volume, votre équipe et votre budget, avec les questions à poser avant d'acheter.",
    date: "2026-07-01",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Opérations",
    related: ["imprimante-ticket-caisse", "caisse-hors-ligne"],
    blocks: [
      {
        type: "p",
        text: "Un café qui démarre avec un seul gérant n'a pas les mêmes besoins qu'un établissement avec plusieurs services et une équipe en rotation. Avant de choisir une caisse, il vaut mieux se poser la bonne question : à partir de quand une caisse enregistreuse classique devient-elle un frein plutôt qu'un outil ? Ce guide vous aide à trancher avec des critères concrets, sans vous pousser vers une solution en particulier.",
      },
      { type: "h2", text: "Caisse classique ou caisse sur tablette : les deux logiques" },
      {
        type: "p",
        text: "La caisse enregistreuse classique est un appareil dédié, avec son clavier, son écran et son tiroir. Elle est simple, robuste et rassure ceux qui n'aiment pas l'informatique. Son défaut : elle enregistre surtout un total. Pour savoir ce que vous avez vendu par article, par heure ou par employé, il faut souvent des opérations manuelles à la fin de la journée.",
      },
      {
        type: "p",
        text: "Un système de caisse sur tablette, téléphone ou ordinateur fonctionne autrement : chaque vente est enregistrée avec ses articles, son mode de paiement et son heure. Vous obtenez de la donnée sans effort, mais vous dépendez d'un appareil, d'une application et d'une connexion. Aucune des deux logiques n'est meilleure en soi. Tout dépend de ce que vous avez besoin de savoir sur votre activité.",
      },
      { type: "h2", text: "Les signes qu'il est temps de changer" },
      {
        type: "list",
        items: [
          "Vous embauchez un premier employé en caisse et devez lui déléguer sans tout superviser.",
          "Le rapprochement de caisse en fin de journée prend plus de 15 minutes, ou ne tombe jamais juste.",
          "Vous recomptez à la main des tickets papier pour connaître vos meilleures ventes.",
          "Vous voulez suivre vos ventes par article, pas seulement un total en fin de journée.",
          "Vous avez plusieurs moyens de paiement et des additions partagées à gérer (moitié carte, moitié espèces).",
          "Vous prenez des commandes à emporter ou sur réservation en plus du comptoir.",
        ],
      },
      { type: "h2", text: "Les questions à vous poser avant d'acheter" },
      {
        type: "list",
        items: [
          "Combien de commandes par jour aux heures de pointe ? Si vous encaissez dix clients en cinq minutes, la rapidité de saisie compte plus que le nombre de fonctions.",
          "Combien de personnes encaissent, et quels droits voulez-vous leur donner ? Un employé qui peut annuler une vente ou rembourser sans contrôle est un risque.",
          "Que se passe-t-il quand internet tombe ? Certains systèmes s'arrêtent, d'autres continuent de vendre.",
          "Quel matériel faut-il en plus : imprimante de tickets, tiroir, lecteur de code-barres, support de tablette ?",
          "Quel est le coût total sur un an : achat ou abonnement, matériel, frais de paiement, assistance ?",
          "Pouvez-vous essayer avant de vous engager ? Une période d'essai vaut mieux qu'une démonstration.",
          "Comment récupérez-vous vos données si vous changez d'outil ? Pouvez-vous exporter facilement vos ventes et vos rapports ?",
        ],
      },
      { type: "h2", text: "Ce qu'un système de caisse sur tablette change concrètement" },
      {
        type: "p",
        text: "Au-delà de l'encaissement, un système pensé pour la restauration relie la commande, le paiement et le ticket en un seul geste. Avec le forfait POS d'Epidom, la caisse fonctionne dans le navigateur sur tablette, téléphone ou ordinateur. Vous choisissez les produits par catégorie ou par recherche, vous pouvez répartir le règlement sur plusieurs moyens de paiement, appliquer un taux de service ou de taxe, et faire un remboursement. Les commandes passent par une file (nouvelle, en préparation, prête, servie), et l'écran de cuisine affiche les tickets en temps réel.",
      },
      {
        type: "p",
        text: "Pour les tickets, les imprimantes thermiques Bluetooth 58 mm et 80 mm compatibles ESC/POS sont prises en charge, avec la possibilité d'en utiliser plusieurs (ticket client, cuisine, bar, étiquettes). Un reçu en PDF ou par e-mail est aussi possible. Notre guide sur l'imprimante de ticket de caisse explique comment choisir le modèle.",
      },
      { type: "h2", text: "Le point que l'on oublie : la panne de connexion" },
      {
        type: "p",
        text: "Une caisse qui s'arrête à 12 h 15, au moment où la file arrive jusqu'à la porte, coûte cher. Demandez toujours ce qui se passe sans internet. Le mode hors ligne du forfait POS permet de continuer à vendre : les ventes sont conservées sur l'appareil, puis synchronisées avec leur heure réelle quand la connexion revient. Cela ne remplace pas une connexion fiable, mais cela évite de noter les ventes sur un carnet. Notre page sur la caisse hors ligne détaille ce comportement. Pour le paiement par carte, le terminal de votre banque ou de votre prestataire a ses propres règles en cas de coupure : informez-vous.",
      },
      { type: "h2", text: "Combien ça coûte, en ordres de grandeur" },
      {
        type: "list",
        items: [
          "Une caisse enregistreuse classique : de quelques centaines d'euros à plus d'un millier, selon le modèle, sans compter les rouleaux et l'entretien.",
          "Une tablette correcte et son support : de l'ordre de 200 à 500 €, un repère à vérifier auprès de vos fournisseurs.",
          "Une imprimante thermique : de l'ordre de 60 à 200 €.",
          "Un abonnement de système de caisse : chez Epidom, le forfait POS est à 13,99 € par mois (11,49 € par mois en abonnement annuel), avec 14 jours d'essai. Le forfait Opérations, à 27,99 € par mois (23,49 € en annuel), ajoute la gestion des postes de caisse, du personnel, du stock et des rapports financiers.",
          "Le terminal de carte : un contrat à part, avec votre banque ou un prestataire, ses frais mensuels et ses frais par transaction.",
        ],
      },
      {
        type: "p",
        text: "Ces chiffres sont des repères pour construire un budget. Demandez toujours un devis avant de vous décider.",
      },
      { type: "h2", text: "Une journée type avec une caisse bien choisie" },
      {
        type: "p",
        text: "À l'ouverture, le gérant compte le fond de caisse. Avec le forfait Opérations, il ouvre le service dans l'application avec le montant compté, ce qui permet de voir l'écart à la fermeture. Le matin, le barista encaisse sur la tablette ; en cas de rupture de croissants, il passe l'article en « épuisé » en deux gestes. À midi, une commande de table s'affiche à l'écran de cuisine, le ticket sort au bar pour les boissons. L'après-midi, un client règle moitié en carte, moitié en espèces : la caisse enregistre les deux paiements sur la même commande. Le soir, le gérant clôture, compte, et regarde les ventes par article de la journée.",
      },
      { type: "h2", text: "Par où commencer" },
      {
        type: "p",
        text: "Commencez petit. Si vous ouvrez un café, créez d'abord votre page gratuite avec votre menu et votre QR code : elle est gratuite sans limite de durée, mais ne comprend pas la commande en ligne. Essayez ensuite le forfait POS pendant ses 14 jours d'essai pour vérifier que la prise en main convient à votre équipe, avant d'abandonner ce qui fonctionne. Choisissez l'outil que votre équipe sait utiliser sans réfléchir, testez-le un jour calme, puis un jour chargé. Si, au bout d'un mois, vous gagnez du temps sur la clôture de caisse et vous savez enfin ce que vous vendez, vous avez fait le bon choix.",
      },
    ],
  },
  {
    slug: "fiche-technique-recette-modele-cafe-boulangerie",
    locale: "fr",
    title: "Fiche technique recette : méthode et modèle pour café et boulangerie",
    description:
      "Comment construire une fiche technique de recette utile : ingrédients, grammages, rendement, coût, allergènes et étapes, puis la relier à votre coût de revient et à votre prix.",
    date: "2026-10-14",
    readMinutes: 7,
    category: "Opérations",
    related: ["calcul-cout-de-revient", "gestion-stock-restaurant"],
    blocks: [
      {
        type: "p",
        text: "Dans une cuisine ou un laboratoire qui tourne bien, la recette ne vit pas dans la tête d'une seule personne. Elle est écrite, pesée, chiffrée. C'est le rôle de la fiche technique de recette (on dit aussi fiche recette) : un document d'une page qui dit exactement quoi mettre, en quelle quantité, comment faire, combien ça donne et combien ça coûte. Voici comment en construire une qui sert vraiment, avec un modèle que vous pouvez recopier dès aujourd'hui.",
      },
      { type: "h2", text: "À quoi sert une fiche technique, concrètement" },
      {
        type: "p",
        text: "Une fiche technique répond à quatre problèmes très courants dans un café ou une boulangerie.",
      },
      {
        type: "list",
        items: [
          "La régularité : le cookie du lundi ressemble à celui du samedi, même quand ce n'est pas la même personne qui le prépare.",
          "La transmission : un nouvel employé peut produire sans vous poser vingt questions, et vous pouvez vous absenter une matinée sans que tout s'arrête.",
          "Le coût : sans quantités précises, impossible de savoir ce que vous coûte réellement une part de tarte ou un cappuccino.",
          "La sécurité alimentaire : savoir quels allergènes se trouvent dans chaque préparation, sans avoir à deviner devant un client qui pose la question.",
        ],
      },
      { type: "h2", text: "Les neuf rubriques d'une bonne fiche" },
      {
        type: "p",
        text: "Inutile d'imaginer une présentation compliquée. Une fiche utile tient sur une page et contient toujours les mêmes rubriques, dans le même ordre.",
      },
      {
        type: "list",
        items: [
          "Le nom de la préparation, tel que vos équipes l'appellent (et la version éventuelle : « brownie sans noix », par exemple).",
          "Le rendement : combien de portions, de pièces ou de litres la recette donne une fois terminée.",
          "La liste des ingrédients, avec le grammage exact de chacun.",
          "Le prix d'achat de chaque ingrédient, ramené à l'unité utilisée (le kilo, le litre, la pièce).",
          "Le coût total de la recette et le coût par portion.",
          "Les allergènes présents.",
          "Les étapes de préparation, courtes et numérotées.",
          "Les temps et températures : préparation, repos, cuisson, conservation.",
          "Le dressage ou le conditionnement : la taille de la portion, le contenant, la décoration.",
        ],
      },
      { type: "h2", text: "Étape 1 : peser, ne pas estimer" },
      {
        type: "p",
        text: "La première erreur est d'écrire « une poignée de pépites » ou « un peu de lait ». Pesez. La fiche doit être exprimée en grammes et en millilitres, jamais en cuillères ou en « environ ». Prenez l'habitude de préparer la recette une fois avec une balance, en notant ce que vous utilisez réellement, et pas ce que vous croyez utiliser.",
      },
      {
        type: "p",
        text: "Pensez aussi aux petites quantités que l'on oublie : le sel, la vanille, le papier de cuisson, le sucre glace pour le saupoudrage, le gobelet et le couvercle pour une boisson à emporter. Individuellement, elles pèsent peu. Additionnées sur un mois, elles comptent.",
      },
      { type: "h2", text: "Étape 2 : écrire le rendement et tenir compte des pertes" },
      {
        type: "p",
        text: "Le rendement est la rubrique la plus négligée, et c'est pourtant elle qui fait basculer votre calcul. Une recette de brownies qui donne douze parts n'a pas le même coût par part que si vous coupez en seize. Fixez la taille de la portion et tenez-vous-y.",
      },
      {
        type: "p",
        text: "Il faut aussi compter les pertes. Une pâte qui reste collée au bol, des fruits épluchés, un café moulu qui ne finit pas dans la tasse : le poids acheté n'est pas le poids servi. Une règle empirique pour démarrer : pour les fruits et légumes à éplucher, prévoyez de 10 à 25 % de perte selon le produit, et vérifiez-le une fois en pesant avant et après. Ce sont des ordres de grandeur à confirmer chez vous, pas des valeurs à recopier telles quelles.",
      },
      { type: "h2", text: "Étape 3 : chiffrer chaque ligne" },
      {
        type: "p",
        text: "Pour chaque ingrédient, ramenez le prix d'achat à l'unité de la fiche. Exemple fictif : un sac de farine de 25 kg acheté 30 € revient à 1,20 € le kilo, soit 0,0012 € le gramme. Une recette qui demande 500 g de farine coûte donc 0,60 € de farine. Faites la même opération pour le beurre, les œufs, le sucre, le chocolat, le lait.",
      },
      {
        type: "p",
        text: "Additionnez toutes les lignes pour obtenir le coût de la recette, puis divisez par le nombre de portions du rendement. Vous obtenez le coût matière par portion, la base de votre coût de revient. Voici un exemple volontairement simple, avec des chiffres inventés pour l'illustration.",
      },
      {
        type: "list",
        items: [
          "Cake au citron, rendement : 10 tranches.",
          "Farine 250 g : 0,30 €. Sucre 200 g : 0,24 €. Beurre 200 g : 1,60 €. Œufs (4) : 1,00 €. Citrons (2) : 0,80 €. Levure et sel : 0,10 €.",
          "Coût de la recette : 4,04 €. Coût par tranche : 0,40 €.",
        ],
      },
      {
        type: "p",
        text: "Dans cet exemple, la tranche est vendue 3,20 €. Le coût matière représente alors 12,5 % du prix de vente. C'est le genre de lecture rapide que la fiche vous permet de faire en trente secondes, pour chaque produit de la carte.",
      },
      { type: "h2", text: "Étape 4 : du coût matière au prix de vente" },
      {
        type: "p",
        text: "Le coût matière n'est pas votre coût de revient complet : il ne contient ni le loyer, ni les salaires, ni l'électricité, ni les commissions éventuelles. Mais il est le point de départ de tout calcul de prix. Une méthode courante consiste à fixer un coefficient multiplicateur, par exemple de 3 à 4 pour des produits de boulangerie ou de café, puis à ajuster selon ce que votre clientèle accepte de payer. C'est un repère de départ, pas une loi : un café servi dans un quartier de bureaux et le même café dans un village n'obéissent pas à la même logique.",
      },
      {
        type: "p",
        text: "Le bon réflexe est de regarder la marge brute par produit : prix de vente hors taxe moins coût matière. Les produits à forte marge peuvent être mis en avant sur la carte, ceux à faible marge peuvent être repensés (portion, ingrédient, prix) ou assumés comme produits d'appel. Notre guide sur le calcul du coût de revient détaille cette partie pas à pas.",
      },
      { type: "h2", text: "Étape 5 : indiquer les allergènes" },
      {
        type: "p",
        text: "Chaque fiche doit mentionner les allergènes présents dans la préparation, y compris ceux qui se cachent dans un ingrédient composé : le gluten dans une farine, le lait dans un beurre, les œufs dans une pâte, les fruits à coque dans une pâte à tartiner, le soja dans un chocolat, la moutarde dans une sauce. Vérifiez les étiquettes de vos fournisseurs, et mettez à jour la fiche dès que vous changez de marque.",
      },
      {
        type: "p",
        text: "Pensez aussi aux contaminations croisées : une planche, un four ou un plan de travail partagés. Une ligne « traces possibles » sur la fiche évite les oublis le jour où le client allergique est devant vous. Pour les règles qui s'appliquent à votre activité, référez-vous toujours aux textes officiels ou à votre interlocuteur sanitaire.",
      },
      { type: "h2", text: "Étape 6 : des étapes courtes, dans l'ordre réel" },
      {
        type: "p",
        text: "Rédigez les étapes comme vous les faites, pas comme un manuel. Un verbe par phrase, un chiffre par étape : « Faire fondre le beurre à feu doux », « Mélanger 2 minutes au fouet », « Cuire 35 minutes à 170 °C », « Laisser refroidir 20 minutes avant de démouler ». Si une étape contient une astuce qui évite un raté (ne pas ouvrir le four avant 25 minutes, par exemple), écrivez-la sur la fiche : c'est précisément ce qui disparaît quand la personne qui sait quitte l'équipe.",
      },
      { type: "h2", text: "Un modèle à recopier" },
      {
        type: "p",
        text: "Voici la trame complète. Vous pouvez la reproduire dans un tableur, dans un classeur plastifié en cuisine, ou directement dans votre outil de gestion.",
      },
      {
        type: "list",
        items: [
          "Nom : ______  Version : ______  Date de mise à jour : ______",
          "Rendement : ______ portions de ______ g (ou ______ ml)",
          "Ingrédients : nom, quantité, unité, prix d'achat à l'unité, coût de la ligne",
          "Coût total de la recette : ______  Coût par portion : ______",
          "Prix de vente conseillé : ______  Marge brute par portion : ______",
          "Allergènes : ______  Traces possibles : ______",
          "Étapes : 1. ______  2. ______  3. ______",
          "Temps : préparation ______  repos ______  cuisson ______  conservation ______",
          "Dressage / conditionnement : ______",
        ],
      },
      { type: "h2", text: "Les erreurs qui reviennent le plus souvent" },
      {
        type: "list",
        items: [
          "Ne pas mettre la fiche à jour quand le prix d'un ingrédient change. Un beurre qui augmente de 20 % déforme toute votre marge, sans que personne ne s'en aperçoive.",
          "Oublier les emballages (gobelet, boîte, serviette, sachet) dans le coût d'un produit à emporter.",
          "Écrire une fiche idéale que personne ne suit. Testez-la en cuisine avec la personne qui fait réellement la recette.",
          "Mélanger plusieurs versions dans le même classeur. Une fiche, une version, une date.",
          "Chiffrer le coût mais ne jamais le comparer au prix de vente. La fiche ne vaut que si vous la relisez.",
        ],
      },
      { type: "h2", text: "Quand le papier ne suffit plus" },
      {
        type: "p",
        text: "Sur dix recettes, un tableur suffit largement. Sur quarante, avec des prix d'achat qui bougent et des préparations qui entrent dans d'autres préparations (une crème pâtissière utilisée dans trois desserts), la mise à jour à la main devient fragile. Dans Epidom, avec le forfait Opérations, vous enregistrez vos ingrédients et leurs prix, vous écrivez vos recettes avec les quantités, et le coût par plat est calculé automatiquement. Les ventes déduisent ensuite le stock au fur et à mesure, et des alertes vous préviennent quand un ingrédient passe sous le seuil que vous avez fixé. C'est aussi ce qui alimente les rapports de marge par article dans la partie finance. Notre page sur la gestion de stock de restaurant montre comment tout cela s'enchaîne.",
      },
      {
        type: "p",
        text: "Que vous restiez sur papier ou que vous passiez à un outil, le principe reste le même : ce qui est écrit, pesé et chiffré peut être amélioré. Commencez par les trois produits que vous vendez le plus. Dans une semaine, vous aurez une base solide, et probablement quelques surprises sur ce qui vous rapporte vraiment.",
      },
    ],
  },
  {
    slug: "ouvrir-un-cafe-materiel-outils-de-caisse",
    locale: "fr",
    title: "Ouvrir un café : le matériel et les outils de caisse à prévoir",
    description:
      "Tablette, imprimante de tickets, écran cuisine, terminal de carte, menu QR code, secours internet : la liste du matériel pour ouvrir un café, les ordres de prix et par quoi commencer.",
    date: "2026-10-14",
    readMinutes: 7,
    category: "Mise en place",
    related: ["imprimante-ticket-caisse", "ecran-cuisine-kds", "menu-qr-code-gratuit"],
    blocks: [
      {
        type: "p",
        text: "Quand on prépare l'ouverture d'un café, la liste des achats donne le vertige : machine à café, vitrine, mobilier, vaisselle… et puis tout ce qui touche à l'encaissement. Cette dernière partie est souvent traitée en dernier, dans la précipitation. Voici une liste concrète, avec des ordres de prix pour se repérer, et surtout un ordre dans lequel s'en occuper.",
      },
      {
        type: "p",
        text: "Les prix cités sont des repères de marché, arrondis, que vous devez vérifier auprès de vos fournisseurs : ils varient selon la marque, le pays, l'état (neuf ou reconditionné) et la période. Ils servent à construire un budget, pas à faire un devis.",
      },
      { type: "h2", text: "1. L'appareil de caisse : une tablette suffit souvent" },
      {
        type: "p",
        text: "Pour un petit café, la caisse n'a plus besoin d'être un meuble volumineux. Une tablette posée sur un support stable, ou un téléphone, ou un ordinateur portable, fait très bien l'affaire si l'application tourne dans le navigateur. Comptez entre 200 et 500 € pour une tablette correcte, plus 20 à 60 € pour un support et un chargeur de rechange. Un écran de 10 pouces ou plus se manipule bien avec des doigts de barista un peu humides, ce qui compte plus que la puissance.",
      },
      {
        type: "p",
        text: "Deux conseils pratiques. Prévoyez un second appareil, même ancien, qui peut servir de secours ou d'écran de cuisine plus tard. Et gardez la tablette branchée en permanence : une batterie à plat au milieu du coup de feu de 8 h 30 est un classique.",
      },
      { type: "h2", text: "2. L'imprimante de tickets" },
      {
        type: "p",
        text: "Pour un café, une imprimante thermique est le choix logique : pas d'encre, pas de cartouche, rapide et silencieuse. Le papier se vend en rouleaux de 58 mm ou 80 mm de large. Le 58 mm convient aux petits tickets de café, le 80 mm aux additions plus détaillées ou aux tickets de cuisine. Comptez environ 60 à 200 € pour le modèle, puis quelques euros par lot de rouleaux.",
      },
      {
        type: "p",
        text: "Avant d'acheter, vérifiez comment elle se connecte à votre appareil : Bluetooth, USB ou réseau. Avec Epidom, les imprimantes thermiques Bluetooth 58 mm et 80 mm compatibles ESC/POS sont prises en charge, et le forfait POS permet d'en brancher plusieurs : une pour le ticket client, une pour la cuisine, une pour le bar, voire une pour des étiquettes. Pour un café qui démarre, une seule imprimante suffit largement. Notre page sur l'imprimante de ticket de caisse détaille le choix du modèle.",
      },
      {
        type: "p",
        text: "Un ticket papier n'est d'ailleurs pas toujours indispensable : un reçu en PDF ou par e-mail existe aussi. Beaucoup de clients de café refusent le ticket. Gardez tout de même une imprimante pour les tickets de préparation si vous avez une cuisine.",
      },
      { type: "h2", text: "3. Le terminal de carte bancaire" },
      {
        type: "p",
        text: "Pour accepter la carte, il faut un terminal de paiement, qui vient de votre banque ou d'un prestataire de paiement. C'est un contrat à part : il a ses propres frais (abonnement mensuel éventuel, pourcentage par transaction, parfois un forfait fixe), ses délais d'ouverture et ses conditions. Comparez au moins deux ou trois offres, en demandant précisément le coût total sur un panier moyen de café, qui est petit : un frais fixe par transaction pèse beaucoup plus sur un ticket de 3 € que sur un ticket de 40 €.",
      },
      {
        type: "p",
        text: "Comptez de 0 à 50 € pour acheter ou louer le terminal selon l'offre, plus un abonnement mensuel qui peut aller de quelques euros à une trentaine d'euros. Demandez dès le départ quand l'argent arrive sur votre compte et si le terminal fonctionne en mobilité (en terrasse, au marché). Attention au calendrier : ouvrir un contrat peut prendre plusieurs jours ou semaines. C'est l'élément à lancer en premier.",
      },
      {
        type: "p",
        text: "Dans Epidom, vous enregistrez les paiements par carte comme un moyen de paiement parmi d'autres, et vous pouvez en combiner plusieurs sur une même commande (moitié espèces, moitié carte). Le terminal, lui, reste celui de votre banque ou de votre prestataire.",
      },
      { type: "h2", text: "4. Le tiroir-caisse" },
      {
        type: "p",
        text: "Même avec beaucoup de paiements par carte, il vous faut un endroit sûr pour les espèces et le fond de caisse. Un tiroir-caisse simple coûte entre 30 et 100 €. Un coffret fermant à clé peut suffire au démarrage. L'important est la discipline : compter la caisse à l'ouverture et à la fermeture. Avec le forfait Opérations, l'ouverture et la clôture de caisse par service, avec comptage et écart, se font directement dans l'application.",
      },
      { type: "h2", text: "5. L'écran de cuisine, quand il devient utile" },
      {
        type: "p",
        text: "Un café qui ne prépare que des boissons et des viennoiseries n'a pas besoin d'écran de cuisine : le barista voit la commande en même temps qu'il la prend. Dès que vous avez une cuisine ou un laboratoire séparé de la caisse (sandwichs chauds, plats du jour, brunch), les tickets papier qui s'accumulent ou les commandes criées à travers la salle finissent par produire des oublis.",
      },
      {
        type: "p",
        text: "Un écran de cuisine affiche les commandes en temps réel, avec l'état de chaque article et une alerte sonore. Il peut s'agir d'une simple deuxième tablette ou d'un petit écran fixé au mur : 150 à 400 € selon l'appareil. Epidom l'inclut dès le forfait POS sur un écran, et le forfait Opérations permet d'en avoir plusieurs, répartis par poste (cuisine, bar). Notre page sur l'écran cuisine explique le fonctionnement. Si vous hésitez, commencez sans : vous l'ajouterez le jour où le service le demande.",
      },
      { type: "h2", text: "6. Le menu QR code" },
      {
        type: "p",
        text: "Le menu QR code est le poste le moins cher et l'un des plus utiles : un code imprimé sur les tables, la vitrine ou le comptoir qui ouvre votre carte sur le téléphone du client. Cela évite de réimprimer les cartes à chaque changement de prix, et vous pouvez marquer un produit en rupture en un geste.",
      },
      {
        type: "p",
        text: "Avec Epidom, la vitrine publique de votre commerce (votre menu, vos photos, vos horaires, vos liens WhatsApp ou Instagram et son QR code imprimable) est gratuite, sans limite de durée. Prévoyez simplement le coût d'impression : quelques supports plastifiés ou des chevalets, de 5 à 40 € selon la qualité. La commande en ligne depuis cette page n'est pas incluse dans la vitrine gratuite : elle fait partie du forfait POS, avec 14 jours d'essai. Les commandes passées depuis la page sont à régler à la caisse. Voir notre guide du menu QR code gratuit.",
      },
      { type: "h2", text: "7. Une solution de secours pour internet" },
      {
        type: "p",
        text: "C'est le poste que tout le monde oublie, jusqu'au jour où la box tombe en panne un samedi. Le plan de secours le plus simple : un partage de connexion depuis un téléphone avec un forfait de données suffisant, et si possible une carte SIM de secours dédiée (compter quelques euros par mois). Notez aussi le numéro de votre opérateur à côté de la caisse.",
      },
      {
        type: "p",
        text: "Il existe aussi une protection côté logiciel : en mode hors ligne, la caisse Epidom du forfait POS continue d'enregistrer les ventes sans internet, et les synchronise avec leur heure réelle dès que la connexion revient. Cela ne remplace pas une connexion fiable, mais cela évite de perdre une matinée de ventes. Votre terminal de carte, lui, a ses propres règles en cas de coupure : demandez-les à votre prestataire.",
      },
      { type: "h2", text: "Le budget en un coup d'œil" },
      {
        type: "list",
        items: [
          "Tablette et support : environ 220 à 560 €",
          "Imprimante thermique et rouleaux : environ 70 à 220 €",
          "Terminal de carte : de 0 à 50 € à l'achat ou à la location, plus un abonnement et des frais par transaction",
          "Tiroir-caisse ou coffret : environ 30 à 100 €",
          "Écran de cuisine (si besoin) : environ 150 à 400 €",
          "Supports QR code imprimés : environ 5 à 40 €",
          "Secours internet : quelques euros par mois",
          "Abonnement caisse : forfait POS à 13,99 € par mois (11,49 € par mois en abonnement annuel), après 14 jours d'essai",
        ],
      },
      {
        type: "p",
        text: "Pour un café qui démarre avec une tablette, une imprimante et un tiroir, le matériel d'encaissement tourne donc plus souvent autour de 400 à 900 €, hors terminal de carte, qu'autour de plusieurs milliers d'euros. Ce sont des ordres de grandeur : à vous de les confronter à vos devis.",
      },
      { type: "h2", text: "Par quoi commencer" },
      {
        type: "list",
        items: [
          "Quatre à huit semaines avant l'ouverture : demandez les offres de terminal de carte et lancez le contrat, c'est le plus long.",
          "Dans le même temps : créez votre vitrine avec le menu et préparez le QR code. C'est gratuit et vous pouvez commencer à faire parler de l'ouverture.",
          "Deux à trois semaines avant : achetez la tablette, l'imprimante et le tiroir, branchez le tout et faites des ventes d'essai avec de faux produits.",
          "Une semaine avant : testez le secours internet, formez l'équipe, imprimez un vrai ticket et faites un faux comptage de caisse.",
          "Après l'ouverture : n'ajoutez l'écran de cuisine ou une deuxième imprimante que lorsque le service en montre le besoin.",
        ],
      },
      {
        type: "p",
        text: "Le meilleur matériel est celui que votre équipe sait utiliser sans réfléchir. Un équipement simple, bien installé et testé avant le premier client, vaut mieux qu'un équipement complet découvert pendant le coup de feu du premier matin.",
      },
    ],
  },
];
