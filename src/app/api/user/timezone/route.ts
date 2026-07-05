import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api";

/**
 * Body schema for the timezone update.
 * Shape-only here — IANA validity is checked separately via Intl below,
 * so we can return a precise INVALID_INPUT error for an unknown zone.
 */
const timezoneBodySchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
});

/**
 * A timezone is a valid IANA zone if the Intl API accepts it.
 * `new Intl.DateTimeFormat(undefined, { timeZone })` throws RangeError otherwise.
 */
function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * PATCH /api/user/timezone
 *
 * Update the current (signed-in) user's IANA timezone. This is auto-detected
 * from the browser and persisted so the admin panel's Region column reflects
 * the user's real location without manual setup.
 *
 * Only the timezone is touched — currency (a billing preference) is untouched.
 */
export const PATCH = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const { timezone } = timezoneBodySchema.parse(body);

    if (!isValidIanaTimeZone(timezone)) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid IANA timezone"),
        { status: 400 }
      );
    }

    // Avoid a redundant write when the stored value is already correct.
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    if (current?.timezone !== timezone) {
      await prisma.user.update({
        where: { id: userId },
        data: { timezone },
      });
    }

    return NextResponse.json(createSuccessResponse({ timezone }));
  },
  { rateLimitEndpoint: "/api/user/timezone", requireStoreAuth: false }
);
