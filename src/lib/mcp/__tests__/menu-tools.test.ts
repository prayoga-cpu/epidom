import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The menu tools: composable items (option groups), previews that write
 * nothing, all-or-nothing bulk changes, categories and stock-linked choices.
 */

const prisma = vi.hoisted(() => ({
  mcpToolCall: { create: vi.fn(async () => ({})) },
  storefront: { findUnique: vi.fn() },
  menuItem: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  productOptionGroup: { findMany: vi.fn(async () => []) },
  menuCategory: {
    findMany: vi.fn(),
    update: vi.fn((args: unknown) => args),
    delete: vi.fn((args: unknown) => args),
    deleteMany: vi.fn(),
  },
  product: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  material: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const storefrontService = vi.hoisted(() => ({
  getStorefrontByStoreId: vi.fn(),
  resolveMenuCategoryId: vi.fn(),
  createMenuItem: vi.fn(),
  // IDR → the store's currency; IDR stores use rate 1.
  getOwnerCurrencyAndRate: vi.fn(async () => ({ currency: "IDR", rate: 1 })),
}));
const productRepository = vi.hoisted(() => ({ updateOptionGroups: vi.fn() }));
const authorizeMcpStore = vi.hoisted(() => vi.fn());
const recordAction = vi.hoisted(() =>
  vi.fn(async (_input: { actionType: string; payload: unknown }) => "chg-1" as string | null)
);

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/audit/record", () => ({ recordAction }));
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService }));
vi.mock("@/lib/repositories/product.repository", () => ({ productRepository }));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));
vi.mock("@/lib/services/finance-settings.service", () => ({
  getFinanceSettings: async () => ({ currency: "IDR" }),
}));
vi.mock("../authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authorize")>()),
  authorizeMcpStore,
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));
vi.mock("@/lib/audit/activity", () => ({ writeActivityEvent: vi.fn(async () => undefined) }));

import { Prisma } from "@prisma/client";
import {
  menuCategoriesChangeSchema,
  menuItemsChangeSchema,
  menuProductOptionsChangeSchema,
} from "@/lib/audit/menu-undo";
import {
  createMenuItems,
  manageCategory,
  setProductOptions,
  updateMenuItem,
  updateMenuItems,
} from "../tools/menu";

const call = {
  principal: {
    userId: "owner-user",
    clientId: "c1",
    clientName: "Claude",
    scopes: ["epidom:read", "epidom:write"],
  },
  meta: {
    requestId: "r1",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
};

const run = async (
  tool: { run: (a: Record<string, unknown>, c: typeof call) => Promise<any> },
  args: Record<string, unknown>
) => {
  const result = await tool.run({ storeId: "store-1", ...args }, call);
  const text = (result.content[0] as { text: string }).text;
  return { isError: Boolean(result.isError), text, json: result.isError ? null : JSON.parse(text) };
};

const SF = {
  id: "sf-1",
  menuCategories: [
    { id: "cat-base", name: "BUILD YOUR OWN - BASE" },
    { id: "cat-sauce", name: "BUILD YOUR OWN - SAUCE" },
  ],
};
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Item ${id}`,
  price: new Prisma.Decimal(20000),
  description: null,
  categoryId: "cat-base",
  department: "KITCHEN",
  isAvailable: true,
  showOnCashier: true,
  isFeatured: false,
  productId: null,
  buildYourOwn: false,
  modifiers: [],
  product: null,
  ...overrides,
});

describe("menu tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Interactive transactions run against the same mock client.
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : arg
    );
    prisma.menuItem.update.mockImplementation(
      async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...row(args.where.id),
        ...args.data,
      })
    );
    prisma.productOptionGroup.findMany.mockResolvedValue([]);
    authorizeMcpStore.mockResolvedValue({
      storeId: "store-1",
      store: { id: "store-1", businessId: "b1", name: "OTIUM" },
      principal: call.principal,
      role: "OWNER",
      staffMemberId: null,
      actor: {
        kind: "USER",
        refId: "owner-user",
        displayName: "Evan",
        email: null,
        adminGrantSource: null,
      },
    });
    storefrontService.getStorefrontByStoreId.mockResolvedValue(SF);
    storefrontService.getOwnerCurrencyAndRate.mockResolvedValue({ currency: "IDR", rate: 1 });
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.update.mockResolvedValue({});
    prisma.menuItem.updateMany.mockResolvedValue({ count: 0 });
    prisma.storefront.findUnique.mockResolvedValue(SF);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.menuCategory.findMany.mockResolvedValue([]);
  });

  describe("create_menu_items", () => {
    const byo = {
      name: "Build Your Own",
      price: 0,
      category: "BUILD YOUR OWN",
      composable: true,
      optionGroups: [
        {
          name: "Base",
          required: true,
          maxSelect: 1,
          options: [{ fromMenuItemId: "quinoa" }, { name: "Rice", priceDelta: 15000 }],
        },
        {
          name: "Sauce",
          maxSelect: null,
          options: [
            { name: "Pesto", priceDelta: 15000 },
            { name: "Green oil", priceDelta: 10000 },
          ],
        },
      ],
    };

    beforeEach(() => {
      prisma.menuItem.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
        args.where.id ? [{ id: "quinoa", name: "Quinoa", price: 20000, productId: "p-quinoa" }] : []
      );
    });

    it("previews a composable item without writing anything, copying name and price", async () => {
      const { json } = await run(createMenuItems, { mode: "preview", items: [byo] });
      expect(storefrontService.createMenuItem).not.toHaveBeenCalled();
      expect(storefrontService.resolveMenuCategoryId).not.toHaveBeenCalled();
      expect(storefrontService.getStorefrontByStoreId).not.toHaveBeenCalled();
      const [item] = json.wouldCreate;
      expect(item.category).toEqual({ name: "BUILD YOUR OWN", exists: false });
      expect(item.composable).toBe(true);
      expect(item.optionGroups[0].options[0]).toMatchObject({
        name: "Quinoa",
        priceDelta: "20000.00",
      });
      // "as many as the group has" for maxSelect: null
      expect(item.optionGroups[1].maxSelect).toBe(2);
      // the copied option isn't stock-linked: the person is told
      expect(json.warnings[0]).toMatch(/will NOT deduct that stock/);
    });

    it("commits the option groups as the item's own modifiers and flags it composable", async () => {
      storefrontService.resolveMenuCategoryId.mockResolvedValue("cat-new");
      storefrontService.createMenuItem.mockResolvedValue(
        row("new-1", { name: "Build Your Own", price: new Prisma.Decimal(0) })
      );
      const { json } = await run(createMenuItems, { items: [byo] });
      const payload = storefrontService.createMenuItem.mock.calls[0][1];
      expect(payload.buildYourOwn).toBe(true);
      expect(payload.categoryId).toBe("cat-new");
      expect(payload.modifiers[0]).toEqual({
        name: "Base",
        isRequired: true,
        maxSelections: 1,
        options: [
          { name: "Quinoa", priceAdd: 20000 },
          { name: "Rice", priceAdd: 15000 },
        ],
      });
      expect(json.created).toHaveLength(1);
      // The history row validates against the catalogue schema and can delete what was added.
      const recorded = recordAction.mock.calls[0][0];
      expect(recorded.actionType).toBe("menu.items.change");
      const change = menuItemsChangeSchema.parse(recorded.payload);
      expect(change.created.map((c) => c.id)).toEqual(["new-1"]);
      expect(json.changeId).toBe("chg-1");
    });

    it("refuses what Epidom can't represent instead of approximating it", async () => {
      const bad = {
        ...byo,
        optionGroups: [{ name: "Protein", minSelect: 2, options: [{ name: "Chicken" }] }],
      };
      const { isError, text } = await run(createMenuItems, { items: [bad] });
      expect(isError).toBe(true);
      expect(text).toMatch(/only require "at least one"/);
    });

    it("skips an unknown linkedProductId and a composable item with no groups", async () => {
      const { json } = await run(createMenuItems, {
        mode: "preview",
        items: [
          { name: "A", price: 1, linkedProductId: "foreign" },
          { name: "B", price: 1, composable: true },
        ],
      });
      expect(json.wouldCreate).toHaveLength(0);
      expect(json.skipped.map((s: { reason: string }) => s.reason)).toEqual([
        expect.stringMatching(/isn't a product of this store/),
        expect.stringMatching(/composable needs optionGroups/),
      ]);
    });

    it("takes the department from the linked product unless one is given", async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: "p1", name: "Latte", department: "BAR", optionGroups: [] },
      ]);
      const { json } = await run(createMenuItems, {
        mode: "preview",
        items: [{ name: "Latte", price: 30000, linkedProductId: "p1" }],
      });
      expect(json.wouldCreate[0]).toMatchObject({ department: "BAR", linkedProduct: { id: "p1" } });
    });
  });

  describe("update_menu_item(s)", () => {
    it("can move an item to the bar and link a product (department follows the product)", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a")]);
      prisma.product.findMany.mockResolvedValue([
        { id: "p-bar", name: "Espresso", department: "BAR", optionGroups: [] },
      ]);
      const { json } = await run(updateMenuItem, { itemId: "a", linkedProductId: "p-bar" });
      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: "a" },
        data: expect.objectContaining({ productId: "p-bar", department: "BAR" }),
      });
      expect(json.updated[0].changes.department).toEqual({ from: "KITCHEN", to: "BAR" });
      // before and after images are what an undo restores
      const change = menuItemsChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      expect(change.updated[0].before.department).toBe("KITCHEN");
      expect(change.updated[0].after.department).toBe("BAR");
    });

    it("previews a single change with before and after, writing nothing", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a")]);
      const { json } = await run(updateMenuItem, {
        itemId: "a",
        mode: "preview",
        price: 25000,
        department: "BAR",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(json.changes[0].changes).toEqual({
        price: { from: "20000.00", to: "25000.00" },
        department: { from: "KITCHEN", to: "BAR" },
      });
    });

    it("hides many items in one transaction", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a"), row("b"), row("c")]);
      const { json } = await run(updateMenuItems, {
        updates: ["a", "b", "c"].map((itemId) => ({ itemId, available: false, onTill: false })),
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.menuItem.update).toHaveBeenCalledTimes(3);
      expect(json.updated).toHaveLength(3);
    });

    it("applies none of them when one id is unknown (all or nothing)", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a")]);
      const { isError, text } = await run(updateMenuItems, {
        updates: [
          { itemId: "a", available: false },
          { itemId: "ghost", available: false },
        ],
      });
      expect(isError).toBe(true);
      expect(text).toMatch(/No menu item with id ghost/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.menuItem.update).not.toHaveBeenCalled();
    });

    it("replaces an item's option groups and refuses composable without any", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a")]);
      const bare = await run(updateMenuItem, { itemId: "a", composable: true });
      expect(bare.isError).toBe(true);
      expect(bare.text).toMatch(/can't be composable without option groups/);

      await run(updateMenuItem, {
        itemId: "a",
        composable: true,
        optionGroups: [{ name: "Size", options: [{ name: "Large", priceDelta: 5000 }] }],
      });
      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: "a" },
        data: expect.objectContaining({
          buildYourOwn: true,
          modifiers: [
            {
              name: "Size",
              isRequired: false,
              maxSelections: 1,
              options: [{ name: "Large", priceAdd: 5000 }],
            },
          ],
        }),
      });
    });

    it("never creates a category in preview", async () => {
      prisma.menuItem.findMany.mockResolvedValue([row("a")]);
      const { json } = await run(updateMenuItem, {
        itemId: "a",
        mode: "preview",
        category: "BUILD YOUR OWN",
      });
      expect(storefrontService.resolveMenuCategoryId).not.toHaveBeenCalled();
      expect(json.newCategories).toEqual(["BUILD YOUR OWN"]);
    });
  });

  // One price per product: a linked menu item and its inventory product are the
  // same thing on sale, so a price change reaches both in one transaction.
  describe("linked product price", () => {
    const earlGrey = (overrides: Record<string, unknown> = {}) =>
      row("a", {
        name: "Earl grey",
        price: new Prisma.Decimal(30000),
        productId: "p1",
        product: { name: "Earl grey", buildYourOwn: false, optionGroups: [] },
        ...overrides,
      });
    const product = (price: number) => ({
      id: "p1",
      name: "Earl grey",
      sku: "EARL-GREY",
      sellingPrice: new Prisma.Decimal(price),
      costPrice: new Prisma.Decimal(0),
    });
    /** menuItem.findMany: the call's own rows by id, other items by productId. */
    const menuRows = (own: unknown[], linked: unknown[] = []) =>
      prisma.menuItem.findMany.mockImplementation(
        async (args: { where: { productId?: string } }) => (args.where.productId ? linked : own)
      );

    it("sets the product's price in the same transaction as the menu item", async () => {
      menuRows([earlGrey()]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 45000 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { sellingPrice: new Prisma.Decimal("45000.00") },
      });
      expect(json.updated[0].price).toBe("45000.00");
      expect(json.linkedProducts).toEqual([
        expect.objectContaining({
          productId: "p1",
          name: "Earl grey",
          sku: "EARL-GREY",
          sellingPrice: { from: "30000.00", to: "45000.00" },
        }),
      ]);
      // The change history names the product too, and holds its before/after for undo.
      const change = menuItemsChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      // (the mocked update returns the default row, hence "Item a")
      expect(change.summary).toBe(
        "Changed 1 menu item: Item a; also set linked product Earl grey (EARL-GREY) to 45000.00"
      );
      expect(change.products).toEqual([
        { id: "p1", name: "Earl grey", sku: "EARL-GREY", before: "30000.00", after: "45000.00" },
      ]);
    });

    it("also moves the other menu items linked to the product", async () => {
      const sibling = earlGrey({ id: "b", name: "Earl grey (iced)" });
      prisma.menuItem.findMany.mockImplementation(
        async (args: { where: { productId?: string; id?: { in: string[] } } }) => {
          if (args.where.productId) return [sibling];
          const ids = args.where.id?.in ?? [];
          if (ids.includes("b") && !ids.includes("a")) {
            return [{ ...sibling, price: new Prisma.Decimal(45000) }];
          }
          return [earlGrey()];
        }
      );
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 45000 });

      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["b"] } },
        data: { price: new Prisma.Decimal(45000), currency: "IDR" },
      });
      expect(json.linkedProducts[0].alsoUpdatesMenuItems).toEqual([
        { itemId: "b", name: "Earl grey (iced)" },
      ]);
      const change = menuItemsChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      expect(change.updated.map((u) => u.before.id)).toEqual(["a", "b"]);
      expect(change.updated[1].before.price).toBe("30000.00");
      expect(change.updated[1].after.price).toBe("45000.00");
      expect(change.summary).toMatch(/and 1 other menu item/);
    });

    it("repairs a product that drifted even when the menu price is already right", async () => {
      menuRows([earlGrey({ price: new Prisma.Decimal(45000) })]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 45000 });

      expect(prisma.product.update).toHaveBeenCalledTimes(1);
      expect(json.updated[0].changes).toEqual({});
      expect(json.linkedProducts).toHaveLength(1);
    });

    it("leaves a product that is already at the price alone", async () => {
      menuRows([earlGrey()]);
      prisma.product.findFirst.mockResolvedValue(product(45000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 45000 });

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(json.linkedProducts).toBeUndefined();
      expect(
        menuItemsChangeSchema.parse(recordAction.mock.calls[0][0].payload).products
      ).toBeUndefined();
    });

    it("touches no product when the item isn't linked or no price is given", async () => {
      menuRows([row("a")]);
      await run(updateMenuItem, { itemId: "a", price: 45000 });
      menuRows([earlGrey()]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      await run(updateMenuItem, { itemId: "a", available: false });

      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it("shows the product price change in a preview and writes nothing", async () => {
      menuRows([earlGrey()]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 45000, mode: "preview" });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(json.changes[0].linkedProduct).toMatchObject({
        name: "Earl grey",
        sellingPrice: { from: "30000.00", to: "45000.00" },
      });
    });

    it("works the same in update_menu_items, and refuses two prices for one product", async () => {
      const other = earlGrey({ id: "b", name: "Earl grey (iced)" });
      menuRows([earlGrey(), other]);
      prisma.product.findFirst.mockResolvedValue(product(30000));

      const ok = await run(updateMenuItems, {
        updates: [
          { itemId: "a", price: 45000 },
          { itemId: "b", price: 45000 },
        ],
      });
      expect(ok.isError).toBe(false);
      expect(prisma.product.update).toHaveBeenCalledTimes(1);

      prisma.$transaction.mockClear();
      const clash = await run(updateMenuItems, {
        updates: [
          { itemId: "a", price: 45000 },
          { itemId: "b", price: 40000 },
        ],
      });
      expect(clash.isError).toBe(true);
      expect(clash.text).toMatch(/same inventory product but get different prices/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("converts a non-IDR price to the product's base currency", async () => {
      // 1 IDR = 0.0001 EUR: a €4.50 item is a 45,000 IDR product.
      storefrontService.getOwnerCurrencyAndRate.mockResolvedValue({
        currency: "EUR",
        rate: 0.0001,
      });
      menuRows([earlGrey({ price: new Prisma.Decimal(3) })]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 4.5 });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { sellingPrice: new Prisma.Decimal("45000.00") },
      });
      expect(json.linkedProducts[0].sellingPrice).toEqual({ from: "3.00", to: "4.50" });
    });

    it("does not treat a rate-only difference as a price change", async () => {
      // The product converts to €3.00 today, so a €3.00 item is already in step.
      storefrontService.getOwnerCurrencyAndRate.mockResolvedValue({
        currency: "EUR",
        rate: 0.0001,
      });
      menuRows([earlGrey({ price: new Prisma.Decimal(3) })]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      await run(updateMenuItem, { itemId: "a", price: 3 });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it("leaves the product alone for a composable item priced 0", async () => {
      menuRows([earlGrey({ buildYourOwn: true, price: new Prisma.Decimal(0) })]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      const { json } = await run(updateMenuItem, { itemId: "a", price: 0 });

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(json.warnings).toEqual([expect.stringMatching(/composable at price 0/)]);
    });

    it("takes the product's price when linked without one", async () => {
      menuRows([row("a")]);
      prisma.product.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Earl grey",
          department: "KITCHEN",
          buildYourOwn: false,
          sellingPrice: new Prisma.Decimal(30000),
          optionGroups: [],
        },
      ]);
      const { json } = await run(updateMenuItem, { itemId: "a", linkedProductId: "p1" });

      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: "a" },
        data: expect.objectContaining({ productId: "p1", price: new Prisma.Decimal(30000) }),
      });
      expect(json.updated[0].changes.price).toEqual({ from: "20000.00", to: "30000.00" });
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(json.warnings[0]).toMatch(/takes the price of the product Earl grey/);
    });

    it("create_menu_items sets the linked product's price too", async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Earl grey",
          department: "KITCHEN",
          buildYourOwn: false,
          sellingPrice: new Prisma.Decimal(30000),
          optionGroups: [],
        },
      ]);
      prisma.menuItem.findMany.mockResolvedValue([]);
      prisma.product.findFirst.mockResolvedValue(product(30000));
      storefrontService.resolveMenuCategoryId.mockResolvedValue(null);
      storefrontService.createMenuItem.mockResolvedValue(
        row("new-1", { name: "Earl grey", price: new Prisma.Decimal(45000), productId: "p1" })
      );

      const preview = await run(createMenuItems, {
        mode: "preview",
        items: [{ name: "Earl grey", price: 45000, linkedProductId: "p1" }],
      });
      expect(preview.json.wouldCreate[0].linkedProduct.sellingPrice).toEqual({
        from: "30000.00",
        to: "45000.00",
      });
      expect(prisma.product.update).not.toHaveBeenCalled();

      const { json } = await run(createMenuItems, {
        items: [{ name: "Earl grey", price: 45000, linkedProductId: "p1" }],
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { sellingPrice: new Prisma.Decimal("45000.00") },
      });
      expect(json.linkedProducts[0].sellingPrice.to).toBe("45000.00");
      const change = menuItemsChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      expect(change.products?.[0]).toMatchObject({ before: "30000.00", after: "45000.00" });
    });
  });

  describe("manage_category", () => {
    const cats = [
      { id: "c1", name: "BASE", displayOrder: 0, _count: { items: 0 } },
      { id: "c2", name: "PROTEIN", displayOrder: 1, _count: { items: 4 } },
      { id: "c3", name: "SAUCE", displayOrder: 2, _count: { items: 0 } },
    ];
    beforeEach(() => {
      prisma.menuCategory.findMany.mockResolvedValue(cats);
      prisma.menuItem.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    });

    it("removes only the empty categories and reports the rest", async () => {
      const { json } = await run(manageCategory, {
        action: "delete_if_empty",
        categoryIds: ["c1", "c2", "c3"],
      });
      expect(prisma.menuCategory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["c1", "c3"] }, storefrontId: "sf-1" },
      });
      expect(json.removed).toEqual(["BASE", "SAUCE"]);
      const change = menuCategoriesChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      expect(change.removed.map((c) => c.id)).toEqual(["c1", "c3"]);
      expect(change.after.map((c) => c.id)).toEqual(["c2"]);
      expect(json.left).toEqual([{ name: "PROTEIN", items: 4, reason: "still has items" }]);
    });

    it("merges by moving the items, then deleting the emptied category, in one transaction", async () => {
      const { json } = await run(manageCategory, {
        action: "merge_into",
        categoryId: "c2",
        targetCategoryId: "c1",
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "c2", storefrontId: "sf-1" },
        data: { categoryId: "c1" },
      });
      expect(json).toMatchObject({ moved: 4, from: "PROTEIN", into: "BASE" });
      const change = menuCategoriesChangeSchema.parse(recordAction.mock.calls[0][0].payload);
      expect(change.removed[0]).toMatchObject({ id: "c2", itemIds: ["i1", "i2"] });
      expect(change.movedTo).toBe("c1");
    });

    it("refuses a rename that would collide, and previews without writing", async () => {
      const clash = await run(manageCategory, {
        action: "rename",
        categoryId: "c1",
        name: "protein",
      });
      expect(clash.isError).toBe(true);
      expect(clash.text).toMatch(/merge_into/);

      await run(manageCategory, { action: "reorder", orderedCategoryIds: ["c3"], mode: "preview" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("reorders: listed first, the others follow", async () => {
      const { json } = await run(manageCategory, {
        action: "reorder",
        orderedCategoryIds: ["c3", "c2"],
      });
      expect(json.order).toEqual(["SAUCE", "PROTEIN", "BASE"]);
    });
  });

  describe("set_product_options", () => {
    const groups = [
      {
        name: "Protein",
        maxSelect: 2,
        options: [{ name: "Chicken", priceDelta: 35000, materialId: "m1", materialQty: 100 }],
      },
    ];

    it("refuses a raw material from another store", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", name: "BYO", buildYourOwn: false });
      prisma.material.findMany.mockResolvedValue([]);
      const { isError, text } = await run(setProductOptions, { productId: "p1", groups });
      expect(isError).toBe(true);
      expect(text).toMatch(/No raw material with id m1/);
      expect(productRepository.updateOptionGroups).not.toHaveBeenCalled();
    });

    it("needs a quantity with every material link", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", name: "BYO", buildYourOwn: false });
      prisma.material.findMany.mockResolvedValue([{ id: "m1", name: "Chicken", unit: "g" }]);
      const { isError, text } = await run(setProductOptions, {
        productId: "p1",
        groups: [{ name: "Protein", options: [{ name: "Chicken", materialId: "m1" }] }],
      });
      expect(isError).toBe(true);
      expect(text).toMatch(/both materialId and materialQty/);
    });

    it("previews what each choice deducts, then replaces the product's groups", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", name: "BYO", buildYourOwn: false });
      prisma.material.findMany.mockResolvedValue([{ id: "m1", name: "Chicken", unit: "g" }]);

      const preview = await run(setProductOptions, { productId: "p1", groups, mode: "preview" });
      expect(productRepository.updateOptionGroups).not.toHaveBeenCalled();
      expect(preview.json.groups[0].options[0].deducts).toBe("100 g of Chicken");

      await run(setProductOptions, { productId: "p1", groups, composable: true });
      expect(productRepository.updateOptionGroups).toHaveBeenCalledWith("p1", "store-1", [
        {
          name: "Protein",
          isRequired: false,
          maxSelections: 2,
          options: [
            { name: "Chicken", priceAdjustment: 35000, materialId: "m1", materialQty: 100 },
          ],
        },
      ]);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { buildYourOwn: true },
      });
    });
  });
});
