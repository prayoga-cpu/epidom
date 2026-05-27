import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { compare, hash } from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/account-settings
 * Returns data usage stats + linked OAuth accounts
 */
export const GET = withApiHandler(
  async (_req, { userId }) => {
    const [user, accounts, storeStats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, email: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { providerId: true, accountId: true, createdAt: true },
      }),
      prisma.store.findMany({
        where: { business: { userId } },
        select: {
          id: true,
          products: { select: { id: true } },
          orders: { select: { id: true } },
          staffMembers: { select: { id: true } },
        },
      }),
    ]);

    const totalStores = storeStats.length;
    const totalProducts = storeStats.reduce((sum, s) => sum + s.products.length, 0);
    const totalOrders = storeStats.reduce((sum, s) => sum + s.orders.length, 0);
    const totalStaff = storeStats.reduce((sum, s) => sum + s.staffMembers.length, 0);

    const linkedAccounts = accounts.map((a) => ({
      provider: a.providerId,
      accountId: a.accountId,
      connectedAt: a.createdAt,
    }));

    const hasPasswordAccount = accounts.some((a) => a.providerId === "credential");

    return NextResponse.json(
      createSuccessResponse({
        createdAt: user?.createdAt,
        dataUsage: { totalStores, totalProducts, totalOrders, totalStaff },
        linkedAccounts,
        hasPasswordAccount,
      })
    );
  },
  { rateLimitEndpoint: "/api/user/account-settings", requireStoreAuth: false }
);

/**
 * POST /api/user/account-settings
 * action: "change-password" | "delete-account"
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    const body = await request.json();
    const { action } = body;

    if (action === "change-password") {
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "New password must be at least 8 characters"),
          { status: 400 }
        );
      }

      const account = await prisma.account.findFirst({
        where: { userId, providerId: "credential" },
        select: { password: true },
      });

      if (!account?.password) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "No password set on this account. Use a social login."),
          { status: 400 }
        );
      }

      if (currentPassword) {
        const valid = await compare(currentPassword, account.password);
        if (!valid) {
          return NextResponse.json(
            createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Current password is incorrect"),
            { status: 401 }
          );
        }
      }

      const newHash = await hash(newPassword, 10);
      await prisma.account.updateMany({
        where: { userId, providerId: "credential" },
        data: { password: newHash },
      });

      return NextResponse.json(createSuccessResponse({ changed: true }));
    }

    if (action === "delete-account") {
      const { confirmEmail } = body;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

      if (confirmEmail !== user?.email) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "Email confirmation does not match"),
          { status: 400 }
        );
      }

      // Cascade deletes handle related data via Prisma schema
      await prisma.user.delete({ where: { id: userId } });

      return NextResponse.json(createSuccessResponse({ deleted: true }));
    }

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Unknown action"),
      { status: 400 }
    );
  },
  { rateLimitEndpoint: "/api/user/account-settings", requireStoreAuth: false }
);
