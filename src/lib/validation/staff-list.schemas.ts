import { z } from "zod";

/**
 * GET /api/stores/[id]/staff query. `include=pay` is the owner's Staff page
 * asking for the pay setup too; it is honored only for the owner as themselves
 * (canSeeStaffPay). Everyone else — PIN pickers, rosters, the offline cache —
 * gets the list without pay.
 */
export const staffListQuerySchema = z.object({
  include: z.enum(["pay"]).optional(),
});
