"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

interface StaffRosterItem {
  role: string;
  isActive: boolean;
}

// Mirrors the "zero-staff bypass" role filter in (dashboard)/layout.tsx —
// a store's own auto-created OWNER-role StaffMember row (used to attribute
// shifts when the owner works the till) doesn't count as "someone else to
// switch to."
export function useHasSwitchableStaff(storeId: string | null | undefined, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["staff-roster-switchable", storeId],
    queryFn: async () => {
      const res = await apiClient.get<{ staff: StaffRosterItem[] }>(`/stores/${storeId}/staff`);
      return res.staff.some((s) => s.isActive && s.role !== "OWNER");
    },
    enabled: enabled && !!storeId,
    staleTime: 60 * 1000,
  });
  return data ?? false;
}
