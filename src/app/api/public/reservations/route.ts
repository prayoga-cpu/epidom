import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bookSchema = z.object({
  storefrontSlug: z.string().min(1),
  tableId: z.string().cuid().optional(),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(50),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid booking data", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { storefrontSlug, guestEmail, ...rest } = parsed.data;

    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: { storeId: true, acceptsReservations: true, isPublished: true },
    });

    if (!storefront || !storefront.isPublished) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Storefront not found"),
        { status: 404 }
      );
    }

    if (!storefront.acceptsReservations) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.FORBIDDEN, "This store does not accept reservations"),
        { status: 403 }
      );
    }

    // If tableId provided, verify it belongs to this store and is reservation-enabled
    if (rest.tableId) {
      const table = await prisma.table.findFirst({
        where: { id: rest.tableId, storeId: storefront.storeId, reservationEnabled: true },
      });
      if (!table) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not available for reservation"),
          { status: 404 }
        );
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        storeId: storefront.storeId,
        guestEmail: guestEmail && guestEmail !== "" ? guestEmail : null,
        ...rest,
        status: "PENDING",
      },
      include: {
        table: { select: { id: true, label: true } },
      },
    });

    return NextResponse.json(createSuccessResponse({ reservation }), { status: 201 });
  } catch {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Failed to create reservation"),
      { status: 500 }
    );
  }
}

/** GET /api/public/reservations?storefrontSlug=...&date=YYYY-MM-DD — returns available reservation-enabled tables */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("storefrontSlug");
  const date = url.searchParams.get("date");

  if (!slug) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "storefrontSlug required"), { status: 400 });
  }

  const storefront = await prisma.storefront.findUnique({
    where: { slug },
    select: { storeId: true, acceptsReservations: true, isPublished: true },
  });

  if (!storefront?.isPublished || !storefront.acceptsReservations) {
    return NextResponse.json(createSuccessResponse({ tables: [] }));
  }

  const tables = await prisma.table.findMany({
    where: { storeId: storefront.storeId, reservationEnabled: true },
    select: { id: true, label: true, capacity: true },
    orderBy: { label: "asc" },
  });

  // If a date is provided, include existing reservations for that day so the client can show conflicts
  let reservations: Array<{ tableId: string | null; scheduledAt: Date; status: string }> = [];
  if (date) {
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(`${date}T23:59:59Z`);
    reservations = await prisma.reservation.findMany({
      where: {
        storeId: storefront.storeId,
        scheduledAt: { gte: start, lte: end },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { tableId: true, scheduledAt: true, status: true },
    });
  }

  return NextResponse.json(createSuccessResponse({ tables, reservations }));
}
