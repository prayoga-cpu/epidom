import { prisma } from "@/lib/prisma";
import { planAtLeast } from "@/lib/plans/entitlements";
import { getStorePlan } from "@/lib/plans/store-plan";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { canAccessStaffPage } from "@/lib/auth/require-staff-page-access";

/**
 * How many items the till can sell: the same set GET /api/stores/[id]/pos/menu
 * returns — the storefront's items shown on the cashier, without the optional
 * second product line (Product.productLine CUSTOM) while the store has it off.
 * A store with no storefront has none.
 *
 * The CUSTOM filter is spelled out for items with no product: a bare
 * `NOT product.productLine = CUSTOM` drops them in SQL (NULL, not true).
 */
export async function countTillMenuItems(
  storeId: string,
  customProductsEnabled: boolean
): Promise<number> {
  return prisma.menuItem.count({
    where: {
      storefront: { storeId },
      showOnCashier: true,
      ...(customProductsEnabled
        ? {}
        : { OR: [{ productId: null }, { product: { productLine: { not: "CUSTOM" } } }] }),
    },
  });
}

/**
 * Where the viewer adds the menu the till sells from, or null when they can't:
 *  - the Data page (Products), on a plan that has it (OPERATIONS) and when
 *    their persona may open it;
 *  - otherwise the storefront's Menu tab, which every plan has;
 *  - null for a linked staff account (Back Office is the owner's shell, see
 *    (dashboard)/layout.tsx) and for a persona granted neither page.
 *
 * Only ever a page the viewer can actually open: sending them anywhere else
 * would bounce them back to the POS, which would send them out again.
 * `?from=pos` tells the page why they are there.
 */
export async function resolveMenuSetupHref(storeId: string): Promise<string | null> {
  const viewer = await getStoreViewer(storeId);
  if (viewer.kind !== "owner") return null;

  const plan = await getStorePlan(storeId);
  if (planAtLeast(plan, "OPERATIONS") && (await canAccessStaffPage(storeId, "/data"))) {
    return `/store/${storeId}/data?from=pos`;
  }
  if (await canAccessStaffPage(storeId, "/storefront")) {
    return `/store/${storeId}/storefront?tab=menu&from=pos`;
  }
  return null;
}
