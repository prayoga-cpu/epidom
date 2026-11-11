import type { StaticImageData } from "next/image";
import type { Locale } from "@/components/lang/i18n-provider";
// Static imports give next/image each file's size and blur placeholder, and the
// optimiser serves AVIF/WebP at each width. In Vitest they resolve to plain URL
// strings, so every layout renders these with `fill` inside a sized box.
import posCashier from "../../../../../public/images/screens/pos-cashier.png";
import posOrderQueue from "../../../../../public/images/screens/pos-order-queue.png";
import posCustomerDisplay from "../../../../../public/images/screens/pos-customer-display.png";
import storefrontMenu from "../../../../../public/images/screens/storefront-menu.png";
import storefrontCheckout from "../../../../../public/images/screens/storefront-checkout.png";
import backOfficeStock from "../../../../../public/images/screens/back-office-stock.png";
import backOfficeFinance from "../../../../../public/images/screens/back-office-finance.png";
import backOfficeSchedule from "../../../../../public/images/screens/back-office-schedule.png";
import posClockIn from "../../../../../public/images/screens/pos-clock-in.png";
import backOfficeFinanceTabs from "../../../../../public/images/screens/back-office-finance-tabs.png";

/**
 * Real Epidom screens (captured 2026-11-11 on v3.46.0, dark theme, 1440x900
 * at 1.5x, phone captures 390 wide at 2.5x) from the public demo café ("Your
 * Café", src/lib/demo/): every figure is its sample data, so no real customer
 * or account shows. Shown on the home page, /products and the sign-in / sign-up
 * pages. Not mockups.
 *
 * public/images/screens/ also holds analytics.png and kds.png (the dashboard
 * and the kitchen screen), captured for the "who it's for" cards and not wired
 * yet, and back-office-finance.png (the Finance page), shown cropped to its
 * figures; back-office-finance-tabs.png (just the report tabs strip) is no longer shown. website-home.png is the
 * source of public/images/og-image.png.
 */
export interface ProductScreen {
  src: StaticImageData;
  /** Phone captures are portrait and get a phone-shaped frame, not a window. */
  device: "desktop" | "phone";
  alt: Record<Locale, string>;
  /** Show only this rectangle of the capture, in the file's own pixels. */
  crop?: { x: number; y: number; w: number; h: number };
}

export const PRODUCT_SCREENS = {
  posCashier: {
    src: posCashier,
    device: "desktop",
    alt: {
      fr: "L'écran de caisse d'Epidom : la catégorie Café à gauche et, à droite, l'addition en cours (sur place) avec un flat white et un iced latte, un total de 8,30 €, et les boutons Enregistrer, Imprimer et Encaisser.",
      en: "Epidom's POS cashier: the Coffee category on the left and, on the right, the current dine-in bill with a flat white and an iced latte, an €8.30 total, and Save Bill, Print Bill and Charge buttons.",
      id: "Layar kasir POS Epidom: kategori Kopi di kiri dan, di kanan, tagihan makan di tempat dengan flat white dan iced latte, total €8,30, serta tombol Simpan, Cetak, dan Bayar.",
    },
  },
  posOrderQueue: {
    src: posOrderQueue,
    device: "desktop",
    alt: {
      fr: "La file des commandes : onglets Caisse, Commande en ligne et Historique, les commandes par numéro et par heure, et les filtres Confirmées, En préparation, Prêtes et Enregistrées.",
      en: "The order queue: POS, Online ordering and Log tabs, orders by number and time, and filters for confirmed, in production, ready and saved orders.",
      id: "Antrian pesanan: tab Kasir, Pesanan online, dan Riwayat, pesanan menurut nomor dan jam, serta filter dikonfirmasi, diproses, siap, dan disimpan.",
    },
  },
  posCustomerDisplay: {
    src: posCustomerDisplay,
    device: "desktop",
    alt: {
      fr: "L'écran client : l'article qui vient d'être ajouté (un iced latte, 4,50 €), la commande avec son total de 8,30 €, et un bouton pour recevoir le ticket sur WhatsApp.",
      en: "The customer screen: the item just added (an iced latte, €4.50), the order with its €8.30 total, and a button to get the receipt on WhatsApp.",
      id: "Layar pelanggan: item yang baru ditambahkan (iced latte, €4,50), pesanan dengan total €8,30, dan tombol untuk menerima struk lewat WhatsApp.",
    },
  },
  storefrontMenu: {
    src: storefrontMenu,
    device: "phone",
    alt: {
      fr: "La page de commande mobile d'un café sur téléphone : les catégories Café, Viennoiserie et Brunch, des articles avec leurs prix et un bouton d'ajout.",
      en: "A café's Phone Orders page on a phone: Coffee, Pastry and Brunch categories, items with their prices and an add button.",
      id: "Halaman pesan lewat HP sebuah kafe di ponsel: kategori Kopi, Roti, dan Brunch, item dengan harganya dan tombol tambah.",
    },
  },
  storefrontCheckout: {
    src: storefrontCheckout,
    device: "phone",
    alt: {
      fr: "Le panier d'une commande depuis un téléphone : l'article choisi, sa quantité, le sous-total et le bouton pour passer aux détails de la commande.",
      en: "The cart when ordering from a phone: the chosen item, its quantity, the subtotal and the button to continue to the order details.",
      id: "Keranjang saat memesan dari ponsel: item yang dipilih, jumlahnya, subtotal, dan tombol untuk lanjut ke detail pesanan.",
    },
  },
  backOfficeStock: {
    src: backOfficeStock,
    device: "desktop",
    alt: {
      fr: "Le tableau de bord : la gestion des stocks, 14 articles avec leur niveau en barre, dont deux en rouge sous leur seuil (poudre de matcha, lait d'avoine).",
      en: "The Store Dashboard stock page: 14 items with their level as a bar, two in red below their minimum (matcha powder, oat milk).",
      id: "Halaman stok Dasbor Toko: 14 item dengan level berupa bar, dua berwarna merah di bawah batas minimum (bubuk matcha, susu oat).",
    },
  },
  // The Finance page's header, filters and eight figures (revenue to waste), without the
  // sidebars (2160x1350 capture; the dev-tools badge sits outside this rectangle).
  backOfficeFinance: {
    src: backOfficeFinance,
    device: "desktop",
    crop: { x: 445, y: 20, w: 1690, h: 940 },
    alt: {
      fr: "Les rapports financiers du tableau de bord : chiffre d'affaires de 2 584,30 € sur 230 commandes, ventes nettes, marge brute de 75,9 %, bénéfice net, coût des marchandises, taxes, frais et pertes.",
      en: "The Store Dashboard finance reports: €2,584.30 revenue from 230 orders, net sales, a 75.9% gross margin, net profit, cost of goods, tax, fees and waste.",
      id: "Laporan keuangan Dasbor Toko: pendapatan €2.584,30 dari 230 pesanan, penjualan bersih, margin kotor 75,9%, laba bersih, harga pokok, pajak, biaya, dan limbah.",
    },
  },
  // The report tabs of the Finance page, as a strip.
  backOfficeFinanceTabs: {
    src: backOfficeFinanceTabs,
    device: "desktop",
    // The strip's right edge carries a dev-tools badge in the capture: cropped off.
    crop: { x: 0, y: 0, w: 1560, h: 108 },
    alt: {
      fr: "Les rapports financiers du tableau de bord : bilan, quotidien, dépenses, par canal, par moyen de paiement et tendances de vente, chacun dans son onglet.",
      en: "The Store Dashboard finance reports: P&L statement, daily, expenses, by channel, payment method and sales patterns, each on its own tab.",
      id: "Laporan keuangan Dasbor Toko: laba rugi, harian, pengeluaran, per kanal, metode pembayaran, dan pola penjualan, masing-masing di tabnya sendiri.",
    },
  },
  // The Work Schedule page: the week's roster by staff and shift block, days off included
  // (2400x1600 capture; the dev-tools badges sit below the crop and the sidebar left of it).
  backOfficeSchedule: {
    src: backOfficeSchedule,
    device: "desktop",
    crop: { x: 170, y: 40, w: 2190, h: 1300 },
    alt: {
      fr: "Le planning du personnel dans le tableau de bord : la semaine du 9 au 15 novembre par personne, avec les blocs Matin et Après-midi publiés et les jours de repos.",
      en: "The Store Dashboard work schedule: the week of 9 to 15 November by person, with published Morning and Afternoon shift blocks and days off.",
      id: "Jadwal kerja di Dasbor Toko: pekan 9 sampai 15 November per orang, dengan blok shift Pagi dan Siang yang dipublikasikan serta hari libur.",
    },
  },
  // POS Mode, Clock In / Out: a staff member's selfie step on a phone (the camera shows a
  // stock photo of a bartender, the demo has no staff camera).
  posClockIn: {
    src: posClockIn,
    device: "phone",
    alt: {
      fr: "L'écran de pointage de la caisse sur téléphone : « Clock In » avec l'aperçu de la caméra et le bouton Prendre la photo, pour le selfie d'arrivée.",
      en: "The POS Clock In screen on a phone: the camera preview and a Take Photo button for the arrival selfie.",
      id: "Layar absen masuk POS di ponsel: pratinjau kamera dan tombol Ambil Foto untuk selfie kehadiran.",
    },
  },
} as const satisfies Record<string, ProductScreen>;

export type ProductScreenKey = keyof typeof PRODUCT_SCREENS;
