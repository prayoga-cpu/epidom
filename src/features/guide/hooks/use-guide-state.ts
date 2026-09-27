"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { GuideState, GuideStatePatch, PageIntroId } from "@/lib/guide/contracts";
import type { ApiSuccessResponse } from "@/types/api/responses";
import { applyPatchToState, emptyGuideState, parseGuideState } from "../lib/guide-state";

/**
 * The viewer's in-app guide state (GET/PATCH /api/user/guide-state): welcome
 * tour seen, page intro cards dismissed, store checklists hidden.
 *
 * Never throws and never blocks a page. Signed out, deactivated or otherwise
 * refused (401/403): it behaves as an empty state that is ready at once, and
 * changes only apply in this tab's cache (nothing is sent), so a dismissed card
 * still goes away for the rest of the visit.
 *
 * Changes are optimistic: the cache updates first, the PATCH follows. PATCHes
 * run one at a time (a shared mutation scope) so two quick taps can't overtake
 * each other. Whenever one settles, the cache is rebuilt as the last state the
 * server confirmed plus the changes still waiting for an answer: a failed
 * change drops out, and neither a failure nor a success can wipe or resurrect a
 * change queued behind it. (Per-change snapshots can't do this: every queued
 * change's onMutate runs at tap time, so its snapshot already holds the changes
 * ahead of it, failed or not.)
 */

export const guideStateKey = ["guide-state"] as const;

/** What the ["guide-state"] cache entry holds. */
export interface GuideStateQueryData {
  state: GuideState;
  /** False when the server refused the read (401/403): changes stay local. */
  available: boolean;
}

const GUIDE_STATE_URL = "/api/user/guide-state";
const guideStateMutationKey = ["guide-state", "patch"] as const;

/** One empty state for the loading/error render, so memoized consumers don't churn. */
const EMPTY_STATE: GuideState = emptyGuideState();

export interface UseGuideStateResult {
  state: GuideState;
  /** First load in flight (no data yet). */
  isLoading: boolean;
  /** Data is in (or the server refused, which reads as empty) — safe to decide whether to auto-open things. */
  isReady: boolean;
  /** False when signed out / refused: nothing is saved server-side. */
  isAvailable: boolean;
  tourSeen: boolean;
  isTipDismissed: (id: PageIntroId) => boolean;
  isChecklistDismissed: (storeId: string) => boolean;
  dismissTip: (id: PageIntroId) => void;
  markTourSeen: () => void;
  /** Clears tourSeenAt so the tour opens by itself again. */
  resetTour: () => void;
  restoreTips: () => void;
  dismissChecklist: (storeId: string) => void;
  restoreChecklist: (storeId: string) => void;
}

class GuideStateRequestError extends Error {
  constructor(readonly status: number) {
    super(`Guide state request failed (${status})`);
    this.name = "GuideStateRequestError";
  }
}

const isRefusal = (status: number) => status === 401 || status === 403;

async function fetchGuideState(): Promise<GuideStateQueryData> {
  const response = await fetch(GUIDE_STATE_URL);
  if (isRefusal(response.status)) return { state: emptyGuideState(), available: false };
  if (!response.ok) throw new GuideStateRequestError(response.status);
  const body: ApiSuccessResponse<GuideState> = await response.json();
  return { state: parseGuideState(body?.data), available: true };
}

async function patchGuideState(patch: GuideStatePatch): Promise<GuideState> {
  const response = await fetch(GUIDE_STATE_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new GuideStateRequestError(response.status);
  const body: ApiSuccessResponse<GuideState> = await response.json();
  return parseGuideState(body?.data);
}

function currentData(client: QueryClient): GuideStateQueryData {
  return (
    client.getQueryData<GuideStateQueryData>(guideStateKey) ?? {
      state: emptyGuideState(),
      available: true,
    }
  );
}

/**
 * The PATCHes in flight or queued for one QueryClient (shared by every
 * useGuideState on the page, like the mutation scope), and the server state
 * they apply on top of.
 */
interface PendingGuideChanges {
  /**
   * The last state the server confirmed: the cache as it stood when the first of
   * the current run of changes was made, then each PATCH answer. Undefined when
   * that first change was made before anything had loaded.
   */
  confirmed: GuideStateQueryData | undefined;
  /** Sent or queued, not yet answered, in the order they were made. */
  patches: GuideStatePatch[];
}

const pendingByClient = new WeakMap<QueryClient, PendingGuideChanges>();

function pendingChanges(client: QueryClient): PendingGuideChanges {
  let pending = pendingByClient.get(client);
  if (!pending) {
    pending = { confirmed: undefined, patches: [] };
    pendingByClient.set(client, pending);
  }
  return pending;
}

/** Takes an answered patch off the list (by identity: every change is its own object). */
function settlePatch(client: QueryClient, patch: GuideStatePatch): PendingGuideChanges {
  const pending = pendingChanges(client);
  const index = pending.patches.indexOf(patch);
  if (index !== -1) pending.patches.splice(index, 1);
  return pending;
}

/** The confirmed state with every still-unanswered change applied, in order. */
function withPendingPatches(
  confirmed: GuideStateQueryData,
  patches: readonly GuideStatePatch[]
): GuideStateQueryData {
  return {
    // Not `reduce(applyPatchToState)`: its third parameter is `now`, and reduce
    // would pass the index there.
    state: patches.reduce((state, patch) => applyPatchToState(state, patch), confirmed.state),
    available: confirmed.available,
  };
}

export function useGuideState(): UseGuideStateResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: guideStateKey,
    queryFn: fetchGuideState,
    staleTime: 5 * 60 * 1000,
    // A refusal already resolved to "empty"; anything else gets one more try.
    retry: (failureCount) => failureCount < 1,
  });

  const mutation = useMutation<GuideState, Error, GuideStatePatch>({
    mutationKey: guideStateMutationKey,
    scope: { id: "guide-state" },
    mutationFn: patchGuideState,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: guideStateKey });
      const pending = pendingChanges(queryClient);
      const cached = queryClient.getQueryData<GuideStateQueryData>(guideStateKey);
      // Nothing else unanswered: what's cached now is what the server has.
      if (pending.patches.length === 0) pending.confirmed = cached;
      pending.patches.push(patch);
      const base = cached ?? currentData(queryClient);
      queryClient.setQueryData<GuideStateQueryData>(guideStateKey, {
        state: applyPatchToState(base.state, patch),
        available: base.available,
      });
    },
    onError: (_error, patch) => {
      const pending = settlePatch(queryClient, patch);
      if (!pending.confirmed) {
        // Nothing had loaded when this run of changes began: ask the server.
        void queryClient.invalidateQueries({ queryKey: guideStateKey });
        return;
      }
      queryClient.setQueryData<GuideStateQueryData>(
        guideStateKey,
        withPendingPatches(pending.confirmed, pending.patches)
      );
    },
    onSuccess: (state, patch) => {
      const pending = settlePatch(queryClient, patch);
      pending.confirmed = { state, available: true };
      // The server's answer, plus whatever is still queued behind it.
      queryClient.setQueryData<GuideStateQueryData>(
        guideStateKey,
        withPendingPatches(pending.confirmed, pending.patches)
      );
    },
  });

  const { mutate } = mutation;
  const available = query.data?.available ?? true;

  const change = useCallback(
    (patch: GuideStatePatch) => {
      const data = queryClient.getQueryData<GuideStateQueryData>(guideStateKey);
      if (data && !data.available) {
        // Refused: remember it for this visit only.
        queryClient.setQueryData<GuideStateQueryData>(guideStateKey, {
          state: applyPatchToState(data.state, patch),
          available: false,
        });
        return;
      }
      mutate(patch);
    },
    [mutate, queryClient]
  );

  const state = query.data?.state ?? EMPTY_STATE;

  return useMemo<UseGuideStateResult>(
    () => ({
      state,
      isLoading: query.isLoading,
      isReady: query.isSuccess,
      isAvailable: available,
      tourSeen: state.tourSeenAt !== null,
      isTipDismissed: (id) => state.dismissedTips.includes(id),
      isChecklistDismissed: (storeId) => state.dismissedChecklists.includes(storeId),
      dismissTip: (id) => change({ dismissTip: id }),
      markTourSeen: () => change({ tourSeen: true }),
      resetTour: () => change({ resetTour: true }),
      restoreTips: () => change({ restoreTips: true }),
      dismissChecklist: (storeId) => change({ dismissChecklist: storeId }),
      restoreChecklist: (storeId) => change({ restoreChecklist: storeId }),
    }),
    [state, query.isLoading, query.isSuccess, available, change]
  );
}
