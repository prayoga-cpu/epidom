import type { LandingPage } from "../types";

export const qrMenuPages: LandingPage[] = [
  {
    slug: "menu-qr-code-gratuit",
    locale: "fr",
    group: "qr-menu",
    kind: "tool",
    metaTitle: "Menu QR code gratuit pour restaurant et café",
    metaDescription:
      "Créez un menu QR code gratuit\u00a0: une vraie page avec photos, prix, options et horaires, plus un QR code à imprimer. Gratuit sans limite de durée.",
    eyebrow: "Menu QR code",
    h1: "Menu QR code gratuit\u00a0: une vraie carte, pas un PDF",
    lede: "Epidom vous donne gratuitement une page de carte à l’adresse epidom.fr/@nom-du-lieu, avec photos, prix et horaires, et un QR code prêt à imprimer pour vos tables. Vos clients consultent la carte gratuitement\u00a0; la prise de commande depuis cette page demande le forfait POS.",
    blocks: [
      { type: "h2", text: "PDF ou vraie carte en ligne\u00a0: ce qui change pour le client" },
      {
        type: "p",
        text: "Beaucoup de menus QR code renvoient vers un PDF. Sur un téléphone, il faut pincer, zoomer, faire défiler une image de 3 Mo qui met du temps à charger en 4G. Les prix y sont figés\u00a0: pour corriger un tarif, il faut refaire le fichier, le remettre en ligne et espérer que personne n’ait enregistré l’ancienne version.",
      },
      {
        type: "p",
        text: "Une vraie carte en ligne est une page web faite pour l’écran du téléphone\u00a0: catégories repliables, photos des plats, prix lisibles, options visibles. Vous modifiez un prix à un endroit, et tous les clients voient la nouvelle valeur au scan suivant, sans réimprimer quoi que ce soit.",
      },
      { type: "h2", text: "Ce que contient la page gratuite" },
      {
        type: "p",
        text: "Le forfait Gratuit d’Epidom est une page publique pour votre établissement, gratuite sans limite de durée. Elle comprend\u00a0:",
      },
      {
        type: "list",
        items: [
          "la carte organisée en catégories, avec photo, prix et description pour chaque article",
          "les options (taille, suppléments) et un interrupteur «\u00a0épuisé\u00a0» pour retirer un plat en un geste",
          "des articles mis en avant pour pousser le plat du jour ou une nouveauté",
          "vos horaires d’ouverture, votre logo, vos couleurs, une photo de couverture et une accroche",
          "des liens\u00a0: Instagram, TikTok, WhatsApp, Google Maps, vos plateformes de livraison et des liens libres",
          "un QR code imprimable qui pointe vers la page, et des statistiques simples (vues, vues de la carte, clics WhatsApp)",
        ],
      },
      {
        type: "callout",
        text: "À retenir\u00a0: la carte est gratuite à consulter. Le forfait Gratuit ne prend pas de commandes. Pour que vos clients commandent depuis la page (sur place avec un numéro de table, ou à emporter), il faut le forfait POS, à 13,99\u00a0€ par mois après 14 jours d’essai gratuit.",
      },
      { type: "h2", text: "Créer votre menu QR code, étape par étape" },
      {
        type: "steps",
        items: [
          {
            title: "Créez votre compte",
            text: "Inscrivez-vous gratuitement et donnez un nom à votre établissement. Votre page est disponible à l’adresse epidom.fr/@nom-du-lieu.",
          },
          {
            title: "Saisissez votre carte",
            text: "Créez vos catégories (entrées, plats, boissons), puis ajoutez chaque article avec son prix, une photo et ses options. Commencez par les dix articles les plus vendus\u00a0: le reste peut suivre.",
          },
          {
            title: "Habillez la page",
            text: "Ajoutez votre logo, vos couleurs, une photo de couverture, vos horaires et vos liens. C’est ce que le client voit en premier.",
          },
          {
            title: "Imprimez le QR code",
            text: "Téléchargez le QR code de la page et placez-le sur vos tables, votre comptoir et votre vitrine. Testez-le avec votre propre téléphone avant d’imprimer en série.",
          },
        ],
      },
      { type: "h2", text: "Que mettre sur la carte de table" },
      {
        type: "p",
        text: "Le QR code seul ne dit pas pourquoi le scanner. Une carte de table efficace tient sur un petit chevalet ou un sous-verre et contient peu de choses\u00a0:",
      },
      {
        type: "list",
        items: [
          "une phrase d’invitation claire, par exemple «\u00a0Scannez pour voir la carte\u00a0»",
          "le QR code, assez grand (3 cm de côté au minimum) et imprimé en foncé sur fond clair",
          "l’adresse courte en toutes lettres, epidom.fr/@nom-du-lieu, pour ceux qui ne scannent pas",
          "votre nom et, si vous le souhaitez, un numéro de table pour vous repérer",
        ],
      },
      {
        type: "p",
        text: "Gardez toujours une ou deux cartes papier pour les clients qui préfèrent ne pas sortir leur téléphone\u00a0: le QR code complète le service, il ne remplace pas l’accueil.",
      },
      { type: "h2", text: "Garder vos prix à jour sans réimprimer" },
      {
        type: "p",
        text: "C’est le vrai avantage d’une carte en ligne. Le prix du café monte, un fournisseur change, un plat n’est plus disponible\u00a0: vous modifiez l’article dans Epidom et la page est à jour. Pour une rupture en plein service, l’interrupteur «\u00a0épuisé\u00a0» évite de décevoir le client qui avait déjà choisi.",
      },
      {
        type: "p",
        text: "Prenez l’habitude de relire la carte une fois par semaine, téléphone en main, comme un client. C’est aussi l’occasion de vérifier que les photos sont nettes et que les horaires de la semaine suivante sont justes.",
      },
      { type: "h2", text: "Et pour commander depuis la carte\u00a0?" },
      {
        type: "p",
        text: "Si vous voulez que le client commande depuis son téléphone, la commande en ligne fait partie du forfait POS\u00a0: sur place avec un numéro de table, ou à emporter. Aujourd’hui, ces commandes se règlent à la caisse\u00a0: la caisse est alertée, et le caissier les marque comme payées. Le forfait POS inclut aussi la caisse, la file des commandes et l’écran cuisine, avec 14 jours d’essai gratuit.",
      },
    ],
    faqs: [
      {
        q: "Comment créer un menu QR code gratuit\u00a0?",
        a: "Créez un compte Epidom gratuit, saisissez vos catégories et vos articles avec prix et photos, puis téléchargez le QR code de votre page epidom.fr/@nom-du-lieu. Imprimez-le et posez-le sur vos tables. Il n’y a rien à installer pour vos clients\u00a0: ils scannent avec l’appareil photo de leur téléphone.",
      },
      {
        q: "Le menu QR code Epidom est-il vraiment gratuit\u00a0?",
        a: "Oui. La page de carte, les photos, les options, les horaires, les liens et le QR code imprimable sont inclus dans le forfait Gratuit, sans limite de durée. Seule la prise de commande depuis la page est payante\u00a0: elle fait partie du forfait POS, à 13,99\u00a0€ par mois (11,49\u00a0€ en abonnement annuel), avec 14 jours d’essai.",
      },
      {
        q: "Mes clients peuvent-ils commander depuis le menu QR code\u00a0?",
        a: "Pas avec le forfait Gratuit\u00a0: la carte est consultable, mais pas commandable. Avec le forfait POS, ils peuvent commander sur place avec un numéro de table ou à emporter. Ces commandes sont aujourd’hui réglées à la caisse, pas en ligne.",
      },
      {
        q: "Faut-il refaire le QR code quand je change mes prix\u00a0?",
        a: "Non. Le QR code pointe vers l’adresse de votre page, pas vers un fichier. Vous modifiez vos prix dans Epidom et la carte affichée est à jour au prochain scan. Vous ne réimprimez le QR code que si vous changez l’adresse de la page.",
      },
      {
        q: "Un PDF suffit-il pour un menu QR code\u00a0?",
        a: "Techniquement oui, mais c’est peu pratique\u00a0: le fichier est lourd, il faut zoomer, et chaque correction oblige à le remplacer. Une page web mobile se charge plus vite, se lit sans zoom, affiche les photos et se met à jour en quelques secondes.",
      },
    ],
    cta: {
      title: "Votre carte en ligne, gratuite",
      text: "Créez votre page et votre QR code gratuitement. Passez au POS plus tard si vous voulez prendre des commandes.",
      button: "Créer ma carte gratuite →",
      target: "register",
    },
    updated: "2026-10-14",
  },
  {
    slug: "menu-qr-code-gratis",
    locale: "id",
    group: "qr-menu",
    kind: "tool",
    metaTitle: "Menu QR Code Gratis untuk Kafe dan Warung",
    metaDescription:
      "Buat menu QR code gratis: halaman menu dengan foto, harga, opsi, dan jam buka, plus QR code siap cetak. Gratis selamanya untuk kafe dan warung.",
    eyebrow: "Menu QR code",
    h1: "Menu QR Code Gratis: Menu Digital Kafe dan Warung",
    lede: "Dengan Epidom Anda mendapat halaman menu di epidom.fr/@nama-toko lengkap dengan foto, harga, dan jam buka, serta QR code siap cetak untuk meja. Pelanggan melihat menu secara gratis; memesan langsung dari halaman itu membutuhkan paket POS.",
    blocks: [
      { type: "h2", text: "PDF atau menu digital sungguhan: bedanya di mana" },
      {
        type: "p",
        text: "Banyak menu QR code hanya mengarah ke file PDF. Di HP, pelanggan harus mencubit layar untuk zoom, menggeser ke sana kemari, dan menunggu file besar terbuka di sinyal yang kadang lemot. Harga di PDF juga kaku: setiap kali harga berubah, Anda harus membuat ulang file dan mengunggahnya lagi.",
      },
      {
        type: "p",
        text: "Menu digital sungguhan adalah halaman web yang dibuat untuk layar HP: kategori rapi, foto menu, harga jelas, dan pilihan ukuran atau tambahan terlihat langsung. Ubah harga satu kali, dan semua pelanggan melihat harga baru saat memindai berikutnya, tanpa cetak ulang.",
      },
      { type: "h2", text: "Isi halaman menu gratis Epidom" },
      {
        type: "p",
        text: "Paket Gratis Epidom adalah halaman publik untuk usaha Anda, gratis selamanya. Isinya:",
      },
      {
        type: "list",
        items: [
          "menu per kategori, dengan foto, harga, dan deskripsi untuk tiap item",
          "opsi (ukuran, tambahan) dan tombol “habis” untuk menyembunyikan menu yang kosong dalam sekali ketuk",
          "menu unggulan untuk mempromosikan menu andalan atau menu baru",
          "jam buka, logo, warna, foto sampul, dan tagline",
          "tautan ke Instagram, TikTok, WhatsApp, Google Maps, GoFood, GrabFood, ShopeeFood, dan tautan lain",
          "QR code siap cetak untuk halaman Anda, plus statistik sederhana (kunjungan, kunjungan menu, klik WhatsApp)",
        ],
      },
      {
        type: "callout",
        text: "Perlu dicatat: melihat menu itu gratis. Paket Gratis tidak menerima pesanan. Agar pelanggan bisa memesan dari halaman menu (makan di tempat dengan nomor meja, atau bawa pulang), Anda butuh paket POS seharga Rp 229.000 per bulan, dengan uji coba gratis 14 hari.",
      },
      { type: "h2", text: "Cara membuat menu QR code" },
      {
        type: "steps",
        items: [
          {
            title: "Daftar akun gratis",
            text: "Buat akun dan beri nama usaha Anda. Halaman Anda langsung tersedia di epidom.fr/@nama-toko.",
          },
          {
            title: "Isi menu",
            text: "Buat kategori seperti makanan, minuman, dan camilan, lalu tambahkan tiap item dengan harga, foto, dan opsinya. Mulailah dari sepuluh menu terlaris, sisanya menyusul.",
          },
          {
            title: "Percantik halaman",
            text: "Pasang logo, warna, foto sampul, jam buka, dan tautan. Ini yang pertama kali dilihat pelanggan.",
          },
          {
            title: "Cetak QR code",
            text: "Unduh QR code halaman Anda, lalu tempel di meja, kasir, dan etalase. Coba pindai dulu dengan HP Anda sendiri sebelum mencetak banyak.",
          },
        ],
      },
      { type: "h2", text: "Apa yang ditulis di kartu meja" },
      {
        type: "p",
        text: "QR code saja tidak menjelaskan kenapa orang harus memindainya. Kartu meja yang baik cukup sederhana:",
      },
      {
        type: "list",
        items: [
          "ajakan singkat, misalnya “Pindai untuk lihat menu”",
          "QR code yang cukup besar (minimal sekitar 3 cm) dengan warna gelap di atas latar terang",
          "alamat singkat dalam teks, epidom.fr/@nama-toko, untuk yang tidak memindai",
          "nama usaha Anda, dan nomor meja bila perlu",
        ],
      },
      {
        type: "p",
        text: "Sediakan juga satu-dua menu cetak untuk pelanggan yang tidak mau membuka HP, terutama orang tua. QR code melengkapi pelayanan, bukan menggantikan sapaan Anda.",
      },
      { type: "h2", text: "Menjaga harga tetap terbaru" },
      {
        type: "p",
        text: "Inilah keunggulan terbesar menu digital kafe atau warung. Harga bahan naik, menu diganti, atau stok habis: cukup ubah item di Epidom dan halaman langsung terbarui. Saat bahan habis di tengah jam ramai, tombol “habis” mencegah pelanggan memilih menu yang tidak bisa Anda buat.",
      },
      {
        type: "p",
        text: "Biasakan membuka halaman menu sendiri seminggu sekali, seperti pelanggan. Periksa apakah foto masih jelas, harga sudah benar, dan jam buka minggu depan sesuai.",
      },
      { type: "h2", text: "Kalau pelanggan ingin memesan dari menu" },
      {
        type: "p",
        text: "Pesanan online dari halaman menu, baik makan di tempat dengan nomor meja maupun bawa pulang, adalah bagian dari paket POS. Saat ini pesanan dari halaman dibayar di kasir: kasir mendapat pemberitahuan, lalu menandainya sebagai lunas. Paket POS juga mencakup aplikasi kasir, antrean pesanan, dan layar dapur, dengan uji coba gratis 14 hari.",
      },
    ],
    faqs: [
      {
        q: "Bagaimana cara membuat menu QR code gratis?",
        a: "Daftar akun Epidom gratis, isi kategori dan menu lengkap dengan harga dan foto, lalu unduh QR code untuk halaman epidom.fr/@nama-toko Anda. Cetak dan tempel di meja. Pelanggan tidak perlu memasang aplikasi, cukup memindai dengan kamera HP.",
      },
      {
        q: "Apakah menu QR code Epidom benar-benar gratis?",
        a: "Ya. Halaman menu, foto, opsi, jam buka, tautan, dan QR code yang bisa dicetak termasuk paket Gratis, tanpa batas waktu. Yang berbayar hanya fitur pesanan dari halaman, yaitu paket POS seharga Rp 229.000 per bulan (Rp 189.000 per bulan bila bayar tahunan), dengan uji coba 14 hari.",
      },
      {
        q: "Bisakah pelanggan memesan lewat menu QR code ini?",
        a: "Tidak di paket Gratis: menu hanya bisa dilihat. Di paket POS, pelanggan bisa memesan makan di tempat dengan nomor meja atau bawa pulang. Saat ini pesanan tersebut dibayar di kasir, bukan secara online.",
      },
      {
        q: "Apakah QR code harus dicetak ulang kalau harga berubah?",
        a: "Tidak. QR code mengarah ke alamat halaman Anda, bukan ke sebuah file. Ubah harga di Epidom dan menu yang tampil langsung terbarui saat dipindai. Cetak ulang hanya perlu jika alamat halaman berubah.",
      },
      {
        q: "Apakah menu PDF cukup untuk menu QR code?",
        a: "Bisa, tetapi kurang nyaman: file berat, harus di-zoom, dan setiap perubahan harga berarti mengganti file. Halaman web yang dibuat untuk HP lebih cepat terbuka, mudah dibaca tanpa zoom, menampilkan foto, dan bisa diperbarui dalam hitungan detik.",
      },
    ],
    cta: {
      title: "Buat menu digital Anda, gratis",
      text: "Daftar, isi menu, dan cetak QR code tanpa biaya. Tambah paket POS nanti bila ingin menerima pesanan.",
      button: "Buat menu gratis →",
      target: "register",
    },
    updated: "2026-10-14",
  },
  {
    slug: "free-qr-code-menu",
    locale: "en",
    group: "qr-menu",
    kind: "tool",
    metaTitle: "Free QR Code Menu for Restaurants and Cafés",
    metaDescription:
      "Make a free QR code menu: a real mobile page with photos, prices, options and opening hours, plus a printable QR code. Free forever, no PDF needed.",
    eyebrow: "QR code menu",
    h1: "Free QR Code Menu: a Real Digital Menu, Not a PDF",
    lede: "Epidom gives you a free menu page at epidom.fr/@shop-name with photos, prices and opening hours, plus a printable QR code for your tables. Customers can view the menu for free; taking orders from that page needs the POS plan.",
    blocks: [
      { type: "h2", text: "PDF vs. a real digital menu for restaurants" },
      {
        type: "p",
        text: "Many QR code menus just open a PDF. On a phone that means pinching, zooming and scrolling through a heavy file that loads slowly on a weak signal. Prices are frozen in the file: every change means rebuilding the PDF, re-uploading it and hoping nobody saved the old version.",
      },
      {
        type: "p",
        text: "A real digital menu is a web page built for the phone screen: collapsible categories, dish photos, readable prices and visible options. You change a price once, and every guest sees the new one on their next scan. Nothing gets reprinted.",
      },
      { type: "h2", text: "What the free page includes" },
      {
        type: "p",
        text: "Epidom's Free plan is a public page for your business, free forever. It includes:",
      },
      {
        type: "list",
        items: [
          "your menu in categories, with a photo, price and description for each item",
          "options (size, add-ons) and a “sold out” switch to pull an item in one tap",
          "featured items to push a special or something new",
          "opening hours, logo, colors, a cover photo and a tagline",
          "links to Instagram, TikTok, WhatsApp, Google Maps, delivery apps and custom links",
          "a printable QR code for the page, plus basic analytics (page views, menu views, WhatsApp clicks)",
        ],
      },
      {
        type: "callout",
        text: "To be precise: viewing the menu is free. The Free plan does not take orders. For customers to order from the page (dine-in with a table number, or takeaway) you need the POS plan, $14.99 per month after a 14-day free trial.",
      },
      { type: "h2", text: "How to make a QR code menu" },
      {
        type: "steps",
        items: [
          {
            title: "Create a free account",
            text: "Sign up and name your business. Your page goes live at epidom.fr/@shop-name.",
          },
          {
            title: "Enter your menu",
            text: "Add categories (starters, mains, drinks), then each item with a price, a photo and its options. Start with your ten best sellers and add the rest as you go.",
          },
          {
            title: "Style the page",
            text: "Add your logo, colors, cover photo, opening hours and links. This is what guests see first.",
          },
          {
            title: "Print the QR code",
            text: "Download the page's QR code and put it on your tables, counter and window. Scan it with your own phone before printing a full batch.",
          },
        ],
      },
      { type: "h2", text: "What to put on the table card" },
      {
        type: "p",
        text: "A QR code on its own doesn't tell anyone why to scan it. A good table card is small and simple:",
      },
      {
        type: "list",
        items: [
          "a short invitation, such as “Scan to see the menu”",
          "the QR code, large enough (at least about 1.2 inches square) in dark ink on a light background",
          "the short address written out, epidom.fr/@shop-name, for guests who don't scan",
          "your business name and, if useful, the table number",
        ],
      },
      {
        type: "p",
        text: "Keep a couple of printed menus behind the counter for guests who would rather not use their phone. The QR code supports your service; it doesn't replace a welcome.",
      },
      { type: "h2", text: "Keeping prices up to date" },
      {
        type: "p",
        text: "This is the main reason to use a digital menu for a café or restaurant. Your coffee supplier raises prices, a dish comes off the menu, an ingredient runs out: you edit the item in Epidom and the page is current. For a mid-service sellout, the “sold out” switch stops guests from picking something you can't make.",
      },
      {
        type: "p",
        text: "Once a week, open your own menu page on your phone the way a guest would. Check that photos are sharp, prices are right and next week's opening hours are correct.",
      },
      { type: "h2", text: "When guests want to order from the menu" },
      {
        type: "p",
        text: "Online ordering from the menu page, dine-in with a table number or takeaway, is part of the POS plan. Right now, orders from the page are pay-at-the-cashier: the POS is alerted and the cashier marks the order as paid. The POS plan also includes the cashier, the order queue and the kitchen display, with a 14-day free trial.",
      },
    ],
    faqs: [
      {
        q: "How do I make a free QR code menu?",
        a: "Create a free Epidom account, add your categories and items with prices and photos, then download the QR code for your epidom.fr/@shop-name page. Print it and place it on your tables. Guests install nothing: they scan it with their phone camera.",
      },
      {
        q: "Is the Epidom QR code menu really free?",
        a: "Yes. The menu page, photos, options, opening hours, links and printable QR code are all in the Free plan, with no time limit. Only taking orders from the page is paid: it is part of the POS plan at $14.99 per month ($12.49 per month billed yearly), with a 14-day free trial.",
      },
      {
        q: "Can customers order from the QR code menu?",
        a: "Not on the Free plan: the menu can be viewed, not ordered from. On the POS plan, customers can order dine-in with a table number or for takeaway. Those orders are currently paid at the cashier, not online.",
      },
      {
        q: "Do I need a new QR code when I change my prices?",
        a: "No. The QR code points to your page's address, not to a file. Update prices in Epidom and the menu shown is current on the next scan. You only reprint if the page address changes.",
      },
      {
        q: "Is a PDF good enough for a QR code menu?",
        a: "It works, but it's awkward: the file is heavy, guests have to zoom, and every correction means replacing it. A mobile web page loads faster, reads without zooming, shows photos and updates in seconds.",
      },
    ],
    cta: {
      title: "Your digital menu, free",
      text: "Create your page and QR code at no cost. Add the POS plan later if you want to take orders.",
      button: "Create my free menu →",
      target: "register",
    },
    updated: "2026-10-14",
  },
];
