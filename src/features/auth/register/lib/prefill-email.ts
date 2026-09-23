import { z } from "zod";
import { createRegisterSchema } from "../../validation/auth.schemas";

// The closing CTA on the home, services and pricing pages hands the visitor
// over with the address they already typed, through sessionStorage (see
// prefill-handoff.ts); a legacy `/register?email=` link is still honoured. Both
// values come from outside the form (storage and the URL can be written by
// anything), so they are untrusted: they have to clear the very email rule the
// form enforces at submit (reached through innerType() because the register schema
// is a refined object, not a bare shape) plus a trim and the RFC 5321
// 254-character cap, or they are dropped. A rejected value is never shown, so the
// schema's messages do not matter and an identity translator will do.
const emailRule = createRegisterSchema((key) => key).innerType().shape.email;
const prefillEmailSchema = z.string().trim().max(254).pipe(emailRule);

/**
 * The email to pre-fill on the sign-up form, or "" when the value (the stashed
 * address or a legacy `?email=` param) is missing or is not a well-formed address.
 * Invalid input is ignored silently on purpose: a visitor who hand-edited the URL
 * just sees a blank field, never an error for something they didn't type into the
 * form.
 */
export function parsePrefillEmail(raw: string | null | undefined): string {
  const parsed = prefillEmailSchema.safeParse(raw);
  return parsed.success ? parsed.data : "";
}
