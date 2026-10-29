import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { ALL_STAFF_PAGES } from "@/config/staff-permissions.config";
import { servingAppUrl } from "@/lib/app-url";
import { defineAccountTool, defineStoreTool } from "../define-tool";
import { listConnectorStores } from "../stores";
import { storeIdInput } from "./shared";

export const listStores = defineAccountTool({
  name: "list_stores",
  title: "List my stores",
  description:
    "The stores (outlets) this Epidom account can reach, with the storeId every other tool needs, the " +
    "account's role there (owner, or a staff role), the store's plan, whether it can be used from Claude " +
    "(connectorEnabled), its currency and its timezone. Call this first.",
  input: z.object({}),
  handler: async (_input, { principal }) => {
    const stores = await listConnectorStores(principal.userId);
    return {
      stores,
      note:
        stores.length === 0
          ? "This account has no store yet. It can create one in the Epidom app."
          : undefined,
    };
  },
});

export const getStoreProfile = defineStoreTool({
  name: "get_store_profile",
  title: "Store profile",
  description:
    "One store's details: address and contact, timezone, currency, tax and service-charge settings, which " +
    "optional modules are on (kitchen display, production, pay later), and its public storefront page " +
    "(link, published or not, taking online orders or reservations).",
  input: z.object({ ...storeIdInput }),
  kind: "read",
  access: { pages: ALL_STAFF_PAGES },
  handler: async (_input, ctx) => {
    const [store, finance] = await Promise.all([
      prisma.store.findUniqueOrThrow({
        where: { id: ctx.storeId },
        select: {
          name: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          kitchenDisplayEnabled: true,
          productionEnabled: true,
          payLaterEnabled: true,
          business: { select: { name: true, timezone: true } },
          storefront: {
            select: {
              slug: true,
              isPublished: true,
              acceptsOrders: true,
              acceptsReservations: true,
            },
          },
        },
      }),
      getFinanceSettings(ctx.storeId),
    ]);

    return {
      storeId: ctx.storeId,
      name: store.name,
      businessName: store.business.name,
      yourRole: ctx.role.toLowerCase(),
      address: store.address,
      city: store.city,
      country: store.country,
      phone: store.phone,
      email: store.email,
      timezone: store.business.timezone,
      currency: finance.currency,
      tax: finance.taxEnabled
        ? {
            label: finance.taxLabel,
            ratePercent: Math.round(finance.taxRate * 10000) / 100,
            includedInPrices: finance.taxInclusive,
          }
        : null,
      serviceChargePercent: finance.serviceChargeEnabled
        ? Math.round(finance.serviceChargeRate * 10000) / 100
        : null,
      modules: {
        kitchenDisplay: store.kitchenDisplayEnabled,
        production: store.productionEnabled,
        payLater: store.payLaterEnabled,
      },
      storefront: store.storefront
        ? {
            url: `${servingAppUrl()}/@${store.storefront.slug}`,
            published: store.storefront.isPublished,
            takesOnlineOrders: store.storefront.acceptsOrders,
            takesReservations: store.storefront.acceptsReservations,
          }
        : null,
    };
  },
});
