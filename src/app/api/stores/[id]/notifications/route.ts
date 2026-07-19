import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export interface NotificationItem {
  id: string;
  type: "order" | "reservation" | "onboarding";
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

/** GET /api/stores/[id]/notifications */
export const GET = withApiHandler(
  async (_req, { storeId }) => {
    const notifications: NotificationItem[] = [];

    // 1. Pending / new orders (last 48h)
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pendingOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { in: ["PENDING", "CONFIRMED"] },
        createdAt: { gte: since },
      },
      select: { id: true, orderNumber: true, status: true, createdAt: true, source: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const o of pendingOrders) {
      notifications.push({
        id: `order-${o.id}`,
        type: "order",
        title: o.status === "PENDING" ? "New Order" : "Order Confirmed",
        body: `${o.orderNumber} · ${o.source ?? "POS"}`,
        href: `/store/${storeId}/pos`,
        createdAt: o.createdAt.toISOString(),
      });
    }

    // 2. Pending reservations
    const pendingRes = await prisma.reservation.findMany({
      where: { storeId, status: "PENDING" },
      select: {
        id: true,
        guestName: true,
        partySize: true,
        scheduledAt: true,
        createdAt: true,
        table: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const r of pendingRes) {
      const when = new Date(r.scheduledAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      notifications.push({
        id: `res-${r.id}`,
        type: "reservation",
        title: "Reservation Request",
        body: `${r.guestName} · ${r.partySize} pax · ${when}${r.table ? ` · ${r.table.label}` : ""}`,
        href: `/store/${storeId}/tables`,
        createdAt: r.createdAt.toISOString(),
      });
    }

    // 3. Onboarding checklist: storefront not published
    const storefront = await prisma.storefront.findUnique({
      where: { storeId },
      select: {
        isPublished: true,
        displayName: true,
        menuCategories: { take: 1, select: { id: true } },
      },
    });

    if (storefront && !storefront.isPublished) {
      notifications.push({
        id: `onboarding-publish-${storeId}`,
        type: "onboarding",
        title: "Publish Your Storefront",
        body: "Your store is not yet visible to customers.",
        href: `/store/${storeId}/storefront`,
        createdAt: new Date(0).toISOString(),
      });
    }

    if (storefront && storefront.menuCategories.length === 0) {
      notifications.push({
        id: `onboarding-menu-${storeId}`,
        type: "onboarding",
        title: "Add Menu Items",
        body: "Your storefront has no menu yet. Add categories and items.",
        href: `/store/${storeId}/storefront`,
        createdAt: new Date(0).toISOString(),
      });
    }

    // Sort: newest first, onboarding last
    const sorted = notifications.sort((a, b) => {
      if (a.type === "onboarding" && b.type !== "onboarding") return 1;
      if (b.type === "onboarding" && a.type !== "onboarding") return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(createSuccessResponse({ notifications: sorted }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/notifications", requireStoreAuth: true }
);
