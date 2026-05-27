import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  tableId: z.string().cuid().optional(),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  partySize: z.number().int().min(1).max(50).default(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).default("PENDING"),
});

/** GET /api/stores/[id]/reservations */
export const GET = withApiHandler(
  async (req, { storeId }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const reservations = await prisma.reservation.findMany({
      where: {
        storeId,
        ...(status ? { status: status as any } : {}),
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        table: { select: { id: true, label: true, capacity: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json(createSuccessResponse({ reservations }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/reservations", requireStoreAuth: true }
);

/** POST /api/stores/[id]/reservations */
export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { guestEmail, ...rest } = parsed.data;
    const reservation = await prisma.reservation.create({
      data: {
        storeId: storeId!,
        ...rest,
        guestEmail: guestEmail && guestEmail !== "" ? guestEmail : null,
      },
      include: {
        table: { select: { id: true, label: true, capacity: true } },
      },
    });

    return NextResponse.json(createSuccessResponse({ reservation }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/reservations", requireStoreAuth: true }
);
