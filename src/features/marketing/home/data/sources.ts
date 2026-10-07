/**
 * The sources behind every number on the home page. A figure on the page links
 * to its source through <SourceRef id="S1" />, and the Sources list at the
 * bottom of the page renders one line per entry here. A figure with no entry
 * here does not ship.
 *
 * What each source says, who published it and when is localised in
 * `redesign.landing.sources.<id lowercased>` (e.g. `redesign.landing.sources.s1`).
 *
 * S1 to S6 come from the homepage spec (28.09.2026). S7 and S8 back the
 * calculator's payment-fee assumption for USD and IDR visitors, which the spec
 * only gave in euros: have them checked like the others before launch.
 */
export const SOURCE_IDS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** The number the footnote marker shows: S1 → 1. */
export function sourceNumber(id: SourceId): number {
  return SOURCE_IDS.indexOf(id) + 1;
}

/** The id of the source's line in the Sources list, for `href="#..."`. */
export function sourceAnchor(id: SourceId): string {
  return `source-${id.toLowerCase()}`;
}

/** The locale key holding the source's text. */
export function sourceKey(id: SourceId): string {
  return `redesign.landing.sources.${id.toLowerCase()}`;
}
