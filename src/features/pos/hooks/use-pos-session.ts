import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";

export interface PosSessionState {
  storeId: string | null;
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  /** Resolved page hrefs this persona can see — null for the synthetic "owner" login (unrestricted). */
  allowedPages: string[] | null;
  shiftId: string | null;
  isActive: boolean;
  /** Local calendar date (toDateString()) this persona logged in on — see checkStale(). */
  loginDate: string | null;
  /**
   * Epoch ms the staff PIN was last verified. Powers PosStaffGate's periodic
   * re-verification for POS specifically (money-handling, so kept stricter
   * than the once-a-day gate everywhere else) — see PIN_REVERIFY_MS there.
   */
  pinVerifiedAt: number | null;
  login: (params: {
    storeId: string;
    staffId: string;
    staffName: string;
    staffRole: string;
    shiftId: string | null;
    allowedPages?: string[] | null;
  }) => void;
  logout: () => void;
  setShiftId: (shiftId: string) => void;
  /** Refreshes pinVerifiedAt after a lightweight re-verification (no identity/page changes). */
  touchPinVerified: () => void;
  /**
   * Clears a persona left logged in from a previous calendar day. The real
   * enforcement is server-side (StaffSession expires at next midnight in the
   * business timezone) — this just keeps the client's own display/gates
   * honest without waiting for a round-trip to discover the cookie is gone.
   */
  checkStale: () => void;
}

export const usePosSession = create<PosSessionState>()(
  persist(
    (set) => ({
      storeId: null,
      staffId: null,
      staffName: null,
      staffRole: null,
      allowedPages: null,
      shiftId: null,
      isActive: false,
      loginDate: null,
      pinVerifiedAt: null,

      login: ({ storeId, staffId, staffName, staffRole, shiftId, allowedPages }) =>
        set({
          storeId,
          staffId,
          staffName,
          staffRole,
          shiftId,
          allowedPages: allowedPages ?? null,
          isActive: true,
          loginDate: new Date().toDateString(),
          pinVerifiedAt: Date.now(),
        }),

      logout: () =>
        set({
          storeId: null,
          staffId: null,
          staffName: null,
          staffRole: null,
          allowedPages: null,
          shiftId: null,
          isActive: false,
          loginDate: null,
          pinVerifiedAt: null,
        }),

      setShiftId: (shiftId) => set({ shiftId }),

      touchPinVerified: () => set({ pinVerifiedAt: Date.now() }),

      checkStale: () =>
        set((state) => {
          if (state.isActive && state.loginDate !== new Date().toDateString()) {
            return {
              storeId: null,
              staffId: null,
              staffName: null,
              staffRole: null,
              allowedPages: null,
              shiftId: null,
              isActive: false,
              loginDate: null,
              pinVerifiedAt: null,
            };
          }
          return {};
        }),
    }),
    { name: "epidom-pos-session" }
  )
);

/** Clears a stale (previous-day) persona once when the calling component mounts. */
export function useClearStalePosSession() {
  const checkStale = usePosSession((s) => s.checkStale);
  useEffect(() => {
    checkStale();
  }, [checkStale]);
}
