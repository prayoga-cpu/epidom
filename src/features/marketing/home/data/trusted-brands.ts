// Customer logos for the home page trust bar.
//
// This list ships EMPTY on purpose. Nothing in this repo shows that any brand
// below is an Epidom customer or agreed to appear on the site, and a logo
// implies an endorsement (Laura Todd is a registered trademark). A static
// `import` of a logo file is bundled into the client whether or not the entry is
// rendered, so a brand that has not confirmed must not even be imported: its
// mark would be emitted to /_next/static/media and its name into the client JS.
//
// To show a brand: uncomment ONLY that brand's import line and its entry in
// TRUSTED_BRANDS, and only after the brand confirms in writing (keep that
// confirmation on file). Leave every other brand commented out. The logo files
// stay in ../assets/brands so nothing has to be re-added later.
import type { StaticImageData } from "next/image";

// Uncomment ONLY after the brand confirms in writing:
// import holyCookie from "../assets/brands/holy-cookie.jpg";
// import laFabrique from "../assets/brands/lafabrique.jpg";
// import lauraTodd from "../assets/brands/laura-todd.jpg";
// import mommaCookies from "../assets/brands/momma-cookies.jpg";
// import pepiteCookie from "../assets/brands/pepite-cookie.jpg";

export interface TrustedBrand {
  slug: string;
  /** Used verbatim as the image alt text. */
  name: string;
  logo: StaticImageData;
  consented: boolean;
  /**
   * Scale applied inside the circular crop, only to trim a stray border in the
   * source file (1 = untouched). Keep it small: 1.04 is enough.
   */
  zoom?: number;
}

export const TRUSTED_BRANDS: readonly TrustedBrand[] = [
  // Uncomment ONLY after the brand confirms in writing (and its import above):
  // { slug: "holy-cookie", name: "Holy Cookie", logo: holyCookie, consented: true },
  // { slug: "la-fabrique-cookies", name: "La Fabrique Cookies", logo: laFabrique, consented: true },
  // // The source JPEG has black corners around the circular mark; the zoom trims
  // // the sliver of black the circular crop would otherwise leave at the rim.
  // { slug: "laura-todd", name: "Laura Todd", logo: lauraTodd, consented: true, zoom: 1.05 },
  // { slug: "momma-cookies", name: "Momma Cookies Bali", logo: mommaCookies, consented: true },
  // { slug: "pepite-cookie", name: "Pépite Cookie", logo: pepiteCookie, consented: true },
];

/** Only the brands that have confirmed in writing (`consented === true`). */
export function getConsentedBrands(
  brands: readonly TrustedBrand[] = TRUSTED_BRANDS
): TrustedBrand[] {
  return brands.filter((brand) => brand.consented === true);
}
