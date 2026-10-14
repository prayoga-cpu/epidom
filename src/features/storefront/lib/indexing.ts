/**
 * Which public storefronts (/@slug) search engines should index.
 *
 * The sitemap listed every published storefront, so Google was handed test
 * pages ("testing", "testings", "demo-cmsbjfr6") and stores with no menu, a
 * name and the default "Welcome to our store!": thin pages that read as junk
 * on epidom.fr. One rule decides both things, so the sitemap never lists a URL
 * whose page says noindex:
 * - src/app/sitemap.ts lists only indexable storefronts;
 * - the storefront pages (/@slug, its menu and item pages) emit
 *   `noindex, follow` for the rest.
 *
 * A store becomes indexable on its own as soon as it fills its menu, and the
 * page still works for anyone with the link either way.
 */

/** Fewest available menu items for a storefront to be worth indexing. */
export const MIN_INDEXABLE_MENU_ITEMS = 3;

/**
 * Slugs and names people give a storefront they are only trying out. The
 * lookahead means a real name that merely starts with these letters
 * ("testarossa", "demoiselle") is not caught; "test-2", "testing" and
 * "demo-cmsbjfr6" are.
 */
const TEST_NAME = /^(?:test(?:ing)?s?|demo|dummy|sample|contoh)(?![a-z])/i;

export function looksLikeTestStorefront(slug: string, displayName: string): boolean {
  return TEST_NAME.test(slug.trim()) || TEST_NAME.test(displayName.trim());
}

export function isStorefrontIndexable({
  slug,
  displayName,
  availableMenuItemCount,
}: {
  slug: string;
  displayName: string;
  availableMenuItemCount: number;
}): boolean {
  return (
    !looksLikeTestStorefront(slug, displayName) &&
    availableMenuItemCount >= MIN_INDEXABLE_MENU_ITEMS
  );
}

/** Available items across a storefront's menu categories, as the public menu shows them. */
export function countAvailableMenuItems(
  menuCategories: ReadonlyArray<{ items: ReadonlyArray<{ isAvailable: boolean }> }>
): number {
  return menuCategories.reduce(
    (sum, category) => sum + category.items.filter((item) => item.isAvailable).length,
    0
  );
}

/** Next metadata `robots` value for a storefront page. */
export function storefrontRobots(storefront: {
  slug: string;
  displayName: string;
  menuCategories: ReadonlyArray<{ items: ReadonlyArray<{ isAvailable: boolean }> }>;
}): { index: boolean; follow: boolean } {
  const indexable = isStorefrontIndexable({
    slug: storefront.slug,
    displayName: storefront.displayName,
    availableMenuItemCount: countAvailableMenuItems(storefront.menuCategories),
  });
  return { index: indexable, follow: true };
}
