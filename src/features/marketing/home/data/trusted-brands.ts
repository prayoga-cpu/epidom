// Client logos for the home page's "trusted by" strip (components/trust-bar.tsx).
//
// Each entry is a brand the owner confirmed as a client and agreed to show
// (`consented: true`). A brand that has not confirmed must not be listed at all
// (or stays `consented: false`): a logo implies an endorsement. The strip counts
// and shows only consented brands, and renders nothing when there are none.
//
// Files: the WHITE single-ink versions are served from public/images/clients/
// (the site is dark). The black and full-colour versions are kept, unused, in
// ../assets/clients/{black,color}/ for a light layout later.

export type BrandGroup = "cafe" | "bakery" | "restaurant";

export interface TrustedBrand {
  slug: string;
  /** Used verbatim as the image alt text. */
  name: string;
  group: BrandGroup;
  /** Site-relative path of the white SVG. */
  logo: string;
  /** width / height of the SVG's viewBox: sizes every mark by its visual weight. */
  aspect: number;
  consented: boolean;
}

const brand = (
  slug: string,
  name: string,
  group: BrandGroup,
  aspect: number
): TrustedBrand => ({
  slug,
  name,
  group,
  aspect,
  logo: `/images/clients/${slug}.svg`,
  consented: true,
});

// Ordered so neighbours differ in shape and kind of business.
export const TRUSTED_BRANDS: readonly TrustedBrand[] = [
  brand("abenz", "Abenz Coffee & Eatery", "cafe", 1.139),
  brand("lorette", "Lorette", "bakery", 1.833),
  brand("kalve", "Kalve", "cafe", 4.838),
  brand("tahoma", "Tahoma", "restaurant", 0.787),
  brand("hygge-caffe", "Hygge Caffe", "cafe", 7.682),
  brand("utopie", "Utopie", "bakery", 0.999),
  brand("stradina", "Stradina", "restaurant", 5.183),
  brand("cuvee-noire", "Cuvée Noire", "cafe", 6.287),
  brand("casacosa", "Casacosa", "restaurant", 3.909),
  brand("roberta-caffe", "Roberta Caffè", "cafe", 3.362),
  brand("mian-fan", "Mian Fan", "restaurant", 3.375),
  brand("la-pause-libanaise", "La Pause Libanaise", "restaurant", 3.607),
];

/** Only the brands that have confirmed (`consented === true`). */
export function getConsentedBrands(
  brands: readonly TrustedBrand[] = TRUSTED_BRANDS
): TrustedBrand[] {
  return brands.filter((brand) => brand.consented === true);
}

/** Display height (px) of a logo: equal visual weight, tall marks capped. */
export function logoHeight(aspect: number): number {
  const height = Math.sqrt(5200 / aspect);
  return Math.round(Math.min(Math.max(height, 24), 46));
}
