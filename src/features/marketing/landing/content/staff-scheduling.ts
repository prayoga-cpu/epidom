import type { LandingPage } from "../types";

export const staffSchedulingPages: LandingPage[] = [
  {
    slug: "planning-personnel-restaurant",
    locale: "fr",
    group: "staff-scheduling",
    kind: "feature",
    metaTitle: "Planning du personnel restaurant et pointage",
    metaDescription:
      "Planning du personnel restaurant : créez les créneaux, publiez la semaine, pointez avec PIN et selfie, comparez heures faites et prévues.",
    eyebrow: "Planning du personnel",
    h1: "Planning du personnel de restaurant : créneaux, pointage, heures",
    lede: "Un bon planning du personnel de restaurant tient en trois choses : qui travaille quand, qui est réellement arrivé, et combien d'heures cela représente. Epidom les réunit dans le forfait Operations.",
    blocks: [
      { type: "h2", text: "Ce qu'un planning d'équipe doit régler au quotidien" },
      {
        type: "p",
        text: "Dans un café ou un restaurant, le planning change toutes les semaines : un congé, un échange de service, un coup de feu imprévu. Le planning sur papier ou sur un groupe de messagerie finit par se perdre, et chacun en a une version différente.",
      },
      {
        type: "p",
        text: "Ce qu'on attend d'un outil de gestion des horaires est simple : une seule version à jour que toute l'équipe peut consulter, une preuve de présence fiable, et un total d'heures prêt pour la paie.",
      },
      { type: "h2", text: "Construire le planning de la semaine" },
      {
        type: "steps",
        items: [
          {
            title: "Ajoutez votre équipe",
            text: "Donnez un rôle à chacun (manager, caissier, cuisine, serveur) et un code PIN à 4 chiffres pour la tablette partagée. Les accès aux pages suivent le rôle, et vous pouvez les ajuster personne par personne.",
          },
          {
            title: "Créez des blocs de quart",
            text: "Par exemple « Matin 07:00–15:00 » et « Soir 15:00–23:00 ». Placez-les sur la grille, ou appliquez un bloc à plusieurs personnes et plusieurs jours d'un coup.",
          },
          {
            title: "Publiez la semaine",
            text: "Chacun retrouve ses créneaux dans « Mon planning », en Mode Caisse. Si vous préférez votre propre tableau, vous pouvez aussi importer une photo du planning : toute l'équipe la voit.",
          },
        ],
      },
      { type: "h2", text: "Le pointage des salariés avec PIN, selfie et position" },
      {
        type: "p",
        text: "À l'arrivée et au départ, la personne choisit son nom sur la tablette, saisit son code PIN et prend un selfie. La position de l'appareil est enregistrée aussi, quand il la partage.",
      },
      {
        type: "p",
        text: "L'historique liste les arrivées, les départs et les absences, avec la photo prise au pointage. Vous voyez en un coup d'œil qui est là, sans avoir à relancer personne par message.",
      },
      {
        type: "callout",
        text: "Exemple : Léa est prévue de 07:00 à 15:00 et pointe à 07:05 puis à 15:10. Epidom affiche les heures effectivement faites à côté des heures prévues au planning, et vous voyez l'écart.",
      },
      { type: "h2", text: "Des heures faites au salaire" },
      {
        type: "p",
        text: "Les heures réellement pointées sont comparées aux heures du planning. À partir de la présence, Epidom calcule le salaire de chaque personne, ce qui évite de recompter les horaires à la main en fin de mois.",
      },
      {
        type: "p",
        text: "Cet outil vous donne des chiffres de présence clairs ; les règles qui s'appliquent à votre établissement (durées, majorations, convention) restent à vérifier avec votre conseil ou votre comptable.",
      },
      { type: "h2", text: "Les quarts de caisse, avec comptage des espèces" },
      {
        type: "p",
        text: "Le planning dit qui devait travailler ; le quart de caisse dit qui a tenu la caisse. À l'ouverture et à la fermeture, vous comptez les espèces : Epidom affiche le montant attendu, le montant compté et l'écart.",
      },
      {
        type: "list",
        items: [
          "Fond de caisse de départ et espèces en caisse",
          "Entrées et sorties d'espèces : pourboires, apports, dépenses, dépôts au coffre",
          "Liste de toutes les sessions, avec la personne qui l'a tenue",
        ],
      },
      { type: "h2", text: "Forfait et prix" },
      {
        type: "p",
        text: "Le personnel, le planning, le pointage et les quarts de caisse font partie du forfait Operations, à 27,99 € par mois (23,49 € par mois en annuel), hors taxes. Il comprend aussi tout le forfait POS, dont l'essai gratuit de 14 jours.",
      },
    ],
    faqs: [
      {
        q: "Comment faire un planning du personnel pour un restaurant ?",
        a: "Listez vos postes et vos plages horaires, créez des blocs de quart (matin, soir), puis placez-les sur une grille semaine par semaine. Dans Epidom, vous publiez ensuite la semaine et chaque personne la voit sur son appareil.",
      },
      {
        q: "Comment fonctionne le pointage des salariés avec Epidom ?",
        a: "La personne choisit son nom sur la tablette, saisit son code PIN et prend un selfie. La position de l'appareil est enregistrée si elle est partagée. Les arrivées et départs apparaissent dans l'historique.",
      },
      {
        q: "Peut-on comparer les heures pointées au planning ?",
        a: "Oui. Epidom affiche les heures faites à côté des heures prévues, et calcule le salaire à partir de la présence enregistrée.",
      },
      {
        q: "Combien coûte la gestion des horaires dans Epidom ?",
        a: "Elle est incluse dans le forfait Operations : 27,99 € par mois, ou 23,49 € par mois en annuel, hors taxes. Le forfait POS, à 13,99 € par mois, ne comprend pas le planning ni le pointage.",
      },
      {
        q: "Mon équipe doit-elle avoir un compte ?",
        a: "Non, un code PIN sur la tablette partagée suffit. Vous pouvez aussi inviter quelqu'un par e-mail pour qu'il se connecte avec son propre compte ; ces comptes fonctionnent pour l'instant en Mode Caisse uniquement.",
      },
    ],
    cta: {
      title: "Passez du planning papier à un planning partagé",
      text: "Le planning, le pointage et les quarts de caisse sont inclus dans le forfait Operations. Consultez les forfaits pour comparer.",
      button: "Voir les forfaits →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "jadwal-shift-karyawan",
    locale: "id",
    group: "staff-scheduling",
    kind: "feature",
    metaTitle: "Jadwal Shift Karyawan Kafe & Absensi Selfie",
    metaDescription:
      "Jadwal shift karyawan untuk kafe dan restoran: susun jadwal kerja, absensi selfie dengan PIN, bandingkan jam kerja dan hitung gaji dari absensi.",
    eyebrow: "Jadwal shift karyawan",
    h1: "Jadwal shift karyawan kafe dan restoran, lengkap dengan absensi",
    lede: "Jadwal shift yang rapi berarti semua karyawan tahu kapan masuk, Anda tahu siapa yang benar-benar hadir, dan gaji bisa dihitung dari jam kerja nyata. Epidom menyatukannya di paket Operations.",
    blocks: [
      { type: "h2", text: "Masalah jadwal kerja restoran yang sering terjadi" },
      {
        type: "p",
        text: "Jadwal kerja restoran atau kafe sering ditulis di kertas atau dikirim lewat grup WhatsApp. Lalu ada yang tukar shift, ada yang izin, dan akhirnya setiap orang punya versi jadwal sendiri. Di akhir bulan, jam kerja dihitung ulang dari ingatan.",
      },
      {
        type: "p",
        text: "Yang dibutuhkan sederhana: satu jadwal terbaru yang bisa dilihat semua karyawan, bukti kehadiran yang jelas, dan total jam kerja yang siap dipakai untuk gaji.",
      },
      { type: "h2", text: "Cara menyusun jadwal shift mingguan" },
      {
        type: "steps",
        items: [
          {
            title: "Tambahkan tim Anda",
            text: "Beri setiap orang peran (manajer, kasir, dapur, pelayan) dan PIN 4 angka untuk tablet bersama. Akses halaman mengikuti peran, dan bisa Anda ubah per orang.",
          },
          {
            title: "Buat blok shift",
            text: 'Misalnya "Pagi 07:00–15:00" dan "Sore 15:00–23:00". Taruh di tabel jadwal, atau terapkan satu blok ke beberapa orang dan beberapa hari sekaligus.',
          },
          {
            title: "Terbitkan jadwal",
            text: 'Setiap karyawan melihat shift-nya di "Jadwal Saya" pada Mode Kasir. Kalau Anda lebih suka jadwal buatan sendiri, unggah saja foto jadwalnya dan semua karyawan bisa melihatnya.',
          },
        ],
      },
      { type: "h2", text: "Absensi karyawan kafe dengan PIN dan selfie" },
      {
        type: "p",
        text: "Saat datang dan pulang, karyawan memilih namanya di tablet, memasukkan PIN, lalu mengambil selfie. Lokasi perangkat ikut tercatat jika perangkat membagikannya.",
      },
      {
        type: "p",
        text: "Riwayat absensi menampilkan jam masuk, jam pulang, dan ketidakhadiran lengkap dengan foto saat absen. Anda tidak perlu lagi menagih kabar lewat chat.",
      },
      {
        type: "p",
        text: "Untuk kafe kecil dengan satu tablet di dekat kasir, cara ini praktis: semua karyawan cukup memakai tablet yang sama setiap kali datang dan pulang, tanpa akun masing-masing.",
      },
      {
        type: "callout",
        text: "Contoh: Sari dijadwalkan 07:00–15:00, absen masuk 07:05 dan pulang 15:10. Epidom menampilkan jam kerja nyata di samping jam yang dijadwalkan, sehingga selisihnya langsung terlihat.",
      },
      { type: "h2", text: "Dari jam kerja ke gaji" },
      {
        type: "p",
        text: "Jam kerja hasil absensi dibandingkan dengan jam di jadwal. Dari data kehadiran itu, Epidom menghitung gaji tiap karyawan, jadi Anda tidak perlu menghitung ulang jam secara manual di akhir bulan.",
      },
      {
        type: "p",
        text: "Epidom memberi angka kehadiran yang jelas. Aturan ketenagakerjaan yang berlaku di usaha Anda sebaiknya tetap Anda pastikan sendiri dengan konsultan atau akuntan.",
      },
      { type: "h2", text: "Shift kasir dan hitung uang tunai" },
      {
        type: "p",
        text: "Jadwal menunjukkan siapa yang seharusnya bekerja. Shift kasir menunjukkan siapa yang memegang laci kasir. Saat buka dan tutup, Anda menghitung uang tunai, lalu Epidom menampilkan jumlah yang diharapkan, jumlah yang dihitung, dan selisihnya.",
      },
      {
        type: "list",
        items: [
          "Modal awal laci kasir dan uang tunai yang ada",
          "Uang masuk dan keluar: tip, tambahan modal, pengeluaran, setoran ke brankas",
          "Daftar semua sesi shift beserta orang yang memegangnya",
        ],
      },
      { type: "h2", text: "Paket dan harga" },
      {
        type: "p",
        text: "Karyawan, jadwal, absensi, dan shift kasir ada di paket Operations: Rp 459.000 per bulan (Rp 379.000 per bulan jika bayar tahunan), belum termasuk pajak. Paket ini juga mencakup semua fitur paket POS, termasuk uji coba gratis 14 hari.",
      },
    ],
    faqs: [
      {
        q: "Bagaimana cara membuat jadwal shift karyawan kafe?",
        a: "Tentukan blok shift (pagi, sore), lalu taruh di tabel jadwal mingguan. Di Epidom, jadwal yang sudah diterbitkan langsung terlihat oleh setiap karyawan di perangkatnya.",
      },
      {
        q: "Bagaimana absensi selfie bekerja di Epidom?",
        a: "Karyawan memilih nama di tablet, memasukkan PIN, dan mengambil selfie. Lokasi perangkat dicatat jika dibagikan. Hasilnya muncul di riwayat absensi beserta fotonya.",
      },
      {
        q: "Bisakah jam kerja nyata dibandingkan dengan jadwal?",
        a: "Bisa. Epidom menampilkan jam kerja hasil absensi di samping jam jadwal, dan menghitung gaji dari kehadiran yang tercatat.",
      },
      {
        q: "Berapa harga fitur jadwal dan absensi di Epidom?",
        a: "Termasuk di paket Operations: Rp 459.000 per bulan, atau Rp 379.000 per bulan untuk paket tahunan, belum termasuk pajak. Paket POS seharga Rp 229.000 per bulan belum mencakup jadwal dan absensi.",
      },
      {
        q: "Apakah karyawan harus punya akun sendiri?",
        a: "Tidak, PIN di tablet bersama sudah cukup. Anda juga bisa mengundang karyawan lewat email agar masuk dengan akun sendiri; saat ini akun karyawan hanya berfungsi di Mode Kasir.",
      },
    ],
    cta: {
      title: "Ganti jadwal di kertas dengan jadwal bersama",
      text: "Jadwal, absensi, dan shift kasir ada di paket Operations. Lihat paket untuk membandingkan.",
      button: "Lihat paket →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
  {
    slug: "restaurant-staff-scheduling",
    locale: "en",
    group: "staff-scheduling",
    kind: "feature",
    metaTitle: "Restaurant Staff Scheduling and Time Clock",
    metaDescription:
      "Restaurant staff scheduling made simple: build the rota, publish it, clock in with PIN and selfie, and compare hours worked against the roster.",
    eyebrow: "Staff scheduling",
    h1: "Restaurant staff scheduling: rota, time clock and hours worked",
    lede: "Good restaurant staff scheduling answers three questions: who is working when, who actually showed up, and how many hours that adds up to. Epidom covers all three in the Operations plan.",
    blocks: [
      { type: "h2", text: "What a staff rota has to solve every week" },
      {
        type: "p",
        text: "A café or restaurant rota changes constantly: a day off, a swapped shift, a rush nobody planned for. A paper schedule or a group chat soon turns into several competing versions, and nobody is sure which one is current.",
      },
      {
        type: "p",
        text: "What you want from scheduling software is simple: one up-to-date rota the whole team can open, reliable proof of who was there, and a total of hours that is ready for payroll.",
      },
      { type: "h2", text: "Build the weekly rota" },
      {
        type: "steps",
        items: [
          {
            title: "Add your team",
            text: "Give each person a role (manager, cashier, kitchen, waiter) and a 4-digit PIN for the shared tablet. Page access follows the role, and you can adjust it person by person.",
          },
          {
            title: "Create shift blocks",
            text: 'For example "Morning 7:00-15:00" and "Evening 15:00-23:00". Place them on the grid, or apply one block to several people and several days at once.',
          },
          {
            title: "Publish the week",
            text: "Each person sees their shifts under My Schedule in POS Mode. If you prefer your own layout, upload a photo of the roster instead and the whole team can see it.",
          },
        ],
      },
      { type: "h2", text: "An employee time clock for cafés: PIN, selfie, location" },
      {
        type: "p",
        text: "On arrival and departure, staff pick their name on the tablet, enter their PIN and take a selfie. The device's location is recorded too, when it shares it.",
      },
      {
        type: "p",
        text: "The log lists clock-ins, clock-outs and absences, with the photo taken at clock-in. You can see who is in without chasing anyone by text.",
      },
      {
        type: "callout",
        text: "Example: Maya is rostered 7:00-15:00 and clocks in at 7:05 and out at 15:10. Epidom shows the hours actually worked next to the hours on the roster, so the difference is visible straight away.",
      },
      { type: "h2", text: "From hours worked to salary" },
      {
        type: "p",
        text: "Clocked hours are compared with the hours on the roster. From recorded attendance, Epidom works out each person's salary, so you are not recounting hours by hand at the end of the month.",
      },
      {
        type: "p",
        text: "The tool gives you clear attendance numbers. The labor rules that apply to your business, such as overtime or breaks, are still something to confirm with your accountant or adviser.",
      },
      { type: "h2", text: "Cash shifts with cash counts" },
      {
        type: "p",
        text: "The rota says who was supposed to work; the cash shift says who ran the drawer. When you open and close, you count the cash, and Epidom shows the expected amount, the counted amount and the difference.",
      },
      {
        type: "list",
        items: [
          "Starting float and cash on hand",
          "Cash in and out: tips, float top-ups, paid-outs, safe drops",
          "A list of every session, with the person who ran it",
        ],
      },
      { type: "h2", text: "Plan and price" },
      {
        type: "p",
        text: "Staff, the rota, the time clock and cash shifts are part of the Operations plan: $29.99 per month ($24.99 per month billed yearly), before tax. It also includes everything in the POS plan, including the 14-day free trial.",
      },
    ],
    faqs: [
      {
        q: "How do I make a staff schedule for a restaurant?",
        a: "List your roles and time slots, create shift blocks such as morning and evening, and place them on a weekly grid. In Epidom you then publish the week and each person sees their shifts on their own device.",
      },
      {
        q: "How does the employee time clock work in Epidom?",
        a: "Staff pick their name on the tablet, enter their PIN and take a selfie. The device's location is recorded if it shares it. Clock-ins and clock-outs show up in the log with the photo.",
      },
      {
        q: "Can I compare hours worked with the roster?",
        a: "Yes. Epidom shows hours worked next to rostered hours and calculates salary from the recorded attendance.",
      },
      {
        q: "How much does scheduling cost in Epidom?",
        a: "It is included in the Operations plan at $29.99 per month, or $24.99 per month billed yearly, before tax. The POS plan at $14.99 per month does not include scheduling or the time clock.",
      },
      {
        q: "Does every employee need an account?",
        a: "No, a PIN on the shared tablet is enough. You can also invite someone by email so they sign in with their own account; those accounts work in POS Mode only for now.",
      },
    ],
    cta: {
      title: "Replace the paper rota with a shared one",
      text: "The rota, time clock and cash shifts are included in the Operations plan. See the plans to compare.",
      button: "See the plans →",
      target: "pricing",
    },
    updated: "2026-10-14",
  },
];
