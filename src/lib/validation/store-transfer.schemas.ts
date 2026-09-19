import { z } from "zod";

// Trims and lowercases BEFORE validating. common.schemas' emailSchema chains
// .email() ahead of .trim(), and Zod applies checks in chain order, so a
// pasted address with a trailing space would be rejected there — and the
// server compares this value case-insensitively against the recipient's
// signed-in email, so it must be stored normalized.
export const storeTransferEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Invalid email format");

// POST /api/stores/[id]/transfer-ownership — who the store is being handed to.
export const initiateStoreTransferSchema = z.object({
  toEmail: storeTransferEmailSchema,
});

export type InitiateStoreTransferInput = z.infer<typeof initiateStoreTransferSchema>;

// The transfer token is 32 random bytes, hex-encoded (see generateTransferToken
// in src/lib/store-transfer.ts). Shape-checking it up front means a malformed
// value never reaches the database lookup. It travels in a POST body, not a
// URL: the audit trail records pathnames and platform logs record full URLs.
export const transferTokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid transfer link"),
});
