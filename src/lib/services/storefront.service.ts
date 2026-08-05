import { prisma } from "@/lib/prisma";
import type {
  UpdateStorefrontInput,
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "@/lib/validation/storefront.schemas";
import { Prisma, Department } from "@prisma/client";

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
    return prisma.storefront.findUnique({
      where: { slug },
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
          select: {
            business: {
              select: {
                user: { select: { currency: true } },
              },
            },
          },
        },
      },
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

      // Create draft storefront
      storefront = await prisma.storefront.create({
        data: {
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
   * Increment view count analytics (unauthenticated / public)
   */
  async incrementViewCount(slug: string) {
    return prisma.storefront.update({
      where: { slug },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
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
      select: { store: { select: { business: { select: { user: { select: { currency: true } } } } } } },
    });
    return storefront?.store.business.user.currency ?? "IDR";
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

      await prisma.menuItem.create({
        data: {
          storefrontId: storefront.id,
          categoryId,
          productId: product.id,
          name: product.name,
          department: product.department ?? "KITCHEN",
          price: new Prisma.Decimal(Number(product.sellingPrice)),
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
