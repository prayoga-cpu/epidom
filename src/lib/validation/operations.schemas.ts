import { z } from "zod";

// ── Staff ────────────────────────────────────────────────────────────────────

export const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]),
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
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "KITCHEN"]).optional(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
  sendPinEmail: z.boolean().optional(),
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
