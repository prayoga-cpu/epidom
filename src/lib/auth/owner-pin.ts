/**
 * Owner PIN exposure guard.
 *
 * `Business.ownerPin` is a bcrypt hash of a 4-digit PIN. There are only 10,000
 * PINs, so anyone holding the hash gets the PIN back offline in minutes. The PIN
 * is the only thing between a staff PIN persona on the owner's shared device
 * (which runs on the owner's own session) and "switch back to Owner". The hash
 * must therefore never be part of a response or of props passed to a client
 * component.
 *
 * Only the owner-pin routes (/api/user/owner-pin, /api/user/owner-pin/reset,
 * /api/user/verify-owner-pin) read the hash, and only server-side. Every other
 * place that sends a Business row to a client passes it through
 * `toPublicBusiness`, which drops the hash and reports `hasOwnerPin` instead
 * (the same pattern as the staff routes' `hasPin`).
 *
 * There is deliberately no global Prisma `omit` for this: backup/restore reads
 * full rows and would silently lose the PIN.
 */

/** A Business-like row without `ownerPin`, plus whether one is set. */
export type PublicBusiness<T> = Omit<T, "ownerPin" | "hasOwnerPin"> & { hasOwnerPin: boolean };

/**
 * Drop the owner PIN hash from a Business-like row and add `hasOwnerPin`.
 *
 * Idempotent: a row that already went through here (no `ownerPin` key, a
 * `hasOwnerPin` flag) keeps its flag, so a repository and a route can both
 * apply it.
 */
export function toPublicBusiness<T extends object>(business: T): PublicBusiness<T> {
  const {
    ownerPin,
    hasOwnerPin: alreadyFlagged,
    ...rest
  } = business as T & { ownerPin?: string | null; hasOwnerPin?: boolean };
  const hasOwnerPin = "ownerPin" in business ? Boolean(ownerPin) : alreadyFlagged === true;
  return { ...rest, hasOwnerPin } as unknown as PublicBusiness<T>;
}
