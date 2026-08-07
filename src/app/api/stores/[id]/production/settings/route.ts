import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { getActiveStaffSession } from "@/lib/staff-session";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

const updateProductionSettingsSchema = z.object({
  productionEnabled: z.boolean(),
});

/**
 * GET /api/stores/[id]/production/settings
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  return NextResponse.json(
    createSuccessResponse({ productionEnabled: verification.productionEnabled })
  );
}

/**
 * PATCH /api/stores/[id]/production/settings
 * Owner-only, even if a staff PIN session has this page in its allowedPages —
 * the toggle itself is a store-wide operational mode, not a page visibility rule.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only the store owner can change this setting"),
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProductionSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings", parsed.error.flatten()),
      { status: 400 }
    );
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: { productionEnabled: parsed.data.productionEnabled },
    select: { productionEnabled: true },
  });

  return NextResponse.json(createSuccessResponse(updated));
}
