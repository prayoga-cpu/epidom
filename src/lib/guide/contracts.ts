import { z } from "zod";
import type { OnboardingGoal } from "@/lib/onboarding/contracts";

/**
 * Shared shapes for the in-app guide (src/features/guide): the welcome tour,
 * the Getting-started checklist, page intro cards and the Help centre.
 *
 * Per-user state lives in User.guideState (JSON). It is a viewer preference —
 * a staff persona on the owner's device shares the owner's account, so a card
 * dismissed there is dismissed for that account.
 */

/** Pages that show a first-visit intro card. */
export const PAGE_INTRO_IDS = [
  "storefront",
  "customers",
  "data",
  "stock",
  "schedule",
  "shifts",
  "finance",
  "orderQueue",
  "kitchen",
  "tables",
  "operational",
  "hardware",
] as const;
export type PageIntroId = (typeof PAGE_INTRO_IDS)[number];

/** Stored in User.guideState. Missing keys mean "nothing seen / dismissed". */
export interface GuideState {
  /** ISO timestamp the welcome tour was finished or skipped. */
  tourSeenAt: string | null;
  dismissedTips: PageIntroId[];
  /** Store ids whose Getting-started checklist the viewer hid. */
  dismissedChecklists: string[];
}

export const EMPTY_GUIDE_STATE: GuideState = {
  tourSeenAt: null,
  dismissedTips: [],
  dismissedChecklists: [],
};

/** PATCH /api/user/guide-state — one or more changes; returns the full GuideState. */
export const guideStatePatchSchema = z
  .object({
    tourSeen: z.literal(true).optional(),
    /** Clear tourSeenAt so the tour auto-opens again (Help → Replay tour does not need this; it opens the dialog directly). */
    resetTour: z.literal(true).optional(),
    dismissTip: z.enum(PAGE_INTRO_IDS).optional(),
    /** Show every page intro card again. */
    restoreTips: z.literal(true).optional(),
    dismissChecklist: z.string().min(1).max(64).optional(),
    restoreChecklist: z.string().min(1).max(64).optional(),
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: "Nothing to update",
  });
export type GuideStatePatch = z.infer<typeof guideStatePatchSchema>;

/** Getting-started checklist groups; the order shown follows the owner's goals. */
export const SETUP_SECTIONS = ["storefront", "counter", "operations"] as const;
export type SetupSection = (typeof SETUP_SECTIONS)[number];

export const SETUP_ITEM_IDS = [
  // storefront (FREE)
  "publishStorefront",
  "addMenuItems",
  "addItemPhotos",
  "addBranding",
  "addWhatsapp",
  "firstVisit",
  // counter (POS)
  "firstSale",
  "openShift",
  "addTables",
  // operations (OPERATIONS)
  "addStockItems",
  "addSupplier",
  "addStaff",
  "publishSchedule",
] as const;
export type SetupItemId = (typeof SETUP_ITEM_IDS)[number];

export type SetupPlan = "FREE" | "POS" | "OPERATIONS";

export interface SetupItem {
  id: SetupItemId;
  section: SetupSection;
  done: boolean;
  /** The store's plan is below `requiredPlan`: show the upgrade path, not the action. */
  locked: boolean;
  requiredPlan: SetupPlan;
  /** In-app path for the item's action (or the upgrade path when locked). */
  href: string;
  /** For count-based items ("5 menu items"): how far along. */
  progress?: { current: number; target: number };
}

/** GET /api/stores/[storeId]/setup-progress */
export interface SetupProgress {
  storeId: string;
  items: SetupItem[];
  /** Sections in display order: the owner's goals first, then the rest. */
  sections: SetupSection[];
  /** Done, unlocked items. */
  completed: number;
  /** Unlocked items. */
  total: number;
  allDone: boolean;
  /** Store created within NEW_STORE_WINDOW_DAYS — the checklist and tour open by themselves only then. */
  isNewStore: boolean;
  plan: "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";
  goals: OnboardingGoal[];
}

export const NEW_STORE_WINDOW_DAYS = 60;
