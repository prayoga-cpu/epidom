/**
 * GET  /api/stores/[id]/cash-movements
 * POST /api/stores/[id]/cash-movements
 *
 * The non-sale cash ledger behind the cash-on-hand figure: tips, float
 * top-ups, paid-outs, safe drops and tip payouts. Orders account for cash that
 * arrives by selling something; this is everything else that opens the drawer.
 *
 * Append-only by intent. A mis-entered row is corrected by recording its
 * opposite (or voiding it via the sibling [movementId] DELETE while it is
 * still fresh), never by editing history — see lib/finance/cash-drawer.ts.
 *
 * GET query params: shiftId, staffId, type, from, to, take, skip.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createCashMovementSchema,
  cashMovementListQuerySchema,
} from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { toDecimal } from "@/lib/utils/types.server";
import { isStaffAuthenticated } from "@/lib/attendance/verify-staff-auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";

export const dynamic = "force-dynamic";

const MOVEMENT_SELECT = {
  id: true,
  type: true,
  amount: true,
  reason: true,
  occurredAt: true,
  shiftId: true,
  staffMemberId: true,
  staffMember: { select: { id: true, name: true } },
} as const;

export const GET = withApiHandler(
  async (request, { storeId }) => {
    // This returns the WHOLE store's ledger — every staff member's paid-outs
    // and the free-text reason attached to each. The same rows reach a
    // cashier only through the per-person self-service log, so the collection
    // view is gated the way the Schedule Log is: manager or owner. (A staff
    // session for another store is treated as no session at all by the guard,
    // which is why the DELETE sibling adds an explicit cross-store check;
    // this is a read, so store-ownership alone is a sufficient floor here.)
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const { searchParams } = new URL(request.url);

    const parsed = cashMovementListQuerySchema.safeParse({
      shiftId: searchParams.get("shiftId") ?? undefined,
      staffId: searchParams.get("staffId") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      take: searchParams.get("take") ?? undefined,
      skip: searchParams.get("skip") ?? undefined,
    });
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

    const { shiftId, staffId, type, from, to, take, skip } = parsed.data;

    const where = {
      storeId,
      ...(shiftId && { shiftId }),
      ...(staffId && { staffMemberId: staffId }),
      ...(type && { type }),
      ...((from || to) && {
        occurredAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [cashMovements, total] = await Promise.all([
      prisma.cashMovement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: { occurredAt: "desc" },
        take,
        skip,
      }),
      prisma.cashMovement.count({ where }),
    ]);

    return NextResponse.json(createSuccessResponse({ cashMovements, total }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/cash-movements", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = createCashMovementSchema.safeParse(body);
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

    const { shiftId, staffMemberId, pin, type, amount, reason, occurredAt } = parsed.data;

    // A till session is optional, but if one is named it must belong to this
    // store and still be open — backdating cash into a closed session would
    // rewrite a variance a cashier has already signed off on.
    if (shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.storeId !== storeId) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Shift not found"), {
          status: 404,
        });
      }
      if (shift.closedAt) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.CONFLICT,
            "That till session is already closed. Record the movement without a shift instead."
          ),
          { status: 409 }
        );
      }
    }

    // Who is accountable for the cash. On a shared iPad the better-auth session
    // is always the OWNER's, so `session.user.id` would be a confident wrong
    // answer — the acting persona comes from the staff-session cookie, or from
    // an explicit staffMemberId proved with a PIN.
    let resolvedStaffMemberId: string | null = null;
    if (staffMemberId) {
      const staff = await prisma.staffMember.findUnique({ where: { id: staffMemberId } });
      if (!staff || staff.storeId !== storeId || !staff.isActive) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, "Staff member not found"),
          { status: 404 }
        );
      }
      const authenticated = await isStaffAuthenticated(storeId!, staffMemberId, pin, staff.pin);
      if (!authenticated) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.UNAUTHORIZED, pin ? "Incorrect PIN" : "PIN required"),
          { status: 401 }
        );
      }
      resolvedStaffMemberId = staff.id;
    } else {
      // No explicit staff member: fall back to the persona this browser is
      // already operating as. Absence of one means the real owner, and the
      // row is left unattributed rather than pinned on someone.
      const active = await getActiveStaffSession();
      resolvedStaffMemberId = active && active.storeId === storeId ? active.staffMemberId : null;
    }

    const cashMovement = await prisma.cashMovement.create({
      data: {
        storeId: storeId!,
        shiftId: shiftId ?? null,
        staffMemberId: resolvedStaffMemberId,
        type,
        amount: toDecimal(amount),
        reason: reason?.trim() || null,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
      select: MOVEMENT_SELECT,
    });

    return NextResponse.json(createSuccessResponse({ cashMovement }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/cash-movements", requireStoreAuth: true }
);
