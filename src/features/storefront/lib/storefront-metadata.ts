import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Search-result titles and snippets for a merchant's public pages, in the
 * store's own language. These pages rank for the shop's name ("Ellens Bakery
 * menu"), so the title says what the visitor gets there, and the shop gets the
 * title rather than a "| Epidom Storefront" suffix.
 *
 * Only what the storefront really offers: "online ordering" appears only when
 * it accepts orders.
 */

/** What a storefront was created with until its owner writes a description. */
export const DEFAULT_STOREFRONT_DESCRIPTION = "Welcome to our store!";

interface StoreFacts {
  displayName: string;
  city?: string | null;
  acceptsOrders: boolean;
}

const cityPart = (city: string | null | undefined, joiner: string) =>
  city && city.trim() ? `${joiner}${city.trim()}` : "";

export function storefrontTitle({ displayName, city, acceptsOrders }: StoreFacts, locale: Locale) {
  const what = {
    fr: acceptsOrders ? "Menu et commande en ligne" : "Menu et horaires",
    id: acceptsOrders ? "Menu & Pesan Online" : "Menu & Jam Buka",
    en: acceptsOrders ? "Menu & Online Ordering" : "Menu & Opening Hours",
  }[locale];
  return `${displayName} — ${what}${cityPart(city, ", ")}`;
}

/** The owner's own words when they wrote some, else a plain line about the page. */
export function storefrontDescription(
  facts: StoreFacts & { description?: string | null; tagline?: string | null },
  locale: Locale
): string {
  const own = facts.description?.trim();
  if (own && own !== DEFAULT_STOREFRONT_DESCRIPTION) return own;
  if (facts.tagline?.trim()) return facts.tagline.trim();

  const { displayName: name, city, acceptsOrders } = facts;
  switch (locale) {
    case "fr":
      return acceptsOrders
        ? `Consultez le menu de ${name}${cityPart(city, " à ")}, les horaires, et commandez en ligne.`
        : `Consultez le menu de ${name}${cityPart(city, " à ")} et les horaires d'ouverture.`;
    case "id":
      return acceptsOrders
        ? `Lihat menu ${name}${cityPart(city, " di ")}, jam buka, dan pesan online.`
        : `Lihat menu ${name}${cityPart(city, " di ")} dan jam bukanya.`;
    default:
      return acceptsOrders
        ? `See ${name}'s menu${cityPart(city, " in ")}, opening hours, and order online.`
        : `See ${name}'s menu${cityPart(city, " in ")} and opening hours.`;
  }
}

export function storefrontMenuTitle({ displayName, city }: StoreFacts, locale: Locale) {
  const base = {
    fr: `Menu — ${displayName}`,
    id: `Menu ${displayName}`,
    en: `${displayName} Menu`,
  }[locale];
  return `${base}${cityPart(city, ", ")}`;
}

/** "Le menu de X : a, b, c… Commandez en ligne." — the dishes are what people search for. */
export function storefrontMenuDescription(
  { displayName: name, acceptsOrders }: StoreFacts,
  itemNames: string[],
  locale: Locale
): string {
  // A list cut short ends on the ellipsis alone, a full one on a period.
  const list = itemNames.length
    ? `${itemNames.slice(0, 4).join(", ")}${itemNames.length > 4 ? "…" : "."}`
    : "";
  switch (locale) {
    case "fr": {
      const head = list ? `Le menu de ${name}\u00a0: ${list}` : `Le menu de ${name}.`;
      return acceptsOrders ? `${head} Commandez en ligne.` : head;
    }
    case "id": {
      const head = list ? `Menu ${name}: ${list}` : `Menu ${name}.`;
      return acceptsOrders ? `${head} Pesan langsung secara online.` : head;
    }
    default: {
      const head = list ? `${name}'s menu: ${list}` : `${name}'s menu.`;
      return acceptsOrders ? `${head} Order online.` : head;
    }
  }
}

export function storefrontItemDescription(
  itemName: string,
  displayName: string,
  locale: Locale
): string {
  return {
    fr: `Commandez ${itemName} chez ${displayName}.`,
    id: `Pesan ${itemName} dari ${displayName}.`,
    en: `Order ${itemName} from ${displayName}.`,
  }[locale];
}

/**
 * schema.org type for the business: a café is a CafeOrCoffeeShop, a bakery a
 * Bakery, and so on; anything else stays the generic FoodEstablishment.
 */
export function schemaTypeForBusiness(businessType: string | null | undefined): string {
  switch (businessType) {
    case "cafe":
      return "CafeOrCoffeeShop";
    case "restaurant":
      return "Restaurant";
    case "bakery":
      return "Bakery";
    case "bar":
      return "BarOrPub";
    case "fastFood":
      return "FastFoodRestaurant";
    default:
      return "FoodEstablishment";
  }
}
