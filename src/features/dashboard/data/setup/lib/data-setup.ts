/**
 * First-run setup of the Data page: how an empty store chooses to fill its
 * lists, and what the page shows while it does.
 *
 * Two ways in, both ending with a menu, because the POS sells from it:
 *  - "import": the menu first, from a photo or a PDF through any AI assistant
 *    (the Smart Import prompt). Fast; costs and stock come later.
 *  - "guided": raw materials, then recipes, then the menu. Slower, but every
 *    sale then takes its ingredients out of stock and Finance shows real costs.
 *
 * Pure functions only, so the rules are tested without rendering the page.
 */

export type DataSetupPath = "import" | "guided";

/** Store-wide totals of the three lists the setup is about. */
export interface DataSetupCounts {
  /** STANDARD products: the menu (each one is linked to a POS menu item). */
  products: number;
  materials: number;
  recipes: number;
}

/** Saved per store on this device (localStorage). */
export interface DataSetupState {
  /** The way in picked on the first-run screen; null until one is picked. */
  path: DataSetupPath | null;
  /** The setup card (guided steps, or "your menu is in") was hidden. */
  cardHidden: boolean;
}

export const DATA_SETUP_DEFAULTS: DataSetupState = { path: null, cardHidden: false };

export function sanitizeDataSetupState(raw: unknown, defaults: DataSetupState): DataSetupState {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Partial<DataSetupState>;
  return {
    path: r.path === "import" || r.path === "guided" ? r.path : defaults.path,
    cardHidden: typeof r.cardHidden === "boolean" ? r.cardHidden : defaults.cardHidden,
  };
}

/** Nothing in any list yet. */
export function isDataEmpty(counts: DataSetupCounts): boolean {
  return counts.products === 0 && counts.materials === 0 && counts.recipes === 0;
}

/**
 * What the page shows:
 *  - "choose": the two ways in, in place of the page tip, the quick start and
 *    the lists (an empty store that hasn't picked);
 *  - "import": the menu import steps, on their own;
 *  - "lists": the page as usual (anything is in a list, the guided way was
 *    picked, or the owner skipped the choice for this visit).
 */
export type DataSetupView = "choose" | "import" | "lists";

export function resolveDataSetupView(
  state: DataSetupState,
  counts: DataSetupCounts,
  skipped: boolean
): DataSetupView {
  if (!isDataEmpty(counts) || skipped) return "lists";
  if (state.path === "import") return "import";
  if (state.path === "guided") return "lists";
  return "choose";
}

/**
 * The card above the lists while setup is under way:
 *  - "guide": the guided steps (until hidden, including their "all set" end);
 *  - "menuReady": the menu import worked; what to do next;
 *  - null: nothing.
 */
export type DataSetupCard = "guide" | "menuReady" | null;

export function resolveDataSetupCard(
  state: DataSetupState,
  counts: DataSetupCounts
): DataSetupCard {
  if (state.cardHidden) return null;
  if (state.path === "guided") return "guide";
  if (state.path === "import" && counts.products > 0) return "menuReady";
  return null;
}

export type GuidedStepId = "materials" | "recipes" | "menu";

export interface GuidedStep {
  id: GuidedStepId;
  /** The Data tab the step's items are added on. */
  tab: "materials" | "recipes" | "products";
  count: number;
  done: boolean;
  /** The first step not done yet. */
  current: boolean;
}

/**
 * Raw materials, recipes, then the menu: each needs the one before it to be
 * accurate (a recipe costs its materials, a menu item takes its recipe's
 * ingredients out of stock). A step is done once its list has anything in it,
 * whatever order it was filled in.
 */
export function guidedSteps(counts: DataSetupCounts): GuidedStep[] {
  const steps = [
    { id: "materials" as const, tab: "materials" as const, count: counts.materials },
    { id: "recipes" as const, tab: "recipes" as const, count: counts.recipes },
    { id: "menu" as const, tab: "products" as const, count: counts.products },
  ].map((step) => ({ ...step, done: step.count > 0, current: false }));
  const current = steps.find((step) => !step.done);
  if (current) current.current = true;
  return steps;
}
