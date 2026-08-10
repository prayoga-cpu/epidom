import { prisma } from "@/lib/prisma";
import type {
  UpdateStorefrontInput,
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
  RecordStorefrontEventInput,
} from "@/lib/validation/storefront.schemas";
import { Prisma, Department } from "@prisma/client";
import { getExchangeRate } from "./exchange-rate.service";
import { getFinanceSettings } from "./finance-settings.service";

export class StorefrontService {
  /**
   * Slugify a string helper
   */
  slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/&/g, "-and-") // Replace & with 'and'
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  }

  /**
   * Get storefront by its public slug
   */
  async getStorefrontBySlug(slug: string) {
    const storefront = await prisma.storefront.findFirst({
      // Deactivated owners' storefronts go offline for the duration of the
      // deactivation (comes back automatically on reactivation, since this
      // is a live filter rather than a cached flag).
      where: { slug, store: { business: { user: { deactivatedAt: null } } } },
      include: {
        menuCategories: {
          orderBy: { displayOrder: "asc" },
          include: {
            items: {
              orderBy: { displayOrder: "asc" },
              include: {
                product: {
                  select: {
                    optionGroups: {
                      orderBy: { displayOrder: "asc" },
                      include: { options: { orderBy: { displayOrder: "asc" } } },
                    },
                  },
                },
              },
            },
          },
        },
        store: {
          select: { id: true },
        },
      },
    });
    if (!storefront) return storefront;

    // The store's resolved currency (store-or-business, per
    // syncFinanceWithBusiness) — moved off the old User.currency, which
    // this storefront's owner no longer has.
    const { currency } = await getFinanceSettings(storefront.store.id);
    return {
      ...storefront,
      store: { ...storefront.store, currency },
    };
  }

  /**
   * One real, currently-published storefront to link to as a live example
   * from the marketing homepage ("see a real storefront"). Picked by
   * highest view count so it's an actually-active shop, not an abandoned
   * draft that happened to toggle isPublished on once. Never hardcode a
   * specific slug in marketing copy — always resolve this at request time,
   * since a merchant can unpublish or deactivate at any point.
   */
  async getExampleStorefrontSlug(): Promise<string | null> {
    const storefront = await prisma.storefront.findFirst({
      where: { isPublished: true, store: { business: { user: { deactivatedAt: null } } } },
      orderBy: { viewCount: "desc" },
      select: { slug: true },
    });
    return storefront?.slug ?? null;
  }

  /**
   * Slugs + last-update timestamp for every live, published storefront —
   * used to build the dynamic sitemap. Same deactivation filter as
   * getStorefrontBySlug so a deactivated owner's page drops out of the
   * sitemap for the duration of the deactivation.
   */
  async getPublishedSlugsForSitemap() {
    return prisma.storefront.findMany({
      where: { isPublished: true, store: { business: { user: { deactivatedAt: null } } } },
      select: { slug: true, updatedAt: true },
    });
  }

  /**
   * Get storefront by storeId.
   * Automatically creates a draft storefront if one doesn't exist yet.
   */
  async getStorefrontByStoreId(storeId: string) {
    let storefront = await prisma.storefront.findUnique({
      where: { storeId },
      include: {
        menuCategories: {
          orderBy: { displayOrder: "asc" },
          include: {
            items: {
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
    });

    if (!storefront) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        throw new Error("Store not found");
      }

      // Generate unique slug
      let baseSlug = this.slugify(store.name);
      if (baseSlug.length < 3) baseSlug = `store-${storeId.substring(0, 5)}`;

      let slug = baseSlug;
      let count = 1;
      while (true) {
        const existing = await prisma.storefront.findUnique({ where: { slug } });
        if (!existing) break;
        slug = `${baseSlug}-${count}`;
        count++;
      }

      // Upsert on storeId (not create): two requests racing to auto-create the
      // first storefront for a store (e.g. two products created back-to-back
      // before either finishes) would otherwise both pass the findUnique check
      // above, both attempt to create, and the loser would throw a unique
      // constraint error — silently swallowed by autoLinkProductToMenu's
      // catch, so that product would never get its POS menu item. Upsert
      // makes the second caller a no-op update instead of a failed create.
      storefront = await prisma.storefront.upsert({
        where: { storeId },
        create: {
          storeId,
          slug,
          displayName: store.name,
          description: "Welcome to our store!",
          themeColor: "#FF6B35",
          fontFamily: "Inter",
          isPublished: false,
          // Accept online orders by default; merchants can pause via settings.
          acceptsOrders: true,
          customLinks: [],
          openingHours: {
            monday: { open: "09:00", close: "21:00", isClosed: false },
            tuesday: { open: "09:00", close: "21:00", isClosed: false },
            wednesday: { open: "09:00", close: "21:00", isClosed: false },
            thursday: { open: "09:00", close: "21:00", isClosed: false },
            friday: { open: "09:00", close: "21:00", isClosed: false },
            saturday: { open: "09:00", close: "21:00", isClosed: false },
            sunday: { open: "09:00", close: "21:00", isClosed: true },
          },
        },
        update: {},
        include: {
          menuCategories: {
            orderBy: { displayOrder: "asc" },
            include: {
              items: {
                orderBy: { displayOrder: "asc" },
              },
            },
          },
        },
      });
    }

    return storefront;
  }

  /**
   * Update storefront settings
   */
  async updateStorefront(storeId: string, input: UpdateStorefrontInput) {
    let existingStorefront = await prisma.storefront.findUnique({
      where: { storeId },
    });

    if (!existingStorefront) {
      // Auto-create draft storefront (same as getStorefrontByStoreId)
      existingStorefront = (await this.getStorefrontByStoreId(storeId)) as any;
    }

    // Verify slug uniqueness if slug is being changed
    if (input.slug && input.slug !== existingStorefront!.slug) {
      const slugExists = await prisma.storefront.findUnique({
        where: { slug: input.slug },
      });
      if (slugExists) {
        throw new Error("This URL slug is already taken. Please choose another one.");
      }
    }

    return prisma.storefront.update({
      where: { storeId },
      data: {
        slug: input.slug,
        displayName: input.displayName,
        tagline: input.tagline,
        description: input.description,
        logoUrl: input.logoUrl,
        heroImageUrl: input.heroImageUrl,
        themeColor: input.themeColor,
        fontFamily: input.fontFamily,
        whatsappNumber: input.whatsappNumber,
        instagramUrl: input.instagramUrl,
        tiktokUrl: input.tiktokUrl,
        gofoodUrl: input.gofoodUrl,
        grabfoodUrl: input.grabfoodUrl,
        shopeefoodUrl: input.shopeefoodUrl,
        googleMapsUrl: input.googleMapsUrl,
        customLinks:
          input.customLinks === undefined
            ? undefined
            : (input.customLinks as Prisma.InputJsonValue),
        isPublished: input.isPublished,
        acceptsOrders: input.acceptsOrders,
        acceptsReservations: input.acceptsReservations,
        openingHours:
          input.openingHours === undefined
            ? undefined
            : (input.openingHours as Prisma.InputJsonValue),
      },
    });
  }

  /**
   * Record a public storefront analytics event (unauthenticated). Resolves
   * by slug since that's all the public route has. Also bumps the legacy
   * `viewCount` counter on `VIEW` events so it stays a meaningful lifetime
   * total alongside the richer `StorefrontEvent` log.
   */
  async recordEvent(
    slug: string,
    input: RecordStorefrontEventInput & { visitorHash: string }
  ): Promise<{ success: boolean }> {
    const storefront = await prisma.storefront.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!storefront) return { success: false };

    await prisma.storefrontEvent.create({
      data: {
        storefrontId: storefront.id,
        type: input.type,
        menuItemId: input.menuItemId,
        menuItemName: input.menuItemName,
        visitorHash: input.visitorHash,
        referrer: input.referrer,
      },
    });

    if (input.type === "VIEW") {
      await prisma.storefront.update({
        where: { id: storefront.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return { success: true };
  }

  // ========================================
  // Menu Category Operations
  // ========================================

  async createMenuCategory(storefrontId: string, input: CreateMenuCategoryInput) {
    // Get max order
    const maxOrder = await prisma.menuCategory.aggregate({
      where: { storefrontId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    return prisma.menuCategory.create({
      data: {
        storefrontId,
        name: input.name,
        displayOrder: input.displayOrder ?? nextOrder,
      },
    });
  }

  async updateMenuCategory(
    categoryId: string,
    storefrontId: string,
    input: UpdateMenuCategoryInput
  ) {
    // Verify ownership
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.storefrontId !== storefrontId) {
      throw new Error("Category not found or does not belong to this storefront");
    }

    return prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name,
        displayOrder: input.displayOrder,
      },
    });
  }

  /**
   * Delete a menu category.
   * In "uncategorize" mode (default) the category's items are kept and fall
   * back to Uncategorized (DB cascade sets MenuItem.categoryId to null). In
   * "delete" mode the items themselves are deleted along with the category.
   */
  async deleteMenuCategory(
    categoryId: string,
    storefrontId: string,
    mode: "uncategorize" | "delete" = "uncategorize"
  ) {
    // Verify ownership
    const category = await prisma.menuCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.storefrontId !== storefrontId) {
      throw new Error("Category not found or does not belong to this storefront");
    }

    if (mode === "delete") {
      await prisma.menuItem.deleteMany({ where: { categoryId } });
    }

    return prisma.menuCategory.delete({
      where: { id: categoryId },
    });
  }

  // ========================================
  // Menu Item Operations
  // ========================================

  async createMenuItem(storefrontId: string, input: CreateMenuItemInput) {
    // Get max order in category (or general if category is null)
    const maxOrder = await prisma.menuItem.aggregate({
      where: {
        storefrontId,
        categoryId: input.categoryId ?? null,
      },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    const currency = input.currency ?? (await this.getOwnerCurrency(storefrontId));

    return prisma.menuItem.create({
      data: {
        storefrontId,
        categoryId: input.categoryId,
        productId: input.productId,
        department: input.department,
        name: input.name,
        description: input.description,
        price: new Prisma.Decimal(input.price),
        currency,
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        isFeatured: input.isFeatured,
        displayOrder: input.displayOrder ?? nextOrder,
        modifiers:
          input.modifiers === undefined ? undefined : (input.modifiers as Prisma.InputJsonValue),
      },
    });
  }

  /**
   * The currency a menu item should default to when none is supplied — the
   * storefront owner's configured display currency, not a hardcoded IDR.
   */
  private async getOwnerCurrency(storefrontId: string): Promise<string> {
    const storefront = await prisma.storefront.findUnique({
      where: { id: storefrontId },
      select: { store: { select: { id: true } } },
    });
    if (!storefront) return "IDR";
    return this.resolveStoreCurrency(storefront.store.id);
  }

  /**
   * getFinanceSettings() throws when the store doesn't exist — appropriate
   * for request handlers, but not here: a not-found store should just mean
   * "no currency conversion to apply" (matches the old direct-Prisma-lookup
   * behavior this replaced), not fail whatever bulk operation is mid-flight.
   */
  private async resolveStoreCurrency(storeId: string): Promise<string> {
    try {
      return (await getFinanceSettings(storeId)).currency;
    } catch {
      return "IDR";
    }
  }

  /**
   * Resolve the store owner's currency and the live IDR->currency rate once.
   * Bulk callers (CSV/Smart Import processing many rows) should fetch this a
   * single time and pass the rate to `convertBaseToOwnerSync`/
   * `convertOwnerToBaseSync` per row, rather than re-querying per row.
   */
  async getOwnerCurrencyAndRate(storeId: string): Promise<{ currency: string; rate: number }> {
    const currency = await this.resolveStoreCurrency(storeId);
    if (currency === "IDR") return { currency, rate: 1 };

    const { rate } = await getExchangeRate("IDR", currency);
    return { currency, rate };
  }

  /**
   * Convert an amount stored in the platform base currency (IDR) — e.g. a
   * linked Product's costPrice/sellingPrice — into the store owner's live
   * display currency. `MenuItem.price` must always be a literal value in
   * the owner's own currency, so any Product price synced into a MenuItem
   * has to pass through this first, or a non-IDR store's menu silently
   * mis-prices by the full exchange-rate factor (e.g. a €1 product
   * showing as "€20,833.33").
   */
  async convertBaseCurrencyToOwner(
    storeId: string,
    amountInBase: number
  ): Promise<{ price: number; currency: string }> {
    const { currency, rate } = await this.getOwnerCurrencyAndRate(storeId);
    return { price: this.convertBaseToOwnerSync(amountInBase, rate), currency };
  }

  /** Pure version of the IDR->owner conversion for a pre-fetched rate. */
  convertBaseToOwnerSync(amountInBase: number, rate: number): number {
    if (rate === 1) return amountInBase;
    return Math.round(amountInBase * rate * 100) / 100;
  }

  /**
   * Inverse of `convertBaseToOwnerSync`: convert an amount a merchant typed
   * or imported in their own currency into the platform base currency (IDR)
   * for storage — the same conversion the Add/Edit Product form applies via
   * `useCurrency().convertToBase()` before submitting. CSV/Smart Import
   * writes Product/Material cost fields directly (see `actions.ts`) and must
   * apply this too, or an imported row's price is stored as a raw literal
   * and later silently mis-displayed by the full exchange-rate factor
   * everywhere Product/Material costs are shown.
   */
  convertOwnerToBaseSync(amountInOwnerCurrency: number, rate: number): number {
    if (rate === 1) return amountInOwnerCurrency;
    return Math.round((amountInOwnerCurrency / rate) * 100) / 100;
  }

  async updateMenuItem(itemId: string, storefrontId: string, input: UpdateMenuItemInput) {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.storefrontId !== storefrontId) {
      throw new Error("Menu item not found or does not belong to this storefront");
    }

    return prisma.menuItem.update({
      where: { id: itemId },
      data: {
        categoryId: input.categoryId !== undefined ? input.categoryId : item.categoryId,
        productId: input.productId !== undefined ? input.productId : item.productId,
        department: input.department !== undefined ? input.department : item.department,
        name: input.name !== undefined ? input.name : item.name,
        description: input.description !== undefined ? input.description : item.description,
        price: input.price !== undefined ? new Prisma.Decimal(input.price) : item.price,
        currency: input.currency !== undefined ? input.currency : item.currency,
        imageUrl: input.imageUrl !== undefined ? input.imageUrl : item.imageUrl,
        isAvailable: input.isAvailable !== undefined ? input.isAvailable : item.isAvailable,
        isFeatured: input.isFeatured !== undefined ? input.isFeatured : item.isFeatured,
        displayOrder: input.displayOrder !== undefined ? input.displayOrder : item.displayOrder,
        modifiers:
          input.modifiers !== undefined
            ? (input.modifiers as Prisma.InputJsonValue)
            : (item.modifiers as Prisma.InputJsonValue),
      },
    });
  }

  async deleteMenuItem(itemId: string, storefrontId: string) {
    const item = await prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.storefrontId !== storefrontId) {
      throw new Error("Menu item not found or does not belong to this storefront");
    }

    return prisma.menuItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Auto-link a product to the store's POS/storefront menu as a new MenuItem,
   * unless one is already linked. Mirrors the manual "Add to POS menu" action
   * (see useAddProductToMenu) so a product added via any path — the add-product
   * dialog, CSV import, or a one-off backfill — shows up in the cashier/menu by
   * default. Users can still remove it manually afterward (deletes the MenuItem
   * row, same as today). Non-fatal: menu-linking failures never block product
   * creation/import.
   */
  async autoLinkProductToMenu(
    storeId: string,
    product: {
      id: string;
      name: string;
      sellingPrice: number | string;
      category?: string | null;
      department?: Department;
    }
  ): Promise<void> {
    try {
      const alreadyLinked = await prisma.menuItem.findFirst({
        where: { productId: product.id },
        select: { id: true },
      });
      if (alreadyLinked) return;

      const storefront = await this.getStorefrontByStoreId(storeId);

      let categoryId: string | null = null;
      if (product.category) {
        const categoryName = product.category;
        const match = storefront.menuCategories.find(
          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
        );
        if (match) {
          categoryId = match.id;
        } else {
          const maxCatOrder = await prisma.menuCategory.aggregate({
            where: { storefrontId: storefront.id },
            _max: { displayOrder: true },
          });
          const created = await this.createMenuCategory(storefront.id, {
            name: categoryName,
            displayOrder: (maxCatOrder._max.displayOrder ?? -1) + 1,
          });
          categoryId = created.id;
        }
      }

      const maxItemOrder = await prisma.menuItem.aggregate({
        where: { storefrontId: storefront.id, categoryId },
        _max: { displayOrder: true },
      });

      // product.sellingPrice is stored in IDR (the platform base currency);
      // MenuItem.price must be a literal value in the owner's own currency.
      const { price, currency } = await this.convertBaseCurrencyToOwner(
        storeId,
        Number(product.sellingPrice)
      );

      await prisma.menuItem.create({
        data: {
          storefrontId: storefront.id,
          categoryId,
          productId: product.id,
          name: product.name,
          department: product.department ?? "KITCHEN",
          price: new Prisma.Decimal(price),
          currency,
          isAvailable: true,
          displayOrder: (maxItemOrder._max.displayOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      console.error(
        `[auto-link-product-to-menu] storeId=${storeId} productId=${product.id}:`,
        error
      );
    }
  }
}

export const storefrontService = new StorefrontService();
