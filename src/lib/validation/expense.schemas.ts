import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

/**
 * Finance → Expenses ledger. Amounts are literal in the store's own currency
 * (Decimal(12,2)); the date is a calendar day, "YYYY-MM-DD".
 */

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Invalid date");

const amountSchema = z.coerce
  .number()
  .positive("Amount must be more than zero")
  .max(9_999_999_999.99, "Amount is too large")
  .transform((value) => Math.round(value * 100) / 100);

export const createExpenseSchema = z.object({
  date: dateKeySchema,
  category: z.nativeEnum(ExpenseCategory),
  description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || null),
  amount: amountSchema,
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
