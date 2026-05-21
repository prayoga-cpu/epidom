import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

const updateTableSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]).optional(),
});

/** GET /api/stores/[id]/tables/[tableId] */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const table = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!table) return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), { status: 404 });

  return NextResponse.json(createSuccessResponse(table));
}

/** PATCH /api/stores/[id]/tables/[tableId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const body = await req.json();
  const parsed = updateTableSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()), { status: 400 });

  const existing = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!existing) return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), { status: 404 });

  try {
    const updated = await prisma.table.update({ where: { id: tableId }, data: parsed.data });
    return NextResponse.json(createSuccessResponse(updated));
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, "Label already in use"), { status: 409 });
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal error"), { status: 500 });
  }
}

/** DELETE /api/stores/[id]/tables/[tableId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; tableId: string }> }
) {
  const { id: storeId, tableId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const existing = await prisma.table.findFirst({ where: { id: tableId, storeId } });
  if (!existing) return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Table not found"), { status: 404 });

  // Only delete if no active orders on table
  const active = await prisma.order.findFirst({
    where: { tableId, status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY"] } },
  });
  if (active) return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, "Cannot delete a table with active orders"), { status: 409 });

  await prisma.table.delete({ where: { id: tableId } });
  return NextResponse.json(createSuccessResponse({ deleted: true }));
}
