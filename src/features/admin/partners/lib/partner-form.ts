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

export const partnerDealFormSchema = z.object({
  displayName: z.string().trim().min(1, "Name shown on the banner is required").max(80),
  referralCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Za-z0-9_-]{3,32}$/.test(v), "3–32 letters, digits, - or _"),
  referralLanding: z.enum(["REGISTER", "HOME"]),
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

export const createPartnerFormSchema = partnerDealFormSchema.extend({
  email: z.string().trim().email("The partner's Epidom account email"),
});
export type CreatePartnerFormValues = z.infer<typeof createPartnerFormSchema>;

export const DEFAULT_DEAL: PartnerDealFormValues = {
  displayName: "",
  referralCode: "",
  referralLanding: "REGISTER",
  commissionRate: "30",
  commissionMonths: "3",
  customerDiscountPercent: "10",
  notes: "",
};

export function toDealPayload(values: PartnerDealFormValues) {
  return {
    displayName: values.displayName.trim(),
    referralCode: values.referralCode.trim() ? values.referralCode.trim().toUpperCase() : null,
    referralLanding: values.referralLanding,
    commissionRate: Number(values.commissionRate),
    commissionMonths: Number(values.commissionMonths),
    customerDiscountPercent: Number(values.customerDiscountPercent),
    notes: values.notes.trim() || null,
  };
}

/** A code from a name: "Bob Martin" → "BOBMARTIN" (the admin can change it). */
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
