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
  /** Exactly two, each with a non-empty `source`. */
  metrics: readonly [CaseStudyMetric, CaseStudyMetric];
  /** Optional long-form page: an internal path ("/blog/...") or an https URL. */
  storyHref?: string;
}

/**
 * Real customer case studies for the home page. Ships EMPTY on purpose: while
 * the list is empty the whole section renders nothing.
 *
 * Authoring rules (an entry that breaks them is dropped, not shown):
 *  - Add an entry ONLY after interviewing the merchant and getting their
 *    written OK to publish the quote, their name and their shop's name.
 *  - The quote is theirs, word for word. Do not polish it into something they
 *    did not say. Provide fr / en / id variants if they agree to a translation.
 *  - Every metric needs a `source` you can point to if asked (interview date,
 *    a dashboard export, an order count you actually ran). No source, no metric.
 *  - Exactly two metrics per study.
 */
export const CASE_STUDIES: readonly CaseStudy[] = [];

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
    Array.isArray(study.metrics) &&
    study.metrics.length === 2 &&
    study.metrics.every((m) => filled(m?.value) && filled(m?.label) && filled(m?.source))
  );
}

/** The entries fit to show; the rest are dropped. */
export function getPublishableCaseStudies(studies: readonly CaseStudy[]): CaseStudy[] {
  return studies.filter(isPublishableCaseStudy);
}
