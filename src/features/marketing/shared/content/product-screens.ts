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
import posMenuDrawer from "../../../../../public/images/screens/pos-menu-drawer.png";

/**
 * Real Epidom screens (captured 13.10.2026 on v3.11.0, dark theme), shown on
 * the home page, /products and the sign-in / sign-up pages. Not mockups.
 *
 * public/images/screens/ also holds captures that are NOT shown whole:
 * back-office-finance.png (the test store's P&L reads €62 million, retake it
 * on realistic numbers before showing any figure from it) and
 * pos-menu-drawer.png (it carries the owner's account block) appear only as
 * CROPS (`crop`) of the part with no figures and no account details: the
 * report tabs and the three modes. website-home.png is the source of
 * public/images/og-image.png. A customer's phone in the order queue is blurred.
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
      fr: "L'écran de caisse d'Epidom : une catégorie du menu à gauche et, à droite, l'addition en cours (sur place) avec un pain au chocolat et un croissant, un total de 7,00 €, et les boutons Enregistrer, Imprimer et Encaisser.",
      en: "Epidom's POS cashier: a menu category on the left and, on the right, the current dine-in bill with a pain au chocolat and a croissant, a €7.00 total, and Save Bill, Print Bill and Charge buttons.",
      id: "Layar kasir POS Epidom: kategori menu di kiri dan, di kanan, tagihan makan di tempat yang sedang berjalan berisi pain au chocolat dan croissant, total €7,00, serta tombol Simpan, Cetak, dan Tagih.",
    },
  },
  posOrderQueue: {
    src: posOrderQueue,
    device: "desktop",
    alt: {
      fr: "La file des commandes : les commandes de la caisse par numéro et par heure, des filtres Confirmées, En préparation, Prêtes et Enregistrées, et le détail d'une commande à droite.",
      en: "The order queue: till orders by number and time, filters for confirmed, in production, ready and saved orders, and one order's details on the right.",
      id: "Antrian pesanan: pesanan kasir menurut nomor dan jam, filter dikonfirmasi, diproses, siap, dan disimpan, serta detail satu pesanan di kanan.",
    },
  },
  posCustomerDisplay: {
    src: posCustomerDisplay,
    device: "desktop",
    alt: {
      fr: "L'écran client : l'article qui vient d'être ajouté (un croissant, 3,00 €), la commande avec son total de 7,00 €, et un bouton pour recevoir le ticket sur WhatsApp.",
      en: "The customer screen: the item just added (a croissant, €3.00), the order with its €7.00 total, and a button to get the receipt on WhatsApp.",
      id: "Layar pelanggan: item yang baru ditambahkan (croissant, €3,00), pesanan dengan total €7,00, dan tombol untuk menerima struk lewat WhatsApp.",
    },
  },
  storefrontMenu: {
    src: storefrontMenu,
    device: "phone",
    alt: {
      fr: "Le menu d'une vitrine sur téléphone : les catégories, les articles avec leur prix et un bouton d'ajout, et le panier en bas.",
      en: "A storefront menu on a phone: categories, items with their prices and an add button, and the cart at the bottom.",
      id: "Menu etalase di ponsel: kategori, item dengan harga dan tombol tambah, serta keranjang di bagian bawah.",
    },
  },
  storefrontCheckout: {
    src: storefrontCheckout,
    device: "phone",
    alt: {
      fr: "Une commande passée depuis un téléphone : nom, numéro WhatsApp, sur place, à emporter ou livraison, paiement à la caisse, et le bouton pour commander.",
      en: "Ordering from a phone: name, WhatsApp number, dine in, takeaway or delivery, pay at the cashier, and the button to place the order.",
      id: "Memesan dari ponsel: nama, nomor WhatsApp, makan di tempat, bawa pulang, atau antar, bayar di kasir, dan tombol untuk memesan.",
    },
  },
  backOfficeStock: {
    src: backOfficeStock,
    device: "desktop",
    alt: {
      fr: "Le tableau de bord : le stock des matières premières, les fournisseurs avec leurs contacts, et les derniers mouvements de stock, chacun créé par une vente en caisse.",
      en: "The Store Dashboard: raw-material stock levels, suppliers with their contacts, and the latest stock movements, each one made by a POS sale.",
      id: "Dasbor Toko: level stok bahan baku, pemasok beserta kontaknya, dan pergerakan stok terbaru, masing-masing dibuat oleh penjualan POS.",
    },
  },
  // Only the report tabs of the Finance page: no figure of the test store shows.
  backOfficeFinanceTabs: {
    src: backOfficeFinance,
    device: "desktop",
    crop: { x: 450, y: 300, w: 870, h: 102 },
    alt: {
      fr: "Les rapports financiers du tableau de bord : bilan, quotidien, dépenses, par canal, par moyen de paiement et tendances de vente, chacun dans son onglet.",
      en: "The Store Dashboard finance reports: P&L statement, daily, expenses, by channel, payment method and sales patterns, each on its own tab.",
      id: "Laporan keuangan Dasbor Toko: laba rugi, harian, pengeluaran, per kanal, metode pembayaran, dan pola penjualan, masing-masing di tabnya sendiri.",
    },
  },
  // Only the three modes of the till's menu: no account block shows.
  posModes: {
    src: posMenuDrawer,
    device: "desktop",
    crop: { x: 1466, y: 354, w: 928, h: 372 },
    alt: {
      fr: "Le menu de la caisse : Tableau de bord, Système POS, et Opérationnel pour le shift, les plannings et le pointage.",
      en: "The till's menu: Store Dashboard, POS System, and Operational for the shift, schedules and clock in/out.",
      id: "Menu kasir: Dasbor Toko, Sistem POS, dan Operasional untuk shift, jadwal, dan absen masuk/pulang.",
    },
  },
} as const satisfies Record<string, ProductScreen>;

export type ProductScreenKey = keyof typeof PRODUCT_SCREENS;
