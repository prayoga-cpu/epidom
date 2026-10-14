import type { LandingPage } from "../types";

export const receiptPrinterPages: LandingPage[] = [
  {
    slug: "imprimante-ticket-caisse",
    locale: "fr",
    group: "receipt-printer",
    kind: "feature",
    metaTitle: "Imprimante ticket de caisse : bien la choisir",
    metaDescription:
      "Imprimante ticket de caisse : thermique Bluetooth 58 ou 80 mm, bon de cuisine, étiquettes. Comment choisir et la connecter à la caisse Epidom.",
    eyebrow: "Imprimante ticket",
    h1: "Imprimante ticket de caisse : choisir et connecter la bonne",
    lede: "Pour un café ou un restaurant, une imprimante thermique Bluetooth compatible ESC/POS suffit : 58 mm pour un comptoir, 80 mm si vous imprimez aussi les bons de cuisine. Voici comment choisir, et comment l'associer à Epidom.",
    blocks: [
      { type: "h2", text: "Pourquoi une imprimante thermique" },
      {
        type: "p",
        text: "Une imprimante thermique n'utilise ni encre ni ruban : la chaleur noircit directement le papier. C'est rapide, silencieux et peu coûteux à l'usage, ce qui explique qu'on la retrouve derrière presque tous les comptoirs. Le seul consommable est le rouleau de papier thermique.",
      },
      {
        type: "p",
        text: "Pour un petit commerce, c'est aussi la solution la plus simple à poser : un boîtier compact, un rouleau, et rien d'autre à brancher si l'imprimante fonctionne en Bluetooth.",
      },
      { type: "h2", text: "Les critères pour bien choisir" },
      {
        type: "list",
        items: [
          "Langage ESC/POS : c'est le standard des imprimantes de tickets. Vérifiez qu'il figure sur la fiche produit.",
          "Bluetooth : pratique sur une tablette ou un téléphone, sans câble qui traîne sur le comptoir.",
          "Largeur du papier : 58 mm pour un ticket étroit et un boîtier compact, 80 mm pour plus de lisibilité et des lignes plus longues.",
          "Coupe-papier automatique : utile en cuisine, où l'on arrache un bon toutes les minutes.",
          "Vitesse d'impression : en plein coup de feu, quelques secondes de moins par ticket se remarquent.",
        ],
      },
      {
        type: "callout",
        text: "Epidom ne recommande aucune marque d'imprimante en particulier. Prenez un modèle thermique Bluetooth ESC/POS en 58 ou 80 mm, et faites un essai d'impression après l'association, avant d'en acheter plusieurs.",
      },
      { type: "h2", text: "58 mm ou 80 mm ?" },
      {
        type: "p",
        text: "Le 58 mm convient au ticket de caisse classique d'un comptoir de café ou de boulangerie : quelques lignes, un total, un moyen de paiement. Le 80 mm devient intéressant quand les libellés sont longs, par exemple des bons de cuisine avec options et remarques, ou des additions de table avec beaucoup de lignes.",
      },
      { type: "h2", text: "Un ticket pour la salle, un bon pour la cuisine" },
      {
        type: "p",
        text: "Une seule imprimante ne suffit pas toujours. Avec le plan POS, Epidom permet d'associer jusqu'à quatre imprimantes à une même caisse, une par usage.",
      },
      {
        type: "list",
        items: [
          "Imprimante de tickets : le ticket client avec prix et total, l'addition et le rapport de service.",
          "Imprimante de cuisine : le bon de commande pour la cuisine, sans les prix. C'est l'imprimante bon de cuisine classique.",
          "Imprimante de bar : uniquement les boissons du bar. Si vous la laissez éteinte, ces articles sortent sur l'imprimante de cuisine.",
          "Imprimante d'étiquettes : un autocollant par article commandé, pour les gobelets et les emballages.",
        ],
      },
      { type: "h2", text: "Associer l'imprimante à Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Ouvrez les réglages matériel",
            text: "En mode caisse, ouvrez le menu Epidom puis Réglages matériel. Ces réglages sont propres à chaque appareil.",
          },
          {
            title: "Activez le rôle voulu",
            text: "Activez uniquement les imprimantes que vous utilisez : tickets, cuisine, bar ou étiquettes.",
          },
          {
            title: "Associez en Bluetooth",
            text: "Choisissez votre imprimante dans la liste Bluetooth. Il faut Chrome sur Android ou sur un ordinateur.",
          },
          {
            title: "Lancez un essai d'impression",
            text: "Utilisez l'essai d'impression sur chaque imprimante. L'impression d'étiquettes en particulier n'est pas vérifiée sur tous les modèles.",
          },
        ],
      },
      { type: "h2", text: "Ce qu'il faut savoir avant d'acheter" },
      {
        type: "list",
        items: [
          "Sur iPad, l'envoi de tickets, de bons de cuisine, de bar ou d'étiquettes vers une imprimante n'est pas possible. Prévoyez une tablette Android ou un ordinateur.",
          "Sans imprimante, vous pouvez envoyer le ticket au client en PDF ou par e-mail.",
          "Un lecteur de codes-barres se branche aussi à la caisse si vous vendez des produits emballés.",
        ],
      },
    ],
    faqs: [
      {
        q: "Quelle imprimante ticket de caisse choisir pour un café ?",
        a: "Une imprimante thermique Bluetooth ESC/POS en 58 mm suffit en général pour un comptoir. Prenez du 80 mm si vous imprimez aussi des bons de cuisine avec des libellés longs. Faites toujours un essai d'impression avant de commander plusieurs exemplaires.",
      },
      {
        q: "Une imprimante thermique Bluetooth fonctionne-t-elle avec Epidom ?",
        a: "Epidom prend en charge les imprimantes thermiques Bluetooth de 58 et 80 mm en ESC/POS. Nous ne recommandons aucune marque en particulier : l'essai d'impression après l'association vous dit si votre modèle convient.",
      },
      {
        q: "Peut-on avoir une imprimante bon de cuisine séparée ?",
        a: "Oui. Avec le plan POS, vous associez une imprimante de cuisine, distincte de l'imprimante de tickets, qui imprime les commandes sans les prix. Vous pouvez aussi ajouter une imprimante de bar et une imprimante d'étiquettes.",
      },
      {
        q: "Peut-on imprimer depuis un iPad ?",
        a: "Non, un iPad ne peut pas envoyer de tickets, de bons de cuisine ou d'étiquettes à une imprimante Bluetooth. L'association Bluetooth demande Chrome sur Android ou sur un ordinateur.",
      },
      {
        q: "Combien coûte l'impression des tickets avec Epidom ?",
        a: "L'impression fait partie du plan POS, à 13,99 € par mois (11,49 € par mois en formule annuelle), avec 14 jours d'essai gratuit. L'imprimante elle-même est un achat à part.",
      },
    ],
    cta: {
      title: "Testez l'impression sur votre propre caisse",
      text: "Le plan POS démarre par 14 jours d'essai gratuit : associez votre imprimante et imprimez un premier ticket.",
      button: "Essayer 14 jours gratuitement →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "printer-struk-kasir",
    locale: "id",
    group: "receipt-printer",
    kind: "feature",
    metaTitle: "Printer Struk Kasir: Cara Memilih & Memasang",
    metaDescription:
      "Printer struk kasir: thermal Bluetooth 58mm atau 80mm, printer dapur, label. Cara memilih dan menyambungkannya ke kasir Epidom.",
    eyebrow: "Printer struk",
    h1: "Printer struk kasir: cara memilih dan memasangnya",
    lede: "Untuk kafe, warung, atau toko roti, printer thermal Bluetooth dengan ESC/POS sudah cukup. Pilih kertas 58mm untuk meja kasir, atau 80mm bila Anda juga mencetak pesanan untuk dapur.",
    blocks: [
      { type: "h2", text: "Kenapa printer thermal" },
      {
        type: "p",
        text: "Printer thermal tidak memakai tinta atau pita. Panas langsung menghitamkan kertasnya, jadi cetaknya cepat, senyap, dan murah dipakai. Satu-satunya bahan habis pakai adalah gulungan kertas thermal.",
      },
      {
        type: "p",
        text: "Bila printernya Bluetooth, tidak ada kabel yang perlu ditarik ke meja kasir. Cukup satu printer kecil di samping tablet.",
      },
      { type: "h2", text: "Hal yang perlu dicek sebelum membeli" },
      {
        type: "list",
        items: [
          "ESC/POS: ini bahasa standar printer struk. Pastikan tertulis di spesifikasi produk.",
          "Bluetooth: praktis untuk tablet atau ponsel, tanpa kabel di meja.",
          "Lebar kertas: 58mm untuk struk ramping dan printer yang mungil, 80mm untuk tulisan lebih lega dan baris yang lebih panjang.",
          "Auto-cutter: berguna di dapur, saat tiket sering dirobek.",
          "Kecepatan cetak: saat ramai, selisih beberapa detik per struk terasa.",
        ],
      },
      {
        type: "callout",
        text: "Epidom tidak menyatakan merek printer tertentu sebagai teruji atau tersertifikasi. Pilih printer thermal Bluetooth ESC/POS 58mm atau 80mm, lalu coba cetak setelah dipasangkan sebelum membeli beberapa unit.",
      },
      { type: "h2", text: "Printer 58mm atau 80mm?" },
      {
        type: "p",
        text: "Kertas 58mm cukup untuk struk kasir biasa di kafe atau toko roti: beberapa baris, total, dan metode bayar. Kertas 80mm lebih nyaman bila nama menu panjang, misalnya tiket dapur dengan pilihan tambahan dan catatan, atau bon meja dengan banyak baris.",
      },
      { type: "h2", text: "Struk untuk pelanggan, tiket untuk dapur" },
      {
        type: "p",
        text: "Satu printer sering tidak cukup. Dengan paket POS, Epidom bisa memasangkan hingga empat printer ke satu kasir, masing-masing untuk satu tugas.",
      },
      {
        type: "list",
        items: [
          "Printer struk: struk dengan harga dan total, bon tagihan, dan laporan shift.",
          "Printer dapur: tiket pesanan untuk dapur tanpa harga. Inilah printer dapur yang umum dipakai.",
          "Printer bar: hanya menu bar. Bila dimatikan, menu bar tercetak di printer dapur.",
          "Printer label: satu stiker untuk setiap item yang dipesan, untuk gelas dan kemasan.",
        ],
      },
      { type: "h2", text: "Cara memasangkan printer ke Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Buka pengaturan perangkat keras",
            text: "Di Mode POS, buka menu Epidom lalu Pengaturan perangkat keras. Pengaturan ini berlaku per perangkat.",
          },
          {
            title: "Aktifkan peran yang dipakai",
            text: "Nyalakan hanya printer yang Anda pakai: struk, dapur, bar, atau label.",
          },
          {
            title: "Pasangkan lewat Bluetooth",
            text: "Pilih printer dari daftar Bluetooth. Anda perlu Chrome di Android atau di komputer.",
          },
          {
            title: "Cetak tes",
            text: "Gunakan cetak tes di setiap printer. Cetak label khususnya belum terverifikasi di semua model.",
          },
        ],
      },
      { type: "h2", text: "Batasan yang perlu Anda tahu" },
      {
        type: "list",
        items: [
          "iPad tidak bisa mengirim struk, tiket dapur, tiket bar, atau label ke printer. Gunakan tablet Android atau komputer.",
          "Tanpa printer, struk tetap bisa dikirim ke pelanggan sebagai PDF atau lewat email.",
          "Pemindai barcode juga bisa dipakai di kasir bila Anda menjual produk kemasan.",
        ],
      },
    ],
    faqs: [
      {
        q: "Printer struk kasir apa yang cocok untuk kafe?",
        a: "Printer thermal Bluetooth dengan ESC/POS, kertas 58mm, biasanya cukup untuk meja kasir. Pilih 80mm bila Anda juga mencetak tiket dapur dengan nama menu panjang. Selalu coba cetak dulu sebelum membeli beberapa unit.",
      },
      {
        q: "Apakah printer thermal Bluetooth 58mm dan 80mm bisa dipakai di Epidom?",
        a: "Epidom mendukung printer thermal Bluetooth 58mm dan 80mm dengan ESC/POS. Kami tidak menyatakan merek tertentu sebagai teruji atau tersertifikasi. Cetak tes setelah pemasangan akan menunjukkan apakah model Anda cocok.",
      },
      {
        q: "Bisakah ada printer dapur yang terpisah dari printer struk?",
        a: "Bisa. Dengan paket POS, Anda memasangkan printer dapur yang terpisah dari printer struk, mencetak pesanan tanpa harga. Anda juga bisa menambah printer bar dan printer label.",
      },
      {
        q: "Apakah bisa mencetak dari iPad?",
        a: "Tidak. iPad tidak bisa mengirim struk, tiket dapur, tiket bar, atau label ke printer Bluetooth. Pemasangan Bluetooth membutuhkan Chrome di Android atau di komputer.",
      },
      {
        q: "Berapa biaya fitur cetak struk di Epidom?",
        a: "Cetak struk termasuk dalam paket POS seharga Rp 229.000 per bulan (Rp 189.000 per bulan bila bayar tahunan), dengan uji coba gratis 14 hari. Printernya sendiri dibeli terpisah.",
      },
    ],
    cta: {
      title: "Coba cetak struk di kasir Anda sendiri",
      text: "Paket POS dimulai dengan uji coba gratis 14 hari: pasangkan printer Anda dan cetak struk pertama.",
      button: "Coba gratis 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "receipt-printer-pos",
    locale: "en",
    group: "receipt-printer",
    kind: "feature",
    metaTitle: "Receipt Printer for POS: What to Buy and How",
    metaDescription:
      "Receipt printer for POS: Bluetooth thermal printers in 58 mm or 80 mm, kitchen ticket printers and labels. How to choose and connect one to Epidom.",
    eyebrow: "Receipt printers",
    h1: "Receipt printer for POS: what to buy and how to connect it",
    lede: "A Bluetooth thermal printer that speaks ESC/POS is all a cafe or restaurant needs. Choose 58 mm paper for a counter, or 80 mm if you also print kitchen tickets, then pair it to Epidom in a few taps.",
    blocks: [
      { type: "h2", text: "Why thermal printers" },
      {
        type: "p",
        text: "A thermal printer uses no ink or ribbon. Heat darkens the paper directly, so printing is fast, quiet and cheap to run. The only thing you buy again is the roll of thermal paper.",
      },
      {
        type: "p",
        text: "If the printer is Bluetooth, there is no cable across the counter. One small box next to the tablet is the whole setup.",
      },
      { type: "h2", text: "What to look for in a Bluetooth thermal receipt printer" },
      {
        type: "list",
        items: [
          "ESC/POS: the standard command language for receipt printers. Check that the spec sheet lists it.",
          "Bluetooth: convenient with a tablet or phone, and no cable to trip over.",
          "Paper width: 58 mm for narrow receipts and a compact body, 80 mm for easier reading and longer lines.",
          "Auto-cutter: handy in a kitchen where you tear off a ticket every minute.",
          "Print speed: during a rush, a few seconds saved per ticket adds up.",
        ],
      },
      {
        type: "callout",
        text: "Epidom does not certify any printer brand. Buy a Bluetooth thermal ESC/POS model in 58 mm or 80 mm, and run a test print right after pairing, before you buy several.",
      },
      { type: "h2", text: "58 mm or 80 mm?" },
      {
        type: "p",
        text: "58 mm is plenty for a standard counter receipt at a cafe or bakery: a few lines, a total, a payment method. 80 mm earns its size when item names are long, such as kitchen tickets with modifiers and notes, or table bills with many lines.",
      },
      { type: "h2", text: "A receipt for the guest, a ticket for the kitchen" },
      {
        type: "p",
        text: "One printer is not always enough. With the POS plan, Epidom pairs up to four printers to one till, one for each job. A kitchen ticket printer is simply the second one.",
      },
      {
        type: "list",
        items: [
          "Receipt printer: the receipt with prices and total, the bill and the shift report.",
          "Kitchen printer: order tickets for the kitchen, with no prices.",
          "Bar printer: bar items only. Leave it off and bar items print on the kitchen printer.",
          "Label printer: one sticker per item ordered, for cups and packaging.",
        ],
      },
      { type: "h2", text: "How to pair a printer with Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Open hardware settings",
            text: "In POS Mode, open the Epidom menu, then Hardware settings. These settings belong to each device.",
          },
          {
            title: "Turn on the roles you use",
            text: "Switch on only the printers you need: receipt, kitchen, bar or labels.",
          },
          {
            title: "Pair over Bluetooth",
            text: "Pick your printer from the Bluetooth list. This needs Chrome on Android or on a computer.",
          },
          {
            title: "Run a test print",
            text: "Use Test print on each printer. Label printing in particular isn't verified on every model.",
          },
        ],
      },
      { type: "h2", text: "Limits to know before you buy" },
      {
        type: "list",
        items: [
          "An iPad can't send receipts, kitchen or bar tickets, or labels to a printer. Plan on an Android tablet or a computer.",
          "With no printer at all, you can still send the receipt to the guest as a PDF or by email.",
          "A barcode scanner also works at the POS if you sell packaged goods.",
        ],
      },
    ],
    faqs: [
      {
        q: "What receipt printer should I buy for a small cafe?",
        a: "A Bluetooth thermal ESC/POS printer in 58 mm is usually enough for a counter. Go with 80 mm if you also print kitchen tickets with long item names. Always do a test print before ordering several.",
      },
      {
        q: "Does Epidom work with any Bluetooth thermal printer?",
        a: "Epidom supports Bluetooth thermal printers in 58 mm and 80 mm over ESC/POS. We don't vouch for any particular brand. The test print after pairing tells you whether your model works.",
      },
      {
        q: "Can I get a separate kitchen ticket printer?",
        a: "Yes. On the POS plan you pair a kitchen printer apart from your receipt printer, printing orders without prices. You can add a bar printer and a label printer as well.",
      },
      {
        q: "Can I print from an iPad?",
        a: "No. An iPad can't send receipts, kitchen or bar tickets, or labels to a Bluetooth printer. Pairing needs Chrome on Android or on a computer.",
      },
      {
        q: "How much does receipt printing cost with Epidom?",
        a: "Printing comes with the POS plan at $14.99 per month ($12.49 per month on the annual plan), with a 14-day free trial. The printer itself is a separate purchase.",
      },
    ],
    cta: {
      title: "Try printing on your own POS",
      text: "The POS plan starts with a 14-day free trial: pair your printer and print a first receipt.",
      button: "Start your 14-day free trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
