import { cache } from "react";
import { getSession } from "@/lib/auth";
import { verifyStoreAccess } from "@/lib/utils/store-verification";

/**
 * Who the signed-in Better Auth user IS at a given store — the question
 * several server guards used to answer implicitly with "no StaffSession
 * cookie, so it must be the owner".
 *
 * That shortcut was sound only while the store's owner was the one and only
 * Better Auth account that could reach a store: staff were personas layered
 * ON the owner's session by PIN. A linked staff account (StaffMember.userId)
 * is a real session that is NOT the owner and has no PIN persona until it
 * enters one — so "no persona" no longer implies "owner" and every guard that
 * assumed it has to ask this instead.
 *
 *  - "owner": the store's owner. Staff personas, if any, are layered on top
 *    exactly as before.
 *  - "staff": a linked staff account. Never the owner, whatever the PIN
 *    state; may only ever act as `staffMemberId`.
 *  - "none": no session, or neither. Callers fail closed.
 *
 * react-cached per request (verifyStoreAccess is too), so a page that calls
 * several guards pays for one lookup.
 */
export type StoreViewer =
  | { kind: "owner" }
  | { kind: "staff"; staffMemberId: string }
  | { kind: "none" };

export const getStoreViewer = cache(async function getStoreViewer(
  storeId: string
): Promise<StoreViewer> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return { kind: "none" };

  try {
    const access = await verifyStoreAccess(storeId, userId);
    return access.accessType === "owner"
      ? { kind: "owner" }
      : { kind: "staff", staffMemberId: access.staffMemberId };
  } catch {
    return { kind: "none" };
  }
});
