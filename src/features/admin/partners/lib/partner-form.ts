import { z } from "zod";

/**
 * The partner deal form (create and edit). Numbers stay strings while typed
 * (an empty field is not 0) and become numbers in toDealPayload; the server
 * validates again (src/lib/validation/partner.schemas.ts).
 */
const decimal = (max: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `${label}: a number, up to 2 decimals`)
    .refine((v) => Number(v) <= max, `${label}: at most ${max}`);

/**
 * Where the partner's link goes: a referral link to the sign-up page or the
 * home page (`?ref=CODE`, customers get the discount), or a sales page the
 * partner owns (every sign-up from it counts, no code, no discount).
 */
export const LINK_LANDING_PATTERN = /^(REGISTER|HOME|sales-page-\d+)$/;

export function isSalesPageLanding(landing: string): boolean {
  return landing.startsWith("sales-page-");
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const partnerDealFormSchema = z.object({
  displayName: z.string().trim().min(1, "Name shown on the banner is required").max(80),
  referralCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Za-z0-9_-]{3,32}$/.test(v), "3–32 letters, digits, - or _"),
  referralLanding: z.string().regex(LINK_LANDING_PATTERN),
  /** A sales page: count its sign-ups from this date (YYYY-MM-DD). */
  creditFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  commissionRate: decimal(100, "Commission"),
  commissionMonths: z
    .string()
    .trim()
    .regex(/^\d+$/, "Months: a whole number")
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, "Months: 1 to 120"),
  customerDiscountPercent: decimal(50, "Discount"),
  notes: z.string().max(2000),
});
export type PartnerDealFormValues = z.infer<typeof partnerDealFormSchema>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createPartnerFormSchema = partnerDealFormSchema
  .extend({
    /** An existing account from the users list, or an email to invite. */
    who: z.enum(["user", "invite"]),
    userId: z.string(),
    inviteEmail: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.who === "user" && !v.userId) {
      ctx.addIssue({ code: "custom", path: ["userId"], message: "Pick a user" });
    }
    if (v.who === "invite" && !EMAIL.test(v.inviteEmail)) {
      ctx.addIssue({ code: "custom", path: ["inviteEmail"], message: "Enter a valid email" });
    }
    if (!isSalesPageLanding(v.referralLanding) && !v.referralCode.trim()) {
      ctx.addIssue({ code: "custom", path: ["referralCode"], message: "A referral link needs a code" });
    }
  });
export type CreatePartnerFormValues = z.infer<typeof createPartnerFormSchema>;

export const DEFAULT_DEAL: PartnerDealFormValues = {
  displayName: "",
  referralCode: "",
  referralLanding: "REGISTER",
  creditFrom: todayIso(),
  commissionRate: "30",
  commissionMonths: "3",
  customerDiscountPercent: "10",
  notes: "",
};

/** The deal as the API takes it. A sales page carries no code and no discount. */
export function toDealPayload(values: PartnerDealFormValues) {
  const salesPage = isSalesPageLanding(values.referralLanding);
  return {
    displayName: values.displayName.trim(),
    referralCode:
      !salesPage && values.referralCode.trim() ? values.referralCode.trim().toUpperCase() : null,
    referralLanding: (salesPage ? "REGISTER" : values.referralLanding) as "REGISTER" | "HOME",
    commissionRate: Number(values.commissionRate),
    commissionMonths: Number(values.commissionMonths),
    customerDiscountPercent: salesPage ? 0 : Number(values.customerDiscountPercent),
    notes: values.notes.trim() || null,
  };
}

/** POST /api/admin/partners body. */
export function toCreatePayload(values: CreatePartnerFormValues) {
  const salesPage = isSalesPageLanding(values.referralLanding);
  return {
    ...toDealPayload(values),
    ...(values.who === "user"
      ? { userId: values.userId }
      : { inviteEmail: values.inviteEmail.trim().toLowerCase() }),
    salesPage: salesPage
      ? { page: values.referralLanding, creditFrom: `${values.creditFrom}T00:00:00Z` }
      : null,
  };
}

/** A code from a name, filled in while the admin hasn't typed one: "Bob Martin" → "BOBMARTIN". */
export function suggestReferralCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

/** The error message an admin API answered with, whichever shape it used. */
export async function apiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: string | { message?: string };
    message?: string;
  } | null;
  if (!body) return `Request failed (${res.status})`;
  if (typeof body.error === "string") return body.error;
  return body.error?.message ?? body.message ?? `Request failed (${res.status})`;
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as T;
}
