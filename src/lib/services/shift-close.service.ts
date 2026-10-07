import { prisma } from "@/lib/prisma";
import { getActiveStaffSession } from "@/lib/staff-session";
import type { StoreAccess } from "@/lib/utils/store-verification";
import { toDecimal } from "@/lib/utils/types.server";
import { getShiftCashOnHand, type ShiftCashInput } from "@/lib/services/cash-drawer.service";

/**
 * Who may sign a till off, and the one write that does it.
 *
 * The rule: on the POS, only the person who OPENED a shift can close it.
 * Another cashier, a manager, and the owner's own POS persona for a shift a
 * cashier opened are all refused. The owner overrides from the Back Office
 * (/shifts → POST /shifts/[shiftId]/close), which records that it did.
 *
 * The owner working the till as themselves has no persona row of their own;
 * their shifts belong to the store's OWNER-role StaffMember (see
 * useShiftStaffMemberId on the client), so "the owner opened it" is "the
 * opener's role is OWNER".
 */

/** Who is ending a till, as the SERVER sees it — never what the client claims. */
export type ShiftActor = { kind: "owner" } | { kind: "staff"; staffMemberId: string };

export async function resolveShiftActor(
  storeId: string,
  access: StoreAccess | undefined
): Promise<ShiftActor> {
  // A linked staff account. authorizeStaffPrincipal has already pinned its
  // PIN persona to exactly this member.
  if (access?.accessType === "staff") {
    return { kind: "staff", staffMemberId: access.staffMemberId };
  }
  // The owner's session. A staff PIN persona layered on top of it is the
  // person actually at the till; an OWNER-role persona is the owner.
  const persona = await getActiveStaffSession();
  if (persona && persona.storeId === storeId && persona.role !== "OWNER") {
    return { kind: "staff", staffMemberId: persona.staffMemberId };
  }
  return { kind: "owner" };
}

export function isShiftOpener(
  actor: ShiftActor,
  opener: { id: string; role: string } | null
): boolean {
  if (!opener) return false;
  return actor.kind === "owner" ? opener.role === "OWNER" : actor.staffMemberId === opener.id;
}

/** The store's own OWNER-role staff row — who a Back Office close is filed under. */
export async function findOwnerStaffMemberId(storeId: string): Promise<string | null> {
  const row = await prisma.staffMember.findFirst({
    where: { storeId, role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

export interface CloseTillShiftInput {
  storeId: string;
  shift: ShiftCashInput;
  closingCash: number;
  notes?: string;
  closedByStaffMemberId: string | null;
  fromBackOffice: boolean;
}

/**
 * Counts the drawer and signs the shift off. Returns null when the shift was
 * already closed by the time the write landed — the caller answers 409.
 *
 * The write is a conditional claim (`closedAt: null`), not a read-then-update:
 * the cashier finishing on the POS and the owner closing from the Back Office
 * at the same moment must not both "win" and overwrite each other's count.
 */
export async function closeTillShift(input: CloseTillShiftInput) {
  const { storeId, shift, closingCash, notes } = input;

  // One shared computation with the daily report, the Finance cash tab and the
  // dashboard card — see lib/finance/cash-drawer.ts. The persisted
  // expectedCash/cashDifference are a snapshot of the moment of closing; the
  // report recomputes live, so a movement backdated into this window after
  // the fact shows up there without rewriting this row.
  const breakdown = await getShiftCashOnHand(storeId, shift, closingCash);
  const expectedCash = breakdown.expectedCash;
  // Non-null in practice: closingCash was passed as the override above, so the
  // breakdown always has a count to compare against. Recomputed rather than
  // `?? 0` because toDecimal(null) silently writes 0.00, which would read as
  // "the drawer balanced perfectly" — the one wrong answer this must not give.
  const cashDifference = breakdown.cashDifference ?? closingCash - expectedCash;

  const claimed = await prisma.shift.updateMany({
    where: { id: shift.id, storeId, closedAt: null },
    data: {
      closedAt: new Date(),
      closingCash: toDecimal(closingCash),
      expectedCash: toDecimal(expectedCash),
      cashDifference: toDecimal(cashDifference),
      notes,
      closedByStaffMemberId: input.closedByStaffMemberId,
      closedFromBackOffice: input.fromBackOffice,
    },
  });
  if (claimed.count === 0) return null;

  return prisma.shift.findUnique({
    where: { id: shift.id },
    include: {
      staffMember: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });
}
