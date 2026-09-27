import { prisma } from "@/lib/prisma";
import { getStorePlan } from "@/lib/plans/store-plan";
import {
  minPlanFor,
  planHasFeature,
  upgradeHrefFor,
  type PlanFeature,
  type PlanTier,
} from "@/lib/plans/entitlements";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { POS_ONLINE_PLATFORMS } from "@/config/aggregator.config";
import { ACTIVE_STAFF_WHERE } from "@/lib/auth/staff-link";
import { ONBOARDING_GOALS, type OnboardingGoal } from "@/lib/onboarding/contracts";
import {
  NEW_STORE_WINDOW_DAYS,
  SETUP_ITEM_IDS,
  SETUP_SECTIONS,
  type SetupItem,
  type SetupItemId,
  type SetupPlan,
  type SetupProgress,
  type SetupSection,
} from "@/lib/guide/contracts";

/**
 * The Getting-started checklist for one store (GET /api/stores/[id]/setup-progress):
 * every item ticks itself off from real data, so there is nothing to mark done
 * by hand and nothing to fall out of sync.
 *
 * Plan: the STORE OWNER's (getStorePlan — the rule requirePlan applies to the
 * pages: owner's subscription, anything not ACTIVE counts as FREE), never the
 * viewer's. A section the plan doesn't cover is `locked`: its items point at the
 * upgrade path, count toward nothing, and are not queried (always done: false).
 */

/** Items that count toward a target show `progress`. */
export const SETUP_TARGETS = {
  addMenuItems: 5,
  addItemPhotos: 3,
} as const satisfies Partial<Record<SetupItemId, number>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The StorefrontEvent types written once per public page load (not the CTA clicks). */
const STOREFRONT_PAGE_VIEW_EVENTS = ["VIEW", "MENU_VIEW", "ITEM_VIEW"] as const;

interface ItemSpec {
  section: SetupSection;
  /** Null: available on every plan. */
  feature: PlanFeature | null;
  /** The in-app page that does the job, for a store id. */
  path: (storeId: string) => string;
  /**
   * The allowedPages entry a staff persona needs for `path` to open instead of
   * redirecting, i.e. the key that page's requireStaffPageAccess checks. Null:
   * the page is requireOwnerOnly, so no persona can open it.
   */
  page: string | null;
}

/**
 * One row per item, in SETUP_ITEM_IDS order. Every path is a real route under
 * src/app/(app)/store/[storeId]/ and every ?tab= a value that page reads:
 *  - /storefront: StorefrontEditorClient VALID_TABS (settings | menu | reviews | analytics)
 *  - /pos/operational: OPERATIONAL_TABS (shift | …)
 *  - /data: DataViewClient DATA_TABS (materials | suppliers | …)
 */
export const SETUP_ITEM_SPECS: Record<SetupItemId, ItemSpec> = {
  publishStorefront: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=settings`,
    page: "/storefront",
  },
  addMenuItems: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=menu`,
    page: "/storefront",
  },
  addItemPhotos: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=menu`,
    page: "/storefront",
  },
  addBranding: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=settings`,
    page: "/storefront",
  },
  addWhatsapp: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=settings`,
    page: "/storefront",
  },
  // Where visits show up once the link is shared.
  firstVisit: {
    section: "storefront",
    feature: null,
    path: (id) => `/store/${id}/storefront?tab=analytics`,
    page: "/storefront",
  },
  firstSale: {
    section: "counter",
    feature: "posAccess",
    path: (id) => `/store/${id}/pos`,
    page: "/pos",
  },
  // /pos/operational itself opens on any POS Mode grant, but its Shift tab needs
  // "/pos" (resolveOperationalTabs → canManageShift); without it ?tab=shift
  // lands on another tab. Every persona that reads this checklist is a MANAGER,
  // a till-holding role, so "/pos" is the whole rule here.
  openShift: {
    section: "counter",
    feature: "posAccess",
    path: (id) => `/store/${id}/pos/operational?tab=shift`,
    page: "/pos",
  },
  addTables: {
    section: "counter",
    feature: "posAccess",
    path: (id) => `/store/${id}/tables`,
    page: "/tables",
  },
  addStockItems: {
    section: "operations",
    feature: "staffOperations",
    path: (id) => `/store/${id}/data?tab=materials`,
    page: "/data",
  },
  addSupplier: {
    section: "operations",
    feature: "supplierManagement",
    path: (id) => `/store/${id}/data?tab=suppliers`,
    page: "/data",
  },
  // The Staff page is requireOwnerOnly: no persona, Manager included.
  addStaff: {
    section: "operations",
    feature: "staffOperations",
    path: (id) => `/store/${id}/staff`,
    page: null,
  },
  publishSchedule: {
    section: "operations",
    feature: "staffOperations",
    path: (id) => `/store/${id}/schedule`,
    page: "/schedule",
  },
};

/**
 * Whether a viewer whose page grants are `personaPages` can open this item's
 * page. Null `personaPages`: the store's owner, who opens everything.
 */
export function canOpenSetupItem(
  spec: Pick<ItemSpec, "page">,
  personaPages: readonly string[] | null
): boolean {
  if (personaPages === null) return true;
  return spec.page !== null && personaPages.includes(spec.page);
}

/** SetupPlan has no ENTERPRISE; no checklist feature needs more than OPERATIONS today. */
function toSetupPlan(tier: PlanTier): SetupPlan {
  if (tier === "FREE" || tier === "POS") return tier;
  return "OPERATIONS";
}

/** The owner's picked goals that are real goals, deduped, in ONBOARDING_GOALS order. */
export function normalizeGoals(raw: readonly string[] | null | undefined): OnboardingGoal[] {
  const picked = new Set(raw ?? []);
  return ONBOARDING_GOALS.filter((goal) => picked.has(goal));
}

/** Goals first (in ONBOARDING_GOALS order), then every other section in SETUP_SECTIONS order. */
export function orderSections(goals: readonly OnboardingGoal[]): SetupSection[] {
  const first = SETUP_SECTIONS.filter((section) => (goals as readonly string[]).includes(section));
  const rest = SETUP_SECTIONS.filter((section) => !first.includes(section));
  return [...first, ...rest];
}

export function isWithinNewStoreWindow(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= NEW_STORE_WINDOW_DAYS * DAY_MS;
}

/** Existence check: resolves true when the query found a row. */
const exists = (query: Promise<{ id: string } | null>) => query.then((row) => row !== null);
const skipped = Promise.resolve(false);
const skippedCount = Promise.resolve(0);

/**
 * @param personaPages The viewing staff persona's page grants (its resolved
 *   allowedPages), or null for the store's owner. With grants, an unlocked item
 *   whose page the persona can't open (see canOpenSetupItem) is left out before
 *   anything is counted, so a Manager is never sent to a page that redirects
 *   them and `completed`/`total`/`allDone` describe only what they can do.
 *   Locked items stay (the section's upsell row), and a section left with no
 *   items is dropped from `sections`.
 * @throws Error("Store not found") for an unknown store id — the route checks
 *   access (and so existence) before calling this.
 */
export async function getSetupProgress(
  storeId: string,
  now: Date = new Date(),
  personaPages: readonly string[] | null = null
): Promise<SetupProgress> {
  const [store, plan] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        createdAt: true,
        business: { select: { onboardingGoals: true } },
        storefront: {
          select: {
            isPublished: true,
            logoUrl: true,
            heroImageUrl: true,
            whatsappNumber: true,
          },
        },
      },
    }),
    getStorePlan(storeId),
  ]);

  if (!store) throw new Error("Store not found");

  const counter = planHasFeature(plan, "posAccess");
  const operations = planHasFeature(plan, "staffOperations");
  const suppliers = planHasFeature(plan, "supplierManagement");
  const onStorefront = { storefront: { storeId } };

  // Locked sections are not queried: their items show the upgrade path whatever
  // the data says, and a FREE store then runs 3 of these 12 queries.
  const [
    menuItemCount,
    photoCount,
    hasVisit,
    hasSale,
    hasShift,
    hasTable,
    hasMaterial,
    hasProduct,
    hasSupplier,
    hasStaff,
    hasPublishedRoster,
    hasScheduleImage,
  ] = await Promise.all([
    prisma.menuItem.count({ where: onStorefront }),
    prisma.menuItem.count({
      where: { ...onStorefront, imageUrl: { not: null }, NOT: { imageUrl: "" } },
    }),
    // recordEvent() in storefront.service.ts writes one page-view event per
    // public page load: VIEW (profile), MENU_VIEW (/menu, where table QR codes
    // land) or ITEM_VIEW (an item page). Any of them is a visit. Like analytics,
    // this doesn't tell the owner's own visit apart from a customer's.
    exists(
      prisma.storefrontEvent.findFirst({
        where: { ...onStorefront, type: { in: [...STOREFRONT_PAGE_VIEW_EVENTS] } },
        select: { id: true },
      })
    ),
    counter
      ? exists(
          prisma.order.findFirst({
            where: {
              storeId,
              status: { notIn: NON_REVENUE_STATUSES },
              // Rung up at the till: a POS sale, or a delivery-platform order the
              // cashier keyed in under "Others". The Indonesian platforms also
              // arrive by email import, which never gets a queue number, so a
              // queue number is what tells a keyed-in one apart.
              OR: [
                { source: "POS" },
                { source: { in: [...POS_ONLINE_PLATFORMS] }, queueNumber: { not: null } },
              ],
            },
            select: { id: true },
          })
        )
      : skipped,
    counter
      ? exists(prisma.shift.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
    counter
      ? exists(prisma.table.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
    operations
      ? exists(prisma.material.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
    operations
      ? exists(prisma.product.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
    suppliers
      ? exists(prisma.supplier.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
    operations
      ? exists(
          prisma.staffMember.findFirst({
            where: { storeId, ...ACTIVE_STAFF_WHERE },
            select: { id: true },
          })
        )
      : skipped,
    // A roster counts once a day of it is published (StaffSchedule rows start as
    // DRAFT; ScheduleShift is only the reusable time-block template), or once a
    // roster image is up — images have no draft state.
    operations
      ? exists(
          prisma.staffSchedule.findFirst({
            where: { storeId, status: "PUBLISHED" },
            select: { id: true },
          })
        )
      : skipped,
    operations
      ? exists(prisma.scheduleImage.findFirst({ where: { storeId }, select: { id: true } }))
      : skipped,
  ]);

  const storefront = store.storefront;
  const done: Record<SetupItemId, boolean> = {
    publishStorefront: storefront?.isPublished ?? false,
    addMenuItems: menuItemCount >= SETUP_TARGETS.addMenuItems,
    addItemPhotos: photoCount >= SETUP_TARGETS.addItemPhotos,
    addBranding: Boolean(storefront?.logoUrl || storefront?.heroImageUrl),
    addWhatsapp: Boolean(storefront?.whatsappNumber?.trim()),
    firstVisit: hasVisit,
    firstSale: hasSale,
    openShift: hasShift,
    addTables: hasTable,
    addStockItems: hasMaterial || hasProduct,
    addSupplier: hasSupplier,
    addStaff: hasStaff,
    publishSchedule: hasPublishedRoster || hasScheduleImage,
  };
  const progress: Partial<Record<SetupItemId, SetupItem["progress"]>> = {
    addMenuItems: {
      current: Math.min(menuItemCount, SETUP_TARGETS.addMenuItems),
      target: SETUP_TARGETS.addMenuItems,
    },
    addItemPhotos: {
      current: Math.min(photoCount, SETUP_TARGETS.addItemPhotos),
      target: SETUP_TARGETS.addItemPhotos,
    },
  };

  const goals = normalizeGoals(store.business.onboardingGoals);
  const orderedSections = orderSections(goals);

  const items: SetupItem[] = orderedSections.flatMap((section) =>
    SETUP_ITEM_IDS.filter((id) => SETUP_ITEM_SPECS[id].section === section).flatMap((id) => {
      const spec = SETUP_ITEM_SPECS[id];
      const requiredTier: PlanTier = spec.feature ? minPlanFor(spec.feature) : "FREE";
      const locked = spec.feature !== null && !planHasFeature(plan, spec.feature);
      if (!locked && !canOpenSetupItem(spec, personaPages)) return [];
      const item: SetupItem = {
        id,
        section,
        done: locked ? false : done[id],
        locked,
        requiredPlan: toSetupPlan(requiredTier),
        href: locked ? upgradeHrefFor(requiredTier) : spec.path(storeId),
      };
      const itemProgress = progress[id];
      if (itemProgress && !locked) item.progress = itemProgress;
      return [item];
    })
  );
  const sections = orderedSections.filter((section) =>
    items.some((item) => item.section === section)
  );

  const unlocked = items.filter((item) => !item.locked);
  const completed = unlocked.filter((item) => item.done).length;
  const total = unlocked.length;

  return {
    storeId,
    items,
    sections,
    completed,
    total,
    allDone: total > 0 && completed === total,
    isNewStore: isWithinNewStoreWindow(store.createdAt, now),
    plan,
    goals,
  };
}
