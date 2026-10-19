import { z } from "zod";
import { SALES_PAGES } from "@/lib/sales-pages";

/** Same rule as normalizeRefCode (src/lib/attribution/cookies.ts): stored upper case. */
export const referralCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, digits, - or _"));

const percent = (max: number) => z.number().finite().min(0).max(max).multipleOf(0.01);

export const partnerDealSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  /** Null = no referral link (a sales-page owner). */
  referralCode: referralCodeSchema.nullable(),
  referralLanding: z.enum(["REGISTER", "HOME"]),
  commissionRate: percent(100),
  commissionMonths: z.number().int().min(1).max(120),
  /** Capped at 50: a 100% coupon would make a $0 "first paid" invoice. */
  customerDiscountPercent: percent(50),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const createPartnerSchema = partnerDealSchema
  .extend({
    /** An existing account picked from the users list… */
    userId: z.string().min(1).optional(),
    /** …or an email to invite (linked straight away when it already has an account). */
    inviteEmail: z.string().trim().toLowerCase().email().optional(),
    /** The link is a sales page they own, counted from `creditFrom`. */
    salesPage: z
      .object({
        page: z.enum(SALES_PAGES as unknown as [string, ...string[]]),
        creditFrom: z.coerce.date(),
      })
      .nullable()
      .optional(),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.inviteEmail), {
    message: "Pick a user, or enter an email to invite",
  });
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export const partnerInviteTokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export const updatePartnerSchema = partnerDealSchema.partial().extend({
  status: z.enum(["ACTIVE", "PAUSED", "ENDED"]).optional(),
});
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

const salesPageSchema = z.enum(SALES_PAGES as unknown as [string, ...string[]]);

export const setPartnerSalesPagesSchema = z.object({
  pages: z
    .array(
      z.object({
        page: salesPageSchema,
        /** Sign-ups since this date are credited (ISO date or datetime). */
        creditFrom: z.coerce.date(),
      })
    )
    .max(SALES_PAGES.length),
});
export type SetPartnerSalesPagesInput = z.infer<typeof setPartnerSalesPagesSchema>;

export const recordPayoutSchema = z.object({
  currency: z.string().trim().toLowerCase().length(3),
  reference: z.string().trim().max(200).nullable().optional(),
  paidAt: z.coerce.date(),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type RecordPayoutInput = z.infer<typeof recordPayoutSchema>;

export const voidCommissionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const updateMyPartnerSchema = z.object({
  referralLanding: z.enum(["REGISTER", "HOME"]),
});

export const addPartnerViewerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/** Where a partner is paid (they enter it on their page). Messages are i18n keys. */
export const partnerBankDetailsSchema = z.object({
  accountHolder: z.string().trim().min(2, "partnerPortal.bankErrHolder").max(100),
  bankName: z.string().trim().min(2, "partnerPortal.bankErrBank").max(100),
  /** An IBAN (FR76 3000 6000 …) or a local account number. */
  accountNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " ").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9 -]{3,41}$/, "partnerPortal.bankErrNumber")),
  swift: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(z.string().regex(/^([A-Z0-9]{8}|[A-Z0-9]{11})?$/, "partnerPortal.bankErrSwift")),
});
export type PartnerBankDetails = z.infer<typeof partnerBankDetailsSchema>;
