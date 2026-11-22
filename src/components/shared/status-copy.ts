"use client";

import type { Locale } from "@/components/lang/i18n-provider";
import { useOptionalI18n } from "@/components/lang/optional-i18n";
import { getLanguagePreference } from "@/lib/cookie-consent";

/**
 * Copy for the error fallbacks (ErrorBoundary, SectionErrorBoundary).
 *
 * An error boundary usually sits ABOVE the I18nProvider it protects
 * (<ErrorBoundary><I18nProvider>…), so its fallback cannot count on useI18n():
 * calling it there would throw inside the error screen and leave a blank page.
 * useStatusText() reads the provider when there is one and otherwise falls
 * back to the few sentences below, in the visitor's saved or browser language.
 * The same sentences live in the dictionaries under `statusPages.*`; keep the
 * two in step.
 */
const BUILT_IN: Record<Locale, Record<string, string>> = {
  en: {
    "statusPages.error.eyebrow": "Unexpected error",
    "statusPages.error.title": "Something went wrong",
    "statusPages.error.description":
      "Sorry, something unexpected happened. Nothing you saved was lost. Try again, or reload the page.",
    "statusPages.error.tryAgain": "Try again",
    "statusPages.error.reload": "Reload page",
    "statusPages.error.details": "Error details",
    "statusPages.section.title": "This section didn't load",
    "statusPages.section.description":
      "The rest of the page still works. Reload the page to see this part.",
  },
  fr: {
    "statusPages.error.eyebrow": "Erreur inattendue",
    "statusPages.error.title": "Une erreur est survenue",
    "statusPages.error.description":
      "Désolé, un problème inattendu s'est produit. Rien de ce que vous avez enregistré n'est perdu. Réessayez ou rechargez la page.",
    "statusPages.error.tryAgain": "Réessayer",
    "statusPages.error.reload": "Recharger la page",
    "statusPages.error.details": "Détails de l'erreur",
    "statusPages.section.title": "Cette section ne s'est pas chargée",
    "statusPages.section.description":
      "Le reste de la page fonctionne. Rechargez la page pour afficher cette partie.",
  },
  id: {
    "statusPages.error.eyebrow": "Kesalahan tak terduga",
    "statusPages.error.title": "Terjadi kesalahan",
    "statusPages.error.description":
      "Maaf, terjadi sesuatu yang tidak terduga. Data yang sudah Anda simpan tetap aman. Coba lagi atau muat ulang halaman.",
    "statusPages.error.tryAgain": "Coba lagi",
    "statusPages.error.reload": "Muat ulang halaman",
    "statusPages.error.details": "Detail kesalahan",
    "statusPages.section.title": "Bagian ini gagal dimuat",
    "statusPages.section.description":
      "Bagian lain halaman tetap berfungsi. Muat ulang halaman untuk menampilkan bagian ini.",
  },
  th: {
    "statusPages.error.eyebrow": "ข้อผิดพลาดที่ไม่คาดคิด",
    "statusPages.error.title": "เกิดข้อผิดพลาด",
    "statusPages.error.description":
      "ขออภัย เกิดปัญหาที่ไม่คาดคิด ข้อมูลที่คุณบันทึกไว้ไม่สูญหาย ลองอีกครั้ง หรือโหลดหน้านี้ใหม่",
    "statusPages.error.tryAgain": "ลองอีกครั้ง",
    "statusPages.error.reload": "โหลดหน้าใหม่",
    "statusPages.error.details": "รายละเอียดข้อผิดพลาด",
    "statusPages.section.title": "โหลดส่วนนี้ไม่สำเร็จ",
    "statusPages.section.description":
      "ส่วนอื่นของหน้ายังใช้งานได้ โหลดหน้าใหม่เพื่อแสดงส่วนนี้",
  },
};

function detectLocale(): Locale {
  try {
    return getLanguagePreference();
  } catch {
    return "en";
  }
}

export function useStatusText(): { t: (key: string) => string; locale: Locale } {
  const i18n = useOptionalI18n();
  const locale = i18n?.locale ?? detectLocale();

  const t = (key: string) => {
    // t() answers with the key itself when a dictionary has no such entry.
    const translated = i18n ? i18n.t(key) : key;
    if (translated !== key) return translated;
    return BUILT_IN[locale]?.[key] ?? BUILT_IN.en[key] ?? key;
  };

  return { t, locale };
}
