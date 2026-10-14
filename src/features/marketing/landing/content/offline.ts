import type { LandingPage } from "../types";

export const offlinePages: LandingPage[] = [
  {
    slug: "caisse-hors-ligne",
    locale: "fr",
    group: "offline",
    kind: "feature",
    metaTitle: "Caisse hors ligne\u00a0: encaisser sans internet",
    metaDescription:
      "Caisse hors ligne\u00a0: continuez à encaisser sans connexion, les ventes se synchronisent au retour d'internet. Ce qui marche, ce qui exige du réseau, le prix.",
    eyebrow: "Caisse sans internet",
    h1: "Caisse hors ligne\u00a0: encaisser sans connexion",
    lede: "Une caisse hors ligne continue d'enregistrer vos ventes quand le réseau tombe, puis les envoie quand il revient. Voici comment cela fonctionne chez Epidom, et ce qui reste en ligne.",
    blocks: [
      { type: "h2", text: "Pourquoi une caisse sans internet compte" },
      {
        type: "p",
        text: "Une box qui redémarre, un wifi saturé au service de midi, une coupure dans la rue\u00a0: en salle, personne n'attend que la connexion revienne. Une caisse qui n'ouvre plus l'écran d'encaissement, c'est une file qui s'allonge et des tickets écrits à la main que l'on ressaisira le soir.",
      },
      {
        type: "p",
        text: "Une caisse hors ligne sert à une chose précise\u00a0: que le geste d'encaisser ne dépende plus du réseau. Elle ne remplace pas la connexion, elle évite qu'une panne d'internet devienne une panne de service.",
      },
      { type: "h2", text: "Ce que fait Epidom quand le réseau tombe" },
      {
        type: "p",
        text: "La caisse d'Epidom est une application web. Ses écrans et les données dont vous avez besoin au comptoir (carte, catégories, prix, tables, réglages) sont conservés sur l'appareil. Quand le réseau disparaît, vous continuez à vendre\u00a0: la vente est mise de côté sur l'appareil, puis envoyée automatiquement quand la connexion revient.",
      },
      {
        type: "list",
        items: [
          "Les ventes faites hors ligne gardent leur propre heure\u00a0: une vente de 23 h 50 reste dans la journée où elle a eu lieu, même si elle est synchronisée le lendemain matin.",
          "Si la connexion est coupée en plein envoi, la vente est mise en attente au lieu d'échouer, et elle n'est pas enregistrée deux fois.",
          "Le ticket affiche un numéro provisoire tant que la vente n'est pas synchronisée.",
          "La détection se fait par un vrai aller-retour avec nos serveurs, pas seulement par le voyant wifi\u00a0: un wifi sans internet est bien traité comme hors ligne.",
        ],
      },
      { type: "h2", text: "Encaisser sans connexion, pas à pas" },
      {
        type: "steps",
        items: [
          {
            title: "Installez l'application et connectez-vous une fois",
            text: "La première ouverture demande internet, pour télécharger l'application et vous identifier. Elle s'installe sur ordinateur (Windows, macOS, Linux), sur Android, ou sur iPad et iPhone via l'écran d'accueil.",
          },
          {
            title: "Laissez la caisse préparer ses données",
            text: "Le mode hors ligne charge la carte, les tables et les réglages sur l'appareil, et les met à jour dès qu'il y a du réseau.",
          },
          {
            title: "Vendez comme d'habitude",
            text: "Si la connexion tombe, la caisse le signale et vous continuez à saisir et à encaisser.",
          },
          {
            title: "Laissez la synchronisation se faire",
            text: "Au retour du réseau, les ventes partent dans l'ordre, de la plus ancienne à la plus récente. Vous pouvez aussi lancer\u00a0«\u00a0Synchroniser maintenant\u00a0» à la main.",
          },
        ],
      },
      { type: "h2", text: "Ce qui ne se perd pas" },
      {
        type: "p",
        text: "Si le serveur refuse une vente à plusieurs reprises, elle n'est pas supprimée. Elle passe en\u00a0«\u00a0À vérifier\u00a0» et reste sur l'appareil\u00a0: une personne peut la renvoyer, en télécharger une copie, ou la supprimer en confirmant. Rien n'est effacé sans qu'une personne l'ait décidé.",
      },
      { type: "h2", text: "Les limites, dites franchement" },
      {
        type: "p",
        text: "Hors ligne ne veut pas dire que tout fonctionne. Voici ce qu'il faut savoir avant de compter dessus.",
      },
      {
        type: "list",
        items: [
          "Un seul appareil à la fois\u00a0: une vente en attente reste sur l'appareil qui l'a prise. Une deuxième caisse ou l'écran cuisine ne la voient qu'après la synchronisation, donc l'écran cuisine ne reçoit rien pendant la coupure.",
          "Les tickets cuisine et bar peuvent toujours s'imprimer depuis les imprimantes Bluetooth de la caisse.",
          "Il faut du réseau pour ouvrir ou clôturer un service de caisse, enregistrer un mouvement d'espèces, faire un remboursement, mettre une addition en attente ou la reprendre, et chercher un client, un coupon ou des points.",
          "Un paiement confirmé en ligne (QRIS, carte via la passerelle) demande aussi du réseau. Hors ligne, encaissez en espèces ou sur un terminal de paiement séparé, et notez le mode de paiement.",
          "La première ouverture demande internet. Une connexion dure environ une semaine\u00a0: passé ce délai, les ventes en attente patientent jusqu'à une nouvelle connexion, elles ne sont pas perdues.",
          "Sur iPhone et iPad, iOS peut vider les données d'une application d'écran d'accueil qu'on n'ouvre pas pendant environ une semaine.",
        ],
      },
      {
        type: "callout",
        text: "Règle simple\u00a0: la caisse hors ligne sert à tenir une coupure de quelques heures, pas à travailler des jours sans réseau. Synchronisez dès que possible.",
      },
      { type: "h2", text: "Tarif" },
      {
        type: "p",
        text: "Le mode hors ligne est inclus dans l'offre POS\u00a0: 13,99\u00a0€ par mois (11,49\u00a0€ par mois en abonnement annuel), avec 14 jours d'essai gratuit. La vitrine en ligne de votre établissement reste gratuite, mais elle n'inclut pas la caisse.",
      },
    ],
    faqs: [
      {
        q: "Peut-on encaisser sans internet\u00a0?",
        a: "Oui, avec la caisse d'Epidom\u00a0: les ventes sont gardées sur l'appareil puis envoyées au retour de la connexion, avec leur heure d'origine. Les paiements qui se confirment en ligne, comme QRIS ou la carte via la passerelle, demandent en revanche du réseau.",
      },
      {
        q: "Que se passe-t-il si je ferme l'application avant la synchronisation\u00a0?",
        a: "Les ventes en attente sont conservées dans la mémoire de l'application sur l'appareil et partent au prochain lancement avec du réseau. Évitez simplement d'effacer les données du navigateur ou de l'application entre-temps.",
      },
      {
        q: "Le mode hors ligne fonctionne-t-il sur tablette Android et iPad\u00a0?",
        a: "Oui. L'application s'installe sur ordinateur, sur Android, et sur iPad ou iPhone via\u00a0«\u00a0Ajouter à l'écran d'accueil\u00a0». Sur iOS, ouvrez l'application au moins une fois par semaine pour que le système ne vide pas ses données.",
      },
      {
        q: "Peut-on ouvrir la caisse ou faire un remboursement hors ligne\u00a0?",
        a: "Non. L'ouverture et la clôture d'un service, les mouvements d'espèces, les remboursements et la mise en attente d'une addition demandent une connexion. Les ventes courantes, elles, peuvent se faire hors ligne.",
      },
      {
        q: "Combien coûte la caisse hors ligne\u00a0?",
        a: "Elle est comprise dans l'offre POS à 13,99\u00a0€ par mois (11,49\u00a0€ par mois en annuel), avec 14 jours d'essai gratuit. Il n'y a pas de supplément pour le mode hors ligne.",
      },
    ],
    cta: {
      title: "Testez la caisse pendant 14 jours",
      text: "Installez l'application sur votre appareil, préparez votre carte et essayez le mode hors ligne dans votre salle.",
      button: "Essayer 14 jours gratuitement\u00a0→",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "aplikasi-kasir-offline",
    locale: "id",
    group: "offline",
    kind: "feature",
    metaTitle: "Aplikasi Kasir Offline, Jualan Tanpa Internet",
    metaDescription:
      "Aplikasi kasir offline untuk kafe dan warung: tetap jualan tanpa internet, transaksi tersinkron saat sinyal kembali. Batasan dan harga dijelaskan jujur.",
    eyebrow: "Kasir tanpa internet",
    h1: "Aplikasi kasir offline: tetap jualan saat internet mati",
    lede: "Aplikasi kasir offline tetap mencatat penjualan saat internet putus, lalu mengirimnya begitu sinyal kembali. Berikut cara kerjanya di Epidom, termasuk yang tetap butuh internet.",
    blocks: [
      { type: "h2", text: "Kenapa kasir tanpa internet itu penting" },
      {
        type: "p",
        text: "Wifi lemot saat jam makan siang, paket data habis, atau listrik dan jaringan padam sebentar: antrean tidak mau menunggu. Kalau kasir berhenti bekerja, pesanan dicatat di kertas dan diketik ulang malam harinya, dan di situlah selisih mulai muncul.",
      },
      {
        type: "p",
        text: "Kasir tanpa internet tidak menggantikan koneksi. Tujuannya satu: internet yang mati tidak membuat layanan Anda ikut berhenti.",
      },
      { type: "h2", text: "Yang dilakukan Epidom saat internet putus" },
      {
        type: "p",
        text: "Kasir Epidom adalah aplikasi web. Layar dan data yang Anda perlukan di kasir (menu, kategori, harga, meja, pengaturan) disimpan di perangkat. Saat internet putus, Anda tetap bisa menjual: transaksi disimpan di perangkat, lalu dikirim otomatis saat koneksi kembali.",
      },
      {
        type: "list",
        items: [
          "Penjualan offline tetap memakai jam saat transaksi dibuat. Penjualan pukul 23.50 yang baru tersinkron besok pagi tetap masuk ke hari yang benar.",
          "Kalau koneksi putus di tengah pengiriman, transaksi masuk antrean, bukan gagal, dan tidak tercatat dua kali.",
          "Struk menampilkan nomor sementara sampai transaksi tersinkron.",
          "Deteksi koneksi memakai pengecekan langsung ke server kami, bukan hanya ikon wifi, jadi wifi tanpa internet tetap dianggap offline.",
        ],
      },
      { type: "h2", text: "Cara memakai kasir offline" },
      {
        type: "steps",
        items: [
          {
            title: "Pasang aplikasi dan masuk sekali dengan internet",
            text: "Pembukaan pertama butuh internet untuk mengunduh aplikasi dan masuk akun. Aplikasi bisa dipasang di komputer (Windows, macOS, Linux), di Android, atau di iPad dan iPhone lewat layar utama.",
          },
          {
            title: "Biarkan kasir menyiapkan datanya",
            text: "Mode offline memuat menu, meja, dan pengaturan ke perangkat, lalu memperbaruinya setiap ada koneksi.",
          },
          {
            title: "Jualan seperti biasa",
            text: "Kalau internet putus, kasir memberi tanda dan Anda lanjut mencatat pesanan serta menerima pembayaran.",
          },
          {
            title: "Biarkan sinkronisasi berjalan",
            text: "Saat sinyal kembali, transaksi dikirim berurutan dari yang paling lama. Anda juga bisa menekan Sinkronkan sekarang secara manual.",
          },
        ],
      },
      { type: "h2", text: "Transaksi tidak hilang begitu saja" },
      {
        type: "p",
        text: "Jika server berulang kali menolak sebuah transaksi, transaksi itu tidak dihapus. Statusnya berubah menjadi Perlu dicek dan tetap tersimpan di perangkat. Seseorang bisa mengirim ulang, mengunduh salinannya, atau menghapusnya setelah konfirmasi. Tidak ada yang dihapus tanpa keputusan manusia. Jadi catatan penjualan Anda tetap utuh meski jaringan bermasalah.",
      },
      { type: "h2", text: "Batasannya, apa adanya" },
      {
        type: "p",
        text: "Offline bukan berarti semuanya jalan. Ini yang perlu Anda tahu sebelum mengandalkannya.",
      },
      {
        type: "list",
        items: [
          "Satu perangkat pada satu waktu: transaksi yang tertunda tinggal di perangkat yang membuatnya. Kasir kedua dan layar dapur baru melihatnya setelah sinkron, jadi layar dapur tidak menerima apa pun selama gangguan.",
          "Tiket dapur dan bar tetap bisa dicetak dari printer Bluetooth milik kasir.",
          "Butuh internet untuk membuka atau menutup shift, mencatat kas masuk atau keluar, refund, menyimpan atau melanjutkan tagihan, serta mencari pelanggan, kupon, dan poin.",
          "Pembayaran yang dikonfirmasi online (QRIS, kartu lewat gerbang pembayaran) juga butuh internet. Saat offline, terima tunai atau pakai mesin EDC terpisah, lalu catat metode pembayarannya.",
          "Pembukaan pertama butuh internet. Sesi masuk berlaku sekitar satu minggu; setelah itu transaksi tertunda menunggu Anda masuk lagi, dan tidak hilang.",
          "Di iPad dan iPhone, iOS bisa menghapus data aplikasi layar utama yang tidak dibuka sekitar seminggu.",
        ],
      },
      {
        type: "callout",
        text: "Pegangan sederhana: kasir offline untuk melewati gangguan beberapa jam, bukan untuk berhari-hari tanpa jaringan. Sinkronkan secepatnya.",
      },
      { type: "h2", text: "Harga" },
      {
        type: "p",
        text: "Mode offline termasuk dalam paket POS: Rp 229.000 per bulan (Rp 189.000 per bulan jika bayar tahunan), dengan uji coba gratis 14 hari. Halaman toko online Anda tetap gratis, tetapi tidak termasuk kasir.",
      },
    ],
    faqs: [
      {
        q: "Apakah kasir bisa dipakai tanpa internet?",
        a: "Bisa. Transaksi disimpan di perangkat dan dikirim saat koneksi kembali, dengan jam transaksi aslinya. Pembayaran yang dikonfirmasi online, seperti QRIS atau kartu lewat gerbang pembayaran, tetap butuh internet.",
      },
      {
        q: "Bagaimana kalau aplikasi saya tutup sebelum sinkron?",
        a: "Transaksi tertunda tersimpan di memori aplikasi pada perangkat dan akan terkirim saat aplikasi dibuka lagi dengan koneksi. Jangan menghapus data browser atau data aplikasi sebelum sinkron. Sambungkan perangkat ke internet secara berkala agar data menu tetap segar.",
      },
      {
        q: "Bisakah dipakai sebagai POS offline Android?",
        a: "Bisa. Aplikasi dipasang di tablet atau ponsel Android, dan juga tersedia untuk komputer serta iPad dan iPhone lewat layar utama. Di Android, data tersimpan di penyimpanan Chrome untuk epidom.fr, jadi jangan menghapus data situs Chrome.",
      },
      {
        q: "Apakah buka shift dan refund bisa dilakukan offline?",
        a: "Tidak. Buka dan tutup shift, kas masuk dan keluar, refund, serta menyimpan tagihan butuh koneksi. Penjualan biasa tetap bisa dicatat offline.",
      },
      {
        q: "Berapa harga kasir offline Epidom?",
        a: "Termasuk dalam paket POS seharga Rp 229.000 per bulan (Rp 189.000 per bulan untuk paket tahunan), dengan uji coba gratis 14 hari. Tidak ada biaya tambahan untuk mode offline.",
      },
    ],
    cta: {
      title: "Coba kasirnya 14 hari gratis",
      text: "Pasang aplikasi di perangkat Anda, siapkan menu, lalu uji mode offline langsung di kafe atau warung Anda.",
      button: "Coba gratis 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "offline-pos-system",
    locale: "en",
    group: "offline",
    kind: "feature",
    metaTitle: "Offline POS System That Keeps Selling",
    metaDescription:
      "An offline POS system keeps ringing up sales without internet and syncs when the connection returns. How it works, what still needs a signal, price.",
    eyebrow: "POS without internet",
    h1: "Offline POS system: keep selling when the internet drops",
    lede: "An offline POS system keeps recording sales when your connection fails, then sends them once it is back. Here is how Epidom does it, and what still needs a signal.",
    blocks: [
      { type: "h2", text: "Why a POS that works without internet matters" },
      {
        type: "p",
        text: "A router that restarts, a lunch rush that overloads the Wi-Fi, a cut on the street: the line in front of your counter does not wait for the network. If the register stops, orders end up on paper and get retyped at closing, which is where mistakes creep in.",
      },
      {
        type: "p",
        text: "A POS that works without internet does one thing: it stops an outage from becoming a service outage. It does not replace a good connection, and it is honest about the parts that still need one.",
      },
      { type: "h2", text: "What Epidom does when the connection fails" },
      {
        type: "p",
        text: "Epidom's POS is a web app. The screens and the data you need at the counter (menu, categories, prices, tables, settings) are kept on the device. When the network disappears you keep selling: each sale is stored on the device and sent automatically when the connection returns.",
      },
      {
        type: "list",
        items: [
          "Sales made offline keep their own time. A sale rung up at 11:50 pm stays on that day's report even if it syncs the next morning.",
          "If the connection drops mid-send, the sale is queued instead of failing, and it is never recorded twice.",
          "The receipt shows a temporary number until the sale has synced.",
          "Connectivity is checked with a real round trip to our servers, not just the Wi-Fi icon, so Wi-Fi with no internet behind it still counts as offline.",
        ],
      },
      { type: "h2", text: "How to use it, step by step" },
      {
        type: "steps",
        items: [
          {
            title: "Install the app and sign in once, online",
            text: "The first launch needs internet to download the app and sign you in. It installs on a computer (Windows, macOS, Linux), on Android, or on an iPad or iPhone from the home screen.",
          },
          {
            title: "Let the POS prepare its data",
            text: "Offline mode loads your menu, tables and settings onto the device and refreshes them whenever there is a connection.",
          },
          {
            title: "Sell as usual",
            text: "If the connection drops, the POS tells you and you carry on taking orders and payments.",
          },
          {
            title: "Let it sync",
            text: "When the network returns, sales are sent oldest first. You can also press Sync now to do it yourself.",
          },
        ],
      },
      { type: "h2", text: "Nothing is deleted behind your back" },
      {
        type: "p",
        text: "If the server keeps refusing a sale, it is not thrown away. It moves to Needs attention and stays on the device, where a person can retry it, download a copy, or discard it after a confirmation. Nothing is deleted unless someone chooses to.",
      },
      { type: "h2", text: "The limits, stated plainly" },
      {
        type: "p",
        text: "Offline does not mean everything works. Know this before you rely on it.",
      },
      {
        type: "list",
        items: [
          "One device at a time: a queued sale lives on the device that took it. A second POS or the kitchen display only sees it after it syncs, so the kitchen display receives nothing during an outage.",
          "Kitchen and bar tickets can still print from the POS's own Bluetooth printers.",
          "You need a connection to open or close a shift, record cash in or out, issue refunds, save or resume a bill, and look up customers, coupons or points.",
          "Any payment confirmed online (QRIS, a card through the payment gateway) also needs a connection. Offline, take cash or use a separate card terminal and record the payment method.",
          "The first launch needs internet. A sign-in lasts about a week, after which queued sales wait for you to sign in again. They are not lost.",
          "On iPhone and iPad, iOS may clear a home-screen app's data if you do not open it for about a week.",
        ],
      },
      {
        type: "callout",
        text: "Rule of thumb: offline mode is for riding out an outage of a few hours, not for working for days with no network. Sync as soon as you can.",
      },
      { type: "h2", text: "Price" },
      {
        type: "p",
        text: "Offline mode is part of the POS plan: $14.99 per month ($12.49 per month on the annual plan), with a 14-day free trial. Your public storefront page stays free, but the POS is not part of it.",
      },
    ],
    faqs: [
      {
        q: "Can a POS work without internet?",
        a: "Yes. Epidom stores each sale on the device and sends it when the connection returns, with the time it was actually rung up. Payments that are confirmed online, such as QRIS or a card through the gateway, still need a connection.",
      },
      {
        q: "What happens if I close the app before it syncs?",
        a: "Queued sales are kept in the app's storage on the device and are sent the next time you open it with a connection. Just avoid clearing the browser or app data in the meantime.",
      },
      {
        q: "Does it work as an offline POS on Android and iPad?",
        a: "Yes. The app installs on a computer, on Android, and on iPad or iPhone via Add to Home Screen. On iOS, open the app at least once a week so the system does not clear its data.",
      },
      {
        q: "Can I open a shift or issue a refund offline?",
        a: "No. Opening and closing shifts, cash in and out, refunds and saving a bill need a connection. Regular sales can be rung up offline.",
      },
      {
        q: "How much does the offline POS cost?",
        a: "It is included in the POS plan at $14.99 per month ($12.49 per month billed annually), with a 14-day free trial. There is no extra charge for offline mode.",
      },
    ],
    cta: {
      title: "Try the POS free for 14 days",
      text: "Install the app on your device, set up your menu, and test offline mode at your own counter.",
      button: "Start the 14-day trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
