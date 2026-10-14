import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Search landing pages: one page per buyer intent ("aplikasi kasir cafe",
 * "calcul coût de revient", "kitchen display system"), each written for ONE
 * language at its own localized slug, the way blog posts and docs guides are.
 * Pages that answer the same intent in different languages share a `group`,
 * which is how hreflang links them.
 */
export type LandingKind = "tool" | "vertical" | "feature";

/** The interactive tool a `{ type: "tool" }` block renders. */
export type LandingTool = "recipe-cost" | "commission";

export type LandingBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  /** Numbered how-to steps. */
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  /** A short highlighted aside: a formula, an example, a caveat. */
  | { type: "callout"; text: string }
  /** Where the page's interactive tool renders (tool pages only). */
  | { type: "tool" };

/** Where the page's call to action sends people. */
export type LandingCta = "trial" | "register" | "pricing";

export interface LandingPage {
  /** Unprefixed path is "/" + slug; the URL adds the locale prefix (fr none). */
  slug: string;
  /** The only language this page exists in. */
  locale: Locale;
  /** Same intent across languages (hreflang); see LANDING_GROUPS. */
  group: string;
  kind: LandingKind;
  tool?: LandingTool;
  /** <title>, ≤ 60 characters with the " — EPIDOM" suffix the page adds. */
  metaTitle: string;
  /** Search snippet, ≤ 160 characters. */
  metaDescription: string;
  eyebrow: string;
  h1: string;
  lede: string;
  blocks: LandingBlock[];
  faqs: Array<{ q: string; a: string }>;
  cta: { title: string; text: string; button: string; target: LandingCta };
  /** ISO date of the last real content change. */
  updated: string;
}
