"use client";

import { useState } from "react";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { useOwnerPinStatus } from "./use-owner-pin";
import { useHasSwitchableStaff } from "./use-has-switchable-staff";
import { apiClient } from "@/lib/api/client";
import { signOut } from "@/lib/auth-client";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";

/**
 * Identity-switching logic — who's using this shared device right now, and
 * how to change that. Extracted from nav-user.tsx (Back Office's Topbar
 * dropdown, where this was originally built and is the only place it was
 * reachable) so PosModeOverflowMenu can offer the exact same, already-
 * correct actions — reload/cookie/service-worker-cache clearing included —
 * instead of a cashier having to leave POS Mode and find Back Office's
 * topbar just to switch to a different staff member or back to Owner.
 *
 * Deliberately distinct from clock in/out (ClockInOutDialog): that's a
 * timesheet action (start/end a paid shift) for the persona already active;
 * this is "who is this device speaking as," a different question with a
 * different answer (docs/back-office-revamp.md's switcher work).
 */
export function useAccountSwitcher(storeId: string | undefined) {
  const posSession = usePosSession();
  const { data: pinStatus } = useOwnerPinStatus();

  // Role-based, not ID-based: a StaffMember row can itself have role "OWNER"
  // (e.g. seeded accounts), and that persona is functionally the owner too.
  const actingAsStaff =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER";

  // "Switch Account" only makes sense if there's actually someone else to
  // switch to — otherwise it reloads into a picker with nothing on it.
  const hasSwitchableStaff = useHasSwitchableStaff(storeId, !actingAsStaff);

  const [verifyOwnerOpen, setVerifyOwnerOpen] = useState(false);
  const [setOwnerPinOpen, setSetOwnerPinOpen] = useState(false);

  const clearStaffSession = async () => {
    posSession.logout();
    if (storeId) {
      try {
        await apiClient.post(`/stores/${storeId}/staff/logout`, {});
      } catch {
        // Best-effort — the client-side session is already cleared either way.
      }
    }
  };

  const handleBackToOwnerClick = () => {
    if (pinStatus?.hasPin) setVerifyOwnerOpen(true);
    else setSetOwnerPinOpen(true);
  };

  const handleSwitchedBackToOwner = async () => {
    await clearStaffSession();
    // Hard reload, not just client state: the current page's server-rendered
    // content was fetched under the (now-cleared) staff session, so a client
    // router transition wouldn't re-run the page guards or refetch anything
    // that was hidden/redirected while restricted.
    window.location.reload();
  };

  // Clears whichever persona is currently active on this device (staff or
  // "Continue as Owner" from the gate) without touching the underlying
  // Better Auth session. Clearing posSession (and the matching server-side
  // StaffSession cookie, harmless to call even when there isn't one) is
  // exactly what StoreAccessGate checks to decide whether to show its
  // "who's using this device?" picker, so a reload lands right back there —
  // used both for "Switch Account" (owner picking a different persona) and
  // "Log Out of Staff Session" (staff stepping away, no owner PIN needed).
  const handleReturnToPicker = async () => {
    await clearStaffSession();
    window.location.reload();
  };

  // The heavier action: ends the real, underlying Epidom account session
  // (Better Auth) — one consistent "leave Epidom entirely" action wherever
  // you are, Owner or staff. Clears the staff session too for a clean slate.
  const handleOwnerAccountLogout = async () => {
    await clearStaffSession();
    // Otherwise the next signed-out (or different) visitor on this device
    // would get bounced from the marketing homepage straight into a
    // login-required page — see LastVisitedTracker/middleware.ts.
    try {
      localStorage.removeItem(LAST_VISITED_COOKIE);
      localStorage.removeItem(REMEMBER_PREF_COOKIE);
    } catch {
      // Ignore — worst case the stale value just gets overwritten on next sign-in.
    }
    try {
      // Expire both cookies immediately (Max-Age=0) — middleware reads these
      // Edge-side on every marketing-page request, so a stale cookie left
      // behind would resume-redirect the next signed-out visitor on this
      // device straight into a login-required page.
      document.cookie = `${LAST_VISITED_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${REMEMBER_PREF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      // Ignore — same as above.
    }
    try {
      // Drop the service worker's offline app shell. It holds server-rendered
      // /store/** documents for THIS account, and a POS tablet is routinely
      // shared — without this the next owner to sign in here could be served
      // the previous one's dashboard the first time the wifi drops. See the
      // SHELL_CACHE block in public/sw.js.
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_APP_SHELL" });
    } catch {
      // Ignore — no controller yet (first load, or SW unsupported) means there
      // is no shell cached to clear in the first place.
    }
    await signOut();
    window.location.href = "/login";
  };

  return {
    posSession,
    pinStatus,
    actingAsStaff,
    hasSwitchableStaff,
    verifyOwnerOpen,
    setVerifyOwnerOpen,
    setOwnerPinOpen,
    setSetOwnerPinOpen,
    handleBackToOwnerClick,
    handleSwitchedBackToOwner,
    handleReturnToPicker,
    handleOwnerAccountLogout,
  };
}
