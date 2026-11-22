import type { LandingPage } from "../types";

export const onlineOrderingPages: LandingPage[] = [
  {
    slug: "commande-en-ligne-restaurant",
    locale: "fr",
    group: "online-ordering",
    kind: "vertical",
    metaTitle: "Commande en ligne restaurant sans commission",
    metaDescription:
      "Commande en ligne pour restaurant ou café, sans commission par commande : click and collect, sur place ou livraison par vos soins. Dès 13,99 €/mois.",
    eyebrow: "Commande en ligne",
    h1: "Commande en ligne restaurant : sans commission par commande",
    lede: "Vos clients commandent depuis la page de votre établissement, la commande arrive en caisse avec une alerte sonore, et vous ne reversez rien à chaque vente : l'abonnement est fixe.",
    blocks: [
      { type: "h2", text: "Ce que coûtent vraiment les plateformes de livraison" },
      {
        type: "p",
        text: "Les applications de livraison prélèvent une commission sur chaque commande. Le taux dépend du contrat et de la formule choisie, mais il représente souvent une part importante du panier, énorme pour un établissement dont la marge nette tient en quelques points. Sur un panier de 20 €, plusieurs euros partent à la plateforme avant même que vous ayez payé les produits ou le personnel.",
      },
      {
        type: "p",
        text: "Ces applications restent utiles pour se faire découvrir. Le problème commence quand vos clients réguliers, ceux qui connaissent déjà votre adresse, passent eux aussi par elles : chaque commande vous coûte une commission pour un client que vous avez déjà conquis.",
      },
      { type: "h2", text: "Votre propre lien de commande, à abonnement fixe" },
      {
        type: "p",
        text: "Avec Epidom, votre établissement a une page publique du type epidom.fr/@nom-du-lieu avec votre carte : catégories, photos, prix, options, bouton « épuisé ». Dans l'offre POS, cette page accepte les commandes. Vous ne payez ni pourcentage ni frais par commande, seulement l'abonnement mensuel.",
      },
      {
        type: "list",
        items: [
          "Sur place : le client indique son numéro de table et commande depuis son téléphone.",
          "À emporter : le client commande à l'avance et vient récupérer, c'est le click and collect restaurant.",
          "Livraison : c'est vous qui livrez, avec vos propres moyens. Epidom ne fournit pas de livreurs.",
        ],
      },
      { type: "h2", text: "Ce qui se passe quand une commande arrive" },
      {
        type: "p",
        text: "La commande tombe dans la file d'attente de la caisse, au même endroit que les commandes saisies au comptoir. Un son et une notification sur l'appareil vous préviennent. Vous la faites passer par les étapes Nouvelle, En préparation, Prête, Servie, et l'écran cuisine l'affiche en temps réel si vous l'utilisez.",
      },
      {
        type: "callout",
        text: "Important : pour l'instant, le paiement se fait à la caisse. Le client ne règle pas en ligne sur la page ; le caissier marque la commande comme payée quand le client paie sur place ou à la livraison.",
      },
      { type: "h2", text: "Mettre en place un site de commande en ligne pour un café" },
      {
        type: "steps",
        items: [
          {
            title: "Créez votre page",
            text: "Inscrivez-vous, ajoutez logo, horaires et liens, puis votre carte avec photos, prix et options.",
          },
          {
            title: "Démarrez l'essai POS",
            text: "La commande en ligne fait partie de l'offre POS, avec 14 jours d'essai gratuit.",
          },
          {
            title: "Activez les modes de commande",
            text: "Choisissez ce que vous proposez : sur place avec numéro de table, à emporter, livraison par vos soins.",
          },
          {
            title: "Partagez le lien",
            text: "Mettez-le dans votre bio Instagram, sur WhatsApp et sur un QR code imprimé en salle ou sur le comptoir.",
          },
        ],
      },
      { type: "h2", text: "Garder les applications, déplacer vos habitués" },
      {
        type: "p",
        text: "Il n'est pas question de quitter GoFood, GrabFood ou les autres si elles vous amènent de nouveaux clients. L'idée est de les garder pour la découverte, puis d'inviter vos habitués à commander directement chez vous : un petit mot sur le sac, un QR code sur le gobelet, le lien dans votre bio.",
      },
      {
        type: "callout",
        text: "Exemple chiffré, simple : si une plateforme garde 25 % d'un panier de 20 €, il vous reste 15 €. La même commande passée par votre lien vous laisse 20 €, abonnement mis à part. Le taux de 25 % est un exemple, pas un chiffre propre à une plateforme.",
      },
    ],
    faqs: [
      {
        q: "La commande en ligne est-elle gratuite chez Epidom ?",
        a: "Non. La page de votre établissement avec la carte est gratuite, mais prendre des commandes fait partie de l'offre POS, à 13,99 € par mois (11,49 € par mois en annuel), avec 14 jours d'essai gratuit. Il n'y a aucune commission par commande.",
      },
      {
        q: "Le client peut-il payer en ligne ?",
        a: "Pas pour l'instant. Les commandes passées depuis la page sont à régler à la caisse : vous êtes alerté, puis le caissier marque la commande comme payée. Nous ne promettons pas le paiement en ligne sur la page.",
      },
      {
        q: "Peut-on proposer du click and collect et de la livraison ?",
        a: "Oui. Vous pouvez proposer la commande sur place avec numéro de table, à emporter, et la livraison assurée par vos soins. Epidom ne fournit pas de livreurs.",
      },
      {
        q: "Comment suis-je prévenu d'une nouvelle commande ?",
        a: "La commande apparaît dans la file d'attente de la caisse avec un signal sonore et une notification sur l'appareil. Vous la suivez ensuite de Nouvelle à Servie.",
      },
      {
        q: "Epidom se connecte-t-il à GoFood, GrabFood ou Uber Eats ?",
        a: "Non, il n'y a pas d'intégration directe. Vous pouvez toutefois saisir ces commandes en caisse comme un canal à part pour suivre leur chiffre d'affaires et leur commission dans les rapports de l'offre Operations.",
      },
    ],
    cta: {
      title: "Essayez la commande en ligne sans commission",
      text: "14 jours d'essai gratuit de l'offre POS. Ensuite 13,99 € par mois, sans pourcentage sur vos ventes.",
      button: "Démarrer l'essai gratuit →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "pesan-online-tanpa-komisi",
    locale: "id",
    group: "online-ordering",
    kind: "vertical",
    metaTitle: "Pesan Online Tanpa Komisi untuk Kafe dan Resto",
    metaDescription:
      "Pesan online tanpa komisi untuk kafe dan resto: link pesanan sendiri, pre-order lewat link, tanpa potongan aplikasi. Mulai Rp 229.000 per bulan.",
    eyebrow: "Pesan online",
    h1: "Pesan online tanpa komisi: link pesanan sendiri untuk kafe",
    lede: "Pelanggan memesan lewat halaman usaha Anda, pesanan masuk ke kasir dengan bunyi notifikasi, dan tidak ada potongan per pesanan. Biayanya langganan bulanan tetap.",
    blocks: [
      { type: "h2", text: "Berapa sebenarnya potongan aplikasi pesan antar" },
      {
        type: "p",
        text: "Aplikasi pesan antar mengambil komisi dari setiap pesanan. Besarnya tergantung kontrak dan paket, tetapi sering kali merupakan bagian besar dari nilai pesanan, padahal laba bersih kafe atau resto biasanya hanya beberapa persen. Dari pesanan Rp 50.000, belasan ribu rupiah bisa langsung hilang sebelum Anda membayar bahan baku dan karyawan.",
      },
      {
        type: "p",
        text: "Aplikasi seperti GoFood, GrabFood, dan ShopeeFood tetap berguna untuk dikenal orang baru. Masalahnya muncul ketika pelanggan tetap, yang sudah tahu tempat Anda, juga memesan lewat aplikasi: Anda membayar komisi untuk pelanggan yang sudah Anda dapatkan.",
      },
      { type: "h2", text: "Link pesanan sendiri dengan harga langganan tetap" },
      {
        type: "p",
        text: "Di Epidom, usaha Anda punya halaman publik seperti epidom.fr/@nama-toko berisi menu: kategori, foto, harga, pilihan, dan tombol habis. Di paket POS, halaman ini bisa menerima pesanan. Tidak ada persentase atau biaya per pesanan, hanya langganan bulanan Rp 229.000 (Rp 189.000 per bulan jika tahunan), dengan uji coba gratis 14 hari.",
      },
      {
        type: "list",
        items: [
          "Makan di tempat: pelanggan memasukkan nomor meja dan memesan dari ponselnya.",
          "Bawa pulang: pelanggan pre-order lewat link lalu mengambil sendiri.",
          "Antar: Anda yang mengantar dengan kurir atau cara Anda sendiri. Epidom tidak menyediakan kurir.",
        ],
      },
      { type: "h2", text: "Apa yang terjadi saat pesanan masuk" },
      {
        type: "p",
        text: "Pesanan masuk ke antrean pesanan di kasir, di tempat yang sama dengan pesanan yang diinput di meja kasir. Anda diberi tahu lewat bunyi dan notifikasi di perangkat. Lalu pesanan bergerak dari Baru, Diproses, Siap, sampai Disajikan. Jika memakai layar dapur, tiket tampil langsung di sana.",
      },
      {
        type: "callout",
        text: "Penting: saat ini pembayaran dilakukan di kasir. Pelanggan belum membayar online lewat halaman toko. Kasir menandai pesanan sebagai lunas ketika pelanggan membayar di tempat atau saat pesanan diantar.",
      },
      { type: "h2", text: "Kapan link pesanan sendiri paling berguna" },
      {
        type: "p",
        text: "Link pesanan sendiri paling terasa untuk pelanggan yang sering datang: pekerja kantor yang memesan kopi sebelum jam istirahat, keluarga yang pre-order nasi kotak untuk akhir pekan, atau tamu di meja yang malas antre ke kasir. Mereka sudah kenal Anda, jadi tidak perlu aplikasi pihak ketiga untuk menemukan Anda.",
      },
      {
        type: "p",
        text: "Karena pesanan masuk ke antrean yang sama dengan pesanan kasir, dapur tidak perlu memantau banyak layar atau grup chat. Satu tempat untuk semua pesanan, baik dari meja kasir maupun dari link.",
      },
      { type: "h2", text: "Cara memulai pesanan online untuk kafe atau resto" },
      {
        type: "steps",
        items: [
          {
            title: "Buat halaman toko",
            text: "Daftar, isi logo, jam buka, dan tautan, lalu tambahkan menu lengkap dengan foto, harga, dan pilihan.",
          },
          {
            title: "Mulai uji coba POS",
            text: "Pesanan online termasuk di paket POS, dengan uji coba gratis 14 hari.",
          },
          {
            title: "Pilih jenis pesanan",
            text: "Tentukan yang Anda layani: makan di tempat dengan nomor meja, bawa pulang, atau antar sendiri.",
          },
          {
            title: "Bagikan link",
            text: "Taruh di bio Instagram, kirim lewat WhatsApp, dan cetak QR code untuk meja atau kasir.",
          },
        ],
      },
      { type: "h2", text: "Tetap pakai aplikasi, pindahkan pelanggan setia" },
      {
        type: "p",
        text: "Anda tidak perlu keluar dari aplikasi pesan antar jika masih membawa pelanggan baru. Pakai aplikasi untuk dikenal, lalu ajak pelanggan langganan memesan langsung: tulis di kantong pesanan, tempel QR code di gelas, pasang link di bio.",
      },
      {
        type: "callout",
        text: "Contoh sederhana: jika sebuah aplikasi mengambil 25% dari pesanan Rp 50.000, Anda menerima Rp 37.500. Pesanan yang sama lewat link sendiri tetap Rp 50.000, di luar biaya langganan. Angka 25% hanya contoh, bukan angka resmi aplikasi mana pun.",
      },
    ],
    faqs: [
      {
        q: "Apakah pesan online di Epidom gratis?",
        a: "Tidak. Halaman toko dengan menu gratis, tetapi menerima pesanan termasuk paket POS, Rp 229.000 per bulan (Rp 189.000 per bulan jika tahunan), dengan uji coba gratis 14 hari. Tidak ada komisi per pesanan.",
      },
      {
        q: "Apakah pelanggan bisa bayar online?",
        a: "Belum. Pesanan dari halaman toko dibayar di kasir: Anda diberi tahu, lalu kasir menandai pesanan sebagai lunas. Kami tidak menjanjikan pembayaran online di halaman toko.",
      },
      {
        q: "Bisakah pelanggan pre-order lewat link?",
        a: "Bisa. Pelanggan memesan lewat link lalu mengambil sendiri, atau memesan makan di tempat dengan nomor meja. Untuk antar, Anda yang mengantarkan.",
      },
      {
        q: "Bagaimana saya tahu ada pesanan baru?",
        a: "Pesanan muncul di antrean kasir dengan bunyi dan notifikasi perangkat. Anda lalu memprosesnya dari Baru sampai Disajikan.",
      },
      {
        q: "Apakah Epidom terhubung langsung ke GoFood atau GrabFood?",
        a: "Tidak ada integrasi langsung. Pesanan dari aplikasi bisa Anda input di kasir sebagai kanal tersendiri agar omzet dan komisinya terlihat di laporan keuangan paket Operations.",
      },
    ],
    cta: {
      title: "Coba pesan online tanpa komisi",
      text: "Uji coba gratis 14 hari paket POS. Setelahnya Rp 229.000 per bulan, tanpa persentase dari penjualan.",
      button: "Mulai uji coba gratis →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "commission-free-online-ordering",
    locale: "en",
    group: "online-ordering",
    kind: "vertical",
    metaTitle: "Commission-Free Online Ordering for Restaurants",
    metaDescription:
      "Commission-free online ordering for restaurants and cafés: your own ordering link, dine-in, takeaway and self-delivery. From $14.99 a month.",
    eyebrow: "Online ordering",
    h1: "Commission-free online ordering for restaurants and cafés",
    lede: "Customers order from your own page, the order lands in your POS with a sound alert, and no cut of each sale goes to a platform. You pay a flat monthly plan.",
    blocks: [
      { type: "h2", text: "What delivery apps really cost you" },
      {
        type: "p",
        text: "Delivery apps take a commission on every order. The rate depends on your contract and tier, but it is often a large share of the order, and a café or restaurant's net margin is only a few points. On a $20 order, several dollars go to the platform before you have paid for ingredients or staff.",
      },
      {
        type: "p",
        text: "The apps are still useful for being discovered. The trouble starts when your regulars, who already know where you are, order through them too. Every one of those orders costs you a commission for a customer you already won.",
      },
      { type: "h2", text: "Your own ordering link on a flat plan" },
      {
        type: "p",
        text: "With Epidom, your business gets a public page like epidom.fr/@your-shop with your menu: categories, photos, prices, options and a sold-out switch. On the POS plan, that page takes orders. There is no percentage and no per-order fee, only the monthly plan: $14.99 a month ($12.49 a month billed yearly), with a 14-day free trial.",
      },
      {
        type: "list",
        items: [
          "Dine-in: the customer enters a table number and orders from their phone.",
          "Takeaway: the customer orders ahead and picks up.",
          "Delivery: you deliver yourself, with your own driver or means. Epidom does not supply couriers.",
        ],
      },
      { type: "h2", text: "What happens when an order comes in" },
      {
        type: "p",
        text: "The order drops into the POS order queue, in the same place as orders rung up at the counter. A sound and a push notification on the device alert you. You move it through New, Preparing, Ready and Served, and the kitchen display shows it in real time if you use one.",
      },
      {
        type: "callout",
        text: "Worth knowing: payment is currently at the cashier. Customers do not pay online on the page. Your cashier marks the order as paid when the customer pays at the counter or on delivery.",
      },
      { type: "h2", text: "When your own ordering link pays off most" },
      {
        type: "p",
        text: "It works best for people who already know you: the office worker ordering a coffee before the lunch rush, the family pre-ordering a pastry box for the weekend, the guest at a table who would rather not queue at the counter. They already know where you are, so they do not need a third-party app to find you.",
      },
      {
        type: "p",
        text: "Because online orders land in the same queue as counter orders, the kitchen does not have to watch several screens or chat groups. One place holds every order, whether it was rung up at the counter or placed from the link.",
      },
      { type: "h2", text: "Setting up an online ordering system for your restaurant" },
      {
        type: "steps",
        items: [
          {
            title: "Create your page",
            text: "Sign up, add your logo, hours and links, then your menu with photos, prices and options.",
          },
          {
            title: "Start the POS trial",
            text: "Online ordering is part of the POS plan, with a 14-day free trial.",
          },
          {
            title: "Turn on your order types",
            text: "Choose what you offer: dine-in with a table number, takeaway, or delivery by your own team.",
          },
          {
            title: "Share the link",
            text: "Put it in your Instagram bio, send it on WhatsApp, and print the QR code for tables and the counter.",
          },
        ],
      },
      { type: "h2", text: "Keep the apps, move your regulars" },
      {
        type: "p",
        text: "You do not have to leave the delivery apps (GoFood, GrabFood, Uber Eats and the like) if they bring you new customers. Keep them for discovery, then invite regulars to order direct: a note in the bag, a QR code on the cup, the link in your bio.",
      },
      {
        type: "callout",
        text: "A simple example: if a platform keeps 25% of a $20 order, you receive $15. The same order through your own link leaves you $20, before your plan fee. The 25% is an illustration, not any one platform's rate.",
      },
    ],
    faqs: [
      {
        q: "Is online ordering free with Epidom?",
        a: "No. Your menu page is free, but taking orders is part of the POS plan at $14.99 a month ($12.49 a month billed yearly), with a 14-day free trial. There is no commission per order.",
      },
      {
        q: "Can customers pay online?",
        a: "Not currently. Orders placed from your page are paid at the cashier: you get an alert, then your cashier marks the order as paid. We do not promise online payment on the page.",
      },
      {
        q: "Can I offer takeaway and delivery?",
        a: "Yes. You can offer dine-in with a table number, takeaway, and delivery handled by you. Epidom does not provide delivery drivers.",
      },
      {
        q: "How will I know a new order has arrived?",
        a: "The order appears in the POS queue with a sound alert and a push notification on the device. You then move it from New to Served.",
      },
      {
        q: "Does Epidom connect to Uber Eats, GrabFood or GoFood?",
        a: "No, there is no direct integration. You can still enter those orders at the POS as their own channel, so their revenue and commission show up in the Operations plan's finance reports.",
      },
    ],
    cta: {
      title: "Try commission-free online ordering",
      text: "14-day free trial of the POS plan. After that $14.99 a month, with no percentage of your sales.",
      button: "Start the free trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "commission-free-online-ordering-th",
    locale: "th",
    group: "online-ordering",
    kind: "vertical",
    metaTitle: "สั่งอาหารออนไลน์ไม่มีค่าคอมมิชชัน",
    metaDescription:
      "ระบบสั่งอาหารออนไลน์ไม่มีค่าคอมมิชชันสำหรับร้านอาหารและคาเฟ่ ลิงก์สั่งอาหารของร้านเอง ทานที่ร้าน กลับบ้าน และส่งเอง เริ่มต้น $14.99 ต่อเดือน",
    eyebrow: "สั่งอาหารออนไลน์",
    h1: "สั่งอาหารออนไลน์ไม่มีค่าคอมมิชชัน สำหรับร้านอาหารและคาเฟ่",
    lede: "ลูกค้าสั่งจากหน้าร้านของคุณเอง ออเดอร์เข้า POS พร้อมเสียงแจ้งเตือน และไม่มีส่วนแบ่งจากยอดขายไปให้แพลตฟอร์ม คุณจ่ายเพียงแพ็กเกจรายเดือนแบบคงที่",
    blocks: [
      { type: "h2", text: "แอปเดลิเวอรีทำให้คุณเสียเงินจริงๆ เท่าไร" },
      {
        type: "p",
        text: "แอปเดลิเวอรีเก็บค่าคอมมิชชันจากทุกออเดอร์ อัตราขึ้นอยู่กับสัญญาและระดับของคุณ แต่มักเป็นสัดส่วนที่สูงของออเดอร์ ขณะที่กำไรสุทธิของคาเฟ่หรือร้านอาหารมีเพียงไม่กี่เปอร์เซ็นต์ ในออเดอร์ $20 เงินหลายดอลลาร์ตกไปอยู่ที่แพลตฟอร์ม ก่อนที่คุณจะจ่ายค่าวัตถุดิบหรือค่าจ้างพนักงานเสียอีก",
      },
      {
        type: "p",
        text: "แอปเหล่านี้ยังมีประโยชน์ในการทำให้คนรู้จักร้าน ปัญหาเริ่มเมื่อลูกค้าประจำที่รู้อยู่แล้วว่าร้านอยู่ที่ไหนสั่งผ่านแอปด้วย ทุกออเดอร์เหล่านั้นทำให้คุณเสียค่าคอมมิชชันกับลูกค้าที่คุณได้มาแล้ว",
      },
      { type: "h2", text: "ลิงก์สั่งอาหารของร้านเอง ในแพ็กเกจราคาคงที่" },
      {
        type: "p",
        text: "กับ Epidom ธุรกิจของคุณจะมีหน้าสาธารณะ เช่น epidom.fr/@your-shop พร้อมเมนูของคุณ ทั้งหมวดหมู่ รูปภาพ ราคา ตัวเลือก และสวิตช์สินค้าหมด ในแพ็กเกจ POS หน้านี้รับออเดอร์ได้ ไม่มีเปอร์เซ็นต์และไม่มีค่าธรรมเนียมต่อออเดอร์ มีเพียงแพ็กเกจรายเดือน: $14.99 ต่อเดือน ($12.49 ต่อเดือนเมื่อชำระรายปี) พร้อมทดลองใช้ฟรี 14 วัน",
      },
      {
        type: "list",
        items: [
          "ทานที่ร้าน: ลูกค้ากรอกหมายเลขโต๊ะและสั่งจากโทรศัพท์ของตัวเอง",
          "กลับบ้าน: ลูกค้าสั่งล่วงหน้าแล้วมารับ",
          "เดลิเวอรี: คุณส่งเอง ด้วยคนขับหรือวิธีของคุณเอง Epidom ไม่มีบริการจัดหาคนส่งของ",
        ],
      },
      { type: "h2", text: "เมื่อมีออเดอร์เข้ามาจะเกิดอะไรขึ้น" },
      {
        type: "p",
        text: "ออเดอร์จะเข้าคิวออเดอร์ของ POS ในที่เดียวกับออเดอร์ที่คิดเงินที่เคาน์เตอร์ เสียงและการแจ้งเตือนแบบพุชบนอุปกรณ์จะแจ้งให้คุณทราบ คุณเลื่อนสถานะไปตาม New, Preparing, Ready และ Served และจอแสดงออเดอร์ในครัวจะแสดงให้เห็นแบบเรียลไทม์ หากคุณใช้งานอยู่",
      },
      {
        type: "callout",
        text: "ควรรู้: ตอนนี้การชำระเงินทำที่แคชเชียร์ ลูกค้าไม่ได้จ่ายเงินออนไลน์บนหน้าร้าน แคชเชียร์ของคุณจะทำเครื่องหมายว่าออเดอร์ชำระแล้ว เมื่อลูกค้าจ่ายที่เคาน์เตอร์หรือเมื่อรับของ",
      },
      { type: "h2", text: "ลิงก์สั่งอาหารของร้านเองคุ้มที่สุดเมื่อไร" },
      {
        type: "p",
        text: "ได้ผลที่สุดกับคนที่รู้จักคุณอยู่แล้ว เช่น พนักงานออฟฟิศที่สั่งกาแฟก่อนช่วงพักเที่ยง ครอบครัวที่สั่งกล่องขนมล่วงหน้าไว้สำหรับวันหยุด หรือแขกที่โต๊ะซึ่งไม่อยากต่อคิวที่เคาน์เตอร์ พวกเขารู้อยู่แล้วว่าร้านอยู่ที่ไหน จึงไม่จำเป็นต้องใช้แอปของบุคคลที่สามเพื่อหาคุณ",
      },
      {
        type: "p",
        text: "เพราะออเดอร์ออนไลน์เข้าคิวเดียวกับออเดอร์ที่เคาน์เตอร์ ครัวจึงไม่ต้องคอยดูหลายหน้าจอหรือหลายกลุ่มแชต ทุกออเดอร์อยู่ในที่เดียว ไม่ว่าจะคิดเงินที่เคาน์เตอร์หรือสั่งมาจากลิงก์",
      },
      { type: "h2", text: "การตั้งค่าระบบสั่งอาหารออนไลน์สำหรับร้านอาหารของคุณ" },
      {
        type: "steps",
        items: [
          {
            title: "สร้างหน้าร้านของคุณ",
            text: "สมัครใช้งาน เพิ่มโลโก้ เวลาเปิดทำการ และลิงก์ จากนั้นเพิ่มเมนูพร้อมรูปภาพ ราคา และตัวเลือก",
          },
          {
            title: "เริ่มทดลองใช้ POS",
            text: "การสั่งอาหารออนไลน์เป็นส่วนหนึ่งของแพ็กเกจ POS พร้อมทดลองใช้ฟรี 14 วัน",
          },
          {
            title: "เปิดประเภทออเดอร์ที่ต้องการ",
            text: "เลือกสิ่งที่คุณให้บริการ: ทานที่ร้านพร้อมหมายเลขโต๊ะ กลับบ้าน หรือเดลิเวอรีโดยทีมของคุณเอง",
          },
          {
            title: "แชร์ลิงก์",
            text: "ใส่ไว้ในไบโอ Instagram ส่งทาง WhatsApp และพิมพ์ QR code ไปวางที่โต๊ะและเคาน์เตอร์",
          },
        ],
      },
      { type: "h2", text: "ใช้แอปต่อไป แต่ย้ายลูกค้าประจำมาสั่งกับคุณ" },
      {
        type: "p",
        text: "คุณไม่จำเป็นต้องเลิกใช้แอปเดลิเวอรี (GoFood, GrabFood, Uber Eats และแอปอื่นๆ) หากแอปเหล่านั้นพาลูกค้าใหม่มาให้ ใช้ไว้เพื่อให้คนรู้จักร้าน แล้วชวนลูกค้าประจำมาสั่งตรง เช่น แปะโน้ตไว้ในถุง ใส่ QR code บนแก้ว หรือวางลิงก์ไว้ในไบโอ",
      },
      {
        type: "callout",
        text: "ตัวอย่างง่ายๆ: หากแพลตฟอร์มเก็บ 25% ของออเดอร์ $20 คุณจะได้รับ $15 ออเดอร์เดียวกันผ่านลิงก์ของร้านเองคุณได้ $20 ก่อนหักค่าแพ็กเกจ ตัวเลข 25% เป็นเพียงตัวอย่าง ไม่ใช่อัตราของแพลตฟอร์มใดโดยเฉพาะ",
      },
    ],
    faqs: [
      {
        q: "การสั่งอาหารออนไลน์ของ Epidom ใช้ฟรีหรือไม่",
        a: "ไม่ฟรี หน้าเมนูของคุณใช้ฟรี แต่การรับออเดอร์เป็นส่วนหนึ่งของแพ็กเกจ POS ที่ $14.99 ต่อเดือน ($12.49 ต่อเดือนเมื่อเรียกเก็บรายปี) พร้อมทดลองใช้ฟรี 14 วัน ไม่มีค่าคอมมิชชันต่อออเดอร์",
      },
      {
        q: "ลูกค้าชำระเงินออนไลน์ได้หรือไม่",
        a: "ตอนนี้ยังไม่ได้ ออเดอร์ที่สั่งจากหน้าร้านของคุณชำระที่แคชเชียร์ คุณจะได้รับการแจ้งเตือน แล้วแคชเชียร์ทำเครื่องหมายว่าออเดอร์ชำระแล้ว เราไม่ได้สัญญาว่าจะมีการชำระเงินออนไลน์บนหน้าร้าน",
      },
      {
        q: "เปิดให้กลับบ้านและเดลิเวอรีได้หรือไม่",
        a: "ได้ คุณเปิดให้บริการทานที่ร้านพร้อมหมายเลขโต๊ะ กลับบ้าน และเดลิเวอรีที่คุณจัดการเองได้ Epidom ไม่มีคนขับส่งของให้",
      },
      {
        q: "จะรู้ได้อย่างไรว่ามีออเดอร์ใหม่เข้ามา",
        a: "ออเดอร์จะปรากฏในคิวของ POS พร้อมเสียงแจ้งเตือนและการแจ้งเตือนแบบพุชบนอุปกรณ์ จากนั้นคุณเลื่อนสถานะจาก New ไปจนถึง Served",
      },
      {
        q: "Epidom เชื่อมต่อกับ Uber Eats, GrabFood หรือ GoFood หรือไม่",
        a: "ไม่ ไม่มีการเชื่อมต่อโดยตรง แต่คุณยังบันทึกออเดอร์เหล่านั้นที่ POS เป็นช่องทางแยกได้ ทำให้รายได้และค่าคอมมิชชันของแอปเหล่านั้นปรากฏในรายงานการเงินของแพ็กเกจ Operations",
      },
    ],
    cta: {
      title: "ลองสั่งอาหารออนไลน์แบบไม่มีค่าคอมมิชชัน",
      text: "ทดลองใช้แพ็กเกจ POS ฟรี 14 วัน หลังจากนั้น $14.99 ต่อเดือน ไม่มีเปอร์เซ็นต์จากยอดขายของคุณ",
      button: "เริ่มทดลองใช้ฟรี →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
