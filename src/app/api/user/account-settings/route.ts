import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { parseUserAgent, geolocateIp } from "@/lib/utils/user-agent";
import { userService } from "@/lib/services";
import { sendAccountDeactivatedEmail } from "@/lib/services/email.service";

const REACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * GET /api/user/account-settings
 * Returns data usage stats + linked OAuth accounts
 */
export const GET = withApiHandler(
  async (_req, { userId, session }) => {
    const [user, accounts, storeStats, sessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, email: true, deactivatedAt: true, purgeAt: true },
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
      prisma.session.findMany({
        where: { userId },
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
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

    // Cap how many sessions get a live geolocation lookup — most users have
    // a handful of devices; this keeps the page from stalling behind dozens
    // of third-party calls if a stale session table ever grows large.
    const sessionsToLocate = sessions.slice(0, 10);
    const locations = await Promise.all(sessionsToLocate.map((s) => geolocateIp(s.ipAddress)));

    const deviceSessions = sessionsToLocate.map((s, i) => ({
      id: s.id,
      isCurrent: s.id === session.session.id,
      ...parseUserAgent(s.userAgent),
      ipAddress: s.ipAddress,
      location: locations[i],
      lastActive: s.updatedAt,
      createdAt: s.createdAt,
    }));

    return NextResponse.json(
      createSuccessResponse({
        createdAt: user?.createdAt,
        dataUsage: { totalStores, totalProducts, totalOrders, totalStaff },
        linkedAccounts,
        hasPasswordAccount,
        sessions: deviceSessions,
        deactivatedAt: user?.deactivatedAt ?? null,
        reactivationDeadline: user?.deactivatedAt
          ? new Date(user.deactivatedAt.getTime() + REACTIVATION_WINDOW_MS).toISOString()
          : null,
        retentionDeadline: user?.purgeAt ? user.purgeAt.toISOString() : null,
      })
    );
  },
  { rateLimitEndpoint: "/api/user/account-settings", requireStoreAuth: false, allowDeactivated: true }
);

/**
 * POST /api/user/account-settings
 * action: "change-password" | "delete-account"
 */
export const POST = withApiHandler(
  async (request, { userId, session }) => {
    const body = await request.json();
    const { action } = body;

    if (action === "revoke-session") {
      const { sessionId } = body;
      if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "sessionId is required"),
          { status: 400 }
        );
      }
      if (sessionId === session.session.id) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INVALID_INPUT,
            "Cannot sign out the device you're currently using — log out instead"
          ),
          { status: 400 }
        );
      }
      // Scope the delete to this user so one account can never revoke another's session.
      const { count } = await prisma.session.deleteMany({ where: { id: sessionId, userId } });
      if (count === 0) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.NOT_FOUND, "Session not found"),
          { status: 404 }
        );
      }
      return NextResponse.json(createSuccessResponse({ revoked: true }));
    }

    if (action === "revoke-other-sessions") {
      const { count } = await prisma.session.deleteMany({
        where: { userId, id: { not: session.session.id } },
      });
      return NextResponse.json(createSuccessResponse({ revokedCount: count }));
    }

    if (action === "change-password") {
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INVALID_INPUT,
            "New password must be at least 8 characters"
          ),
          { status: 400 }
        );
      }

      const account = await prisma.account.findFirst({
        where: { userId, providerId: "credential" },
        select: { id: true, password: true },
      });

      // No credential account yet (e.g. signed up via Google only) — this is
      // a first-time password *set*, not a change, so there's nothing to
      // verify currentPassword against.
      if (!account) {
        const newHash = await hashPassword(newPassword);
        const now = new Date();
        await prisma.account.create({
          data: {
            accountId: userId,
            providerId: "credential",
            userId,
            password: newHash,
            createdAt: now,
            updatedAt: now,
          },
        });
        return NextResponse.json(createSuccessResponse({ changed: true }));
      }

      if (currentPassword) {
        const valid = await verifyPassword({
          hash: account.password!,
          password: currentPassword,
        });
        if (!valid) {
          return NextResponse.json(
            createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Current password is incorrect"),
            { status: 401 }
          );
        }
      }

      const newHash = await hashPassword(newPassword);
      await prisma.account.update({
        where: { id: account.id },
        data: { password: newHash },
      });

      return NextResponse.json(createSuccessResponse({ changed: true }));
    }

    if (action === "deactivate-account") {
      const { confirmEmail } = body;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user || confirmEmail !== user.email) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.INVALID_INPUT, "Email confirmation does not match"),
          { status: 400 }
        );
      }

      const { deactivatedAt } = await userService.deactivateAccount(userId);
      const reactivationDeadline = new Date(deactivatedAt.getTime() + REACTIVATION_WINDOW_MS);
      await sendAccountDeactivatedEmail(user.email, user.name, reactivationDeadline);

      return NextResponse.json(createSuccessResponse({ deactivated: true }));
    }

    if (action === "reactivate-account") {
      try {
        await userService.reactivateAccount(userId);
        return NextResponse.json(createSuccessResponse({ reactivated: true }));
      } catch (err) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.FORBIDDEN,
            err instanceof Error ? err.message : "Failed to reactivate account"
          ),
          { status: 403 }
        );
      }
    }

    return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "Unknown action"), {
      status: 400,
    });
  },
  { rateLimitEndpoint: "/api/user/account-settings", requireStoreAuth: false, allowDeactivated: true }
);
