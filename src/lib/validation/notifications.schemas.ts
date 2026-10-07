import { z } from "zod";

/**
 * GET /api/stores/[id]/notifications query. `scope=pos` is the POS status
 * bar's bell (arriving orders only, POS links, no Back Office reminders);
 * absent is the Back Office bell.
 */
export const notificationsQuerySchema = z.object({
  scope: z.enum(["pos"]).optional(),
});
