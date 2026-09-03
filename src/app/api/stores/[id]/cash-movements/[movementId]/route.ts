/**
 * DELETE /api/stores/[id]/cash-movements/[movementId]
 *
 * Voids a freshly mis-entered cash movement (wrong type, fat-fingered amount).
 *
 * Deliberately narrow. The ledger is append-only by intent, so the normal way
 * to fix a mistake noticed later is to record its opposite. This exists only
 * for the "I just tapped the wrong button" case, and refuses once the movement
 * belongs to a till session that has been closed — at that point a cashier has
 * already counted the drawer and signed off on a variance, and silently
 * changing the inputs would rewrite a reconciled figure.
 *
 * Manager/owner only, and recorded at CRITICAL severity by the audit trail
 * (see ROUTE_ACTION_MAP): deleting a paid-out row is exactly how a till
 * shortage would be covered up.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { getActiveStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export const DELETE = withApiHandler(
  async (_request, { storeId, params }) => {
    const { movementId } = params as { movementId: string };

    // Belt and braces, and not redundant: requireManagerOrOwnerApi treats a
    // staff session belonging to a DIFFERENT store as "no staff session at
    // all" and returns null, i.e. allowed — correct for its original callers,
    // but here it would let a CASHIER persona signed in to store B delete
    // store A's cash rows whenever the owner's better-auth cookie covers both
    // (requireStoreAuth only proves the *user* owns store A). Any active
    // persona must be operating on this store before it may touch the ledger.
    const staffSession = await getActiveStaffSession();
    if (staffSession && staffSession.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "Switch to this store before changing its cash ledger"
        ),
        { status: 403 }
      );
    }

    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const movement = await prisma.cashMovement.findUnique({
      where: { id: movementId },
      include: { shift: { select: { closedAt: true } } },
    });

    // Tenant check is not optional: movementId arrives straight off the path.
    if (!movement || movement.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Cash movement not found"),
        { status: 404 }
      );
    }

    if (movement.shift?.closedAt) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.CONFLICT,
          "That till session is already closed. Record a correcting movement instead of deleting this one."
        ),
        { status: 409 }
      );
    }

    await prisma.cashMovement.delete({ where: { id: movementId } });

    return NextResponse.json(createSuccessResponse({ id: movementId, deleted: true }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/cash-movements/[movementId]",
    requireStoreAuth: true,
  }
);
