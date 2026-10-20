import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  try {
    const admin = await requireAdminApi({ section: "leads" });
    if (admin instanceof NextResponse) return admin;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const type = searchParams.get("type"); // "sales" | "newsletter" | undefined = all

    const [salesLeads, subscribers] = await Promise.all([
      type === "newsletter"
        ? { items: [], nextCursor: null }
        : prisma.salesLead
            .findMany({
              orderBy: { createdAt: "desc" },
              take: PAGE_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
              select: {
                id: true,
                page: true,
                locale: true,
                source: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                createdAt: true,
              },
            })
            .then((items) => ({
              items,
              nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].id : null,
            })),
      type === "sales"
        ? { items: [], nextCursor: null }
        : prisma.newsletterSubscriber
            .findMany({
              orderBy: { createdAt: "desc" },
              take: PAGE_SIZE,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
              select: {
                id: true,
                email: true,
                source: true,
                page: true,
                locale: true,
                createdAt: true,
              },
            })
            .then((items) => ({
              items,
              nextCursor: items.length === PAGE_SIZE ? items[items.length - 1].id : null,
            })),
    ]);

    return NextResponse.json(
      createSuccessResponse({
        salesLeads: salesLeads.items,
        subscribers: subscribers.items,
        nextCursor: salesLeads.nextCursor ?? subscribers.nextCursor,
      })
    );
  } catch (error) {
    console.error("[ADMIN_LEADS_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal server error"),
      { status: 500 }
    );
  }
}
