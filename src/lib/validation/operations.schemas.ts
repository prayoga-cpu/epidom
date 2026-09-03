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

// ── Cash movements ───────────────────────────────────────────────────────────

export const cashMovementTypeSchema = z.enum(["TIP", "PETTY_IN", "PETTY_OUT", "DROP", "PAYOUT"]);
export type CashMovementTypeInput = z.infer<typeof cashMovementTypeSchema>;

/**
 * Movement types that take cash OUT of the drawer. These demand a reason —
 * "where did the money go" is the entire point of recording them, and a blank
 * paid-out is indistinguishable from a till short at the end of the day.
 */
export const OUTBOUND_CASH_MOVEMENT_TYPES = ["PETTY_OUT", "DROP", "PAYOUT"] as const;

export const createCashMovementSchema = z
  .object({
    // Optional: a movement can legitimately happen with no till open (an owner
    // topping up the float before the first shift, an evening safe drop).
    shiftId: z.string().cuid().optional(),
    // Who is recording it. Omitted means the acting staff persona is taken from
    // the staff-session cookie, or the row is left unattributed for a real
    // owner — never silently attributed to the owner's user id, which on a
    // shared iPad would be a confident wrong answer.
    staffMemberId: z.string().cuid().optional(),
    pin: z
      .string()
      .length(4)
      .regex(/^\d{4}$/)
      .optional()
      .or(z.literal("")),
    type: cashMovementTypeSchema,
    // Strictly positive. Direction comes from `type`, never from the sign — a
    // negative amount here would double-negate an outbound movement and
    // silently inflate the expected drawer balance.
    // Upper bound is the column, not a policy: `amount` is Decimal(12, 2), so
    // anything from 1e10 up is a Postgres numeric-overflow 22003 — a 500 from
    // a value a user can simply type. 10 integer digits is only ~600k USD in
    // IDR terms, so this is reachable by a fat-fingered rupiah amount, not
    // just by abuse.
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .finite("Amount must be finite")
      .lt(1e10, "Amount is too large")
      .multipleOf(0.01, "Amount can only have 2 decimal places"),
    reason: z.string().max(500).optional(),
    // Backdating is legitimate — a paid-out often gets keyed in ten minutes
    // late. Forward-dating is not: a movement stamped next week would sit
    // outside every report until then, silently unbalancing today's drawer.
    // A few minutes of tolerance covers ordinary device clock skew.
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.occurredAt) {
      const CLOCK_SKEW_MS = 5 * 60 * 1000;
      if (new Date(data.occurredAt).getTime() > Date.now() + CLOCK_SKEW_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["occurredAt"],
          message: "A cash movement cannot be dated in the future",
        });
      }
    }
    const isOutbound = (OUTBOUND_CASH_MOVEMENT_TYPES as readonly string[]).includes(data.type);
    if (isOutbound && !data.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "A reason is required when cash leaves the drawer",
      });
    }
  });
export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;

export const cashMovementListQuerySchema = z
  .object({
    shiftId: z.string().cuid().optional(),
    staffId: z.string().cuid().optional(),
    type: cashMovementTypeSchema.optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    take: z.coerce.number().int().positive().max(200).default(100),
    skip: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to), {
    message: "`from` must not be after `to`",
    path: ["from"],
  });
export type CashMovementListQuery = z.infer<typeof cashMovementListQuerySchema>;
