import type { LandingPage } from "../types";

/**
 * The Claude connector (Beta). Facts come from docs/MCP.md: reading is open
 * from the Operations plan, changing data is Enterprise, and payments,
 * refunds, the till, clock-in, PINs, billing and storefront publishing are
 * never exposed. No prices are quoted here (the plans change; the pricing page
 * is the source), and the page says Beta because it is.
 */
export const claudeConnectorPages: LandingPage[] = [
  {
    slug: "claude-connector-pos",
    locale: "en",
    group: "claude-connector",
    kind: "feature",
    metaTitle: "Claude Connector for Your POS (Beta)",
    metaDescription:
      "Connect Claude to your POS and ask about sales, stock, staff and finance in plain words. Read-only from the Operations plan. How it works, what it can't do.",
    eyebrow: "Claude connector · Beta",
    h1: "Ask Claude about your POS: sales, stock, staff and finance",
    lede: "The Epidom Claude connector lets you ask Claude questions about your own restaurant or café, such as last week's margin or what to reorder, and get answers from your real POS data. Reading is included from the Operations plan. It is in Beta.",
    blocks: [
      { type: "h2", text: "What the Claude connector does" },
      {
        type: "p",
        text: "Most owners already know the numbers they want: how did we do last week, which dishes sell and which don't, what is running low. The hard part is opening four screens to find out. The Epidom connector gives Claude secure access to your store, so you ask in plain words, in your own language, and Claude reads the answer from your POS.",
      },
      {
        type: "p",
        text: "It works through the Model Context Protocol (MCP), the open standard Claude uses to talk to other apps. You add Epidom to Claude once with a single URL, sign in to your Epidom account, and approve what Claude may see. Claude then has tools for sales, orders, the menu, stock, suppliers, the roster, customers and finance reports, for one outlet or all of them.",
      },
      { type: "h2", text: "What you can ask" },
      {
        type: "list",
        items: [
          "“How did we do last week compared with the week before?” Claude reads revenue, orders, average ticket and profit, and points out what changed.",
          "“Why was margin down on Tuesday?” It looks at the sales breakdown by channel and hour, the best sellers and the costs behind them.",
          "“What do I need to reorder?” It checks the stock alerts and prepares a proposed order per supplier, without placing anything.",
          "“Which dishes should I rethink?” It reviews your menu by profit and popularity and suggests price, placement or recipe changes.",
          "“Who worked overtime this month?” It reads hours and overtime from the roster, for managers and owners.",
        ],
      },
      {
        type: "p",
        text: "Epidom also ships ready-made requests you can pick inside Claude: a weekly business review, a restock check, a menu review and a roster plan. They simply walk Claude through the right tools.",
      },
      { type: "h2", text: "Reading is open, changing is Enterprise" },
      {
        type: "p",
        text: "Any store on the Operations plan or higher can connect Claude and read its data. Letting Claude change things is part of the Enterprise plan. With that option, and only if you tick “Also allow changes” on the consent screen, Claude can adjust stock, record waste and expenses, edit menu items, prepare and receive supplier orders, draft and publish rosters, decide overtime, and add or update customers. It shows you what it is about to do and asks before each change, and every change appears in your Activity log.",
      },
      {
        type: "callout",
        text: "Plans at a glance: POS and Free stores cannot connect Claude. Operations can connect it and read. Enterprise can read and, with your approval, make changes.",
      },
      { type: "h2", text: "Connect Claude to Epidom, step by step" },
      {
        type: "steps",
        items: [
          {
            title: "Open the Claude connector card in Epidom",
            text: "In your Epidom profile, open the Claude card and copy the connector URL. It is https://www.epidom.fr/api/mcp. Always use the www address, because the bare domain redirects and Claude drops its sign-in on a redirect.",
          },
          {
            title: "Add it as a custom connector in Claude",
            text: "In claude.ai or the Claude desktop app, go to Settings, then Connectors, then Add custom connector, and paste the URL. In Claude Code, run: claude mcp add --transport http epidom https://www.epidom.fr/api/mcp",
          },
          {
            title: "Sign in and choose what Claude may do",
            text: "Claude sends you to an Epidom screen that names the app, shows the stores it can open and, on Enterprise, offers the “Also allow changes” box, which is off by default. Approve it.",
          },
          {
            title: "Ask your first question",
            text: "Try “Give me a weekly review of my store”. You can disconnect at any time from your Epidom profile, and the access stops immediately.",
          },
        ],
      },
      { type: "h2", text: "What Claude cannot do" },
      {
        type: "p",
        text: "Some things stay inside the Epidom app on purpose, because they move money or identify people. The connector never exposes them.",
      },
      {
        type: "list",
        items: [
          "Taking payments, refunds, cancelling or merging bills, and the till (shifts and cash).",
          "Clocking in or out, staff PINs, pay settings, roles and invitations.",
          "Billing and plan changes, deleting or transferring a store, and publishing your storefront.",
          "Sending messages to your customers or suppliers.",
        ],
      },
      {
        type: "p",
        text: "A sale is also never edited or deleted from Claude: orders are an immutable ledger. Customer contact details are masked in what Claude sees.",
      },
      { type: "h2", text: "Security and control" },
      {
        type: "p",
        text: "Epidom is its own sign-in provider for the connector, using OAuth 2.1 with PKCE. Access tokens last one hour, and the connection is checked on every request, so a plan change, a deactivated staff member or a revoked connection takes effect on the next question. Staff who sign in with their own account see only what their role and page access allows. Epidom records which tool was called, never your questions or the answers.",
      },
      { type: "h2", text: "A Beta, said plainly" },
      {
        type: "p",
        text: "The connector is in Beta. It works with claude.ai, the Claude desktop app and Claude Code, but we are still testing it with pilot stores, and charts inside Claude are not available yet. Tell us what breaks or what you wish it did. Claude runs on your own Claude plan, and Epidom does not charge extra for the connector on Operations.",
      },
    ],
    faqs: [
      {
        q: "Which Epidom plans include the Claude connector?",
        a: "Reading your data from Claude is included from the Operations plan. Letting Claude change data, such as stock, menu items, supplier orders or rosters, is part of Enterprise. Stores on the Free or POS plan cannot connect Claude yet.",
      },
      {
        q: "Can Claude change or delete my sales?",
        a: "No. Orders are an immutable ledger, so sales are never edited or deleted from Claude. Payments, refunds and the till also stay inside the Epidom app. On Enterprise, Claude can make a limited set of other changes, only if you allow them, and it asks before each one.",
      },
      {
        q: "Is it safe to give Claude access to my store?",
        a: "You control it. You sign in to Epidom yourself, choose which stores Claude can open, and leave changes switched off unless you want them. Access is checked on every request, staff accounts keep their own limits, and you can disconnect from your profile at any time.",
      },
      {
        q: "Does it work with ChatGPT or other AI assistants?",
        a: "The connector is built and tested for Claude. It uses the open MCP standard, so other tools that support remote MCP servers may be able to connect, but we have not tested them and do not support them yet.",
      },
      {
        q: "Does the Claude connector cost extra?",
        a: "Epidom does not charge extra for it on the plans that include it. You use your own Claude plan, and Epidom only answers Claude's requests. Check the pricing page for the current plans.",
      },
    ],
    cta: {
      title: "Run your POS by asking",
      text: "See which plan includes the Claude connector, start with the POS trial, and connect Claude once your store is on Operations.",
      button: "See plans →",
      target: "pricing",
    },
    updated: "2026-11-04",
  },
  {
    slug: "connecteur-claude-caisse",
    locale: "fr",
    group: "claude-connector",
    kind: "feature",
    metaTitle: "Connecteur Claude pour votre caisse (bêta)",
    metaDescription:
      "Connectez Claude à votre caisse et interrogez ventes, stocks, planning et finances en langage courant. Lecture dès l'offre Operations. Ses limites.",
    eyebrow: "Connecteur Claude · bêta",
    h1: "Interrogez Claude sur votre caisse\u00a0: ventes, stocks, équipe, finances",
    lede: "Le connecteur Claude d'Epidom vous laisse poser vos questions à Claude sur votre restaurant ou votre café, comme la marge de la semaine dernière ou ce qu'il faut recommander, et obtenir des réponses tirées de vos vraies données de caisse. La lecture est incluse dès l'offre Operations. Il est en bêta.",
    blocks: [
      { type: "h2", text: "Ce que fait le connecteur Claude" },
      {
        type: "p",
        text: "La plupart des gérants savent ce qu'ils veulent savoir\u00a0: comment s'est passée la semaine, quels plats se vendent, ce qui manque en stock. Le plus pénible est d'ouvrir quatre écrans pour le trouver. Le connecteur Epidom donne à Claude un accès sécurisé à votre établissement\u00a0: vous posez la question en langage courant, dans votre langue, et Claude lit la réponse dans votre caisse.",
      },
      {
        type: "p",
        text: "Il fonctionne grâce au Model Context Protocol (MCP), le standard ouvert que Claude utilise pour parler à d'autres applications. Vous ajoutez Epidom à Claude une seule fois avec une adresse, vous vous connectez à votre compte Epidom et vous validez ce que Claude peut voir. Claude dispose alors d'outils pour les ventes, les commandes, la carte, les stocks, les fournisseurs, le planning, les clients et les rapports financiers, pour un établissement ou pour tous.",
      },
      { type: "h2", text: "Ce que vous pouvez demander" },
      {
        type: "list",
        items: [
          "«\u00a0Comment s'est passée la semaine par rapport à la précédente\u00a0?\u00a0» Claude lit le chiffre d'affaires, les commandes, le ticket moyen et le bénéfice, et signale ce qui a bougé.",
          "«\u00a0Pourquoi la marge a-t-elle baissé mardi\u00a0?\u00a0» Il regarde la répartition des ventes par canal et par heure, les meilleures ventes et les coûts qui les accompagnent.",
          "«\u00a0Que dois-je recommander\u00a0?\u00a0» Il consulte les alertes de stock et prépare une commande proposée par fournisseur, sans rien passer.",
          "«\u00a0Quels plats faut-il repenser\u00a0?\u00a0» Il passe votre carte en revue selon le bénéfice et la popularité, et propose des changements de prix, de place ou de recette.",
          "«\u00a0Qui a fait des heures supplémentaires ce mois-ci\u00a0?\u00a0» Il lit les heures et les heures supplémentaires du planning, pour les responsables et les propriétaires.",
        ],
      },
      {
        type: "p",
        text: "Epidom propose aussi des demandes toutes prêtes à choisir dans Claude\u00a0: un bilan hebdomadaire, un contrôle des réassorts, une revue de la carte et un plan de planning. Elles guident simplement Claude vers les bons outils.",
      },
      { type: "h2", text: "La lecture est ouverte, la modification est Enterprise" },
      {
        type: "p",
        text: "Tout établissement sur l'offre Operations ou supérieure peut connecter Claude et lire ses données. Laisser Claude modifier des choses fait partie de l'offre Enterprise. Avec cette option, et seulement si vous cochez «\u00a0Autoriser aussi les modifications\u00a0» sur l'écran de consentement, Claude peut ajuster les stocks, déclarer des pertes et des dépenses, modifier la carte, préparer et réceptionner des commandes fournisseurs, préparer et publier des plannings, trancher les heures supplémentaires, et ajouter ou mettre à jour des clients. Il vous montre ce qu'il s'apprête à faire et demande avant chaque modification, qui apparaît dans votre journal d'activité.",
      },
      {
        type: "callout",
        text: "En résumé\u00a0: les établissements Free et POS ne peuvent pas connecter Claude. Operations le connecte et lit. Enterprise lit et, avec votre accord, modifie.",
      },
      { type: "h2", text: "Connecter Claude à Epidom, pas à pas" },
      {
        type: "steps",
        items: [
          {
            title: "Ouvrez la carte Claude dans Epidom",
            text: "Dans votre profil Epidom, ouvrez la carte Claude et copiez l'adresse du connecteur\u00a0: https://www.epidom.fr/api/mcp. Utilisez toujours l'adresse en www, car le domaine nu redirige et Claude perd sa connexion lors d'une redirection.",
          },
          {
            title: "Ajoutez-le comme connecteur personnalisé dans Claude",
            text: "Dans claude.ai ou l'application Claude pour ordinateur, ouvrez Paramètres, puis Connecteurs, puis Ajouter un connecteur personnalisé, et collez l'adresse. Dans Claude Code, lancez\u00a0: claude mcp add --transport http epidom https://www.epidom.fr/api/mcp",
          },
          {
            title: "Connectez-vous et choisissez ce que Claude peut faire",
            text: "Claude vous envoie vers un écran Epidom qui nomme l'application, liste les établissements qu'elle peut ouvrir et, en Enterprise, propose la case «\u00a0Autoriser aussi les modifications\u00a0», décochée par défaut. Validez.",
          },
          {
            title: "Posez votre première question",
            text: "Essayez «\u00a0Fais-moi le bilan de la semaine de mon établissement\u00a0». Vous pouvez vous déconnecter à tout moment depuis votre profil Epidom, et l'accès s'arrête aussitôt.",
          },
        ],
      },
      { type: "h2", text: "Ce que Claude ne peut pas faire" },
      {
        type: "p",
        text: "Certaines choses restent volontairement dans l'application Epidom, parce qu'elles touchent à l'argent ou identifient des personnes. Le connecteur ne les expose jamais.",
      },
      {
        type: "list",
        items: [
          "Encaisser, rembourser, annuler ou fusionner des additions, et la caisse (services et espèces).",
          "Pointer, les codes PIN, la rémunération, les rôles et les invitations du personnel.",
          "La facturation et le changement d'offre, la suppression ou le transfert d'un établissement, et la publication de votre vitrine.",
          "L'envoi de messages à vos clients ou à vos fournisseurs.",
        ],
      },
      {
        type: "p",
        text: "Une vente n'est jamais modifiée ni supprimée depuis Claude non plus\u00a0: les commandes forment un registre qu'on ne réécrit pas. Les coordonnées des clients sont masquées dans ce que Claude voit.",
      },
      { type: "h2", text: "Sécurité et contrôle" },
      {
        type: "p",
        text: "Epidom est son propre fournisseur de connexion pour le connecteur, avec OAuth 2.1 et PKCE. Les jetons d'accès durent une heure et la connexion est vérifiée à chaque requête\u00a0: un changement d'offre, un membre du personnel désactivé ou une connexion révoquée s'applique dès la question suivante. Le personnel qui se connecte avec son propre compte ne voit que ce que son rôle et ses accès permettent. Epidom enregistre quel outil a été appelé, jamais vos questions ni les réponses.",
      },
      { type: "h2", text: "Une bêta, dite franchement" },
      {
        type: "p",
        text: "Le connecteur est en bêta. Il fonctionne avec claude.ai, l'application Claude pour ordinateur et Claude Code, mais nous le testons encore avec des établissements pilotes, et les graphiques dans Claude ne sont pas encore disponibles. Dites-nous ce qui casse ou ce que vous aimeriez qu'il fasse. Claude fonctionne avec votre propre abonnement Claude, et Epidom ne facture pas de supplément pour le connecteur sur l'offre Operations.",
      },
    ],
    faqs: [
      {
        q: "Quelles offres Epidom incluent le connecteur Claude\u00a0?",
        a: "La lecture de vos données depuis Claude est incluse dès l'offre Operations. Laisser Claude modifier des données, comme les stocks, la carte, les commandes fournisseurs ou les plannings, fait partie d'Enterprise. Les établissements en offre Free ou POS ne peuvent pas encore connecter Claude.",
      },
      {
        q: "Claude peut-il modifier ou supprimer mes ventes\u00a0?",
        a: "Non. Les commandes forment un registre qu'on ne réécrit pas\u00a0: une vente n'est jamais modifiée ni supprimée depuis Claude. Les paiements, les remboursements et la caisse restent aussi dans l'application Epidom. En Enterprise, Claude peut faire un nombre limité d'autres modifications, seulement si vous les autorisez, et il demande avant chacune.",
      },
      {
        q: "Est-ce sûr de donner l'accès de mon établissement à Claude\u00a0?",
        a: "Vous gardez la main. Vous vous connectez vous-même à Epidom, vous choisissez les établissements que Claude peut ouvrir, et vous laissez les modifications désactivées si vous n'en voulez pas. L'accès est vérifié à chaque requête, les comptes du personnel gardent leurs propres limites, et vous pouvez vous déconnecter depuis votre profil à tout moment.",
      },
      {
        q: "Cela fonctionne-t-il avec ChatGPT ou d'autres assistants\u00a0?",
        a: "Le connecteur est conçu et testé pour Claude. Il repose sur le standard ouvert MCP, donc d'autres outils compatibles avec les serveurs MCP distants peuvent s'y connecter, mais nous ne les avons pas testés et ne les prenons pas encore en charge.",
      },
      {
        q: "Le connecteur Claude coûte-t-il un supplément\u00a0?",
        a: "Epidom ne facture pas de supplément sur les offres qui l'incluent. Vous utilisez votre propre abonnement Claude, et Epidom répond seulement aux requêtes de Claude. Consultez la page des tarifs pour les offres en vigueur.",
      },
    ],
    cta: {
      title: "Pilotez votre caisse en posant des questions",
      text: "Voyez quelle offre inclut le connecteur Claude, commencez par l'essai de la caisse et connectez Claude quand votre établissement est sur Operations.",
      button: "Voir les offres\u00a0→",
      target: "pricing",
    },
    updated: "2026-11-04",
  },
  {
    slug: "konektor-claude-kasir",
    locale: "id",
    group: "claude-connector",
    kind: "feature",
    metaTitle: "Konektor Claude untuk Kasir Anda (Beta)",
    metaDescription:
      "Hubungkan Claude ke kasir Anda dan tanya penjualan, stok, jadwal, dan keuangan dengan bahasa sehari-hari. Baca data mulai paket Operations. Batasannya.",
    eyebrow: "Konektor Claude · Beta",
    h1: "Tanya Claude soal kasir Anda: penjualan, stok, staf, dan keuangan",
    lede: "Konektor Claude Epidom memungkinkan Anda bertanya ke Claude tentang kafe atau restoran Anda sendiri, misalnya margin minggu lalu atau apa yang perlu dipesan ulang, dan mendapat jawaban dari data kasir yang asli. Akses baca sudah termasuk mulai paket Operations. Fitur ini masih Beta.",
    blocks: [
      { type: "h2", text: "Apa yang dilakukan konektor Claude" },
      {
        type: "p",
        text: "Kebanyakan pemilik sudah tahu apa yang ingin diketahui: bagaimana minggu lalu, menu apa yang laku dan tidak, bahan apa yang menipis. Yang merepotkan adalah membuka empat layar untuk mencarinya. Konektor Epidom memberi Claude akses aman ke toko Anda, jadi Anda bertanya dengan bahasa sehari-hari, dan Claude membaca jawabannya dari data kasir Anda.",
      },
      {
        type: "p",
        text: "Konektor ini bekerja lewat Model Context Protocol (MCP), standar terbuka yang dipakai Claude untuk berbicara dengan aplikasi lain. Anda menambahkan Epidom ke Claude sekali saja dengan satu URL, masuk ke akun Epidom, lalu menyetujui apa yang boleh dilihat Claude. Setelah itu Claude punya alat untuk penjualan, pesanan, menu, stok, pemasok, jadwal staf, pelanggan, dan laporan keuangan, untuk satu outlet atau semuanya.",
      },
      { type: "h2", text: "Apa saja yang bisa ditanyakan" },
      {
        type: "list",
        items: [
          "“Bagaimana minggu lalu dibanding minggu sebelumnya?” Claude membaca omzet, jumlah pesanan, rata-rata nota, dan laba, lalu menunjukkan apa yang berubah.",
          "“Kenapa margin turun hari Selasa?” Claude melihat rincian penjualan per kanal dan per jam, menu terlaris, dan biaya di baliknya.",
          "“Apa yang perlu saya pesan ulang?” Claude memeriksa peringatan stok dan menyiapkan usulan pesanan per pemasok, tanpa memesan apa pun.",
          "“Menu mana yang perlu dipikirkan ulang?” Claude menilai menu berdasarkan laba dan popularitas, lalu menyarankan perubahan harga, posisi, atau resep.",
          "“Siapa yang lembur bulan ini?” Claude membaca jam kerja dan lembur dari jadwal staf, untuk manajer dan pemilik.",
        ],
      },
      {
        type: "p",
        text: "Epidom juga menyediakan permintaan siap pakai yang bisa dipilih di dalam Claude: tinjauan bisnis mingguan, cek stok yang perlu dipesan, tinjauan menu, dan rencana jadwal. Isinya hanya mengarahkan Claude ke alat yang tepat.",
      },
      { type: "h2", text: "Membaca terbuka, mengubah khusus Enterprise" },
      {
        type: "p",
        text: "Toko mana pun di paket Operations atau lebih tinggi bisa menghubungkan Claude dan membaca datanya. Mengizinkan Claude mengubah data adalah bagian dari paket Enterprise. Dengan opsi itu, dan hanya jika Anda mencentang “Izinkan juga perubahan” di layar persetujuan, Claude bisa menyesuaikan stok, mencatat bahan terbuang dan pengeluaran, mengubah menu, menyiapkan dan menerima pesanan pemasok, menyusun dan menerbitkan jadwal, memutuskan lembur, serta menambah atau memperbarui pelanggan. Claude menunjukkan apa yang akan dilakukan dan bertanya dulu sebelum setiap perubahan, dan semuanya tercatat di Log aktivitas.",
      },
      {
        type: "callout",
        text: "Ringkasnya: toko di paket Free dan POS belum bisa menghubungkan Claude. Operations bisa menghubungkan dan membaca. Enterprise bisa membaca dan, dengan persetujuan Anda, mengubah.",
      },
      { type: "h2", text: "Menghubungkan Claude ke Epidom, langkah demi langkah" },
      {
        type: "steps",
        items: [
          {
            title: "Buka kartu Claude di Epidom",
            text: "Di profil Epidom, buka kartu Claude dan salin URL konektor: https://www.epidom.fr/api/mcp. Selalu pakai alamat www, karena domain tanpa www dialihkan dan Claude kehilangan login saat pengalihan.",
          },
          {
            title: "Tambahkan sebagai konektor kustom di Claude",
            text: "Di claude.ai atau aplikasi Claude desktop, buka Pengaturan, lalu Konektor, lalu Tambah konektor kustom, dan tempel URL-nya. Di Claude Code, jalankan: claude mcp add --transport http epidom https://www.epidom.fr/api/mcp",
          },
          {
            title: "Masuk dan pilih apa yang boleh dilakukan Claude",
            text: "Claude membawa Anda ke layar Epidom yang menyebut aplikasinya, menampilkan toko yang bisa dibuka, dan di Enterprise menawarkan kotak “Izinkan juga perubahan”, yang tidak tercentang secara bawaan. Setujui.",
          },
          {
            title: "Ajukan pertanyaan pertama",
            text: "Coba “Buatkan tinjauan mingguan toko saya”. Anda bisa memutus koneksi kapan saja dari profil Epidom, dan aksesnya langsung berhenti.",
          },
        ],
      },
      { type: "h2", text: "Yang tidak bisa dilakukan Claude" },
      {
        type: "p",
        text: "Beberapa hal sengaja tetap di dalam aplikasi Epidom karena menyangkut uang atau identitas orang. Konektor tidak pernah membukanya.",
      },
      {
        type: "list",
        items: [
          "Menerima pembayaran, refund, membatalkan atau menggabungkan tagihan, dan kasir (shift dan kas).",
          "Absen masuk atau pulang, PIN staf, pengaturan gaji, peran, dan undangan.",
          "Tagihan dan ganti paket, menghapus atau memindahkan toko, dan menerbitkan etalase.",
          "Mengirim pesan ke pelanggan atau pemasok.",
        ],
      },
      {
        type: "p",
        text: "Penjualan juga tidak pernah diubah atau dihapus dari Claude: pesanan adalah catatan yang tidak ditulis ulang. Kontak pelanggan disamarkan dalam apa yang dilihat Claude.",
      },
      { type: "h2", text: "Keamanan dan kendali" },
      {
        type: "p",
        text: "Epidom menjadi penyedia login sendiri untuk konektor ini, memakai OAuth 2.1 dengan PKCE. Token akses berlaku satu jam, dan koneksi diperiksa di setiap permintaan, jadi perubahan paket, staf yang dinonaktifkan, atau koneksi yang dicabut langsung berlaku pada pertanyaan berikutnya. Staf yang masuk dengan akunnya sendiri hanya melihat yang diizinkan peran dan aksesnya. Epidom mencatat alat mana yang dipanggil, tidak pernah pertanyaan atau jawaban Anda.",
      },
      { type: "h2", text: "Masih Beta, kami katakan terus terang" },
      {
        type: "p",
        text: "Konektor ini masih Beta. Ia berjalan dengan claude.ai, aplikasi Claude desktop, dan Claude Code, tetapi kami masih mengujinya bersama toko percontohan, dan grafik di dalam Claude belum tersedia. Beri tahu kami apa yang rusak atau apa yang Anda harapkan. Claude memakai paket Claude Anda sendiri, dan Epidom tidak menarik biaya tambahan untuk konektor di paket Operations.",
      },
    ],
    faqs: [
      {
        q: "Paket Epidom mana yang termasuk konektor Claude?",
        a: "Membaca data Anda dari Claude sudah termasuk mulai paket Operations. Mengizinkan Claude mengubah data, seperti stok, menu, pesanan pemasok, atau jadwal, adalah bagian dari Enterprise. Toko di paket Free atau POS belum bisa menghubungkan Claude.",
      },
      {
        q: "Apakah Claude bisa mengubah atau menghapus penjualan saya?",
        a: "Tidak. Pesanan adalah catatan yang tidak ditulis ulang, jadi penjualan tidak pernah diubah atau dihapus dari Claude. Pembayaran, refund, dan kasir juga tetap di aplikasi Epidom. Di Enterprise, Claude bisa melakukan sejumlah perubahan lain, hanya jika Anda mengizinkan, dan selalu bertanya dulu.",
      },
      {
        q: "Apakah aman memberi Claude akses ke toko saya?",
        a: "Anda yang mengendalikan. Anda sendiri yang masuk ke Epidom, memilih toko yang boleh dibuka Claude, dan membiarkan perubahan tetap mati bila tidak diperlukan. Akses diperiksa di setiap permintaan, akun staf tetap punya batasnya sendiri, dan Anda bisa memutus koneksi dari profil kapan saja.",
      },
      {
        q: "Apakah bisa dipakai dengan ChatGPT atau asisten AI lain?",
        a: "Konektor ini dibuat dan diuji untuk Claude. Ia memakai standar terbuka MCP, sehingga alat lain yang mendukung server MCP jarak jauh mungkin bisa terhubung, tetapi belum kami uji dan belum kami dukung.",
      },
      {
        q: "Apakah konektor Claude dikenai biaya tambahan?",
        a: "Epidom tidak menarik biaya tambahan di paket yang menyertakannya. Anda memakai paket Claude sendiri, dan Epidom hanya menjawab permintaan Claude. Lihat halaman harga untuk paket yang berlaku.",
      },
    ],
    cta: {
      title: "Jalankan kasir Anda dengan bertanya",
      text: "Lihat paket mana yang menyertakan konektor Claude, mulai dari uji coba kasir, lalu hubungkan Claude saat toko Anda sudah di paket Operations.",
      button: "Lihat paket →",
      target: "pricing",
    },
    updated: "2026-11-04",
  },
];
