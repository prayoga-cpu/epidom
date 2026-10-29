import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/types/api/responses";
import { listConnectedApps, revokeConnectedApp } from "@/lib/mcp/connections";
import { listConnectorStores } from "@/lib/mcp/stores";
import { mcpResourceUrl } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/connected-apps
 * The Claude connector card on Profile: the URL to paste into Claude, which
 * of the account's stores can be used from Claude, and the connections the
 * account has allowed.
 */
export const GET = withApiHandler(async (_request, { userId }) => {
  const [apps, stores] = await Promise.all([
    listConnectedApps(userId),
    listConnectorStores(userId),
  ]);
  return NextResponse.json(
    createSuccessResponse({
      connectorUrl: mcpResourceUrl(),
      stores: stores.map((store) => ({
        storeId: store.storeId,
        name: store.name,
        plan: store.plan,
        connectorEnabled: store.connectorEnabled,
      })),
      apps,
    })
  );
});

const revokeSchema = z.object({ clientId: z.string().min(1).max(200) });

/**
 * DELETE /api/user/connected-apps   body: { clientId }
 * Revoke one connection of the signed-in account.
 */
export const DELETE = withApiHandler(async (request, { userId }) => {
  const { clientId } = revokeSchema.parse(await request.json());
  const revoked = await revokeConnectedApp(userId, clientId);
  if (!revoked) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Connection not found"), {
      status: 404,
    });
  }
  return NextResponse.json(createSuccessResponse({ revoked: true }));
});
