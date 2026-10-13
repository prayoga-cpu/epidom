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

/**
 * Real Epidom screens (captured 13.10.2026 on v3.11.0, dark theme), shown on
 * the home page, /services and the sign-in / sign-up pages. Not mockups.
 *
 * public/images/screens/ also holds captures that are deliberately NOT shown:
 * back-office-finance.png (the test store's P&L reads €62 million, retake it
 * on realistic numbers before using it), pos-menu-drawer.png and
 * website-home.png (the source of public/images/og-image.png). The owner's
 * email in the drawer and a customer's phone in the order queue are blurred.
 */
export interface ProductScreen {
  src: StaticImageData;
  /** Phone captures are portrait and get a phone-shaped frame, not a window. */
  device: "desktop" | "phone";
  alt: Record<Locale, string>;
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
      fr: "Le back-office : le stock des matières premières, les fournisseurs avec leurs contacts, et les derniers mouvements de stock, chacun créé par une vente en caisse.",
      en: "The Back Office: raw-material stock levels, suppliers with their contacts, and the latest stock movements, each one made by a POS sale.",
      id: "Back Office: level stok bahan baku, pemasok beserta kontaknya, dan pergerakan stok terbaru, masing-masing dibuat oleh penjualan POS.",
    },
  },
} as const satisfies Record<string, ProductScreen>;

export type ProductScreenKey = keyof typeof PRODUCT_SCREENS;
