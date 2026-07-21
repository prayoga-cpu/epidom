/**
 * Feedback validation schemas
 *
 * Zod schemas for the dashboard feedback / bug report feature.
 */

import { z } from "zod";

export const FEEDBACK_TYPES = ["BUG", "FEATURE_SUGGESTION", "GENERAL_FEEDBACK"] as const;

export const FEEDBACK_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as const;

export const FEEDBACK_PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

export const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  page: z.string().min(1).max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be at most 2000 characters"),
  screenshotUrl: z
    .string()
    .url()
    .refine((value) => {
      // Only accept URLs produced by our own upload endpoint (Vercel Blob).
      // Zod still runs refinements when .url() fails, so new URL() must not throw.
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")
        );
      } catch {
        return false;
      }
    }, "Invalid screenshot URL")
    .optional()
    .or(z.literal("")),
  storeId: z.string().max(50).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

// Admin triage update — status and priority are both admin-set (never
// user-submitted), so either can be patched independently from the same
// endpoint. At least one must be present.
export const updateFeedbackTriageSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(FEEDBACK_STATUSES).optional(),
    priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  })
  .refine((data) => data.status !== undefined || data.priority !== undefined, {
    message: "At least one of status or priority is required",
    path: ["status"],
  });

export type UpdateFeedbackTriageInput = z.infer<typeof updateFeedbackTriageSchema>;

export const updateOwnFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  page: z.string().min(1).max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be at most 2000 characters"),
});

export type UpdateOwnFeedbackInput = z.infer<typeof updateOwnFeedbackSchema>;
