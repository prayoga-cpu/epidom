import { z } from "zod";
import { MAX_POINTS_ADJUSTMENT } from "@/lib/validation/customers.schemas";
import type { CreateCustomerBody, CustomerRowDto, UpdateCustomerBody } from "@/types/api/cashier";

/**
 * Client-side form schemas for the Customers page. The API re-validates
 * everything (src/lib/validation/customers.schemas.ts) — these exist so the
 * common mistakes are caught before a round trip, in the user's language. The
 * limits below mirror the server's; the server stays the authority (a duplicate
 * phone, for one, can only be known there).
 */

type Translate = (key: string) => string;

const NAME_MAX = 100;
const EMAIL_MAX = 254;
const NOTES_MAX = 500;
const REASON_MAX = 200;

// Same shape the server's normalisePhone() accepts, and what PhoneInput emits.
// PhoneInput reports a half-typed number ("+336") as-is, so the length check is
// what stops a truncated number reaching the API.
const E164 = /^\+[1-9]\d{6,14}$/;

const emailShape = z.string().email();

// ─── Add / edit customer ─────────────────────────────────────────────────────

export function createCustomerFormSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("customers.form.errors.nameRequired"))
      .max(NAME_MAX, t("customers.form.errors.nameTooLong")),
    // PhoneInput reports E.164, or undefined once the number is cleared.
    phone: z
      .string()
      .optional()
      .refine((v) => !v || E164.test(v), t("customers.form.errors.phoneInvalid")),
    email: z
      .string()
      .trim()
      .max(EMAIL_MAX, t("customers.form.errors.emailTooLong"))
      .refine((v) => v === "" || emailShape.safeParse(v).success, {
        message: t("customers.form.errors.emailInvalid"),
      }),
    notes: z.string().trim().max(NOTES_MAX, t("customers.form.errors.notesTooLong")),
  });
}

export type CustomerFormValues = z.infer<ReturnType<typeof createCustomerFormSchema>>;

export function emptyCustomerForm(): CustomerFormValues {
  return { name: "", phone: undefined, email: "", notes: "" };
}

export function customerToFormValues(
  customer: Pick<CustomerRowDto, "name" | "phone" | "email" | "notes">
): CustomerFormValues {
  return {
    name: customer.name,
    phone: customer.phone ?? undefined,
    email: customer.email ?? "",
    notes: customer.notes ?? "",
  };
}

/** Create: an untouched optional field is left out rather than sent as "". */
export function toCreateBody(values: CustomerFormValues): CreateCustomerBody {
  const body: CreateCustomerBody = { name: values.name };
  if (values.phone) body.phone = values.phone;
  if (values.email) body.email = values.email;
  if (values.notes) body.notes = values.notes;
  return body;
}

/**
 * Edit: the form always holds the customer's full current state, so every
 * field is sent, and an emptied one goes as `null` — which is how PATCH clears
 * phone / email / notes (a missing key would mean "leave alone").
 */
export function toUpdateBody(values: CustomerFormValues): UpdateCustomerBody {
  return {
    name: values.name,
    phone: values.phone || null,
    email: values.email || null,
    notes: values.notes || null,
  };
}

// ISO country a PhoneInput starts on, from the store's display currency — the
// same per-store signal the server uses to complete a number typed without its
// "+<country>" prefix (callingCodeForCurrency). France is the primary market.
const COUNTRY_BY_CURRENCY: Record<string, string> = {
  IDR: "ID",
  EUR: "FR",
  USD: "US",
  GBP: "GB",
  SGD: "SG",
  MYR: "MY",
  AUD: "AU",
};

export function defaultPhoneCountry(currency: string | null | undefined): string {
  return (currency && COUNTRY_BY_CURRENCY[currency.toUpperCase()]) || "FR";
}

// ─── Adjust points ───────────────────────────────────────────────────────────

export type AdjustDirection = "add" | "remove";

/**
 * The amount is kept as a magnitude string plus an explicit direction, not as a
 * signed number: iOS's numeric keypad has no minus key, so "type -50" is
 * impossible on the tablets and phones this page is used on. The field is named
 * `points` (not `amount`) so a server error pinned to `points` lands on it via
 * applyServerFieldErrors.
 */
export function createAdjustPointsSchema(t: Translate, formatMax: string) {
  return z.object({
    direction: z.enum(["add", "remove"]),
    points: z
      .string()
      .trim()
      .regex(/^\d+$/, t("customers.adjust.errors.amountInvalid"))
      .refine((v) => Number(v) >= 1, t("customers.adjust.errors.amountInvalid"))
      .refine(
        (v) => Number(v) <= MAX_POINTS_ADJUSTMENT,
        t("customers.adjust.errors.amountMax").replace("{max}", formatMax)
      ),
    note: z
      .string()
      .trim()
      .min(1, t("customers.adjust.errors.reasonRequired"))
      .max(REASON_MAX, t("customers.adjust.errors.reasonTooLong")),
  });
}

export type AdjustPointsFormValues = z.infer<ReturnType<typeof createAdjustPointsSchema>>;

/** The signed number the API takes: "+" grants, "−" removes. */
export function toSignedPoints(direction: AdjustDirection, magnitude: string): number {
  const value = Number(magnitude);
  return direction === "add" ? value : -value;
}
