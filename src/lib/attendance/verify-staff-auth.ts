import { compare } from "bcryptjs";
import { getActiveStaffSession } from "@/lib/staff-session";

/**
 * Shared PIN check for the clock-in / clock-out / absence endpoints. A PIN
 * is only meant to prove identity once, at login — if this exact browser
 * already has a live StaffSession for this exact staff member (established
 * by /api/stores/[id]/staff/verify-pin), that's already proof enough and the
 * clock-in/out flow shouldn't ask again. Falls back to checking the
 * submitted PIN for devices with no active session (e.g. a shared kiosk
 * picking a different staff member than the one currently logged in).
 */
export async function isStaffAuthenticated(
  storeId: string,
  staffId: string,
  pin: string | undefined,
  pinHash: string | null
): Promise<boolean> {
  if (!pinHash) return true;

  const activeSession = await getActiveStaffSession();
  if (
    activeSession &&
    activeSession.storeId === storeId &&
    activeSession.staffMemberId === staffId
  ) {
    return true;
  }

  if (!pin) return false;
  return compare(pin, pinHash);
}
