"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFeedbackInput,
  UpdateOwnFeedbackInput,
} from "@/lib/validation/feedback.schemas";
import { ApiSuccessResponse } from "@/types/api/responses";

// Feedback types matching Prisma schema (kept local to avoid client-side Prisma imports)
export type FeedbackType = "BUG" | "FEATURE_SUGGESTION" | "GENERAL_FEEDBACK";

export type FeedbackStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  page: string;
  description: string;
  screenshotUrl: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

// Error carrying the HTTP status so callers can react to specific codes (e.g. 429)
export interface ApiError extends Error {
  status?: number;
}

// Query key for the current user's own feedback list
const MY_FEEDBACK_KEY = ["my-feedback"] as const;

/**
 * Submit feedback (bug report, feature suggestion, or general feedback)
 */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation<FeedbackItem, ApiError, CreateFeedbackInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error: ApiError = new Error(errorData.error?.message || "Failed to submit feedback");
        error.status = response.status;
        throw error;
      }

      const data: ApiSuccessResponse<FeedbackItem> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      // Keep the "My tickets" list in sync with the just-created ticket
      queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    },
  });
}

/**
 * Fetch the current user's own feedback tickets
 * Pass `enabled: false` while the list is not visible to avoid needless fetches
 */
export function useMyFeedback(enabled: boolean) {
  return useQuery<FeedbackItem[], ApiError>({
    queryKey: MY_FEEDBACK_KEY,
    queryFn: async () => {
      const response = await fetch("/api/feedback");

      if (!response.ok) {
        const errorData = await response.json();
        const error: ApiError = new Error(errorData.error?.message || "Failed to fetch feedback");
        error.status = response.status;
        throw error;
      }

      const data: ApiSuccessResponse<FeedbackItem[]> = await response.json();
      return data.data;
    },
    enabled,
  });
}

/**
 * Update one of the current user's own feedback tickets (type/page/description only)
 */
export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation<FeedbackItem, ApiError, { id: string; input: UpdateOwnFeedbackInput }>({
    mutationFn: async ({ id, input }) => {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error: ApiError = new Error(errorData.error?.message || "Failed to update feedback");
        error.status = response.status;
        throw error;
      }

      const data: ApiSuccessResponse<FeedbackItem> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      // Invalidate the user's ticket list to refetch
      queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    },
  });
}

/**
 * Delete one of the current user's own feedback tickets
 */
export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation<{ deleted: boolean }, ApiError, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error: ApiError = new Error(errorData.error?.message || "Failed to delete feedback");
        error.status = response.status;
        throw error;
      }

      const data: ApiSuccessResponse<{ deleted: boolean }> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      // Invalidate the user's ticket list to refetch
      queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    },
  });
}
