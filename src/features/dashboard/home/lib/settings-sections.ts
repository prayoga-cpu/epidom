import {
  Activity,
  BadgePercent,
  Building2,
  KeyRound,
  MonitorSmartphone,
  Receipt,
  Repeat,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Every card on the Settings page, as something the search can jump to. The anchor is the
 * element id in profile-client.tsx. `keywords` deliberately mixes English, Indonesian and
 * French (and the things people actually type: "tax", "pajak", "TVA", "wifi", "qris"), so a
 * search finds the section whichever language the person writes in, whatever the app language.
 */
export interface SettingsSection {
  id: string;
  anchor: string;
  /** Existing locale key for the card's title, shown as the result label. */
  labelKey: string;
  icon: LucideIcon;
  keywords: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "personal",
    anchor: "settings-personal",
    labelKey: "profile.personal.title",
    icon: UserRound,
    keywords:
      "profile personal information name email phone photo avatar my details subscription plan billing invoice " +
      "profil informasi pribadi nama telepon foto langganan paket tagihan faktur " +
      "profil informations personnelles nom téléphone abonnement forfait facturation facture",
  },
  {
    id: "business",
    anchor: "settings-business",
    labelKey: "profile.business.title",
    icon: Building2,
    keywords:
      "business information company legal name address city country logo time zone timezone language locale " +
      "informasi bisnis usaha perusahaan alamat kota negara logo zona waktu bahasa " +
      "informations entreprise société adresse ville pays fuseau horaire langue",
  },
  {
    id: "fees",
    anchor: "settings-fees",
    labelKey: "profile.feesAndTaxes.title",
    icon: BadgePercent,
    keywords:
      "fees taxes tax rate vat service charge tip currency market pay later payment processing fee payment methods card cash qris " +
      "biaya pajak ppn tarif pajak biaya layanan servis mata uang pasar bayar nanti bayar kemudian biaya pemrosesan pembayaran metode pembayaran kartu tunai " +
      "frais taxes taxe tva taux service pourboire devise marché payer plus tard frais de traitement paiement moyens de paiement carte espèces",
  },
  {
    id: "receipt",
    anchor: "settings-receipt",
    labelKey: "profile.receiptSettings.title",
    icon: Receipt,
    keywords:
      "receipt whatsapp auto send footer message thank you social handles instagram tiktok facebook guest wifi password print " +
      "struk nota kwitansi whatsapp kirim otomatis pesan penutup terima kasih sosial media wifi tamu kata sandi cetak " +
      "reçu ticket de caisse whatsapp envoi automatique message de pied de page merci réseaux sociaux wifi invités mot de passe imprimer",
  },
  {
    id: "customer-display",
    anchor: "settings-customer-display",
    labelKey: "pos.customerDisplay.editor.title",
    icon: MonitorSmartphone,
    keywords:
      "customer display screen customize promo banner background look thank you screen qris qr code second screen " +
      "layar pelanggan tampilan pelanggan spanduk promo latar belakang layar terima kasih kode qr layar kedua " +
      "écran client affichage client bannière promo arrière-plan écran de remerciement code qr second écran",
  },
  {
    id: "transfer",
    anchor: "transfer-ownership",
    labelKey: "pages.storeTransferCardTitle",
    icon: Repeat,
    keywords:
      "transfer ownership owner sell store hand over new owner invite " +
      "transfer kepemilikan pemilik jual toko serahkan pemilik baru undang " +
      "transférer propriété propriétaire vendre magasin céder nouveau propriétaire inviter",
  },
  {
    id: "account",
    anchor: "settings-account",
    labelKey: "profile.accountSettings.title",
    icon: KeyRound,
    keywords:
      "account password change password sign out log out connected devices linked devices logged in devices other devices sessions security delete account deactivate close account two factor " +
      "akun kata sandi ganti kata sandi keluar perangkat terhubung perangkat tertaut perangkat lain sesi keamanan hapus akun nonaktifkan tutup akun " +
      "compte mot de passe changer le mot de passe déconnexion appareils connectés autres appareils sessions sécurité supprimer le compte désactiver fermer le compte",
  },
  {
    id: "claude",
    anchor: "settings-claude",
    labelKey: "home.claude.label",
    icon: Sparkles,
    keywords:
      "claude mcp connector ai assistant chat connect integration token revoke " +
      "konektor asisten ai hubungkan integrasi cabut " +
      "connecteur assistant ia connecter intégration révoquer",
  },
  {
    id: "activity",
    anchor: "settings-activity",
    labelKey: "profile.sections.activity",
    icon: Activity,
    keywords:
      "activity log history audit changes who did what login events " +
      "log aktivitas riwayat audit perubahan siapa melakukan apa " +
      "journal d'activité historique audit modifications qui a fait quoi connexions",
  },
];
