import type { Market } from "@/components/market-flag";
import { hasLocalizedText, type LocalizedText } from "./localized-text";

export interface CaseStudyMetric {
  /** The figure as it should read, e.g. "-40%" or "3 h/week". */
  value: string;
  label: string;
  /** Where the figure comes from (interview date, dashboard export, ...). Required. */
  source: string;
}

export interface CaseStudy {
  slug: string;
  shopName: string;
  ownerName: string;
  location: string;
  /** A plain string shows in every locale; a per-locale map lets you translate it. */
  quote: LocalizedText;
  /** What the shop does, in a line or two, shown above the quote. Optional. */
  summary?: LocalizedText;
  /** The owner's role ("Co-founder", "Owner"). Optional. */
  ownerRole?: LocalizedText;
  /**
   * Leave out until the figures are verified: a study can run on the shop and
   * the quote alone. When present, two or three, each with a non-empty `source`.
   */
  metrics?: readonly [CaseStudyMetric, CaseStudyMetric] | readonly [CaseStudyMetric, CaseStudyMetric, CaseStudyMetric];
  /** Optional long-form page: an internal path ("/blog/...") or an https URL. */
  storyHref?: string;
  /** The country's flag shown after the location (the site's two markets). */
  flag?: Market;
  /** The shop's mark: a WHITE logo (shown on a navy tile), e.g. "/images/clients/abenz.svg". */
  logo?: string;
  /** The speaker's photo (public/images/people/<name>.jpg); their initial shows until it exists. */
  photo?: string;
}

/**
 * Real customer case studies for the home page. Ships EMPTY on purpose: while
 * the list is empty the whole section renders nothing. (In local development
 * only, the drafts below stand in so the layout can be seen.)
 *
 * Authoring rules (an entry that breaks them is dropped, not shown):
 *  - Add an entry ONLY after interviewing the merchant and getting their
 *    written OK to publish the quote, their name and their shop's name.
 *  - The quote is theirs, word for word. Do not polish it into something they
 *    did not say. Provide fr / en / id variants if they agree to a translation.
 *  - Every metric needs a `source` you can point to if asked (interview date,
 *    a dashboard export, an order count you actually ran). No source, no metric.
 *  - Either no metrics at all (shop and quote only) or two or three.
 */
/**
 * DRAFTS, for the two stories being gathered. They show ONLY in local
 * development (NODE_ENV === "development"), never in a production build or in
 * tests. The wording below is a PROPOSAL written for Dinda and Angelia to
 * correct in their own words: send it to them, change it to what they say, get
 * their written OK for the quote, name, role and shop, then move the entry
 * into CASE_STUDIES (and delete it from here). No figures are claimed.
 */
const DRAFT_CASE_STUDIES: readonly CaseStudy[] = [
  {
    slug: "abenz",
    shopName: "Abenz Coffee & Eatery",
    ownerName: "Dinda",
    ownerRole: { en: "Owner", fr: "Propriétaire", id: "Pemilik" },
    location: "Bali",
    flag: "id",
    logo: "/images/clients/abenz.svg",
    photo: "/images/people/dinda.jpg",
    summary: {
      en: "A coffee shop and eatery in Bali.",
      fr: "Un coffee shop et restaurant à Bali.",
      id: "Kedai kopi dan eatery di Bali.",
    },
    quote: {
      en: "Orders used to reach us through chats and notes in five different places. Now customers order from one link, and I can see which drinks really make money.",
      fr: "Avant, les commandes nous arrivaient par messages et par notes un peu partout. Maintenant les clients commandent depuis un seul lien, et je vois quelles boissons rapportent vraiment.",
      id: "Dulu pesanan masuk lewat chat dan catatan di lima tempat berbeda. Sekarang pelanggan memesan lewat satu link, dan saya bisa melihat minuman mana yang benar-benar untung.",
    },
  },
  {
    slug: "casacosa",
    shopName: "Casacosa",
    ownerName: "Angelia",
    ownerRole: { en: "General manager", fr: "Directrice générale", id: "General manager" },
    location: "Paris",
    flag: "fr",
    logo: "/images/clients/casacosa.svg",
    photo: "/images/people/angelia.jpg",
    summary: {
      en: "A restaurant in Paris.",
      fr: "Un restaurant à Paris.",
      id: "Restoran di Paris.",
    },
    quote: {
      en: "Service is calmer: orders reach the kitchen without anyone retyping them, and the team's schedule lives in the same place as the till.",
      fr: "Le service est plus calme : les commandes arrivent en cuisine sans que personne ne les ressaisisse, et le planning de l'équipe est au même endroit que la caisse.",
      id: "Layanan jadi lebih tenang: pesanan sampai ke dapur tanpa ada yang mengetik ulang, dan jadwal tim ada di tempat yang sama dengan kasir.",
    },
  },
];

export const CASE_STUDIES: readonly CaseStudy[] =
  process.env.NODE_ENV === "development" ? DRAFT_CASE_STUDIES : [];

function filled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** True when the entry has every field the section needs, sources included. */
export function isPublishableCaseStudy(study: CaseStudy): boolean {
  return (
    filled(study.slug) &&
    filled(study.shopName) &&
    filled(study.ownerName) &&
    filled(study.location) &&
    hasLocalizedText(study.quote) &&
    (study.metrics === undefined ||
      (Array.isArray(study.metrics) &&
        (study.metrics.length === 2 || study.metrics.length === 3) &&
        study.metrics.every((m) => filled(m?.value) && filled(m?.label) && filled(m?.source))))
  );
}

/** The entries fit to show; the rest are dropped. */
export function getPublishableCaseStudies(studies: readonly CaseStudy[]): CaseStudy[] {
  return studies.filter(isPublishableCaseStudy);
}
