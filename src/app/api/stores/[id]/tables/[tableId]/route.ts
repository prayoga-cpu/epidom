import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccessWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";
import { ACTIVE_POS_STATUSES } from "@/lib/constants/order-status";

const TABLE_STATUS_VALUES = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"] as const;

const updateTableSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(TABLE_STATUS_VALUES).optional(),
  reservationEnabled: z.boolean().optional(),
  // Optimistic-concurrency guard for the offline status-cycle queue (see
  // src/lib/pwa/offline-table-queue.ts). The cashier's tap advances whatever
  // status was showing on screen when queued — if the table isn't still in
  // that state by the time this replays (another terminal already seated or
  // freed it while this device was offline), applying the change blindly
  // would silently clobber that newer write. Only meaningful together with
  // `status`; a plain field edit (label/capacity) never sends this.
  expectedStatus: z.enum(TABLE_STATUS_VALUES).optional(),
});

/** GET /api/stores/[id]/tables/[tableId] */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, req);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const v = storeAccess.store;

  const table = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!table)
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), {
      status: 404,
    });

  return NextResponse.json(createSuccessResponse(table));
}

/** PATCH /api/stores/[id]/tables/[tableId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, req);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const v = storeAccess.store;

  const body = await req.json();
  const parsed = updateTableSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()),
      { status: 400 }
    );

  const existing = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!existing)
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), {
      status: 404,
    });

  const { expectedStatus, ...data } = parsed.data;

  try {
    if (expectedStatus !== undefined) {
      // Conditional update: only applies if the row is still in the state the
      // caller last saw. 0 rows affected means someone else moved it first —
      // report a conflict instead of overwriting their write.
      const result = await prisma.table.updateMany({
        where: { id: tableId, storeId, status: expectedStatus },
        data,
      });
      if (result.count === 0) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.CONFLICT,
            "Table status changed since this update was queued"
          ),
          { status: 409 }
        );
      }
      const updated = await prisma.table.findFirst({ where: { id: tableId, storeId } });
      return NextResponse.json(createSuccessResponse(updated));
    }

    const updated = await prisma.table.update({ where: { id: tableId }, data });
    return NextResponse.json(createSuccessResponse(updated));
  } catch (e: any) {
    if (e.code === "P2002")
      return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, "Label already in use"), {
        status: 409,
      });
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal error"), {
      status: 500,
    });
  }
}

/** DELETE /api/stores/[id]/tables/[tableId] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });

  const storeAccess = await verifyStoreAccessWithResponse(storeId, session.user.id, req);
  if (storeAccess instanceof NextResponse) return storeAccess;
  const v = storeAccess.store;

  const existing = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!existing)
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), {
      status: 404,
    });

  // Only delete if no active orders on table
  const active = await prisma.order.findFirst({
    where: { tableId, status: { in: ACTIVE_POS_STATUSES } },
  });
  if (active)
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.CONFLICT, "Cannot delete a table with active orders"),
      { status: 409 }
    );

  await prisma.table.delete({ where: { id: tableId } });
  return NextResponse.json(createSuccessResponse({ deleted: true }));
}
