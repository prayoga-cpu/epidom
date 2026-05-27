import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PosSessionState {
  storeId: string | null;
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  shiftId: string | null;
  isActive: boolean;
  login: (params: {
    storeId: string;
    staffId: string;
    staffName: string;
    staffRole: string;
    shiftId: string | null;
  }) => void;
  logout: () => void;
  setShiftId: (shiftId: string) => void;
}

export const usePosSession = create<PosSessionState>()(
  persist(
    (set) => ({
      storeId: null,
      staffId: null,
      staffName: null,
      staffRole: null,
      shiftId: null,
      isActive: false,

      login: ({ storeId, staffId, staffName, staffRole, shiftId }) =>
        set({ storeId, staffId, staffName, staffRole, shiftId, isActive: true }),

      logout: () =>
        set({
          storeId: null,
          staffId: null,
          staffName: null,
          staffRole: null,
          shiftId: null,
          isActive: false,
        }),

      setShiftId: (shiftId) => set({ shiftId }),
    }),
    { name: "epidom-pos-session" }
  )
);
