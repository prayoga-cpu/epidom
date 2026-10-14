import type { LandingPage } from "../types";

export const kitchenDisplayPages: LandingPage[] = [
  {
    slug: "ecran-cuisine-kds",
    locale: "fr",
    group: "kitchen-display",
    kind: "feature",
    metaTitle: "Écran cuisine (KDS) pour restaurant et café",
    metaDescription:
      "Écran cuisine KDS : à quoi il sert, ce qu'il remplace et comment l'utiliser sur une tablette avec Epidom, dès le plan POS à 13,99 €/mois.",
    eyebrow: "Écran cuisine",
    h1: "Écran cuisine (KDS) pour restaurant : bons en temps réel",
    lede: "Un écran cuisine affiche les commandes en cours sur une tablette, au fur et à mesure qu'elles sont saisies en salle, au comptoir ou en ligne. Epidom en propose un dès le plan POS, sur n'importe quelle tablette avec un navigateur.",
    blocks: [
      { type: "h2", text: "Ce qu'est un écran cuisine (KDS)" },
      {
        type: "p",
        text: "KDS veut dire Kitchen Display System. C'est un écran, souvent une tablette fixée au mur ou posée sur le passe, qui remplace ou complète les bons de commande papier. Chaque commande y apparaît sous forme de ticket, avec les plats, les options et le numéro de table ou le mode (sur place, à emporter, livraison).",
      },
      {
        type: "p",
        text: "L'intérêt est simple : le cuisinier voit ce qu'il doit préparer sans attendre qu'un bon sorte de l'imprimante, et la salle voit ce qui est prêt sans aller poser la question en cuisine.",
      },
      { type: "h2", text: "Ce qu'il change par rapport aux bons de commande papier" },
      {
        type: "list",
        items: [
          "Plus de bon perdu, froissé, taché ou illisible sur le passe.",
          "Les modifications sont visibles tout de suite : plus besoin de rapporter un bon corrigé à la main.",
          "Chaque plat peut changer d'état, donc la cuisine sait ce qui est en cours et ce qui est terminé.",
          "Une alerte sonore signale l'arrivée d'une nouvelle commande, même quand on a les mains prises.",
          "Pas de papier ni de rouleau à racheter pour la cuisine.",
        ],
      },
      {
        type: "p",
        text: "Cela dit, beaucoup de restaurants gardent les deux. Epidom fonctionne à côté des bons imprimés cuisine et bar : vous pouvez garder une imprimante thermique Bluetooth pour les bons et ajouter l'écran, ou l'inverse. Rien n'oblige à choisir.",
      },
      { type: "h2", text: "Comment fonctionne l'écran cuisine d'Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "La commande est saisie",
            text: "Un serveur ou un caissier la prend sur la caisse (tablette, téléphone ou ordinateur), ou le client la passe depuis la page de votre établissement.",
          },
          {
            title: "Le ticket arrive en cuisine",
            text: "Il s'affiche en temps réel sur l'écran cuisine, avec une alerte sonore, sans rien à rafraîchir.",
          },
          {
            title: "La cuisine fait avancer les plats",
            text: "Elle marque l'état de chaque article au fil de la préparation, puis la commande passe en prête.",
          },
          {
            title: "La salle sert",
            text: "La commande suit son parcours dans la file : Nouvelle, En préparation, Prête, Servie.",
          },
        ],
      },
      { type: "h2", text: "Une seule cuisine ou plusieurs postes" },
      {
        type: "p",
        text: "Le plan POS inclut un écran cuisine : ce qu'il faut pour un café, une boulangerie qui prépare des sandwichs ou un petit restaurant avec une seule pièce de préparation.",
      },
      {
        type: "p",
        text: "Dès que la cuisine et le bar travaillent chacun de leur côté, le plan Operations permet plusieurs écrans, routés par poste. Les boissons s'affichent au bar, les plats en cuisine, et chaque équipe ne voit que ses articles. Le cuisinier n'a plus à trier les cocktails dans un bon mélangé.",
      },
      {
        type: "callout",
        text: "Exemple : une commande de deux burgers, une limonade et un café. Les burgers apparaissent sur l'écran cuisine, la limonade et le café sur l'écran bar. Chaque poste fait avancer ses articles, et la commande n'est prête que lorsque tout l'est.",
      },
      { type: "h2", text: "Quel matériel faut-il ?" },
      {
        type: "p",
        text: "Une tablette avec un navigateur suffit, ou un ordinateur ou un téléphone si vous préférez. Epidom tourne dans le navigateur, sans serveur à installer. Prévoyez un support stable, une prise de courant à proximité, et une connexion internet fiable pour recevoir les commandes en direct.",
      },
      {
        type: "p",
        text: "Pour les bons papier, des imprimantes thermiques Bluetooth 58 mm ou 80 mm peuvent être associées à la caisse : reçu, bon cuisine, bon bar, étiquettes d'articles.",
      },
    ],
    faqs: [
      {
        q: "Qu'est-ce qu'un KDS en restauration ?",
        a: "KDS signifie Kitchen Display System, ou écran cuisine. C'est un écran qui affiche les commandes à préparer en temps réel, à la place ou en plus des bons papier. Il évite les tickets perdus et permet de suivre l'avancement de chaque plat.",
      },
      {
        q: "Peut-on utiliser une simple tablette comme écran cuisine ?",
        a: "Oui. Avec Epidom, l'écran cuisine s'ouvre dans le navigateur de n'importe quelle tablette, d'un ordinateur ou d'un téléphone. Il suffit d'une connexion internet et d'un support pour la tenir à portée de vue en cuisine.",
      },
      {
        q: "Faut-il arrêter d'imprimer les bons de commande ?",
        a: "Non. L'écran cuisine fonctionne à côté des bons cuisine et bar imprimés. Vous pouvez garder les deux le temps de vous habituer, ou ne garder que l'écran.",
      },
      {
        q: "Combien coûte l'écran cuisine Epidom ?",
        a: "Un écran cuisine est inclus dans le plan POS, à 13,99 € par mois (11,49 € par mois en abonnement annuel), avec 14 jours d'essai gratuit. Plusieurs écrans routés par poste, cuisine et bar, sont inclus dans le plan Operations, à 27,99 € par mois (23,49 € en annuel).",
      },
      {
        q: "Les commandes en ligne arrivent-elles aussi sur l'écran ?",
        a: "Oui. Les commandes passées depuis la page de votre établissement entrent dans la même file que celles prises en salle ou au comptoir, et s'affichent donc sur l'écran cuisine comme les autres.",
      },
    ],
    cta: {
      title: "Essayez l'écran cuisine sur votre tablette",
      text: "Le plan POS démarre par 14 jours d'essai gratuit. Ouvrez Epidom sur une tablette en cuisine et passez quelques commandes de test.",
      button: "Essayer 14 jours gratuitement →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "layar-dapur-kds",
    locale: "id",
    group: "kitchen-display",
    kind: "feature",
    metaTitle: "Kitchen Display System (KDS) untuk Restoran",
    metaDescription:
      "Layar dapur atau kitchen display system (KDS): fungsinya, bedanya dengan nota kertas, dan cara memakainya di tablet dengan Epidom mulai paket POS.",
    eyebrow: "Layar dapur",
    h1: "Kitchen Display System (KDS): layar dapur untuk restoran",
    lede: "Kitchen display system adalah layar di dapur yang menampilkan pesanan masuk secara langsung, jadi koki tidak perlu menunggu nota kertas. Di Epidom, satu layar dapur sudah termasuk di paket POS dan bisa dibuka di tablet apa pun yang punya browser.",
    blocks: [
      { type: "h2", text: "Apa itu KDS atau layar dapur?" },
      {
        type: "p",
        text: "KDS adalah singkatan dari Kitchen Display System. Bentuknya layar, biasanya tablet yang dipasang di dinding atau diletakkan di meja pass, yang menampilkan setiap pesanan sebagai tiket: daftar menu, pilihan tambahan, nomor meja, dan jenis pesanan (makan di tempat, bawa pulang, atau antar).",
      },
      {
        type: "p",
        text: "Dengan KDS, pesanan yang diketik kasir langsung muncul di dapur. Tidak ada nota yang terselip, basah, atau tulisannya tidak terbaca, dan pelayan tidak perlu bolak-balik bertanya apakah pesanan meja 5 sudah jadi.",
      },
      { type: "h2", text: "Bedanya dengan nota kertas ke dapur" },
      {
        type: "list",
        items: [
          "Pesanan muncul seketika, tanpa menunggu printer mencetak.",
          "Tiap menu punya status, sehingga dapur tahu mana yang sedang dibuat dan mana yang selesai.",
          "Ada bunyi peringatan saat pesanan baru masuk, berguna ketika tangan koki sedang sibuk.",
          "Tidak perlu membeli gulungan kertas untuk dapur.",
          "Pesanan dari kasir, meja, dan pesanan online masuk ke tempat yang sama.",
        ],
      },
      {
        type: "p",
        text: "Banyak kafe dan restoran tetap memakai keduanya. Epidom berjalan berdampingan dengan nota dapur dan bar yang dicetak: printer thermal Bluetooth tetap bisa dipakai, dan layar ditambahkan di sampingnya.",
      },
      { type: "h2", text: "Cara kerja layar dapur di Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Pesanan dimasukkan",
            text: "Kasir atau pelayan mencatatnya di aplikasi kasir (tablet, ponsel, atau komputer), atau pelanggan memesan lewat halaman toko Anda.",
          },
          {
            title: "Tiket muncul di dapur",
            text: "Tiket tampil secara langsung di layar dapur dengan bunyi peringatan, tanpa perlu menyegarkan halaman.",
          },
          {
            title: "Dapur menandai status menu",
            text: "Koki mengubah status tiap item selama proses memasak, lalu pesanan ditandai siap.",
          },
          {
            title: "Pesanan disajikan",
            text: "Pesanan bergerak di antrean: Baru, Diproses, Siap, Disajikan.",
          },
        ],
      },
      { type: "h2", text: "Satu layar atau beberapa layar per stasiun" },
      {
        type: "p",
        text: "Paket POS mencakup satu layar dapur. Itu cukup untuk kafe, warung makan, atau restoran kecil dengan satu area memasak.",
      },
      {
        type: "p",
        text: "Jika dapur dan bar bekerja terpisah, paket Operations mendukung beberapa layar yang diarahkan per stasiun. Minuman muncul di bar, makanan di dapur, dan setiap tim hanya melihat item miliknya.",
      },
      {
        type: "callout",
        text: "Contoh: satu pesanan berisi dua nasi goreng, satu es teh, dan satu kopi susu. Nasi goreng tampil di layar dapur, es teh dan kopi susu tampil di layar bar. Pesanan baru dianggap siap setelah semua stasiun selesai.",
      },
      { type: "h2", text: "Perangkat yang dibutuhkan" },
      {
        type: "p",
        text: "Cukup tablet dengan browser, atau komputer dan ponsel jika Anda lebih suka. Epidom berjalan di browser, jadi tidak ada server yang perlu dipasang. Siapkan dudukan tablet yang stabil, stopkontak di dekatnya, dan koneksi internet yang andal agar pesanan masuk secara langsung.",
      },
      {
        type: "p",
        text: "Sebelum jam sibuk, coba dulu beberapa pesanan contoh dari kasir dan lihat apakah tulisan di layar cukup besar dari posisi koki berdiri. Pastikan juga volume tablet cukup keras supaya bunyi peringatan pesanan baru terdengar di tengah suara dapur.",
      },
      {
        type: "p",
        text: "Untuk nota kertas, printer thermal Bluetooth 58 mm atau 80 mm bisa dipasangkan ke kasir: struk, nota dapur, nota bar, dan label item.",
      },
    ],
    faqs: [
      {
        q: "Apa itu KDS di restoran?",
        a: "KDS adalah Kitchen Display System atau layar dapur, yaitu layar yang menampilkan pesanan masuk secara langsung menggantikan atau melengkapi nota kertas. Dengan KDS, dapur bisa melihat dan menandai status tiap menu.",
      },
      {
        q: "Apakah tablet biasa bisa dipakai sebagai layar dapur?",
        a: "Bisa. Layar dapur Epidom dibuka lewat browser di tablet, komputer, atau ponsel apa pun. Yang Anda butuhkan hanya koneksi internet dan dudukan agar layar mudah dilihat koki.",
      },
      {
        q: "Apakah nota dapur kertas harus dihentikan?",
        a: "Tidak harus. Layar dapur berjalan berdampingan dengan nota dapur dan bar yang dicetak. Anda bisa memakai keduanya dulu, lalu memutuskan sendiri apakah printernya masih diperlukan.",
      },
      {
        q: "Berapa harga layar dapur Epidom?",
        a: "Satu layar dapur termasuk di paket POS, Rp 229.000 per bulan (Rp 189.000 per bulan jika bayar tahunan), dengan percobaan gratis 14 hari. Beberapa layar per stasiun, dapur dan bar, ada di paket Operations, Rp 459.000 per bulan (Rp 379.000 jika tahunan).",
      },
      {
        q: "Apakah pesanan online juga muncul di layar dapur?",
        a: "Ya. Pesanan dari halaman toko Anda masuk ke antrean yang sama dengan pesanan dari kasir, sehingga tampil di layar dapur seperti pesanan lainnya.",
      },
    ],
    cta: {
      title: "Coba layar dapur di tablet Anda",
      text: "Paket POS dimulai dengan percobaan gratis 14 hari. Buka Epidom di tablet dapur dan coba beberapa pesanan contoh.",
      button: "Coba gratis 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "kitchen-display-system",
    locale: "en",
    group: "kitchen-display",
    kind: "feature",
    metaTitle: "Kitchen Display System (KDS) for Restaurants",
    metaDescription:
      "What a kitchen display system does, how it differs from printed tickets, and how to run a KDS on any tablet with Epidom, starting on the POS plan.",
    eyebrow: "Kitchen display",
    h1: "Kitchen Display System (KDS) for restaurants and cafés",
    lede: "A kitchen display system shows incoming orders on a screen in the kitchen in real time, so the cooks never wait for a printed ticket. Epidom includes one kitchen screen on the POS plan, and it runs on any tablet with a browser.",
    blocks: [
      { type: "h2", text: "What a kitchen display system does" },
      {
        type: "p",
        text: "A KDS is a screen, usually a tablet mounted on the wall or set at the pass, that shows each order as a ticket: the items, the options, the table number, and whether it is dine-in, takeaway or delivery. It replaces the printer-and-paper-slip routine, or sits next to it.",
      },
      {
        type: "p",
        text: "The point is speed and clarity. Orders appear in the kitchen the moment they are entered, and the dining room can see what is ready without walking back to ask.",
      },
      { type: "h2", text: "KDS versus printed kitchen tickets" },
      {
        type: "list",
        items: [
          "No lost, smudged or unreadable slips on the pass.",
          "Changes show up immediately instead of arriving as a second slip.",
          "Each item has a status, so the kitchen knows what is in progress and what is done.",
          "A sound alert announces a new order when everyone's hands are busy.",
          "No paper rolls to reorder for the kitchen.",
        ],
      },
      {
        type: "p",
        text: "You do not have to choose. Epidom works alongside printed kitchen and bar tickets, so you can keep a Bluetooth thermal printer for paper copies and add the screen, or the other way around.",
      },
      { type: "h2", text: "How the kitchen screen works in Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "The order is entered",
            text: "A server or cashier rings it up on the POS (tablet, phone or computer), or a customer places it from your store page.",
          },
          {
            title: "The ticket lands in the kitchen",
            text: "It appears on the kitchen display in real time with a sound alert, with nothing to refresh.",
          },
          {
            title: "The kitchen moves items along",
            text: "Staff update the status of each item as they cook, then the order is marked ready.",
          },
          {
            title: "Front of house serves",
            text: "The order moves through the queue: New, Preparing, Ready, Served.",
          },
        ],
      },
      { type: "h2", text: "One screen or several stations" },
      {
        type: "p",
        text: "The POS plan includes one kitchen screen. That is enough for a café, a bakery making sandwiches to order, or a small restaurant with a single prep area.",
      },
      {
        type: "p",
        text: "Once the kitchen and the bar work separately, the Operations plan supports several screens routed by station. Drinks show up at the bar, food shows up in the kitchen, and each team sees only its own items.",
      },
      {
        type: "callout",
        text: "Example: an order has two burgers, a lemonade and a flat white. The burgers appear on the kitchen screen, the drinks on the bar screen. Each station moves its own items along, and the order is only ready when every station is done.",
      },
      { type: "h2", text: "What hardware you need" },
      {
        type: "p",
        text: "Any tablet with a browser will do, or a computer or phone if you prefer. Epidom runs in the browser, so there is no server to install. Plan for a stable stand, a power outlet nearby, and a reliable internet connection so orders arrive live.",
      },
      {
        type: "p",
        text: "For paper tickets, 58 mm or 80 mm Bluetooth thermal printers can be paired to the POS for receipts, kitchen tickets, bar tickets and item labels.",
      },
    ],
    faqs: [
      {
        q: "What does KDS stand for in a restaurant?",
        a: "KDS stands for kitchen display system. It is a screen that shows orders to prepare in real time, in place of or alongside printed tickets, and lets the kitchen mark each item as it is made.",
      },
      {
        q: "Can I use a regular tablet as a kitchen screen?",
        a: "Yes. Epidom's kitchen display opens in the browser of any tablet, computer or phone. You need an internet connection and a stand that keeps the screen within sight of the cooks.",
      },
      {
        q: "Do I have to stop printing kitchen tickets?",
        a: "No. The kitchen display works alongside printed kitchen and bar tickets. You can run both while your team gets used to the screen and decide later whether you still need the printer.",
      },
      {
        q: "How much does a kitchen display cost with Epidom?",
        a: "One kitchen screen is included in the POS plan at $14.99 per month ($12.49 per month billed yearly), with a 14-day free trial. Several screens routed by station, kitchen and bar, come with the Operations plan at $29.99 per month ($24.99 billed yearly).",
      },
      {
        q: "Do online orders show up on the kitchen screen too?",
        a: "Yes. Orders placed from your store page join the same queue as walk-in orders, so they appear on the kitchen display like any other.",
      },
    ],
    cta: {
      title: "Try the kitchen screen on your tablet",
      text: "The POS plan starts with a 14-day free trial. Open Epidom on a tablet in the kitchen and run a few test orders.",
      button: "Start your 14-day trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
