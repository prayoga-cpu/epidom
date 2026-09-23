import { z } from "zod";

/**
 * The claim token from an emailed staff sign-in invite. The exact shape is
 * checked loosely (length only) on purpose: anything that isn't a real token
 * simply won't match a row, and the caller gets the same "invalid link"
 * answer either way — this only stops absurd payloads reaching the database.
 */
export const staffInviteTokenSchema = z.object({
  token: z.string().min(20).max(200),
});

/**
 * Claiming an invite. `password` present = create a brand-new account for the
 * invited email; absent = link the account the caller is ALREADY signed in as.
 * (Better Auth's own minimum is 8 characters, so that is the floor here too —
 * the looser 6 in the login form only ever applied to signing IN.)
 */
export const staffInviteCompleteSchema = staffInviteTokenSchema.extend({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .optional(),
  name: z.string().trim().min(1).max(100).optional(),
});

export type StaffInviteCompleteInput = z.infer<typeof staffInviteCompleteSchema>;
