import type { BlogPost } from "./types";

/**
 * Un guide pratique par type de commerce de bouche. Les cartes « À quoi sert
 * Epidom ? » de l'accueil y renvoient (slugs repris dans
 * src/features/marketing/home/lib/industry-guides.ts). Le conseil d'abord,
 * le produit ensuite, aucun chiffre inventé.
 */
export const frIndustryPosts: BlogPost[] = [
  {
    slug: "gerer-un-cafe-commandes-marge-stock",
    locale: "fr",
    title: "Gérer un café au quotidien\u00a0: commandes, marge et stock au même endroit",
    description:
      "Une routine concrète pour gérants de café\u00a0: raccourcir la file du matin, connaître le vrai coût d'une tasse, commander avant la rupture et continuer à encaisser quand le Wi-Fi coupe.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Cafés",
    blocks: [
      {
        type: "p",
        text: "Vu de la salle, un café est simple\u00a0: du café qui entre, du café qui sort. Derrière le comptoir, c'est trois métiers à la fois. Il faut prendre les commandes vite, protéger une marge mince sur chaque tasse, et garder les étagères pleines sans acheter trop de lait qui tournera avant vendredi. La plupart des cafés perdent de l'argent entre ces trois métiers, rarement dans l'un d'eux.",
      },
      {
        type: "p",
        text: "Ce guide décrit une routine quotidienne qui comble ces écarts. Il s'adresse aux gérants qui tiennent un ou deux points de vente, et ne suppose aucun outil en particulier. Quand c'est utile, il montre à quoi ressemble la même étape dans Epidom, pour que vous jugiez si cela colle à votre façon de travailler.",
      },
      { type: "h2", text: "Raccourcir la file du matin avant d'acheter quoi que ce soit" },
      {
        type: "p",
        text: "Le coup de feu du matin décide de la journée. Une file qui paraît longue fait passer son chemin aux clients de passage, et les habitués qui attendent trop souvent finissent par aller ailleurs. Le remède le moins cher n'est pas un barista plus rapide\u00a0: c'est de sortir une partie des commandes de la caisse.",
      },
      {
        type: "list",
        items: [
          "Donnez à vos habitués un lien ou un QR code sur le comptoir pour commander et payer depuis leur téléphone, puis venir chercher leur boisson quand leur prénom est appelé. La caisse ne sert plus que ceux qui veulent vous parler.",
          "Gardez à l'écran de la caisse ce qui se vend vraiment le matin. Un écran court et bien rangé va plus vite qu'un écran complet, et la carte entière reste à un geste.",
          "Décidez à l'avance qui fait quoi au pic\u00a0: une personne aux commandes, une à la machine, une à la remise. Aucun outil ne répare une équipe entièrement collée à la machine.",
        ],
      },
      {
        type: "p",
        text: "Dans Epidom, la page de commande de votre café est un lien public à votre adresse. Le client commande depuis son téléphone, le ticket arrive en caisse et, si vous en avez un, sur l'écran de cuisine ou de bar. Vous pouvez l'essayer dans la démo en direct, sans créer de compte.",
      },
      { type: "h2", text: "Connaître le vrai coût d'une tasse" },
      {
        type: "p",
        text: "Le coût par tasse est le chiffre que la plupart des gérants devinent. Lait, grains, sirop, gobelet, couvercle, manchon\u00a0: chacun est minuscule, et ensemble ils décident si une boisson à quatre euros vous rapporte quelque chose. La seule méthode fiable est d'écrire la recette une fois et de laisser l'outil refaire le calcul à chaque changement de prix.",
      },
      {
        type: "list",
        items: [
          "Listez les ingrédients de vos dix meilleures ventes avec les quantités, gobelet et couvercle compris. Pesez quelques doses plutôt que de vous fier à la mémoire.",
          "Saisissez le prix que vous payez réellement au kilo ou au litre, et mettez-le à jour quand votre fournisseur le change. Une marge calculée sur le prix du lait de l'an dernier est une supposition.",
          "Relisez le résultat une fois par mois. Un article cher à marge fine mérite une petite hausse\u00a0; un article très vendu à marge fine mérite qu'on regarde la recette de plus près.",
        ],
      },
      {
        type: "p",
        text: "Quand les recettes sont reliées à vos produits, chaque vente peut décompter ses ingrédients du stock et enregistrer son coût au moment de la vente. C'est ce qui permet à un rapport d'afficher une marge brute plutôt que le seul chiffre d'affaires.",
      },
      { type: "h2", text: "Commander avant la rupture, pas après" },
      {
        type: "p",
        text: "Manquer de lait d'avoine à neuf heures coûte plus cher que le lait. Cela coûte les ventes de chaque boisson qui en contient, et la confiance du client qui l'avait demandé. Une liste de stock bas que l'on regarde un jour fixe vaut mieux que toute la mémoire du monde.",
      },
      {
        type: "list",
        items: [
          "Fixez un seuil minimum pour la poignée d'articles qui arrêtent le service quand ils manquent\u00a0: lait, grains, gobelets, couvercles.",
          "Regardez la liste de stock bas une ou deux fois par semaine et passez une commande par fournisseur, plutôt que plusieurs petites.",
          "Notez les pertes quand elles arrivent. Un pichet renversé se note en dix secondes sur le moment, et ne se reconstitue pas en fin de mois.",
        ],
      },
      { type: "h2", text: "Continuer à encaisser quand la connexion coupe" },
      {
        type: "p",
        text: "Le Wi-Fi d'un café est rarement parfait. Une caisse qui se fige à la moindre coupure transforme un souci de dix secondes en coup de feu perdu. Vérifiez comment votre outil se comporte hors connexion avant d'en avoir besoin\u00a0: continue-t-il à encaisser, que fait-il des ventes ensuite, et quelles actions exigent encore du réseau\u00a0?",
      },
      {
        type: "p",
        text: "L'application de caisse d'Epidom, sur ordinateur et sur Android, continue d'enregistrer les ventes quand la connexion tombe et les envoie à son retour. L'ouverture et la clôture de la caisse, les mouvements d'espèces et les remboursements demandent la connexion, volontairement, pour que les chiffres restent fiables. Essayez une fois un après-midi calme en éteignant la box, pour que la première fois ne tombe pas en plein service.",
      },
      { type: "h2", text: "Une clôture courte et régulière" },
      {
        type: "list",
        items: [
          "Clôturez la caisse et comptez les espèces face à ce que la caisse attend. Notez l'écart, même petit.",
          "Regardez les ventes de la journée heure par heure. Si le coup de feu commence plus tôt que votre planning, décalez un service.",
          "Jetez un œil à la liste de stock bas et notez ce qu'il faut pour la commande de demain.",
          "Enregistrez les pertes pas encore notées.",
        ],
      },
      {
        type: "p",
        text: "Rien de tout cela ne demande un gros système. Il faut les mêmes quelques chiffres, regardés les mêmes jours, par la même personne. Si un outil facilite cela, tant mieux\u00a0; s'il ajoute un écran que personne n'ouvre, laissez-le de côté. Vous pouvez essayer Epidom gratuitement, sur un café de démonstration avec un mois de commandes fictives, avant de décider.",
      },
    ],
  },
  {
    slug: "restaurant-commande-a-table-flux-cuisine",
    locale: "fr",
    title: "Restaurant\u00a0: commande à table et flux de cuisine, une mise en place concrète",
    description:
      "Comment laisser les clients commander depuis la table, envoyer les tickets au bon poste, garder une seule caisse pour la salle, la vente à emporter et la livraison, et suivre stock et planning au même endroit.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Restaurants",
    blocks: [
      {
        type: "p",
        text: "Dans un restaurant, la commande est un relais. Le client choisit, le serveur note, la cuisine prépare, un runner apporte, et la caisse boucle la boucle. Chaque passage de relais est une occasion de perdre un ticket, de se tromper de table ou de laisser un plat sous la lampe. Un meilleur logiciel ne retire pas les gens du relais, mais il peut retirer les cris et le papier.",
      },
      {
        type: "p",
        text: "Ce guide présente la mise en place qui change le plus de choses pour un restaurant petit ou moyen\u00a0: la commande depuis la table, un écran de cuisine qui montre les tickets dans l'ordre, une seule caisse pour tous les canaux, et les bases de l'arrière-boutique, c'est-à-dire stock, recettes et planning. Il reste concret et indique où Epidom s'insère à chaque étape.",
      },
      { type: "h2", text: "Laisser les clients commander depuis la table" },
      {
        type: "p",
        text: "La commande à table ne sert pas à remplacer le serveur. Elle supprime les allers-retours répétitifs et peu utiles\u00a0: le deuxième tour de boissons, le pain en plus, l'addition. L'équipe garde son temps pour les clients qui veulent un conseil, et les autres commandent quand ils sont prêts.",
      },
      {
        type: "list",
        items: [
          "Posez un QR code sur chaque table qui ouvre votre carte sur le téléphone du client, avec des photos pour les plats dont on vous parle le plus.",
          "Gardez un serveur pour la première commande et pour ceux qui préfèrent parler. La commande à table marche mieux comme une option que comme une règle.",
          "Marquez indisponible ce qui vient de manquer, dès que cela arrive, pour que personne ne commande deux fois la dernière portion.",
        ],
      },
      {
        type: "p",
        text: "Dans Epidom, une commande passée depuis la table arrive comme un ticket en caisse et à l'écran de cuisine, rattaché à la table, sans que personne ne la ressaisisse. La démo en direct montre le côté client et le côté caisse sans inscription.",
      },
      { type: "h2", text: "Un écran de cuisine plutôt que du papier et des cris" },
      {
        type: "p",
        text: "Une imprimante à tickets suffit jusqu'au coup de feu, quand les tickets s'empilent et que l'ordre d'arrivée n'est plus l'ordre de cuisson. Un écran de cuisine affiche chaque ticket dans l'ordre, avec son temps d'attente, et permet au cuisinier de marquer un plat prêt pour que la salle le sache.",
      },
      {
        type: "list",
        items: [
          "Envoyez entrées, plats et desserts au bon poste, pour que le gril ne lise pas les tickets de desserts.",
          "Utilisez le timing par service\u00a0: lancez le plat quand l'entrée est débarrassée, pas quand elle est commandée.",
          "Gardez une imprimante en secours. Un écran qui perd le courant pendant le service ne doit jamais signifier une cuisine incapable de lire une commande.",
        ],
      },
      {
        type: "p",
        text: "Epidom permet d'envoyer les tickets vers plusieurs imprimantes, par exemple une imprimante de cuisine et une de bar, et propose un affichage cuisine pour les équipes qui préfèrent un écran. Choisissez ce que vos cuisiniers utiliseront vraiment\u00a0: une fonction que personne ne regarde est pire que pas de fonction.",
      },
      { type: "h2", text: "Une caisse pour la salle, la vente à emporter et la livraison" },
      {
        type: "p",
        text: "Beaucoup de restaurants tiennent trois ou quatre listes séparées\u00a0: la caisse, une tablette pour la plateforme de livraison, un cahier pour les commandes au téléphone. En fin de semaine, personne ne sait dire quels sont les vrais chiffres. Une seule caisse pour tous les canaux met toutes les ventes dans un même rapport, et c'est la seule façon de comparer les canaux honnêtement.",
      },
      {
        type: "list",
        items: [
          "Enregistrez chaque commande avec son canal, pour voir ce que rapportent la salle, la vente à emporter et la livraison.",
          "Comparez les ventes des plateformes de livraison à la commission qu'elles coûtent. Un canal très actif à marge mince n'est pas un canal rentable.",
          "Proposez votre propre lien de commande à emporter, pour que les habitués commandent en direct et que vous gardiez la totalité du montant.",
        ],
      },
      { type: "h2", text: "Stock, recettes et planning au même endroit" },
      {
        type: "p",
        text: "Derrière le passe, trois chiffres décident du mois\u00a0: le coût de chaque plat, ce que vous avez jeté, et les heures que vous avez payées. Ils vivent souvent dans trois endroits différents, ce qui explique qu'on les regarde rarement.",
      },
      {
        type: "list",
        items: [
          "Écrivez chaque recette une fois avec ses ingrédients et ses quantités, et laissez le système calculer le coût par portion quand les prix changent.",
          "Notez les pertes au fil de l'eau\u00a0: une assiette tombée, une préparation qui a tourné. Sur un mois, c'est souvent le plus gros coût que l'on ne voit pas.",
          "Construisez le planning de la semaine à partir des heures les plus chargées de la précédente, puis comparez les heures faites à ce que prévoyait le planning.",
        ],
      },
      {
        type: "p",
        text: "Epidom range recettes, stock, commandes fournisseurs et plannings du personnel à côté de la caisse\u00a0: une vente met à jour le stock, et le coût du plat apparaît à côté de son prix. C'est la partie la plus longue à mettre en place, alors commencez par vos vingt meilleures ventes et ajoutez le reste en quelques semaines.",
      },
      { type: "h2", text: "Par où commencer cette semaine" },
      {
        type: "p",
        text: "Inutile de tout changer d'un coup. Choisissez le passage de relais qui fait le plus mal. Si les tickets se perdent, commencez par l'écran de cuisine ou une deuxième imprimante. Si l'addition est lente, commencez par la commande à table. Si la marge est un mystère, commencez par cinq recettes. Essayez d'abord sur le restaurant de démonstration, puis lors d'un service calme du mardi, et seulement après un samedi soir.",
      },
    ],
  },
  {
    slug: "boulangerie-cout-de-revient-stock-production",
    locale: "fr",
    title: "Boulangerie\u00a0: coût de revient et stock pour des viennoiseries cuites par fournées",
    description:
      "Comment chiffrer une recette en fournée, vendre à la pièce, au plateau ou à la boîte, cuire la bonne quantité chaque matin et prendre les commandes à l'avance sans cahier.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Boulangeries",
    blocks: [
      {
        type: "p",
        text: "Une boulangerie vend un croissant à la fois, mais en fabrique quarante à la fois. Ce décalage est tout le problème. On s'engage sur la fournée avant de savoir qui l'achètera, les invendus valent bien moins le soir, et le coût d'une pièce est caché dans une recette écrite pour une plaque.",
      },
      {
        type: "p",
        text: "Ce guide porte sur trois habitudes qui règlent l'essentiel\u00a0: chiffrer une recette à la pièce, cuire selon un chiffre plutôt qu'au ressenti, et prendre les commandes à l'avance pour que les gâteaux et les boîtes du matin ne soient jamais une surprise. Il suppose une petite boulangerie avec un comptoir et des habitués, et montre à quoi ressemble chaque habitude dans Epidom.",
      },
      { type: "h2", text: "Chiffrer la fournée, puis diviser" },
      {
        type: "p",
        text: "Farine, beurre, œufs et sucre s'achètent au kilo, s'utilisent au gramme et se vendent à la pièce. Le calcul est facile à rater de tête et pénible à refaire à la main chaque fois que le beurre change de prix. Écrivez la recette une fois, avec son rendement, et laissez le coût par pièce en découler.",
      },
      {
        type: "list",
        items: [
          "Saisissez la recette complète avec le nombre de pièces qu'elle donne réellement, pas celui que vous espérez. Pesez une vraie fournée une fois pour vérifier le rendement.",
          "Ajoutez ce qu'on oublie facilement\u00a0: le papier, la boîte, le glaçage, le gaz ou l'électricité du four si vous voulez un coût complet.",
          "Gardez un prix par ingrédient et mettez-le à jour quand un fournisseur le change. Le beurre seul peut déplacer la marge d'un croissant.",
        ],
      },
      {
        type: "p",
        text: "Dans Epidom, une recette est reliée à un produit et ses ingrédients sont des matières premières avec leur propre prix. Le coût par pièce se met à jour quand un prix change, et chaque vente enregistre le coût de ce moment-là\u00a0: un rapport montre ainsi la vraie marge brute d'un croissant, pas celle du printemps dernier.",
      },
      { type: "h2", text: "Vendre à la pièce, au plateau ou à la boîte" },
      {
        type: "p",
        text: "Un même produit se vend souvent sous plusieurs formats\u00a0: une viennoiserie, une boîte de six, un plateau pour un bureau. Chaque format a son prix et son coût d'emballage, et les confondre grignote la marge sans bruit.",
      },
      {
        type: "list",
        items: [
          "Créez la boîte et le plateau comme des articles à part, avec leur prix et leur emballage, au lieu de faire une remise à la pièce dans votre tête.",
          "Proposez une boîte que le client compose lui-même. Elle relève le ticket moyen et aide à écouler les articles qui tournent lentement.",
          "Revoyez les prix quand un ingrédient bondit. Une petite hausse sur les articles que l'on achète sans regarder passe mieux qu'une grosse plus tard.",
        ],
      },
      { type: "h2", text: "Cuire la bonne quantité" },
      {
        type: "p",
        text: "Cuire trop peu fait perdre des ventes\u00a0; cuire trop fait perdre de l'argent, car le pain d'hier se vend beaucoup moins cher que celui d'aujourd'hui. La réponse n'est pas un sentiment dans le poignet. Ce sont les dernières semaines de ventes du même jour de la semaine, et la trace de ce que vous avez jeté.",
      },
      {
        type: "list",
        items: [
          "Regardez les ventes par article pour le même jour de la semaine sur le dernier mois, et fixez-en une quantité de départ.",
          "Notez ce qui reste à la fermeture, chaque jour. Après deux semaines, vous avez pour chaque article un chiffre plus fiable que la mémoire.",
          "Décidez d'avance du sort des invendus\u00a0: une remise à une heure fixe, un don, le pain perdu de demain. Un plan vaut mieux que l'improvisation à la fermeture.",
        ],
      },
      {
        type: "p",
        text: "Epidom suit le stock et les pertes par article, et le rapport des ventes montre ce qui s'est vendu par heure et par jour. C'est suffisant pour transformer la liste de cuisson en un tableau que l'on ajuste chaque semaine. Commencez par vos cinq meilleures ventes, car ce sont elles qui portent l'essentiel des pertes.",
      },
      { type: "h2", text: "Prendre les commandes à l'avance sans cahier" },
      {
        type: "p",
        text: "Les gâteaux, les boîtes de réception et la commande du dimanche matin sont la part la plus rentable et la plus fragile d'une boulangerie, parce qu'elle vit dans un cahier, un téléphone et la tête de quelqu'un. Une ligne perdue, c'est un client déçu le jour d'un anniversaire.",
      },
      {
        type: "list",
        items: [
          "Donnez aux clients un seul lien où voir votre offre et commander depuis leur téléphone, au lieu de messages que vous retapez ensuite.",
          "Demandez l'heure de retrait et la remarque au moment de la commande, pour ne jamais rappeler pour un détail.",
          "Affichez ou imprimez les commandes du jour en début de service, pour que le boulanger voie ce qui est déjà engagé avant de décider la fournée.",
        ],
      },
      {
        type: "p",
        text: "Votre page Epidom est un lien public à votre adresse, avec la carte, les photos et un formulaire de commande. Les commandes arrivent en caisse à côté des ventes du comptoir\u00a0: une seule liste dit quoi cuire. Essayez la démo pour voir le côté client.",
      },
      { type: "h2", text: "Une revue simple chaque semaine" },
      {
        type: "p",
        text: "Une fois par semaine, prenez dix minutes avec trois chiffres\u00a0: la marge brute par article, les pertes par article et les heures de pointe. Si un article a une bonne marge et peu de pertes, rendez-le plus facile à trouver. S'il perd beaucoup, cuisez-en moins. Si le coup de feu commence avant que le four soit prêt, avancez la première fournée. Cette boucle, répétée, fait plus pour une boulangerie que n'importe quel outil pris seul.",
      },
    ],
  },
  {
    slug: "bar-cout-matiere-tournees-cloture",
    locale: "fr",
    title: "Bar\u00a0: tournées, coût matière et clôture, le guide pour s'y retrouver",
    description:
      "Comment un petit bar peut prendre les tournées vite, laisser commander depuis la table sans faire la queue, envoyer boissons et plats au bon poste et connaître sa marge par boisson et par soirée.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Bars",
    blocks: [
      {
        type: "p",
        text: "Un bar a le problème inverse d'un café. Personne n'est pressé de partir, mais tout le monde veut la prochaine tournée au même moment. Les commandes arrivent par groupes, les additions restent ouvertes pendant des heures, et le coût d'une boisson dépend d'une dose différente à chaque fois. Le risque n'est pas une vente perdue\u00a0: c'est une soirée qui a l'air pleine et qui rapporte moins qu'elle ne devrait.",
      },
      {
        type: "p",
        text: "Ce guide traite quatre points qu'un petit bar peut régler sans gros investissement\u00a0: prendre les tournées rapidement, laisser les clients commander depuis la table, envoyer boissons et plats au bon endroit, et connaître la marge par boisson et par soirée. Il montre à quoi ressemble chacun dans Epidom, pour que vous jugiez si cela convient.",
      },
      { type: "h2", text: "Prendre les tournées vite et garder les additions justes" },
      {
        type: "p",
        text: "Au pic, une tournée de six boissons pour une table doit tenir en quelques gestes, pas en une conversation. Il en va de même pour une addition qui grossit au fil de la soirée\u00a0: si y ajouter une ligne est lent, les barmans s'en dispensent, et une boisson oubliée est une boisson que vous avez payée.",
      },
      {
        type: "list",
        items: [
          "Mettez vos dix boissons les plus commandées sur le premier écran, avec les options comme la glace, la taille et le mélangeur à un geste.",
          "Gardez une addition ouverte par table ou par prénom, complétez-la au fil de la soirée et réglez-la une seule fois, plutôt que de la garder en tête ou sur un coin de nappe.",
          "Encaissez les additions à un moment fixe, par exemple au dernier service, pour que rien ne reste derrière une file de fermeture.",
        ],
      },
      { type: "h2", text: "Laisser les clients commander depuis la table" },
      {
        type: "p",
        text: "Un soir de forte affluence, le comptoir lui-même est le goulot. Les clients attendent de croiser le regard d'un barman, et ceux qui renoncent partent sans la tournée de plus. La commande à table déplace cette attente du comptoir vers le téléphone du client, où elle ne vous coûte rien.",
      },
      {
        type: "list",
        items: [
          "Posez un QR code sur chaque table ou sur la carte, et laissez les clients commander la tournée suivante quand ils sont prêts.",
          "Gardez une règle claire pour la remise\u00a0: service à table, ou retrait au comptoir quand le prénom s'affiche. Les clients acceptent les deux si c'est évident.",
          "Vérifiez les règles d'âge et de licence qui s'appliquent chez vous, et gardez la remise de l'alcool entre les mains d'une personne, quel que soit l'outil.",
        ],
      },
      {
        type: "p",
        text: "Dans Epidom, une commande de la table arrive comme un ticket en caisse et, si vous utilisez une imprimante ou un écran de bar, au bon poste. Rien n'est ressaisi, et la table figure sur le ticket. La démo en direct montre les deux côtés.",
      },
      { type: "h2", text: "Les boissons au bar, les plats en cuisine" },
      {
        type: "p",
        text: "Un bar qui sert à manger gère deux postes avec une seule commande. Si un ticket avec un cocktail et un burger sort au même endroit, soit le barman lit le plat, soit le cuisinier lit la boisson. Séparer le ticket selon le type d'article règle cela et garde les deux postes en mouvement.",
      },
      {
        type: "list",
        items: [
          "Attribuez un poste à chaque article\u00a0: bar, cuisine ou les deux. Une commande mixte sort alors à deux endroits et personne ne lit ce qui n'est pas pour lui.",
          "Ajoutez une imprimante d'étiquettes si vous vendez des boissons en bouteille, des gobelets à emporter ou voulez un ticket sur chaque verre.",
          "Testez tout le trajet avec une vraie commande avant la soirée, du téléphone du client à chaque imprimante.",
        ],
      },
      {
        type: "p",
        text: "Epidom gère plusieurs imprimantes avec des rôles différents, comme reçu, cuisine, bar et étiquettes, pour qu'une commande sorte là où il le faut. Regardez d'abord le matériel que vous possédez déjà\u00a0: beaucoup d'imprimantes de tickets courantes fonctionnent.",
      },
      { type: "h2", text: "Connaître la marge par boisson et par soirée" },
      {
        type: "p",
        text: "Le coût matière est la part du prix d'une boisson qui part dans ce qu'il y a dans le verre. C'est le premier chiffre qu'un patron de bar devrait connaître, et le dernier que la plupart estiment. Construisez-le à partir de la recette\u00a0: l'alcool en millilitres, le mélangeur, la garniture, la glace et le verre, au prix que vous payez vraiment.",
      },
      {
        type: "list",
        items: [
          "Écrivez chaque cocktail comme une recette aux mesures exactes, et standardisez la dose avec un doseur pour que la recette soit vraie.",
          "Comptez les bouteilles à la fermeture pour vos principaux alcools, et comparez avec ce que les ventes disent qu'il doit rester. Un écart est le signal pour regarder de plus près.",
          "Regardez la marge par boisson et par soirée, pas seulement le chiffre d'affaires. Une soirée pleine de boissons à faible marge peut rapporter moins qu'une soirée plus calme.",
        ],
      },
      {
        type: "p",
        text: "Avec des recettes reliées aux produits, Epidom enregistre le coût de chaque boisson au moment de la vente et affiche la marge brute dans le rapport financier. La précision dépend toutefois de vos mesures et de la mise à jour des prix de vos bouteilles.",
      },
      { type: "h2", text: "Une clôture qui tient en peu de temps" },
      {
        type: "list",
        items: [
          "Soldez les additions et la caisse, comptez les espèces et notez l'écart éventuel.",
          "Comptez les bouteilles qui comptent et enregistrez casse et renversements comme des pertes.",
          "Regardez les ventes de la soirée heure par heure et notez quand le coup de feu a vraiment commencé.",
          "Préparez la commande de demain si la liste de stock bas indique un manque.",
        ],
      },
      {
        type: "p",
        text: "Faites les mêmes quelques gestes chaque soir et les chiffres commencent à avoir un sens. Vous pouvez essayer le bar de démonstration, avec un mois de ventes et de recettes fictives, gratuitement et sans compte, pour voir à quoi ressemblent les écrans avant de configurer le vôtre.",
      },
    ],
  },
  {
    slug: "food-truck-menu-court-file-rapide",
    locale: "fr",
    title: "Food truck\u00a0: un menu court, une file rapide et un réseau capricieux",
    description:
      "Un guide de terrain pour food trucks\u00a0: bâtir un menu court qui se vend vite, laisser commander par QR code dans la file, encaisser hors connexion et connaître sa marge par événement.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Food trucks",
    blocks: [
      {
        type: "p",
        text: "Un food truck est un restaurant avec un guichet, sans salle et avec une connexion qui vaut ce que vaut le parking. Les contraintes sont serrées\u00a0: peu d'espace, un service court, une file de gens qui n'attendront pas longtemps et un signal qui va et vient. Les camions qui réussissent font de ces contraintes des règles.",
      },
      {
        type: "p",
        text: "Ce guide pose quatre règles\u00a0: garder le menu court, sortir la commande du guichet, continuer à encaisser quand le signal tombe et mesurer chaque événement séparément. Il s'adresse aux gérants d'un camion, et indique où Epidom aide à chaque étape, pour que vous jugiez si cela vous convient.",
      },
      { type: "h2", text: "Règle un\u00a0: un menu court qui se vend vite" },
      {
        type: "p",
        text: "Chaque article en plus ralentit la file, ajoute du stock à transporter et rend le guichet plus difficile à lire. Un menu court se prépare plus vite, se chiffre plus facilement et se retient mieux. La plupart des camions vendent quelques plats signature bien plus que le reste.",
      },
      {
        type: "list",
        items: [
          "Réduisez la carte à ce que vous servez en un temps très court par commande au plus fort du service. Gardez le reste pour un jour spécial.",
          "Faites du meilleur plat le plus simple à commander et à préparer, et affichez son prix là où la file peut le lire.",
          "Proposez les choix comme de simples options, taille ou sauce, plutôt que comme de nouveaux articles. L'écran de caisse reste petit.",
        ],
      },
      { type: "h2", text: "Règle deux\u00a0: prendre la commande avant le guichet" },
      {
        type: "p",
        text: "Le guichet est le goulot\u00a0: une seule personne prend, cuisine et remet. Tout ce qui avance la commande raccourcit l'attente de tout le monde. Un QR code sur un panneau dans la file permet de choisir et de payer en attendant, pour que le guichet ne serve plus qu'à remettre.",
      },
      {
        type: "list",
        items: [
          "Placez un grand QR code là où la file se forme, avec une courte phrase qui dit à quoi il sert.",
          "Affichez clairement le prénom ou le numéro de retrait, pour que chacun sache quand avancer.",
          "Gardez une caisse au guichet pour ceux qui préfèrent y commander. Les deux canaux doivent finir dans la même liste.",
        ],
      },
      {
        type: "p",
        text: "Dans Epidom, votre camion a une page de commande publique à votre adresse. Les commandes des téléphones arrivent en caisse avec les ventes du guichet, dans une seule liste. Essayez la démo en direct pour voir ce que voit le client, puis imprimez votre propre QR code.",
      },
      { type: "h2", text: "Règle trois\u00a0: continuer à encaisser quand le signal tombe" },
      {
        type: "p",
        text: "Marchés, parkings et festivals sont exactement les endroits où les connexions lâchent. Une caisse qui a besoin d'internet pour chaque vente fait perdre la meilleure heure de la journée. Avant de compter sur un outil, testez son comportement hors connexion\u00a0: continue-t-il à enregistrer les ventes, et que deviennent-elles ensuite\u00a0?",
      },
      {
        type: "list",
        items: [
          "Testez la caisse avec le téléphone en mode avion avant le premier événement, pas pendant.",
          "Sachez quelles actions exigent encore du réseau. Dans Epidom, ce sont l'ouverture et la clôture de la caisse, les mouvements d'espèces et les remboursements\u00a0: prévoyez de les faire là où il y a du signal.",
          "Gardez un lecteur de cartes avec ses propres données mobiles, séparé de la caisse, pour qu'une connexion faible sur l'un n'arrête pas l'autre.",
        ],
      },
      {
        type: "p",
        text: "L'application de caisse d'Epidom, sur ordinateur et sur Android, continue d'enregistrer les ventes sans connexion et les envoie au retour du réseau. Prenez le premier événement comme une répétition et vérifiez que chaque vente faite hors connexion apparaît ensuite.",
      },
      { type: "h2", text: "Règle quatre\u00a0: mesurer chaque événement" },
      {
        type: "p",
        text: "La semaine d'un camion est faite de journées très différentes\u00a0: un parking à midi, un marché le samedi, un festival le soir. Un total mensuel unique cache lesquelles valent l'emplacement et le carburant. Mesurez chacune pour elle-même.",
      },
      {
        type: "list",
        items: [
          "Notez le coût de l'emplacement ou de l'événement et comparez-le à la marge brute de la journée, pas seulement au chiffre d'affaires.",
          "Enregistrez le stock emporté et le stock rapporté. Cela dit quoi préparer la prochaine fois.",
          "Regardez les ventes par heure. Si le pic est plus court que l'événement, vous pouvez partir plus tôt ou charger moins.",
        ],
      },
      {
        type: "p",
        text: "Les rapports d'Epidom montrent les ventes par heure et par article, et la marge brute une fois vos recettes chiffrées. Ajoutez le coût de l'événement comme dépense et vous avez le vrai résultat de la journée. Un coup d'œil hebdomadaire aux mêmes quelques chiffres vous dira où vous garer le mois prochain.",
      },
      { type: "h2", text: "Une liste pour le matin d'un événement" },
      {
        type: "list",
        items: [
          "Chargez le téléphone, l'imprimante et le lecteur de cartes, et emportez un câble de rechange.",
          "Ouvrez la caisse pendant que vous avez encore du signal.",
          "Imprimez ou affichez le QR code et vérifiez qu'il ouvre bien la page de commande.",
          "Comparez la liste de stock bas avec ce qu'il y a dans le camion.",
        ],
      },
      {
        type: "p",
        text: "Passez la même liste en revue à chaque fois et la journée devient une routine. Vous pouvez essayer Epidom gratuitement sur un food truck de démonstration avec des ventes fictives avant de configurer votre propre menu.",
      },
    ],
  },
];
