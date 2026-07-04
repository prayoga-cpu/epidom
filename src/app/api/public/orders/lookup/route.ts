import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupPublicOrdersSchema } from "@/lib/validation/public-orders.schemas";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export async function POST(request: Request) {
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/public/orders/lookup");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid JSON body"),
        { status: 400 }
      );
    }

    const parsed = lookupPublicOrdersSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid lookup data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    // Scope to the storefront's own orders, mirroring the public order page's
    // storefrontId check — POS/internal orders of any tenant must not resolve here
    const orders = await prisma.order.findMany({
      where: {
        id: { in: parsed.data.orderIds },
        storefront: { slug: parsed.data.storefrontSlug, isPublished: true },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            name: true,
            quantity: true,
            menuItem: { select: { name: true } },
          },
        },
      },
    });

    const mapped = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
      itemsSummary: o.items
        .map((i) => `${Number(i.quantity)}x ${i.menuItem?.name ?? i.name}`)
        .join(", "),
    }));

    return NextResponse.json(createSuccessResponse({ orders: mapped }));
  } catch (error: unknown) {
    console.error("[PUBLIC_ORDERS_LOOKUP_POST_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
