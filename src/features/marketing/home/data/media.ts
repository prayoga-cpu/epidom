import type { StaticImageData } from "next/image";
import type { Locale } from "@/components/lang/i18n-provider";
// Kept in public/ where it was supplied; the static import gives next/image its
// size and blur placeholder, and the optimiser serves AVIF/WebP at each width.
import heroPhoto from "../../../../../public/images/hero.jpeg";

/**
 * The home page's photos and screenshots. An entry stays null until the real
 * asset exists, and the page renders a clean fallback meanwhile.
 *
 * Hero: a real café or restaurant photo, people working, no stock look. It is
 * the LCP element and is preloaded; the hero's overlays keep cream text at WCAG
 * AA on top of it. Alt text in every language describes what the photo shows.
 * The supplied file is 1280 px wide: a 2560 px original would stay sharp on
 * large and retina screens.
 *
 * Spaces: one real screenshot per space (Storefront, POS Mode, Back Office),
 * not a mockup.
 */
export interface LocalizedImage {
  src: StaticImageData;
  alt: Record<Locale, string>;
}

export const HERO_PHOTO: LocalizedImage | null = {
  src: heroPhoto,
  alt: {
    fr: "Trois membres d'une équipe de café rient derrière le comptoir : l'une tient un long ticket de caisse, un autre montre un téléphone et une petite imprimante de tickets.",
    en: "Three café staff laughing behind the counter: one holds a long printed receipt, another shows a phone and a small receipt printer.",
    id: "Tiga staf kafe tertawa di balik meja kasir: satu memegang struk panjang, yang lain menunjukkan ponsel dan printer struk kecil.",
  },
};

export const SPACE_SCREENSHOTS: Record<"storefront" | "pos" | "backOffice", LocalizedImage | null> =
  {
    storefront: null,
    pos: null,
    backOffice: null,
  };
