import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  tableId: z.string().cuid().nullable().optional(),
  guestName: z.string().min(1).max(100).optional(),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(50).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
});

/** PATCH /api/stores/[id]/reservations/[reservationId] */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { reservationId } = params as { reservationId: string };

    const existing = await prisma.reservation.findFirst({ where: { id: reservationId, storeId } });
    if (!existing) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Reservation not found"),
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const { guestEmail, ...rest } = parsed.data;
    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        ...rest,
        ...(guestEmail !== undefined ? { guestEmail: guestEmail === "" ? null : guestEmail } : {}),
      },
      include: {
        table: { select: { id: true, label: true, capacity: true } },
      },
    });

    return NextResponse.json(createSuccessResponse({ reservation }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/reservations/[reservationId]", requireStoreAuth: true }
);

/** DELETE /api/stores/[id]/reservations/[reservationId] */
export const DELETE = withApiHandler(
  async (_req, { storeId, params }) => {
    const { reservationId } = params as { reservationId: string };

    const existing = await prisma.reservation.findFirst({ where: { id: reservationId, storeId } });
    if (!existing) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Reservation not found"),
        { status: 404 }
      );
    }

    await prisma.reservation.delete({ where: { id: reservationId } });
    return NextResponse.json(createSuccessResponse({ deleted: true }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/reservations/[reservationId]", requireStoreAuth: true }
);
