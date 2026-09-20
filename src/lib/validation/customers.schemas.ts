import { z } from "zod";

/**
 * Customer validation (POS "Add customer" + Back Office Customers page).
 *
 * The phone is only checked for length here: turning it into canonical E.164
 * needs the store's default country calling code, so the SERVICE normalises it
 * and reports a bad number as a field error — see customer.service.ts.
 */

const nameSchema = z.string().trim().min(1, "Name is required").max(100, "Name is too long");

// The forms post "" for an untouched optional input; treat that as "not given"
// rather than a value that then fails its own format check.
const optionalTrimmed = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

// "" is allowed through the format check so a cleared input means "no e-mail"
// (the transforms below turn it into absent / null) instead of an "Invalid email"
// error — and a single refine, not a union, so the message stays specific.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email format");

const createEmail = emailField.transform((v) => (v === "" ? undefined : v)).optional();

// A customer may be created from a phone number alone — the POS captures a
// WhatsApp number first and the name/email are optional extras the customer may
// never give. The service then names the record after the number (Customer.name
// is NOT NULL), so "no name" is only valid alongside a phone.
export const createCustomerSchema = z
  .object({
    name: optionalTrimmed(100, "Name is too long"),
    phone: optionalTrimmed(30, "Phone number is too long"),
    email: createEmail,
    notes: optionalTrimmed(500, "Notes are too long"),
  })
  .refine((v) => !!v.name || !!v.phone, {
    message: "Enter a name or a phone number",
    path: ["name"],
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// PATCH: a missing key means "leave alone", and null (or "") means "clear it".
const clearableTrimmed = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const updateCustomerSchema = z
  .object({
    name: nameSchema.optional(),
    phone: clearableTrimmed(30, "Phone number is too long"),
    email: emailField
      .nullable()
      .transform((v) => (v === "" ? null : v))
      .optional(),
    notes: clearableTrimmed(500, "Notes are too long"),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Largest single manual adjustment — a typo guard, not a business limit. */
export const MAX_POINTS_ADJUSTMENT = 1_000_000;

export const adjustPointsSchema = z.object({
  points: z
    .number()
    .int("Points must be a whole number")
    .refine((v) => v !== 0, "Enter a non-zero number of points")
    .refine(
      (v) => Math.abs(v) <= MAX_POINTS_ADJUSTMENT,
      `Adjust at most ${MAX_POINTS_ADJUSTMENT.toLocaleString("en-US")} points at a time`
    ),
  note: z.string().trim().min(1, "A reason is required").max(200, "Reason is too long"),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

/**
 * DB-backed sorts only. lifetimeSpend / orderCount / lastOrderAt are computed
 * from Order per request, so ordering by them would mean aggregating the whole
 * table before the first page could be cut.
 */
export const CUSTOMER_SORTS = ["name", "newest", "oldest", "points"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(64).optional(),
  sort: z.enum(CUSTOMER_SORTS).default("name"),
  includeSummary: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
