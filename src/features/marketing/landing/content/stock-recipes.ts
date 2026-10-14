import type { LandingPage } from "../types";

export const stockRecipesPages: LandingPage[] = [
  {
    slug: "gestion-stock-restaurant",
    locale: "fr",
    group: "stock-recipes",
    kind: "feature",
    metaTitle: "Gestion de stock restaurant et fiches techniques",
    metaDescription:
      "Gestion de stock restaurant\u00a0: fiches techniques, coût matière calculé, stock déduit à chaque commande, alertes et commandes fournisseurs. Dès 27,99\u00a0€/mois.",
    eyebrow: "Stock et fiches techniques",
    h1: "Gestion de stock restaurant\u00a0: du produit brut à la marge",
    lede: "Une bonne gestion de stock relie trois choses\u00a0: ce que vous avez en réserve, ce que chaque plat consomme et ce que vous commandez. Epidom les relie dans un seul outil, avec le coût matière de chaque plat calculé pour vous.",
    blocks: [
      { type: "h2", text: "Pourquoi le stock se perd entre deux services" },
      {
        type: "p",
        text: "Dans la plupart des restaurants, le stock vit dans la tête du chef et sur un cahier. L'inventaire se fait le lundi, la commande au feeling, et on découvre l'écart de marge à la fin du mois. Trois fuites reviennent presque toujours\u00a0: les portions qui dérivent, les pertes jamais notées et les prix fournisseurs qui montent sans que les prix de vente suivent.",
      },
      {
        type: "p",
        text: "Pour les voir, il faut deux outils simples\u00a0: une fiche technique par plat et un stock qui bouge au rythme des ventes. Le reste, c'est de la discipline.",
      },
      { type: "h2", text: "La fiche technique\u00a0: la base du coût matière" },
      {
        type: "p",
        text: "Une fiche technique liste les ingrédients d'un plat avec leur quantité exacte. Avec le prix d'achat de chaque ingrédient, elle donne le coût de revient du plat, c'est-à-dire ce que vous dépensez en matière avant même d'allumer le feu.",
      },
      {
        type: "callout",
        text: "Exemple\u00a0: une quiche lorraine pour 8 parts demande 250 g de pâte à 3,00\u00a0€ le kilo, 200 g de lardons à 9,00\u00a0€ le kilo, 4 œufs à 0,35\u00a0€ pièce et 40 cl de crème à 3,50\u00a0€ le litre. Total\u00a0: 0,75\u00a0€ + 1,80\u00a0€ + 1,40\u00a0€ + 1,40\u00a0€ = 5,35\u00a0€, soit 0,67\u00a0€ la part. Vendue 4,50\u00a0€, la part laisse une marge brute de 3,83\u00a0€.",
      },
      {
        type: "p",
        text: "En règle générale, beaucoup de restaurateurs visent un coût matière autour de 25 à 35\u00a0% du prix de vente hors taxe. Ce n'est qu'un repère\u00a0: un bar à vin et une brasserie n'ont pas le même équilibre. L'important est de connaître votre chiffre, plat par plat.",
      },
      { type: "h2", text: "Comment Epidom gère le stock" },
      {
        type: "p",
        text: "La gestion du stock et des recettes fait partie du plan Operations. Voici ce que vous y trouvez.",
      },
      {
        type: "list",
        items: [
          "Un catalogue d'ingrédients avec le niveau de stock actuel",
          "Des recettes avec les quantités, et le coût de revient de chaque plat calculé automatiquement",
          "Le stock déduit quand une commande est terminée, sans saisie à la main",
          "Des alertes de stock bas pour commander avant la rupture",
          "Un historique de tous les mouvements\u00a0: livraisons, ventes, ajustements, pertes",
          "Des fournisseurs et des commandes fournisseurs\u00a0: à la réception, le stock est mis à jour",
        ],
      },
      {
        type: "p",
        text: "Les pertes se saisissent avec un motif et réapparaissent dans la rubrique Finance, à côté du chiffre d'affaires et de la marge. Vous voyez ce que le gaspillage vous coûte réellement.",
      },
      { type: "h2", text: "Mettre en place votre inventaire restaurant" },
      {
        type: "steps",
        items: [
          {
            title: "Listez vos ingrédients",
            text: "Ajoutez chaque matière première avec son unité et son prix d'achat. Commencez par les dix produits qui pèsent le plus dans vos achats.",
          },
          {
            title: "Écrivez vos fiches techniques",
            text: "Pour chaque plat, indiquez les quantités par portion. Le coût de revient s'affiche tout de suite.",
          },
          {
            title: "Reliez le menu aux recettes",
            text: "Les articles du menu liés à une recette retirent leurs ingrédients du stock au fil des ventes.",
          },
          {
            title: "Faites un premier inventaire",
            text: "Comptez ce que vous avez et ajustez les niveaux. Un ajustement groupé permet de corriger beaucoup de produits d'un coup.",
          },
          {
            title: "Commandez et réceptionnez",
            text: "Créez la commande fournisseur, envoyez-la par e-mail ou WhatsApp, puis marquez-la Reçue à la livraison\u00a0: le stock augmente.",
          },
        ],
      },
      { type: "h2", text: "Les commandes fournisseurs en deux temps" },
      {
        type: "p",
        text: "Une commande fournisseur se fait en deux étapes\u00a0: vous la créez avec le fournisseur, les articles, les quantités et la date prévue, puis vous la marquez Reçue quand la marchandise arrive. Tant qu'elle n'est pas reçue, rien n'entre dans le stock. Si la livraison n'arrive jamais, vous annulez la commande et le stock reste juste.",
      },
      { type: "h2", text: "Ce que l'outil ne fait pas à votre place" },
      {
        type: "callout",
        text: "Le stock théorique (ce que les ventes devraient avoir consommé) diffère toujours un peu du stock réel. Un inventaire régulier reste nécessaire\u00a0: l'écart entre les deux est justement ce qui révèle les pertes et les portions trop généreuses.",
      },
    ],
    faqs: [
      {
        q: "Qu'est-ce qu'une fiche technique en restauration\u00a0?",
        a: "C'est la liste des ingrédients d'un plat avec leurs quantités par portion. Associée aux prix d'achat, elle donne le coût matière du plat et sert de référence pour garder des portions régulières d'un cuisinier à l'autre.",
      },
      {
        q: "Comment calculer le coût matière d'un plat\u00a0?",
        a: "Additionnez le coût de chaque ingrédient pour une portion, puis divisez par le prix de vente hors taxe. Un plat qui coûte 3,00\u00a0€ en matière et se vend 10,00\u00a0€ hors taxe a un coût matière de 30\u00a0%. Epidom fait ce calcul dans la recette.",
      },
      {
        q: "Le stock baisse-t-il tout seul quand je vends\u00a0?",
        a: "Oui, pour les articles du menu reliés à une recette ou à un produit\u00a0: leurs ingrédients sortent du stock quand la commande est terminée. Les articles non reliés ne touchent pas au stock.",
      },
      {
        q: "Peut-on suivre les pertes et le gaspillage\u00a0?",
        a: "Oui. Vous enregistrez une perte avec un motif, elle apparaît dans l'historique des mouvements et dans la rubrique Finance, pour mesurer ce que le gaspillage coûte sur la période.",
      },
      {
        q: "Combien coûte la gestion de stock dans Epidom\u00a0?",
        a: "Elle fait partie du plan Operations, à 27,99\u00a0€ par mois (23,49\u00a0€ par mois en abonnement annuel), hors taxe. Ce plan inclut aussi les finances, le personnel et jusqu'à 3 établissements.",
      },
    ],
    cta: {
      title: "Connaissez le coût réel de chaque plat",
      text: "Le stock, les recettes et les commandes fournisseurs sont inclus dans le plan Operations. Comparez les plans et choisissez celui qui vous convient.",
      button: "Voir les tarifs →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "aplikasi-stok-bahan-baku",
    locale: "id",
    group: "stock-recipes",
    kind: "feature",
    metaTitle: "Aplikasi Stok Bahan Baku dan HPP Resep Otomatis",
    metaDescription:
      "Aplikasi stok bahan baku untuk kafe dan restoran: HPP resep otomatis, stok berkurang tiap pesanan selesai, peringatan stok menipis. Mulai Rp 459.000/bulan.",
    eyebrow: "Stok dan resep",
    h1: "Aplikasi stok bahan baku dengan HPP resep otomatis",
    lede: "Stok yang rapi dimulai dari tiga hal: resep dengan takaran jelas, stok yang berkurang sendiri saat Anda jualan, dan pesanan ke supplier yang tercatat. Epidom menyatukannya dan menghitung HPP setiap menu untuk Anda.",
    blocks: [
      { type: "h2", text: "Kenapa bahan baku sering bocor tanpa terasa" },
      {
        type: "p",
        text: "Di banyak kafe dan warung, stok dicatat di buku atau cukup diingat. Hasilnya sama: bahan habis di tengah jam ramai, bahan lain menumpuk sampai rusak, dan di akhir bulan laba terasa lebih tipis dari hitungan. Biasanya penyebabnya tiga: takaran yang bergeser, bahan terbuang yang tidak dicatat, dan harga beli naik tapi harga jual tetap.",
      },
      { type: "h2", text: "HPP resep: dasar dari semua hitungan" },
      {
        type: "p",
        text: "HPP (harga pokok penjualan) satu menu adalah jumlah biaya bahan untuk satu porsi. Anda perlu resep dengan takaran, dan harga beli tiap bahan.",
      },
      {
        type: "callout",
        text: "Contoh: es kopi susu 1 gelas memakai 18 g kopi (Rp 280.000 per kg = Rp 5.040), 150 ml susu (Rp 20.000 per liter = Rp 3.000), 20 ml sirup gula (Rp 1.000) dan es serta gelas (Rp 1.500). HPP = Rp 5.040 + 3.000 + 1.000 + 1.500 = Rp 10.540. Dijual Rp 28.000, margin kotornya Rp 17.460, atau HPP sekitar 38 persen dari harga jual.",
      },
      {
        type: "p",
        text: "Sebagai patokan umum, banyak pemilik kafe menjaga HPP bahan di kisaran 25 sampai 35 persen dari harga jual. Ini hanya acuan, bukan aturan: yang terpenting Anda tahu angka tiap menu.",
      },
      { type: "h2", text: "Yang Anda dapat di Epidom" },
      {
        type: "p",
        text: "Fitur stok dan resep ada di paket Operations. Isinya:",
      },
      {
        type: "list",
        items: [
          "Katalog bahan baku dengan jumlah stok saat ini",
          "Resep dengan takaran, dan HPP per menu yang dihitung otomatis",
          "Stok berkurang otomatis saat pesanan selesai",
          "Peringatan stok menipis, supaya Anda belanja sebelum bahan habis",
          "Riwayat semua pergerakan stok: barang datang, penjualan, penyesuaian, bahan terbuang",
          "Supplier dan pesanan ke supplier: begitu pesanan diterima, stok bertambah",
        ],
      },
      {
        type: "p",
        text: "Bahan terbuang dicatat dengan alasan, lalu muncul di laporan Finance di samping omzet dan margin. Jadi Anda tahu berapa rupiah yang hilang karena rusak, tumpah, atau salah buat.",
      },
      { type: "h2", text: "Cara mulai stok opname kafe" },
      {
        type: "steps",
        items: [
          {
            title: "Daftarkan bahan baku",
            text: "Masukkan tiap bahan dengan satuan dan harga belinya. Mulai dari sepuluh bahan yang paling besar pengeluarannya.",
          },
          {
            title: "Buat resep tiap menu",
            text: "Isi takaran per porsi. HPP langsung terlihat begitu resep disimpan.",
          },
          {
            title: "Hubungkan menu ke resep",
            text: "Menu yang terhubung ke resep akan mengurangi bahannya dari stok saat terjual.",
          },
          {
            title: "Lakukan stok opname pertama",
            text: "Hitung stok yang ada lalu sesuaikan angkanya. Penyesuaian massal membantu bila bahannya banyak.",
          },
          {
            title: "Pesan dan terima barang",
            text: "Buat pesanan ke supplier, kirim lewat email atau WhatsApp, lalu tandai Diterima saat barang datang. Stok otomatis bertambah.",
          },
        ],
      },
      { type: "h2", text: "Pesanan ke supplier dalam dua langkah" },
      {
        type: "p",
        text: "Pertama Anda membuat pesanan: supplier, barang, jumlah, dan tanggal perkiraan tiba. Kedua, saat barang sampai, Anda menandainya Diterima. Selama belum diterima, stok tidak berubah. Kalau barang tidak jadi datang, batalkan pesanannya dan stok Anda tetap akurat.",
      },
      { type: "h2", text: "Kapan harga jual perlu disesuaikan" },
      {
        type: "p",
        text: "Harga bahan berubah, dan HPP ikut berubah. Kalau harga susu atau kopi naik, perbarui harga belinya dan HPP semua menu yang memakainya ikut terhitung ulang. Dari situ Anda bisa memutuskan: menaikkan harga jual sedikit, mengurangi takaran, atau mengganti bahan, sebelum margin menipis tanpa Anda sadari.",
      },
      { type: "h2", text: "Batas yang perlu Anda tahu" },
      {
        type: "callout",
        text: "Stok di aplikasi adalah stok menurut penjualan, dan selalu sedikit berbeda dari stok di rak. Tetap lakukan stok opname berkala: selisihnya justru menunjukkan takaran yang terlalu royal atau bahan yang hilang.",
      },
    ],
    faqs: [
      {
        q: "Bagaimana cara menghitung HPP resep?",
        a: "Jumlahkan biaya semua bahan untuk satu porsi, lalu bandingkan dengan harga jual. Jika bahan satu menu Rp 9.000 dan dijual Rp 30.000, HPP-nya 30 persen. Di Epidom hitungan ini muncul otomatis di resep.",
      },
      {
        q: "Apakah stok berkurang sendiri saat ada penjualan?",
        a: "Ya, untuk menu yang sudah terhubung ke resep atau produk. Bahannya keluar dari stok ketika pesanan selesai. Menu yang tidak terhubung tidak memengaruhi stok.",
      },
      {
        q: "Bisakah mencatat bahan yang terbuang?",
        a: "Bisa. Catat jumlahnya dengan alasan, dan datanya tampil di riwayat stok serta laporan Finance, sehingga kerugian akibat bahan terbuang terlihat jelas.",
      },
      {
        q: "Bagaimana kalau bahan hampir habis?",
        a: "Epidom memberi peringatan stok menipis supaya Anda bisa memesan lebih dulu. Pesanan ke supplier bisa dikirim lewat email atau WhatsApp, atau dicetak.",
      },
      {
        q: "Berapa harga fitur stok dan resep?",
        a: "Fitur ini ada di paket Operations: Rp 459.000 per bulan (Rp 379.000 per bulan dengan paket tahunan), belum termasuk pajak. Paket yang sama juga memuat laporan keuangan, karyawan, dan sampai 3 outlet.",
      },
    ],
    cta: {
      title: "Ketahui HPP setiap menu Anda",
      text: "Stok, resep, dan pesanan ke supplier ada di paket Operations. Lihat paket dan pilih yang sesuai dengan usaha Anda.",
      button: "Lihat harga →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "restaurant-inventory-software",
    locale: "en",
    group: "stock-recipes",
    kind: "feature",
    metaTitle: "Restaurant Inventory Software with Recipe Costing",
    metaDescription:
      "Restaurant inventory software linking recipes to stock: automatic recipe costing, food cost tracking, low-stock alerts, supplier orders. From $29.99/mo.",
    eyebrow: "Inventory and recipes",
    h1: "Restaurant inventory software with built-in recipe costing",
    lede: "Good inventory control connects three things: what is on the shelf, what each dish uses, and what you reorder. Epidom links them and works out the cost of every dish, so food cost tracking happens as you sell.",
    blocks: [
      { type: "h2", text: "Where restaurant stock quietly leaks" },
      {
        type: "p",
        text: "In a lot of kitchens, inventory lives in a notebook and in the chef's head. Counts happen once a week, orders go in by feel, and the margin problem shows up at month end. Three leaks come up again and again: portions that drift, waste nobody writes down, and supplier prices that rise while menu prices stay put.",
      },
      { type: "h2", text: "Recipe costing: the foundation of food cost" },
      {
        type: "p",
        text: "A recipe lists the ingredients in a dish with exact quantities. Combine that with what you pay for each ingredient and you get the plate cost: what the dish costs in ingredients before anyone cooks it.",
      },
      {
        type: "callout",
        text: "Example: a burger uses a 150 g patty at $9.00 per lb of ground beef ($2.98), a $0.60 bun, 30 g of cheese ($0.45), lettuce and tomato ($0.40) and sauce ($0.25). Plate cost = $2.98 + 0.60 + 0.45 + 0.40 + 0.25 = $4.68. Sold at $14.00, food cost is about 33% and the gross margin is $9.32.",
      },
      {
        type: "p",
        text: "As a common rule of thumb, many restaurants aim for food cost somewhere between 25% and 35% of the menu price. It is a reference, not a law; a steakhouse and a sandwich shop sit in different places. What matters is knowing your own number, dish by dish.",
      },
      { type: "h2", text: "What Epidom does with it" },
      {
        type: "p",
        text: "Stock and recipes are part of the Operations plan. Here is what you get:",
      },
      {
        type: "list",
        items: [
          "An ingredient catalog with the current stock level of each item",
          "Recipes with quantities, and an automatic cost per dish",
          "Stock deducted when orders complete, with no manual entry",
          "Low-stock alerts so you reorder before you run out",
          "A movement history covering deliveries, sales, adjustments and waste",
          "Suppliers and supplier orders: receiving an order updates stock",
        ],
      },
      {
        type: "p",
        text: "Waste is recorded with a reason and shows up in Finance next to revenue and margin, so you can see what spoilage and mistakes cost you over a period.",
      },
      { type: "h2", text: "Setting up your restaurant inventory" },
      {
        type: "steps",
        items: [
          {
            title: "List your ingredients",
            text: "Add each raw item with its unit and purchase price. Start with the ten items that make up most of your spend.",
          },
          {
            title: "Build your recipes",
            text: "Enter the quantity per portion for each dish. The cost per dish appears as soon as you save.",
          },
          {
            title: "Link the menu to recipes",
            text: "Menu items tied to a recipe take their ingredients out of stock as they sell.",
          },
          {
            title: "Run a first count",
            text: "Count what is on the shelf and correct the levels. Bulk adjust fixes many items at once.",
          },
          {
            title: "Order and receive",
            text: "Create the supplier order, send it by email or WhatsApp, then mark it Received on delivery to add the items to stock.",
          },
        ],
      },
      { type: "h2", text: "Supplier orders in two steps" },
      {
        type: "p",
        text: "A supplier order has two steps. You create it with the supplier, the items, the quantities and the expected day. When the delivery arrives you mark it Received, and only then does stock go up. If it never comes, cancel it and nothing is added.",
      },
      { type: "h2", text: "When to revisit your menu prices" },
      {
        type: "p",
        text: "Ingredient prices move, and so does plate cost. When the price of beef or coffee goes up, update the purchase price and every recipe that uses it is recalculated. From there you can decide whether to raise the menu price slightly, trim a portion or swap an ingredient, before the margin quietly shrinks.",
      },
      { type: "h2", text: "What software can't do for you" },
      {
        type: "callout",
        text: "Stock in the app is the stock your sales say you should have, and it will always drift a little from the walk-in. Keep counting on a schedule: the gap between the two is what exposes over-portioning and loss.",
      },
    ],
    faqs: [
      {
        q: "What is recipe costing?",
        a: "Recipe costing adds up the cost of every ingredient in one portion of a dish. Divide that by the menu price and you get food cost as a percentage. Epidom calculates it inside the recipe from your ingredient prices.",
      },
      {
        q: "Does stock go down automatically when I sell?",
        a: "Yes, for menu items linked to a recipe or product. Their ingredients are deducted when the order completes. Items that are not linked do not affect stock.",
      },
      {
        q: "Can I track waste?",
        a: "Yes. Record waste with a reason and it appears in the stock movement history and in Finance, so you can see what it costs over the period.",
      },
      {
        q: "Can I order from suppliers inside the app?",
        a: "Yes. Create a supplier order, send it by email or WhatsApp or print it, and mark it Received when the delivery arrives. Receiving updates your stock.",
      },
      {
        q: "How much does inventory management cost?",
        a: "It is part of the Operations plan at $29.99 per month ($24.99 per month billed yearly), before tax. That plan also covers finance reports, staff and up to 3 outlets.",
      },
    ],
    cta: {
      title: "Know what every dish really costs",
      text: "Stock, recipes and supplier orders are included in the Operations plan. Compare plans and pick the one that fits.",
      button: "See pricing →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
];
