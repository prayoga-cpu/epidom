"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { StaffRole } from "@prisma/client";

export interface OnDutyStaff {
  staffMemberId: string;
  name: string;
  role: StaffRole;
  customRoleLabel: string | null;
  /** ISO instant of the open CLOCK_IN. */
  since: string;
  locationLabel: string | null;
  shiftName: string | null;
}

export interface OpenTill {
  id: string;
  staffMemberId: string;
  name: string;
  role: StaffRole;
  openedAt: string;
  /** Literal in the store's own currency — not an IDR value to convert. */
  openingCash: number;
  orderCount: number;
}

export interface LateStaff {
  staffMemberId: string;
  name: string;
  role: StaffRole;
  customRoleLabel: string | null;
  shiftName: string | null;
  /** "HH:mm" in the store's business timezone. */
  startTime: string;
  minutesLate: number;
}

export interface OperationsStatus {
  now: string;
  timezone: string;
  businessDate: string;
  onDuty: OnDutyStaff[];
  openTills: OpenTill[];
  late: LateStaff[];
  today: {
    scheduledCount: number;
    onDutyCount: number;
    clockedInCount: number;
    absentCount: number;
    openTillCount: number;
    lateCount: number;
  };
}

/**
 * Live operations snapshot for the dashboard card. Polls on a 60s interval —
 * clock-in/out and till open/close are human-paced events, so this is a
 * deliberately cheaper alternative to the SSE stream the POS order queue uses.
 *
 * `enabled` should carry the caller's plan/role gate so the request is never
 * fired for a viewer the endpoint would 403 anyway.
 */
export function useOperationsStatus(storeId: string, enabled = true) {
  return useQuery<OperationsStatus>({
    queryKey: ["operations-status", storeId],
    queryFn: () => apiClient.get<OperationsStatus>(`/stores/${storeId}/operations/status`),
    enabled: enabled && !!storeId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
