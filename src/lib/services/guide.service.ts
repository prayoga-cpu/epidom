import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { linkedStaffWhere } from "@/lib/auth/staff-link";
import type { GuideState, GuideStatePatch } from "@/lib/guide/contracts";
import { applyPatchToState, parseGuideState } from "@/features/guide/lib/guide-state";

/**
 * Per-user state of the in-app guide (User.guideState, a JSON column): when the
 * welcome tour was seen, which page intro cards and which stores' Getting-started
 * checklists the viewer dismissed. See GuideState in src/lib/guide/contracts.ts.
 *
 * The column is free-form JSON, so every read goes through parseGuideState:
 * whatever is stored (an older shape, a hand edit, a value from a future
 * version) comes back as a valid GuideState instead of breaking the page. The
 * pure helpers live in src/features/guide/lib/guide-state.ts so the client's
 * optimistic update applies exactly the same change.
 */
export {
  applyPatchToState,
  parseGuideState,
  GUIDE_STATE_LIST_CAP,
} from "@/features/guide/lib/guide-state";

/** How many times a write re-reads and retries when another write got there first. */
const MAX_WRITE_ATTEMPTS = 3;

/** Thrown by applyGuideStatePatch when dismissChecklist names a store the user can't reach. */
export class GuideStoreAccessError extends Error {
  constructor() {
    super("You can't change the checklist for this store");
    this.name = "GuideStoreAccessError";
  }
}

/**
 * Whether the user may hide this store's checklist: a store their business
 * owns, or the one their account is linked to as active staff (the same two
 * ways in as verifyStoreAccess).
 */
export async function userCanAccessStore(userId: string, storeId: string): Promise<boolean> {
  const [owned, linked] = await Promise.all([
    prisma.store.findFirst({
      where: { id: storeId, business: { userId } },
      select: { id: true },
    }),
    prisma.staffMember.findFirst({
      where: { storeId, ...linkedStaffWhere(userId) },
      select: { id: true },
    }),
  ]);
  return Boolean(owned || linked);
}

async function readRaw(userId: string): Promise<Prisma.JsonValue | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { guideState: true },
  });
  return user?.guideState ?? null;
}

/** The user's guide state (EMPTY_GUIDE_STATE when nothing is stored or the user is gone). */
export async function getGuideState(userId: string): Promise<GuideState> {
  return parseGuideState(await readRaw(userId));
}

/**
 * Applies one PATCH /api/user/guide-state body and returns the new full state.
 *
 * Read-modify-write on User.guideState. The write only lands if the column
 * still holds what was read (compare-and-swap on the JSON value) and re-reads on
 * a conflict: two quick taps (finish the tour, then dismiss a card) can arrive
 * as two overlapping requests, and a plain read-then-write would let the second
 * erase the first. The last attempt writes unconditionally.
 *
 * @throws GuideStoreAccessError when `dismissChecklist` names a store the user
 *   neither owns nor is linked to.
 */
export async function applyGuideStatePatch(
  userId: string,
  patch: GuideStatePatch
): Promise<GuideState> {
  if (patch.dismissChecklist && !(await userCanAccessStore(userId, patch.dismissChecklist))) {
    throw new GuideStoreAccessError();
  }

  for (let attempt = 1; ; attempt++) {
    const raw = await readRaw(userId);
    const next = applyPatchToState(parseGuideState(raw), patch);
    const data = next as unknown as Prisma.InputJsonValue;

    if (attempt >= MAX_WRITE_ATTEMPTS) {
      // Still contended after every retry: last write wins rather than failing
      // a change the viewer already saw take effect.
      await prisma.user.update({ where: { id: userId }, data: { guideState: data } });
      return next;
    }

    const { count } = await prisma.user.updateMany({
      where: {
        id: userId,
        guideState:
          raw === null ? { equals: Prisma.AnyNull } : { equals: raw as Prisma.InputJsonValue },
      },
      data: { guideState: data },
    });
    if (count === 1) return next;
  }
}
