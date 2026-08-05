/**
 * Custom development request validation schemas
 *
 * Zod schemas for the Enterprise "Custom Development" request feature.
 */

import { z } from "zod";

export const CUSTOM_DEVELOPMENT_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
] as const;

export const createCustomDevelopmentRequestSchema = z.object({
  company: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  budget: z.string().max(100).optional().or(z.literal("")),
  timeline: z.string().max(100).optional().or(z.literal("")),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(3000, "Description must be at most 3000 characters"),
  storeId: z.string().max(50).optional(),
});

export type CreateCustomDevelopmentRequestInput = z.infer<
  typeof createCustomDevelopmentRequestSchema
>;

// Owner self-edit — same shape as create (the client resends the full form).
export const updateOwnCustomDevelopmentRequestSchema = z.object({
  company: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  budget: z.string().max(100).optional().or(z.literal("")),
  timeline: z.string().max(100).optional().or(z.literal("")),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(3000, "Description must be at most 3000 characters"),
});

export type UpdateOwnCustomDevelopmentRequestInput = z.infer<
  typeof updateOwnCustomDevelopmentRequestSchema
>;

// Admin triage update — status and devNote are both admin-set (never
// user-submitted), so either can be patched independently from the same
// endpoint. At least one must be present.
export const updateCustomDevelopmentTriageSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(CUSTOM_DEVELOPMENT_STATUSES).optional(),
    devNote: z.string().max(2000).optional(),
  })
  .refine((data) => data.status !== undefined || data.devNote !== undefined, {
    message: "At least one of status or devNote is required",
    path: ["status"],
  });

export type UpdateCustomDevelopmentTriageInput = z.infer<
  typeof updateCustomDevelopmentTriageSchema
>;
