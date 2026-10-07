import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { notificationsQuerySchema } from "@/lib/validation/notifications.schemas";

export const dynamic = "force-dynamic";

export interface NotificationItem {
  id: string;
  type: "order" | "reservation" | "onboarding";
  title: string;
  body: string;
  href: string;
  createdAt: string;
  /** Orders only — the bell builds its own localized title/body from these. */
  orderNumber?: string;
  source?: string;
  /** An online order the customer has not paid yet: collect it at the cashier. */
  unpaid?: boolean;
}

/**
 * GET /api/stores/[id]/notifications
 *
 * `?scope=pos` is the POS status bar's bell: only orders that ARRIVE (storefront
 * and delivery platforms — never the till's own sales, which the cashier just
 * rang up), order links into the POS queue, and no Back Office setup reminders.
 */
export const GET = withApiHandler(
  async (req, { storeId }) => {
    const parsed = notificationsQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid query", parsed.error.flatten()),
        { status: 400 }
      );
    }
    const pos = parsed.data.scope === "pos";
    const notifications: NotificationItem[] = [];

    // 1. New orders (last 48h). A storefront order still waiting for payment is
    // listed whatever its status: with the kitchen display off it is placed
    // straight as DELIVERED, and it is exactly the one the cashier must act on.
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const newOrders = await prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: since },
        OR: [
          { status: "CONFIRMED" },
          { source: "STOREFRONT", paymentStatus: "PENDING", status: { not: "CANCELLED" } },
        ],
        // The POS bell lists orders that ARRIVE. A till sale is never one —
        // including a GoFood/GrabFood order the cashier keyed in at the till,
        // which carries the platform as its source but the till's own POS-
        // order number (storefront orders are ORD-, email imports AGG-/the
        // platform's number).
        ...(pos && { source: { not: "POS" }, NOT: { orderNumber: { startsWith: "POS-" } } }),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        source: true,
        paymentStatus: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const o of newOrders) {
      const unpaid = o.source === "STOREFRONT" && o.paymentStatus === "PENDING";
      notifications.push({
        id: `order-${o.id}`,
        type: "order",
        title: unpaid ? "New online order · unpaid" : "New Order",
        body: `${o.orderNumber} · ${o.source ?? "POS"}`,
        href: pos ? `/store/${storeId}/pos/orders` : `/store/${storeId}/pos`,
        createdAt: o.createdAt.toISOString(),
        orderNumber: o.orderNumber,
        source: o.source,
        unpaid,
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

    // 3. Onboarding checklist: storefront not published. Back Office pages —
    // nothing a POS persona can act on.
    const storefront = pos
      ? null
      : await prisma.storefront.findUnique({
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
