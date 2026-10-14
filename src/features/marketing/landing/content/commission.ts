import type { LandingPage } from "../types";

export const commissionPages: LandingPage[] = [
  {
    slug: "calcul-commission-uber-eats",
    locale: "fr",
    group: "commission",
    kind: "tool",
    tool: "commission",
    metaTitle: "Calcul commission Uber Eats et Deliveroo",
    metaDescription:
      "Calculez ce que la commission Uber Eats ou Deliveroo coûte vraiment à votre restaurant, et ce que vous gagneriez avec votre propre lien de commande.",
    eyebrow: "Calculateur de commission",
    h1: "Calcul de la commission Uber Eats\u00a0: ce que vous gardez vraiment",
    lede: "Une commande de 20\u00a0€ passée par une plateforme ne vous rapporte pas 20\u00a0€. Saisissez votre chiffre d'affaires, votre taux et la part de clients que vous pourriez rediriger\u00a0: le calculateur chiffre l'économie mensuelle.",
    blocks: [
      { type: "h2", text: "Combien prend Uber Eats, vraiment\u00a0?" },
      {
        type: "p",
        text: "Il n'existe pas de taux unique. La commission Uber Eats, comme la commission Deliveroo pour un restaurant, dépend de votre contrat, de l'offre choisie (avec ou sans livreur de la plateforme) et des options de visibilité. On cite couramment des fourchettes très larges, et elles évoluent. Le seul taux qui compte est celui écrit dans votre propre contrat\u00a0: gardez-le sous la main avant de commencer.",
      },
      { type: "tool" },
      { type: "h2", text: "Ce que le calculateur prend en compte" },
      {
        type: "list",
        items: [
          "Votre chiffre d'affaires mensuel et le ticket moyen.",
          "La part de ce chiffre qui vient des plateformes de livraison.",
          "Le taux de commission de votre contrat.",
          "La part de ces commandes qui pourrait passer par votre propre lien de commande.",
          "Vos frais de caisse actuels et votre marge nette actuelle.",
        ],
      },
      {
        type: "p",
        text: "Le résultat montre l'économie mensuelle et la nouvelle marge, une fois déduits les frais de paiement et le prix de l'abonnement Epidom. C'est une estimation honnête, pas une promesse\u00a0: si vos clients ne changent pas d'habitude, l'économie sera plus faible.",
      },
      { type: "h2", text: "Le coût réel des plateformes de livraison" },
      {
        type: "p",
        text: "Le coût réel d'une plateforme ne se limite pas au pourcentage affiché. Il faut ajouter les promotions que vous cofinancez, les frais de paiement, les commandes remboursées et le temps passé sur la tablette dédiée. Et surtout, la commission porte sur le prix de vente, pas sur votre marge\u00a0: sur un plat dont la marge brute est de 65\u00a0%, un gros pourcentage laisse très peu.",
      },
      {
        type: "callout",
        text: "Exemple de calcul\u00a0: 8 000\u00a0€ de chiffre d'affaires mensuel, dont 30\u00a0% via les plateformes, soit 2 400\u00a0€. Avec un taux de 25\u00a0% (exemple, pas un tarif), vous versez 600\u00a0€ par mois. Si un quart de ces commandes passait par votre propre lien, vous garderiez environ 150\u00a0€ de plus, avant frais de paiement et abonnement.",
      },
      { type: "h2", text: "Garder les plateformes, déplacer vos habitués" },
      {
        type: "p",
        text: "Les plateformes servent à se faire découvrir\u00a0: un nouveau client vous trouve, commande, et c'est une vraie source de visibilité. La question est ce qui se passe ensuite. Un habitué qui commande chaque semaine n'a plus besoin de la vitrine, mais vous continuez à la payer à chaque commande. L'idée n'est donc pas de quitter les plateformes, mais de proposer un lien direct à ceux qui vous connaissent déjà.",
      },
      { type: "h2", text: "Comment faire avec Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Publiez votre page",
            text: "La vitrine gratuite (epidom.fr/@nom-du-restaurant) affiche votre carte, vos horaires et vos liens, dont ceux de vos pages de plateformes.",
          },
          {
            title: "Activez la commande en ligne",
            text: "Avec le plan POS, vos clients commandent sur place, à emporter ou en livraison par vos soins depuis votre page. Aucune commission de plateforme n'est prélevée. Les commandes arrivent à la caisse avec une alerte, et la caissière les marque payées à l'encaissement.",
          },
          {
            title: "Orientez vos habitués",
            text: "Mettez le QR code de la page sur les sacs et les tickets, et le lien dans votre bio Instagram ou votre statut WhatsApp.",
          },
          {
            title: "Saisissez les commandes des plateformes",
            text: "Epidom ne se connecte pas directement à Uber Eats ni à Deliveroo. Vous saisissez ces commandes en caisse comme un canal à part.",
          },
          {
            title: "Lisez le vrai coût de chaque plateforme",
            text: "Avec le plan Operations, les rapports Finance isolent chiffre d'affaires et commission par canal, pour comparer chaque plateforme à votre vente directe.",
          },
        ],
      },
      { type: "h2", text: "Quel plan pour quoi" },
      {
        type: "p",
        text: "La commande en ligne depuis votre page demande le plan POS\u00a0: 13,99\u00a0€ par mois (11,49\u00a0€ en abonnement annuel), avec 14 jours d'essai gratuit. Le suivi par canal et par plateforme dans les rapports Finance fait partie du plan Operations\u00a0: 27,99\u00a0€ par mois (23,49\u00a0€ en annuel). La vitrine seule reste gratuite.",
      },
    ],
    faqs: [
      {
        q: "Combien prend Uber Eats aux restaurants\u00a0?",
        a: "Le taux dépend de votre contrat et de l'offre choisie, et il peut changer. On l'entend citer dans une fourchette très large. Reprenez le pourcentage écrit dans votre contrat et saisissez-le dans le calculateur plutôt que de vous fier à un chiffre général.",
      },
      {
        q: "La commission Deliveroo est-elle différente de celle d'Uber Eats\u00a0?",
        a: "Chaque plateforme fixe ses conditions, et elles varient selon le restaurant, la ville et les options. Comparez vos propres contrats. Si vous saisissez chaque plateforme comme un canal distinct dans Epidom, les rapports Finance (plan Operations) vous donnent le coût de chacune.",
      },
      {
        q: "Peut-on supprimer les plateformes pour tout passer en direct\u00a0?",
        a: "Ce n'est pas ce que nous conseillons. Les plateformes restent utiles pour attirer de nouveaux clients. Le gain vient du fait de proposer votre lien direct à vos habitués, qui commandent déjà chez vous.",
      },
      {
        q: "Epidom se connecte-t-il à Uber Eats ou Deliveroo\u00a0?",
        a: "Non, il n'y a pas d'intégration directe. Vous saisissez les commandes des plateformes en caisse, sur un canal dédié, ce qui permet de suivre leur chiffre d'affaires et leur commission dans les rapports Finance.",
      },
      {
        q: "Combien coûte la commande en direct sur ma page\u00a0?",
        a: "Aucune commission n'est prélevée sur les commandes passées depuis votre page. Elle suppose le plan POS à 13,99\u00a0€ par mois (11,49\u00a0€ en annuel), avec 14 jours d'essai gratuit. Les commandes sont à régler à la caisse.",
      },
    ],
    cta: {
      title: "Chiffrez puis testez avec vos habitués",
      text: "Essayez le plan POS pendant 14 jours et donnez à vos clients réguliers un lien de commande qui n'a pas de commission de plateforme.",
      button: "Démarrer l'essai gratuit de 14 jours →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "kalkulator-komisi-gofood",
    locale: "id",
    group: "commission",
    kind: "tool",
    tool: "commission",
    metaTitle: "Kalkulator Komisi GoFood, GrabFood, ShopeeFood",
    metaDescription:
      "Hitung komisi GoFood, GrabFood, dan ShopeeFood yang Anda bayar tiap bulan, dan berapa hemat jika pelanggan setia pesan lewat link toko sendiri.",
    eyebrow: "Kalkulator komisi",
    h1: "Kalkulator komisi GoFood: berapa sebenarnya yang Anda terima",
    lede: "Pesanan Rp 50.000 lewat aplikasi tidak berarti Rp 50.000 masuk ke kas Anda. Isi omzet, persentase komisi, dan berapa pesanan yang bisa dipindah ke link sendiri, lalu lihat penghematan per bulan.",
    blocks: [
      { type: "h2", text: "Berapa komisi GoFood, GrabFood, dan ShopeeFood?" },
      {
        type: "p",
        text: "Tidak ada satu angka untuk semua. Komisi GoFood, komisi GrabFood, dan komisi ShopeeFood berbeda menurut kontrak, jenis layanan, promo yang diikuti, dan bisa berubah. Di lapangan, angkanya sering disebut dalam rentang yang lebar. Pakai persentase yang tertulis di kontrak Anda sendiri, bukan angka kira-kira dari orang lain.",
      },
      { type: "tool" },
      { type: "h2", text: "Yang dihitung kalkulator" },
      {
        type: "list",
        items: [
          "Omzet bulanan dan rata-rata nilai pesanan.",
          "Berapa persen omzet yang datang dari aplikasi pesan-antar.",
          "Persentase komisi di kontrak Anda.",
          "Berapa persen pesanan aplikasi yang bisa pindah ke link pesan online toko sendiri.",
          "Biaya sistem kasir Anda saat ini dan margin bersih saat ini.",
        ],
      },
      {
        type: "p",
        text: "Hasilnya adalah penghematan per bulan dan margin baru, sudah dikurangi biaya pembayaran dan harga paket Epidom. Ini perkiraan, bukan janji: kalau pelanggan tidak mau ganti kebiasaan, penghematannya akan lebih kecil.",
      },
      { type: "h2", text: "Potongan aplikasi ojol untuk resto: biaya yang sering terlewat" },
      {
        type: "p",
        text: "Komisi dihitung dari harga jual, bukan dari untung Anda. Kalau satu menu punya margin kotor 60 persen, potongan besar bisa menyisakan sedikit sekali. Tambahkan promo yang ditanggung toko, biaya pembayaran, pesanan yang dibatalkan, dan waktu karyawan menjaga tablet khusus aplikasi. Total biaya nyata jauh lebih besar dari angka persen di layar.",
      },
      {
        type: "callout",
        text: "Contoh hitungan: omzet Rp 60.000.000 per bulan, 30 persen dari aplikasi = Rp 18.000.000. Dengan komisi 20 persen (contoh, bukan tarif resmi), potongannya Rp 3.600.000. Jika seperempat pesanan itu pindah ke link sendiri, Anda menyimpan sekitar Rp 900.000 lebih banyak, sebelum biaya pembayaran dan harga paket.",
      },
      { type: "h2", text: "Tetap di aplikasi, pindahkan pelanggan setia" },
      {
        type: "p",
        text: "Aplikasi bagus untuk ditemukan orang baru. Masalahnya muncul setelah itu: pelanggan yang sudah langganan tidak lagi butuh etalase, tapi Anda tetap membayarnya di setiap pesanan. Jadi tujuannya bukan keluar dari aplikasi, melainkan memberi link langsung kepada orang yang sudah kenal toko Anda.",
      },
      { type: "h2", text: "Caranya dengan Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Buat halaman toko",
            text: "Halaman gratis (epidom.fr/@nama-toko) memuat menu, jam buka, dan tautan, termasuk tautan GoFood, GrabFood, dan ShopeeFood Anda.",
          },
          {
            title: "Aktifkan pesan online",
            text: "Dengan paket POS, pelanggan bisa pesan makan di tempat, bawa pulang, atau diantar sendiri oleh toko lewat halaman Anda, tanpa komisi platform. Pesanan masuk ke kasir dengan peringatan, dan kasir menandainya lunas saat dibayar.",
          },
          {
            title: "Arahkan pelanggan setia",
            text: "Pasang QR code halaman di kemasan dan struk, serta link di bio Instagram atau status WhatsApp.",
          },
          {
            title: "Catat pesanan aplikasi",
            text: "Epidom tidak terhubung langsung ke GoFood, GrabFood, atau ShopeeFood. Anda memasukkan pesanan itu di kasir sebagai saluran sendiri.",
          },
          {
            title: "Lihat biaya nyata tiap aplikasi",
            text: "Di paket Operations, laporan Finance memisahkan omzet dan komisi per saluran, sehingga tiap aplikasi bisa dibandingkan dengan penjualan langsung.",
          },
        ],
      },
      { type: "h2", text: "Paket mana untuk apa" },
      {
        type: "p",
        text: "Pesan online dari halaman toko butuh paket POS: Rp 229.000 per bulan (Rp 189.000 per bulan jika bayar tahunan), dengan percobaan gratis 14 hari. Laporan Finance per saluran dan per aplikasi ada di paket Operations: Rp 459.000 per bulan (Rp 379.000 jika tahunan). Halaman toko saja tetap gratis.",
      },
    ],
    faqs: [
      {
        q: "Berapa komisi GoFood untuk resto?",
        a: "Besarnya tergantung kontrak dan layanan yang diambil, dan bisa berubah. Karena itu angkanya sering disebut dalam rentang lebar. Ambil persentase dari kontrak Anda sendiri dan masukkan ke kalkulator.",
      },
      {
        q: "Apakah komisi GrabFood dan ShopeeFood sama dengan GoFood?",
        a: "Tidak ada jaminan sama. Tiap aplikasi punya syarat sendiri yang bergantung pada kontrak dan promo. Jika Anda mencatat tiap aplikasi sebagai saluran terpisah di Epidom, laporan Finance (paket Operations) menunjukkan biaya masing-masing.",
      },
      {
        q: "Apakah saya harus berhenti dari aplikasi pesan-antar?",
        a: "Tidak perlu, dan kami tidak menyarankannya. Aplikasi tetap berguna untuk menjaring pelanggan baru. Penghematan datang dari memberi link langsung kepada pelanggan setia yang sudah sering memesan.",
      },
      {
        q: "Apakah Epidom terhubung ke GoFood atau GrabFood?",
        a: "Tidak, belum ada integrasi langsung. Pesanan aplikasi dicatat manual di kasir sebagai saluran tersendiri, lalu omzet dan komisinya muncul di laporan Finance.",
      },
      {
        q: "Berapa biaya pesan online lewat halaman toko sendiri?",
        a: "Tidak ada komisi platform untuk pesanan dari halaman Anda. Fiturnya ada di paket POS seharga Rp 229.000 per bulan (Rp 189.000 jika tahunan), dengan percobaan gratis 14 hari. Pesanan dibayar di kasir.",
      },
    ],
    cta: {
      title: "Hitung dulu, lalu coba dengan pelanggan setia",
      text: "Coba paket POS selama 14 hari dan beri pelanggan langganan Anda link pesan yang bebas komisi platform.",
      button: "Mulai percobaan gratis 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "delivery-app-commission-calculator",
    locale: "en",
    group: "commission",
    kind: "tool",
    tool: "commission",
    metaTitle: "Delivery App Commission Calculator for Restaurants",
    metaDescription:
      "Delivery app commission calculator: see what delivery apps really cost your restaurant each month and what moving regulars to your own link would save.",
    eyebrow: "Commission calculator",
    h1: "Delivery app commission calculator: what you keep per order",
    lede: "A $20 order through a delivery app does not put $20 in your till. Enter your revenue, your commission rate and how many orders could move to your own link, and the calculator shows the monthly saving.",
    blocks: [
      { type: "h2", text: "How much do delivery apps charge restaurants?" },
      {
        type: "p",
        text: "There is no single rate. Delivery commission fees depend on your contract, the service tier (with or without the platform's couriers) and any promotion or visibility add-ons, and they change over time. Commissions are commonly quoted in a wide range. The only number that matters is the one in your own contract, so have it in front of you before you start.",
      },
      { type: "tool" },
      { type: "h2", text: "What the calculator uses" },
      {
        type: "list",
        items: [
          "Your monthly revenue and average order value.",
          "The share of revenue that comes from delivery apps.",
          "The commission percentage in your contract.",
          "The share of those orders that could move to your own ordering link.",
          "Your current POS fee and your current net margin.",
        ],
      },
      {
        type: "p",
        text: "The result is the monthly saving and your new margin, after payment fees and the Epidom plan price. It is an estimate, not a promise: if your customers do not change their habits, the saving will be smaller.",
      },
      { type: "h2", text: "The real cost of a delivery app" },
      {
        type: "p",
        text: "The advertised percentage is only part of the cost. Add the promotions you co-fund, payment processing, refunded orders and the staff time spent watching a separate tablet. The commission is also charged on the selling price, not on your profit: on a dish with a 65 percent gross margin, a large cut leaves very little behind.",
      },
      {
        type: "callout",
        text: "Worked example: $10,000 monthly revenue, 30 percent through apps, so $3,000. At a 25 percent rate (an example, not anyone's actual rate) you pay $750 a month. If a quarter of those orders came through your own link instead, you would keep about $187 more, before payment fees and the plan price.",
      },
      { type: "h2", text: "Keep the apps, move your regulars" },
      {
        type: "p",
        text: "Apps are good at discovery: a new customer finds you, orders, and that is real exposure. The question is what happens next. A regular who orders every week no longer needs the storefront, but you keep paying for it on every order. The idea is not to leave the apps. It is to give a direct link to people who already know you.",
      },
      { type: "h2", text: "How to do it with Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Publish your page",
            text: "The free storefront (epidom.fr/@your-shop) shows your menu, hours and links, including your delivery app pages.",
          },
          {
            title: "Turn on online ordering",
            text: "With the POS plan, customers order for dine-in, takeaway or delivery by your own team from your page, with no platform commission. Orders reach your POS with an alert, and the cashier marks them paid.",
          },
          {
            title: "Point your regulars to it",
            text: "Put the page's QR code on bags and receipts, and the link in your Instagram bio or WhatsApp status.",
          },
          {
            title: "Record app orders at the POS",
            text: "Epidom does not connect directly to the delivery apps. You enter those orders at the POS as their own channel.",
          },
          {
            title: "Read each platform's real cost",
            text: "On the Operations plan, Finance reports split revenue and commission by channel, so each app can be compared with your direct sales.",
          },
        ],
      },
      { type: "h2", text: "Which plan covers what" },
      {
        type: "p",
        text: "Online ordering from your page needs the POS plan: $14.99 a month ($12.49 on the annual plan), with a 14-day free trial. The per-channel commission view in Finance reports is part of Operations: $29.99 a month ($24.99 yearly). The storefront on its own stays free.",
      },
    ],
    faqs: [
      {
        q: "How much do delivery apps charge restaurants?",
        a: "It depends on the contract, the service tier and the promotions you join, and it changes over time. Commissions are commonly quoted in a wide range, so use the percentage from your own contract in the calculator instead of a general figure.",
      },
      {
        q: "Are delivery commission fees the same on every app?",
        a: "Not necessarily. Each platform sets its own terms, which vary by restaurant, city and options. If you record each app as a separate channel in Epidom, the Finance reports (Operations plan) show what each one actually costs.",
      },
      {
        q: "Should I drop the delivery apps?",
        a: "We would not suggest it. Apps are still useful for reaching new customers. The saving comes from offering your own ordering link to regulars who already order from you.",
      },
      {
        q: "Does Epidom integrate with delivery apps?",
        a: "No, there is no direct integration. You enter app orders at the POS as their own channel, and their revenue and commission then appear in Finance reports.",
      },
      {
        q: "What does ordering from my own page cost?",
        a: "No platform commission is taken on orders placed from your page. It requires the POS plan at $14.99 a month ($12.49 on the annual plan), with a 14-day free trial. Orders are paid at the cashier.",
      },
    ],
    cta: {
      title: "Run the numbers, then test with your regulars",
      text: "Try the POS plan free for 14 days and give your regular customers an ordering link with no platform commission.",
      button: "Start the 14-day free trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
