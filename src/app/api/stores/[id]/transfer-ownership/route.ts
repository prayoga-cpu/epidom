/**
 * GET    /api/stores/[id]/transfer-ownership — the pending invite, if any
 * POST   /api/stores/[id]/transfer-ownership — invite a new owner by email
 * DELETE /api/stores/[id]/transfer-ownership — cancel the pending invite
 *
 * Owner-only. Acceptance lives under /api/transfer-ownership/* — a different
 * route tree on purpose: the recipient may not have an account yet, let alone
 * own this store, so it can't go through requireStoreAuth.
 */
import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { initiateStoreTransferSchema } from "@/lib/validation/store-transfer.schemas";
import {
  cancelPendingTransfer,
  getPendingTransfer,
  startStoreTransfer,
} from "@/lib/services/store-transfer.service";
import { requireOwnerOnlyApi } from "@/lib/auth/require-owner-only";

export const dynamic = "force-dynamic";

// Two layers keep everyone but the real owner out of these routes, and
// neither is optional. (1) Linked staff ACCOUNTS: withApiHandler's
// staff-principal policy is default-deny and these routes are deliberately
// absent from it. (2) A staff PIN persona (Manager included) layered onto the
// owner's own signed-in device: requireOwnerOnlyApi. Handing a store to
// someone else is about as consequential as this app gets.
const OPTIONS = { rateLimitEndpoint: "/api/stores/[id]/transfer-ownership", requireStoreAuth: true };

export const GET = withApiHandler(async (_req, { storeId }) => {
  const blocked = await requireOwnerOnlyApi(storeId!);
  if (blocked) return blocked;
  return NextResponse.json(createSuccessResponse({ pending: await getPendingTransfer(storeId!) }));
}, OPTIONS);

export const POST = withApiHandler(async (request, { storeId, session }) => {
  const blocked = await requireOwnerOnlyApi(storeId!);
  if (blocked) return blocked;

  const parsed = initiateStoreTransferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
      { status: 400 }
    );
  }

  const result = await startStoreTransfer({
    storeId: storeId!,
    toEmail: parsed.data.toEmail,
    fromUser: {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
    },
  });
  return NextResponse.json(createSuccessResponse({ sent: true, toEmail: result.toEmail }));
}, OPTIONS);

export const DELETE = withApiHandler(async (_req, { storeId }) => {
  const blocked = await requireOwnerOnlyApi(storeId!);
  if (blocked) return blocked;
  await cancelPendingTransfer(storeId!);
  return NextResponse.json(createSuccessResponse({ canceled: true }));
}, OPTIONS);
