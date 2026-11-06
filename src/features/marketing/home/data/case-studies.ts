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
}

/**
 * Real customer case studies for the home page. Ships EMPTY on purpose: while
 * the list is empty the whole section renders nothing. (In local development
 * only, placeholders stand in so the layout can be seen: see below.)
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
 * PLACEHOLDERS, to see the layout while the real stories are gathered. They
 * show ONLY in local development (NODE_ENV === "development"), never in a
 * production build or in tests, so invented names and figures cannot reach
 * visitors. Replace them with real entries in CASE_STUDIES below, then delete
 * this list.
 */
const PLACEHOLDER_CASE_STUDIES: readonly CaseStudy[] = [
  {
    slug: "placeholder-cafe",
    shopName: "Sample Café",
    ownerName: "Sample Owner",
    ownerRole: "Co-founder",
    location: "Lyon",
    summary: "PLACEHOLDER: a neighbourhood café with a queue every morning at nine.",
    quote: "PLACEHOLDER: replace this with the owner's own words, exactly as they said them.",
    metrics: [
      { value: "-00%", label: "Placeholder figure one", source: "PLACEHOLDER, replace" },
      { value: "00 min", label: "Placeholder figure two", source: "PLACEHOLDER, replace" },
      { value: "0x", label: "Placeholder figure three", source: "PLACEHOLDER, replace" },
    ],
    storyHref: "/blog",
  },
  {
    slug: "placeholder-bakery",
    shopName: "Sample Bakery",
    ownerName: "Sample Baker",
    ownerRole: "Owner",
    location: "Bali",
    summary: "PLACEHOLDER: a bakery taking pre-orders by phone for cakes and the morning box.",
    quote: "PLACEHOLDER: a second quote, in the owner's words.",
    metrics: [
      { value: "00%", label: "Placeholder figure one", source: "PLACEHOLDER, replace" },
      { value: "000+", label: "Placeholder figure two", source: "PLACEHOLDER, replace" },
    ],
  },
  {
    slug: "placeholder-bar",
    shopName: "Sample Bar",
    ownerName: "Sample Manager",
    ownerRole: "Manager",
    location: "Paris",
    summary: "PLACEHOLDER: a bar where drinks print at the right station.",
    quote: "PLACEHOLDER: a third quote, a story with no figures at all.",
  },
];

export const CASE_STUDIES: readonly CaseStudy[] =
  process.env.NODE_ENV === "development" ? PLACEHOLDER_CASE_STUDIES : [];

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
