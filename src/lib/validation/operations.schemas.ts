import { z } from "zod";
import { phoneSchema, optionalEmailSchema } from "./common.schemas";
import { ALL_STAFF_PAGES } from "@/config/staff-permissions.config";

// ── Staff ────────────────────────────────────────────────────────────────────

// Login identity for the staff PIN gate — unique per store (enforced at the
// API layer, not just DB), not an email/contact field.
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9_.]+$/, "Only lowercase letters, numbers, underscore, and dot are allowed");

// Dashboard nav item hrefs a staff member can be granted — validated
// against the actual page universe (staff-permissions.config.ts), so this
// can't drift out of sync with navigation.config.ts or accept junk values.
const allowedPagesSchema = z
  .array(z.string().refine((page) => ALL_STAFF_PAGES.includes(page), "Unknown page"))
  .optional();

export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  username: usernameSchema,
  email: optionalEmailSchema,
  whatsapp: phoneSchema,
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]),
  customRoleLabel: z.string().max(40).optional().or(z.literal("")),
  allowedPages: allowedPagesSchema,
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  sendInvite: z.boolean().optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: usernameSchema.optional(),
  email: optionalEmailSchema,
  whatsapp: phoneSchema,
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]).optional(),
  customRoleLabel: z.string().max(40).optional().or(z.literal("")),
  allowedPages: allowedPagesSchema,
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
  sendPinEmail: z.boolean().optional(),
  // Optional pay rate for labor-cost reporting — many roles are genuinely
  // off-system payroll, so NONE (the default) means "unknown," not zero.
  payType: z.enum(["HOURLY", "MONTHLY", "NONE"]).optional(),
  payRate: z.number().min(0).optional().nullable(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const verifyStaffPinSchema = z.object({
  staffId: z.string().cuid(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("")),
});

// ── Shifts ───────────────────────────────────────────────────────────────────

export const openShiftSchema = z.object({
  staffId: z.string().cuid(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("")),
  openingCash: z.number().min(0),
});
export type OpenShiftInput = z.infer<typeof openShiftSchema>;

export const closeShiftSchema = z.object({
  closingCash: z.number().min(0),
  notes: z.string().max(500).optional(),
});
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
