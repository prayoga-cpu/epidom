import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { z } from "zod";

const createTableSchema = z.object({
  label: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50).default(4),
});

const updateTableSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]).optional(),
});

/** GET /api/stores/[id]/tables */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const tables = await prisma.table.findMany({
    where: { storeId },
    orderBy: { label: "asc" },
    include: {
      orders: {
        where: { status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY"] } },
        select: { id: true, orderNumber: true, status: true, total: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(createSuccessResponse(tables));
}

/** POST /api/stores/[id]/tables */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), { status: 401 });

  const v = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (v instanceof NextResponse) return v;

  const body = await req.json();
  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input", parsed.error.flatten()), { status: 400 });

  try {
    const table = await prisma.table.create({
      data: { storeId, ...parsed.data },
    });
    return NextResponse.json(createSuccessResponse(table), { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, `Table "${parsed.data.label}" already exists`), { status: 409 });
    }
    return NextResponse.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Internal error"), { status: 500 });
  }
}
