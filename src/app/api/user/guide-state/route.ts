import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { guideStatePatchSchema } from "@/lib/guide/contracts";
import {
  applyGuideStatePatch,
  getGuideState,
  GuideStoreAccessError,
} from "@/lib/services/guide.service";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";

export const dynamic = "force-dynamic";

/** Per-user preferences: never cached by the browser or anything in between. */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * GET /api/user/guide-state
 *
 * The signed-in user's in-app guide state (GuideState): when the welcome tour
 * was seen, which page intro cards and store checklists they dismissed. Takes no
 * input — the user comes from the session.
 */
export const GET = withApiHandler(
  async (_request, { userId }) => {
    const state = await getGuideState(userId);
    return NextResponse.json(createSuccessResponse(state), { headers: NO_STORE });
  },
  { rateLimitEndpoint: "/api/user/guide-state", requireStoreAuth: false }
);

/**
 * PATCH /api/user/guide-state
 *
 * One or more changes (guideStatePatchSchema); returns the full new GuideState.
 * `dismissChecklist` must name a store the user owns or is linked to as staff
 * (403 otherwise); every other change only touches the caller's own row.
 */
export const PATCH = withApiHandler(
  async (request, { userId }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = guideStatePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid guide state change",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    try {
      const state = await applyGuideStatePatch(userId, parsed.data);
      return NextResponse.json(createSuccessResponse(state), { headers: NO_STORE });
    } catch (error) {
      if (error instanceof GuideStoreAccessError) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, error.message), {
          status: 403,
        });
      }
      throw error;
    }
  },
  { rateLimitEndpoint: "/api/user/guide-state", requireStoreAuth: false }
);
