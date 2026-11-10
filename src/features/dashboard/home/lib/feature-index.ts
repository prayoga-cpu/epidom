import {
  BarChart3,
  Barcode,
  BookOpen,
  CalendarClock,
  ChefHat,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Flame,
  Gift,
  HandCoins,
  Layers,
  LayoutGrid,
  ListChecks,
  MonitorSmartphone,
  Package,
  Percent,
  Printer,
  Receipt,
  ReceiptText,
  RotateCcw,
  Scale,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  Upload,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PlanTier } from "@/config/navigation.config";

/**
 * Things people look for that are a tab, a button or a how-to inside a page rather than a page
 * of their own: "import my menu", "split the bill", "kitchen screen", "profit and loss".
 * Each opens the page (and tab) where the thing lives. Labels are written in all three
 * languages here; keywords mix en / id / fr so a search matches whichever language is typed.
 * `href` is relative to /store/{id}; `gate` is the staff grant the page needs.
 */
export interface FeatureEntry {
  id: string;
  label: { en: string; id: string; fr: string };
  keywords: string;
  icon: LucideIcon;
  href: string;
  gate: string;
  plan?: PlanTier;
}

const f = (
  id: string,
  icon: LucideIcon,
  en: string,
  idn: string,
  fr: string,
  keywords: string,
  href: string,
  gate: string,
  plan?: PlanTier
): FeatureEntry => ({ id, icon, label: { en, id: idn, fr }, keywords, href, gate, plan });

export const FEATURE_INDEX: FeatureEntry[] = [
  // ── Menu, products, phone orders ────────────────────────────────────────────
  f(
    "menu-editor",
    Package,
    "Menu editor",
    "Editor menu",
    "Éditeur de menu",
    "menu items add product edit price photo category dish drink variants options sold out hide produk tambah harga foto kategori makanan minuman habis sembunyikan produit ajouter prix photo catégorie plat boisson épuisé masquer carte",
    "/storefront?tab=menu",
    "/storefront"
  ),
  f(
    "import-menu",
    Upload,
    "Import your menu (CSV / Excel / photo)",
    "Impor menu (CSV / Excel / foto)",
    "Importer votre menu (CSV / Excel / photo)",
    "import menu upload csv excel xlsx spreadsheet photo scan smart import bulk migrate from another pos impor unggah menu massal pindah dari kasir lain importer téléverser menu en masse migrer depuis une autre caisse",
    "/data?tab=products",
    "/data",
    "OPERATIONS"
  ),
  f(
    "share-storefront",
    Share2,
    "Share your Phone Orders link / QR code",
    "Bagikan tautan / kode QR Pesanan Telepon",
    "Partager le lien / QR code des commandes par téléphone",
    "share link qr code url publish storefront online ordering website domain slug whatsapp bagikan tautan kode qr publikasikan toko online pesan online partager lien qr publier vitrine commande en ligne",
    "/storefront",
    "/storefront"
  ),
  f(
    "storefront-reviews",
    Star,
    "Reviews & Google reviews",
    "Ulasan & ulasan Google",
    "Avis & avis Google",
    "reviews ratings google reviews feedback maps ulasan penilaian masukan avis notes google avis clients",
    "/storefront?tab=reviews",
    "/storefront"
  ),
  f(
    "storefront-analytics",
    BarChart3,
    "Phone Orders analytics",
    "Analitik Pesanan Telepon",
    "Statistiques des commandes par téléphone",
    "storefront analytics visits views conversion statistics analitik kunjungan tayangan statistik statistiques visites vues",
    "/storefront?tab=analytics",
    "/storefront"
  ),
  f(
    "custom-products",
    Layers,
    "Build-your-own (composable) products",
    "Produk rakit sendiri (komposisi)",
    "Produits à composer (build your own)",
    "build your own composable custom product bowl pizza toppings choices options produk rakit sendiri komposisi pilihan topping produits à composer personnalisés choix garnitures",
    "/data?tab=customProducts",
    "/data",
    "OPERATIONS"
  ),

  // ── Stock, recipes, suppliers, promotions (Data) ────────────────────────────
  f(
    "materials",
    Package,
    "Ingredients & raw materials (stock)",
    "Bahan baku & stok",
    "Ingrédients & matières premières (stock)",
    "ingredients raw materials inventory stock levels units cost low stock add ingredient bahan baku bahan inventaris stok satuan biaya stok rendah tambah bahan ingrédients matières premières inventaire niveaux de stock unité coût stock bas ajouter ingrédient",
    "/data?tab=materials",
    "/data",
    "OPERATIONS"
  ),
  f(
    "recipes",
    ChefHat,
    "Recipes & food cost",
    "Resep & biaya bahan",
    "Recettes & coût matière",
    "recipes recipe cost food cost margin bill of materials bom ingredients per dish resep biaya resep hpp margin bahan per hidangan recettes coût de revient marge fiche technique ingrédients par plat",
    "/data?tab=recipes",
    "/data",
    "OPERATIONS"
  ),
  f(
    "suppliers",
    Truck,
    "Suppliers",
    "Pemasok",
    "Fournisseurs",
    "suppliers vendors contacts add supplier pemasok vendor kontak tambah pemasok fournisseurs contacts ajouter fournisseur",
    "/data?tab=suppliers",
    "/data",
    "OPERATIONS"
  ),
  f(
    "promotions",
    Percent,
    "Promotions & discount codes",
    "Promosi & kode diskon",
    "Promotions & codes de réduction",
    "promotions promo discount coupon voucher code happy hour percentage promosi diskon kupon voucher kode potongan harga promotions réductions coupon bon code remise",
    "/data?tab=promotions",
    "/data",
    "OPERATIONS"
  ),
  f(
    "stock-adjust",
    Scale,
    "Adjust stock / record waste",
    "Sesuaikan stok / catat sisa",
    "Ajuster le stock / enregistrer les pertes",
    "adjust stock count stocktake correction waste spoilage damaged expired opname sesuaikan stok hitung stok koreksi sisa rusak kadaluarsa ajuster stock inventaire correction perte gaspillage périmé cassé",
    "/management?tab=item",
    "/management",
    "OPERATIONS"
  ),
  f(
    "supplier-orders",
    Truck,
    "Order from a supplier / receive a delivery",
    "Pesan ke pemasok / terima pengiriman",
    "Commander chez un fournisseur / réceptionner une livraison",
    "supplier order purchase order receive delivery restock reorder pesan pemasok pesanan pembelian terima barang restok pesan ulang commande fournisseur bon de commande réception livraison réapprovisionner",
    "/management?tab=delivery",
    "/management",
    "OPERATIONS"
  ),
  f(
    "stock-log",
    ListChecks,
    "Stock movement log",
    "Riwayat pergerakan stok",
    "Journal des mouvements de stock",
    "stock log movements history audit who changed riwayat stok pergerakan journal mouvements historique",
    "/management?tab=log",
    "/management",
    "OPERATIONS"
  ),
  f(
    "production",
    Flame,
    "Batch production (make a recipe in bulk)",
    "Produksi massal (buat resep sekaligus)",
    "Production par lots",
    "production batch produce prepare bake make semi-finished prep produksi massal buat siapkan olahan setengah jadi production lot préparer cuire semi-fini",
    "/production",
    "/production",
    "OPERATIONS"
  ),
  f(
    "production-history",
    Clock,
    "Production history",
    "Riwayat produksi",
    "Historique de production",
    "production history batches log riwayat produksi historique production lots",
    "/production",
    "/production",
    "OPERATIONS"
  ),

  // ── POS: the till ────────────────────────────────────────────────────────────
  f(
    "pos-till",
    ShoppingCart,
    "Take an order (POS till)",
    "Ambil pesanan (kasir POS)",
    "Prendre une commande (caisse)",
    "pos till register cashier sell checkout new order ring up kasir jual bayar pesanan baru caisse vendre encaisser nouvelle commande",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-hold",
    ShoppingBag,
    "Hold a bill & resume it",
    "Tahan tagihan & lanjutkan",
    "Mettre une addition en attente et la reprendre",
    "hold save bill park resume open tab pending order tahan simpan tagihan lanjutkan pesanan tertunda mettre en attente sauvegarder addition reprendre commande en cours",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-split",
    Receipt,
    "Split a bill",
    "Pisah tagihan",
    "Partager l'addition",
    "split bill divide payment separate check pisah tagihan bagi bayar pecah partager l'addition diviser paiement séparer",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-discount",
    Tag,
    "Apply a discount or promo code at the till",
    "Beri diskon atau kode promo di kasir",
    "Appliquer une remise ou un code promo en caisse",
    "discount promo code coupon percentage amount off at checkout diskon kode promo potongan di kasir remise code promo réduction en caisse",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-payments",
    CreditCard,
    "Take payment (cash, card, QRIS, split tender)",
    "Terima pembayaran (tunai, kartu, QRIS)",
    "Encaisser (espèces, carte, QRIS)",
    "payment cash card qris e-wallet tender change tip pay later pembayaran tunai kartu dompet digital kembalian tip bayar nanti paiement espèces carte monnaie pourboire payer plus tard",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-refund",
    RotateCcw,
    "Refund or cancel an order",
    "Refund atau batalkan pesanan",
    "Rembourser ou annuler une commande",
    "refund void cancel return order mistake reverse refund batalkan pesanan kembalikan uang salah remboursement annuler commande retour erreur",
    "/pos/orders?tab=history",
    "/pos",
    "POS"
  ),
  f(
    "pos-orders",
    ReceiptText,
    "Order queue & order history",
    "Antrean & riwayat pesanan",
    "File des commandes & historique",
    "orders queue active history past orders search receipt reprint unpaid antrean pesanan riwayat cari struk cetak ulang belum dibayar commandes file active historique recherche ticket réimprimer impayé",
    "/pos/orders",
    "/pos",
    "POS"
  ),
  f(
    "pos-daily-report",
    FileSpreadsheet,
    "Daily sales report (end of day)",
    "Laporan penjualan harian (akhir hari)",
    "Rapport de ventes du jour (fin de journée)",
    "daily report end of day z report closing totals today laporan harian tutup hari total hari ini rapport journalier clôture z de caisse total du jour",
    "/pos/orders/daily-report",
    "/pos",
    "POS"
  ),
  f(
    "pos-kds",
    ChefHat,
    "Kitchen display (KDS)",
    "Layar dapur (KDS)",
    "Écran cuisine (KDS)",
    "kitchen display kds screen tickets bar prep dapur layar tiket bar cuisine écran tickets bar préparation",
    "/pos/kds",
    "/pos",
    "POS"
  ),
  f(
    "pos-tables",
    LayoutGrid,
    "Tables & floor plan",
    "Meja & denah",
    "Tables & plan de salle",
    "tables floor plan dine in seat table number meja denah makan di tempat nomor meja tables plan de salle sur place numéro de table",
    "/tables",
    "/pos",
    "POS"
  ),
  f(
    "pos-shift",
    Wallet,
    "Open / close the till shift (cash drawer)",
    "Buka / tutup shift kasir (laci kas)",
    "Ouvrir / fermer la caisse (tiroir-caisse)",
    "shift open close till cash drawer float opening cash counted expected cash in cash out buka tutup shift laci kas modal awal hitung kas masuk keluar ouvrir fermer caisse tiroir fond de caisse compté entrée sortie d'espèces",
    "/pos/operational?tab=shift",
    "/pos",
    "POS"
  ),
  f(
    "pos-hardware",
    Printer,
    "Printers & barcode scanner",
    "Printer & pemindai barcode",
    "Imprimantes & lecteur de codes-barres",
    "printer receipt printer thermal bluetooth usb kitchen printer label barcode scanner hardware setup cash drawer printer struk termal bluetooth printer dapur label pemindai barcode perangkat imprimante ticket thermique bluetooth imprimante cuisine étiquette lecteur code-barres matériel",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-scanner",
    Barcode,
    "Scan barcodes at the till",
    "Pindai barcode di kasir",
    "Scanner des codes-barres en caisse",
    "barcode scanner scan sku camera pindai barcode kamera scanner code-barres caméra",
    "/pos",
    "/pos",
    "POS"
  ),
  f(
    "pos-customer-display",
    MonitorSmartphone,
    "Customer display (second screen)",
    "Layar pelanggan (layar kedua)",
    "Écran client (second écran)",
    "customer display second screen banner promo qris thank you layar pelanggan layar kedua spanduk écran client second écran bannière",
    "/profile#settings-customer-display",
    "/profile"
  ),
  f(
    "pos-staff-pin",
    Users,
    "Switch staff / PIN login at the till",
    "Ganti staf / login PIN di kasir",
    "Changer de membre / connexion par code PIN",
    "staff pin switch user lock persona permissions staf ganti pengguna kunci izin équipe code pin changer d'utilisateur verrouiller autorisations",
    "/staff",
    "/staff",
    "OPERATIONS"
  ),
  f(
    "pos-offline",
    ShieldCheck,
    "Work offline (desktop / Android app)",
    "Bekerja offline (aplikasi desktop / Android)",
    "Travailler hors ligne (appli bureau / Android)",
    "offline no internet desktop app android install sync luring tanpa internet aplikasi desktop pasang sinkron hors ligne sans internet application bureau installer synchroniser",
    "/help",
    "/pos",
    "POS"
  ),

  // ── Team ─────────────────────────────────────────────────────────────────────
  f(
    "staff-add",
    Users,
    "Add a staff member & choose their pages",
    "Tambah staf & atur halaman akses",
    "Ajouter un membre & choisir ses pages",
    "add staff employee invite role cashier manager kitchen permissions access pin tambah staf karyawan undang peran kasir manajer akses ajouter employé inviter rôle caissier gérant cuisine autorisations accès",
    "/staff",
    "/staff",
    "OPERATIONS"
  ),
  f(
    "roster",
    CalendarClock,
    "Build & publish the weekly roster",
    "Susun & terbitkan jadwal mingguan",
    "Créer & publier le planning de la semaine",
    "roster schedule shifts week publish rota image jadwal shift minggu terbitkan planning semaine publier horaires",
    "/schedule",
    "/schedule",
    "OPERATIONS"
  ),
  f(
    "overtime",
    Clock,
    "Overtime & hours approval",
    "Persetujuan lembur & jam kerja",
    "Validation des heures supplémentaires",
    "overtime hours approve reject worked hours attendance clock in out lembur jam kerja setujui tolak absensi heures supplémentaires approuver refuser pointage",
    "/schedule",
    "/schedule",
    "OPERATIONS"
  ),
  f(
    "payroll",
    HandCoins,
    "Payroll, salary & commission",
    "Gaji, tunjangan & komisi",
    "Paie, salaire & commission",
    "payroll salary wage pay allowance commission bonus gaji upah tunjangan komisi bonus paie salaire commission prime",
    "/schedule",
    "/schedule",
    "OPERATIONS"
  ),
  f(
    "attendance",
    Clock,
    "Attendance & selfie check-in",
    "Absensi & selfie masuk",
    "Présence & pointage par selfie",
    "attendance clock in clock out selfie location late absence absensi masuk pulang selfie lokasi terlambat présence pointer entrée sortie selfie retard absence",
    "/shifts",
    "/shifts",
    "OPERATIONS"
  ),
  f(
    "shift-report",
    ReceiptText,
    "Shift report & cash log",
    "Laporan shift & log kas",
    "Rapport de caisse & journal d'espèces",
    "shift report cash log variance over short cash movements laporan shift log kas selisih rapport de caisse journal espèces écart",
    "/shifts",
    "/shifts",
    "OPERATIONS"
  ),

  // ── Money ────────────────────────────────────────────────────────────────────
  f(
    "fin-pl",
    BarChart3,
    "Profit & loss statement",
    "Laporan laba rugi",
    "Compte de résultat (P&L)",
    "profit loss p&l income statement net profit gross margin revenue laba rugi laba bersih pendapatan compte de résultat bénéfice net marge brute chiffre d'affaires",
    "/finance?tab=pl",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-daily",
    BarChart3,
    "Daily sales",
    "Penjualan harian",
    "Ventes quotidiennes",
    "daily sales per day revenue by day penjualan harian per hari ventes par jour quotidiennes",
    "/finance?tab=daily",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-expenses",
    Wallet,
    "Record & review expenses",
    "Catat & lihat pengeluaran",
    "Saisir & consulter les dépenses",
    "expenses costs rent utilities spending record expense bills pengeluaran biaya sewa listrik catat dépenses charges loyer enregistrer",
    "/finance?tab=expenses",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-channels",
    BarChart3,
    "Sales by channel (dine-in, takeaway, delivery, online)",
    "Penjualan per kanal",
    "Ventes par canal",
    "channels dine in takeaway delivery online grab gofood kanal makan di tempat bawa pulang antar canaux sur place à emporter livraison",
    "/finance?tab=channels",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-payment-methods",
    CreditCard,
    "Sales by payment method",
    "Penjualan per metode pembayaran",
    "Ventes par moyen de paiement",
    "payment methods cash card qris breakdown metode pembayaran tunai kartu moyens de paiement espèces carte répartition",
    "/finance?tab=paymentMethod",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-patterns",
    BarChart3,
    "Sales patterns (busiest hours & days)",
    "Pola penjualan (jam & hari tersibuk)",
    "Tendances de ventes (heures & jours de pointe)",
    "patterns busiest hours peak heatmap best day rush pola jam tersibuk puncak hari terbaik tendances heures de pointe meilleur jour",
    "/finance?tab=patterns",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-items",
    Package,
    "Best-selling items",
    "Produk terlaris",
    "Articles les plus vendus",
    "best sellers top items most sold popular products terlaris produk populer meilleures ventes articles populaires",
    "/finance?tab=items",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-margin",
    Percent,
    "Item margins & profitability",
    "Margin & profitabilitas produk",
    "Marges & rentabilité par article",
    "margin profitability cost price food cost per item margin produk keuntungan hpp marge rentabilité coût par article",
    "/finance?tab=margin",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-category",
    LayoutGrid,
    "Sales by category",
    "Penjualan per kategori",
    "Ventes par catégorie",
    "category sales breakdown kategori penjualan catégorie ventes répartition",
    "/finance?tab=category",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-adjustments",
    RotateCcw,
    "Discounts, refunds & voids",
    "Diskon, refund & pembatalan",
    "Remises, remboursements & annulations",
    "adjustments discounts refunds voids cancelled comps penyesuaian diskon refund batal ajustements remises remboursements annulations",
    "/finance?tab=adjustments",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-tax",
    Percent,
    "Tax report (VAT)",
    "Laporan pajak (PPN)",
    "Rapport de taxes (TVA)",
    "tax report vat ppn sales tax collected service charge laporan pajak ppn pajak terkumpul biaya layanan rapport taxe tva collectée frais de service",
    "/finance?tab=tax",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-waste",
    Trash2,
    "Waste report",
    "Laporan sisa / limbah",
    "Rapport des pertes",
    "waste spoilage loss report sisa limbah rusak laporan pertes gaspillage rapport",
    "/finance?tab=waste",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fin-cash",
    Wallet,
    "Cash reconciliation",
    "Rekonsiliasi kas",
    "Rapprochement de caisse",
    "cash reconciliation drawer variance counted expected rekonsiliasi kas selisih laci rapprochement caisse écart tiroir",
    "/finance?tab=cash",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "export",
    FileSpreadsheet,
    "Export / print a report (PDF, CSV)",
    "Ekspor / cetak laporan (PDF, CSV)",
    "Exporter / imprimer un rapport (PDF, CSV)",
    "export download print report pdf csv excel accountant ekspor unduh cetak laporan akuntan exporter télécharger imprimer rapport comptable",
    "/finance",
    "/finance",
    "OPERATIONS"
  ),
  f(
    "fiscal",
    ShieldCheck,
    "Fiscal journal (NF525)",
    "Jurnal fiskal (NF525)",
    "Journal fiscal (NF525)",
    "fiscal journal nf525 signed receipts compliance france anti-fraud attestation jurnal fiskal kepatuhan journal fiscal conformité antifraude attestation",
    "/fiscal",
    "/fiscal"
  ),

  // ── Customers, plan, help ───────────────────────────────────────────────────
  f(
    "customers",
    Users,
    "Customers & loyalty",
    "Pelanggan & loyalti",
    "Clients & fidélité",
    "customers loyalty points contacts phone whatsapp history pelanggan loyalti poin kontak riwayat clients fidélité points contacts historique",
    "/customers",
    "/customers",
    "POS"
  ),
  f(
    "upgrade",
    Gift,
    "Upgrade your plan / compare plans",
    "Upgrade paket / bandingkan paket",
    "Changer de forfait / comparer les forfaits",
    "upgrade plan pricing free pos operations enterprise trial subscription paket harga gratis uji coba langganan forfait tarifs gratuit essai abonnement",
    "/billing",
    "/billing"
  ),
  f(
    "billing",
    CreditCard,
    "Billing, invoices & payment method",
    "Tagihan, faktur & metode bayar",
    "Facturation, factures & moyen de paiement",
    "billing invoice receipt card cancel subscription payment method stripe tagihan faktur kartu batal langganan facturation facture carte résilier abonnement",
    "/billing",
    "/billing"
  ),
  f(
    "outlets",
    Store,
    "Add another store / outlet",
    "Tambah toko / cabang lain",
    "Ajouter un autre magasin / point de vente",
    "add store outlet branch multi location second shop tambah toko cabang lokasi ajouter magasin point de vente succursale",
    "/billing",
    "/billing"
  ),
  f(
    "help",
    BookOpen,
    "Help centre & guides",
    "Pusat bantuan & panduan",
    "Centre d'aide & guides",
    "help guide tutorial how to docs support contact learn welcome tour checklist bantuan panduan tutorial cara dukungan hubungi aide guide tutoriel comment faire documentation support contact visite guidée",
    "/help",
    ""
  ),
  f(
    "changelog",
    BookOpen,
    "What's new (release notes)",
    "Yang baru (catatan rilis)",
    "Nouveautés (notes de version)",
    "changelog release notes what's new updates versions catatan rilis pembaruan versi nouveautés notes de version mises à jour",
    "/changelog",
    ""
  ),
  f(
    "alerts-low-stock",
    Package,
    "Low-stock alerts",
    "Peringatan stok rendah",
    "Alertes de stock bas",
    "alerts low stock notifications reorder peringatan stok rendah notifikasi alertes stock bas notifications",
    "/alerts",
    "/alerts",
    "OPERATIONS"
  ),
];
