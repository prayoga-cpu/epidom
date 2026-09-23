/**
 * POST /api/transfer-ownership/accept
 *
 * The recipient accepts a store handed to them. Requires a signed-in session
 * (withApiHandler, no requireStoreAuth — they don't own the store yet); the
 * service checks the session's VERIFIED email matches the address the invite
 * was sent to, then moves the store in one transaction. Token in the body, not
 * the URL — see the lookup route.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { transferTokenSchema } from "@/lib/validation/store-transfer.schemas";
import { acceptStoreTransfer } from "@/lib/services/store-transfer.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request, { session }) => {
    const parsed = transferTokenSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "This transfer link is invalid."),
        { status: 404 }
      );
    }

    const result = await acceptStoreTransfer({
      token: parsed.data.token,
      recipient: {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? null,
        emailVerified: Boolean(session.user.emailVerified),
      },
    });
    return NextResponse.json(createSuccessResponse(result));
  },
  { rateLimitEndpoint: "/api/transfer-ownership/accept" }
);
