import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { userService, subscriptionService } from "@/lib/services";
import { getActingAdmin } from "@/lib/auth/require-admin-api";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { recordAction, beginAction, completeAction, failAction } from "@/lib/audit/record";
import { captureEntitySnapshot } from "@/lib/audit/snapshot";
import { notifyCriticalAction, notifyAccountAction } from "@/lib/audit/notify";

/**
 * GET /api/admin/users
 * List all users with subscription, business, store count, and login methods.
 */
export async function GET() {
  if (!(await getActingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    take: 500,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      timezone: true,
      timezoneUpdatedAt: true,
      deactivatedAt: true,
      purgeAt: true,
      accounts: {
        select: { providerId: true, password: true },
      },
      subscription: {
        select: {
          plan: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          stripeCustomerId: true,
          customPriceAmount: true,
          customPriceCurrency: true,
          customPriceInterval: true,
          customPricePlan: true,
          customPricePendingAt: true,
        },
      },
      business: {
        select: {
          id: true,
          name: true,
          _count: { select: { stores: true } },
        },
      },
    },
  });

  // Derive login methods without exposing password hashes
  const sanitized = users.map((u) => {
    const providers = u.accounts.map((a) => a.providerId);
    const hasPassword = u.accounts.some((a) => a.providerId === "credential" && !!a.password);
    return {
      ...u,
      accounts: undefined,
      providers,
      hasPassword,
      subscription: u.subscription
        ? {
            ...u.subscription,
            customPriceAmount:
              u.subscription.customPriceAmount != null
                ? Number(u.subscription.customPriceAmount)
                : null,
          }
        : null,
    };
  });

  return NextResponse.json({ users: sanitized });
}

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-plan"),
    userId: z.string(),
    plan: z.enum(["FREE", "POS", "OPERATIONS", "ENTERPRISE"]),
    status: z.enum(["ACTIVE", "CANCELED", "PAST_DUE", "INCOMPLETE"]),
  }),
  z.object({
    action: z.literal("set-period"),
    userId: z.string(),
    months: z.number().int().min(1).max(1200).optional(),
    lifetime: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("set-custom-price"),
    userId: z.string(),
    amount: z.number().nonnegative().finite().multipleOf(0.01),
    currency: z.string().length(3),
    interval: z.enum(["MONTHLY", "YEARLY"]),
    // FREE is excluded: a custom price is something the user is asked to pay,
    // and the free tier has nothing to charge for.
    plan: z.enum(["POS", "OPERATIONS", "ENTERPRISE"]),
  }),
  z.object({
    action: z.literal("clear-custom-price"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("set-admin"),
    userId: z.string(),
    isAdmin: z.boolean(),
  }),
  z.object({
    action: z.literal("reset-password"),
    userId: z.string(),
    newPassword: z.string().min(8).max(128),
  }),
  z.object({
    action: z.literal("temp-password"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("delete-user"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("reset-account"),
    userId: z.string(),
  }),
  z.object({
    action: z.literal("reactivate-user"),
    userId: z.string(),
  }),
]);

/**
 * PATCH /api/admin/users
 *
 * Every branch below is now audited. Each captures a before-image *before* the
 * write, so the action is revertible rather than merely visible — a log that
 * records "the plan changed" without recording what it changed from cannot
 * restore anything.
 *
 * The two cascade roots (delete-user, reset-account) additionally capture a
 * full entity-graph snapshot inside the same transaction as the destruction,
 * because Prisma never observes the 56 `onDelete: Cascade` edges Postgres
 * follows and there is nothing to reconstruct them from afterwards.
 */
export const PATCH = withAdminApiHandler(async (req, { admin }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (
    (input.action === "set-admin" ||
      input.action === "delete-user" ||
      input.action === "reset-account") &&
    input.userId === admin.id
  ) {
    return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
  }

  // Identity is read once up front: after a delete there is no row left to
  // name the account in the log, so the label has to be captured beforehand.
  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      emailVerified: true,
      deactivatedAt: true,
      purgeAt: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const who = { userId: target.id, userEmail: target.email, userName: target.name };

  if (input.action === "set-plan") {
    const before = await prisma.subscription.findUnique({
      where: { userId: input.userId },
      select: { plan: true, status: true },
    });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
    const subscription = await prisma.subscription.upsert({
      where: { userId: input.userId },
      update: { plan: input.plan, status: input.status },
      create: {
        userId: input.userId,
        stripeCustomerId: `admin_${input.userId}`,
        plan: input.plan,
        status: input.status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await recordAction({
      actionType: "admin.user.set_plan",
      targetId: input.userId,
      payload: { ...who, before, after: { plan: input.plan, status: input.status } },
    });

    return NextResponse.json({ subscription });
  }

  if (input.action === "set-period") {
    const before = await prisma.subscription.findUnique({
      where: { userId: input.userId },
      select: { status: true, currentPeriodStart: true, currentPeriodEnd: true },
    });

    const now = new Date();
    const LIFETIME = new Date(now.getTime() + 200 * 365 * 24 * 60 * 60 * 1000);
    const periodEnd = input.lifetime
      ? LIFETIME
      : new Date(now.getTime() + (input.months ?? 1) * 30 * 24 * 60 * 60 * 1000);
    const subscription = await prisma.subscription.upsert({
      where: { userId: input.userId },
      update: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd },
      create: {
        userId: input.userId,
        stripeCustomerId: `admin_${input.userId}`,
        plan: "OPERATIONS",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await recordAction({
      actionType: "admin.user.set_period",
      targetId: input.userId,
      payload: {
        ...who,
        before: before
          ? {
              status: before.status,
              currentPeriodStart: before.currentPeriodStart?.toISOString() ?? "",
              currentPeriodEnd: before.currentPeriodEnd?.toISOString() ?? "",
            }
          : null,
        after: {
          status: "ACTIVE" as const,
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
        },
        lifetime: input.lifetime,
        months: input.months,
      },
    });

    return NextResponse.json({ subscription });
  }

  if (input.action === "set-custom-price") {
    const before = await prisma.subscription.findUnique({
      where: { userId: input.userId },
      select: {
        customPriceAmount: true,
        customPriceCurrency: true,
        customPriceInterval: true,
        customPricePlan: true,
      },
    });

    try {
      const subscription = await subscriptionService.setCustomPrice(input.userId, {
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        interval: input.interval,
        plan: input.plan,
      });

      await recordAction({
        actionType: "admin.user.set_custom_price",
        targetId: input.userId,
        payload: {
          ...who,
          before: before
            ? {
                // Decimal -> string, never a JSON number: a Decimal(14,6)
                // would silently round through JSON.parse.
                amount: before.customPriceAmount?.toString() ?? null,
                currency: before.customPriceCurrency,
                interval: before.customPriceInterval,
                plan: before.customPricePlan,
              }
            : null,
          after: {
            amount: input.amount.toString(),
            currency: input.currency.toUpperCase(),
            interval: input.interval,
            plan: input.plan,
          },
          stripeSubscriptionCancelled: true,
        },
      });

      return NextResponse.json({ subscription });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to set custom price" },
        { status: 400 }
      );
    }
  }

  if (input.action === "clear-custom-price") {
    const before = await prisma.subscription.findUnique({
      where: { userId: input.userId },
      select: {
        customPriceAmount: true,
        customPriceCurrency: true,
        customPriceInterval: true,
        customPricePlan: true,
      },
    });

    try {
      const subscription = await subscriptionService.clearCustomPrice(input.userId);

      // Only recordable when there was a price to clear; otherwise the payload
      // has no before-image and the entry would claim a revertibility it lacks.
      if (before?.customPriceAmount && before.customPriceCurrency && before.customPricePlan) {
        await recordAction({
          actionType: "admin.user.clear_custom_price",
          targetId: input.userId,
          payload: {
            ...who,
            before: {
              amount: before.customPriceAmount.toString(),
              currency: before.customPriceCurrency,
              interval: before.customPriceInterval ?? "MONTHLY",
              plan: before.customPricePlan,
            },
          },
        });
      }

      return NextResponse.json({ subscription });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to clear custom price" },
        { status: 400 }
      );
    }
  }

  if (input.action === "set-admin") {
    const user = await prisma.user.update({
      where: { id: input.userId },
      data: { isAdmin: input.isAdmin },
      select: { id: true, email: true, isAdmin: true },
    });

    await recordAction({
      actionType: "admin.user.set_admin",
      targetId: input.userId,
      payload: { ...who, before: target.isAdmin, after: input.isAdmin },
    });

    return NextResponse.json({ user });
  }

  if (input.action === "reset-password") {
    const hashed = await hashPassword(input.newPassword);

    const existing = await prisma.account.findFirst({
      where: { userId: input.userId, providerId: "credential" },
    });

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { password: hashed },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: input.userId,
          providerId: "credential",
          userId: input.userId,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Ensure email is verified so better-auth's requireEmailVerification gate passes
    await prisma.user.update({
      where: { id: input.userId },
      data: { emailVerified: true },
    });

    // The old hash is deliberately NOT captured. Storing a reversible
    // credential in a table designed to outlive the account would be a worse
    // liability than the loss of reversibility; see the catalogue caveat.
    await recordAction({
      actionType: "admin.user.reset_password",
      targetId: input.userId,
      payload: {
        ...who,
        credentialExisted: Boolean(existing),
        emailVerifiedBefore: target.emailVerified,
      },
    });

    await notifyAccountAction(target, "reset-password");

    return NextResponse.json({ ok: true });
  }

  if (input.action === "temp-password") {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    const temp = Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const hashed = await hashPassword(temp);

    const existing = await prisma.account.findFirst({
      where: { userId: input.userId, providerId: "credential" },
    });

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { password: hashed },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: input.userId,
          providerId: "credential",
          userId: input.userId,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Ensure email is verified so better-auth's requireEmailVerification gate passes
    await prisma.user.update({
      where: { id: input.userId },
      data: { emailVerified: true },
    });

    await recordAction({
      actionType: "admin.user.temp_password",
      targetId: input.userId,
      payload: {
        ...who,
        credentialExisted: Boolean(existing),
        emailVerifiedBefore: target.emailVerified,
      },
    });

    await notifyAccountAction(target, "temp-password");

    // Return the plaintext temp password — shown once to admin, never stored
    return NextResponse.json({ tempPassword: temp });
  }

  if (input.action === "delete-user") {
    // Two-phase: the PENDING row commits before the delete, so a cascade that
    // crashes halfway still leaves evidence the attempt happened.
    const actionLogId = await beginAction({
      actionType: "admin.user.delete",
      targetId: input.userId,
      payload: { ...who, snapshotId: null, rowCount: 0 },
    });

    try {
      const snapshot = await captureEntitySnapshot({
        rootType: "User",
        rootId: input.userId,
        rootLabel: target.email,
        reasonCode: "admin.user.delete",
        subjectUserIds: [input.userId],
      });

      await prisma.user.delete({ where: { id: input.userId } });

      await completeAction(actionLogId, {
        snapshotId: snapshot?.id ?? null,
        payload: { ...who, snapshotId: snapshot?.id ?? null, rowCount: snapshot?.rowCount ?? 0 },
      });

      await notifyCriticalAction("admin.user.delete", target.email, admin.email);

      return NextResponse.json({ deleted: true, snapshotId: snapshot?.id ?? null });
    } catch (error) {
      await failAction(actionLogId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  if (input.action === "reset-account") {
    const actionLogId = await beginAction({
      actionType: "admin.user.reset_account",
      targetId: input.userId,
      payload: { ...who, snapshotId: null, rowCount: 0 },
    });

    try {
      const snapshot = await captureEntitySnapshot({
        rootType: "Business",
        rootId: input.userId,
        rootLabel: target.email,
        reasonCode: "admin.user.reset_account",
        subjectUserIds: [input.userId],
      });

      // Wipe business data (cascades stores → storefronts, menus, orders, inventory,
      // staff, shifts) and stale alerts, revoke every session so the user is signed
      // out on all devices, then clear the onboarding flag so they restart from the
      // onboarding wizard on next login. Login account, subscription/billing, and
      // feedback history are preserved.
      await prisma.$transaction([
        prisma.business.deleteMany({ where: { userId: input.userId } }),
        prisma.alert.deleteMany({ where: { userId: input.userId } }),
        prisma.session.deleteMany({ where: { userId: input.userId } }),
        prisma.user.update({ where: { id: input.userId }, data: { hasOnboarded: false } }),
      ]);

      await completeAction(actionLogId, {
        snapshotId: snapshot?.id ?? null,
        payload: { ...who, snapshotId: snapshot?.id ?? null, rowCount: snapshot?.rowCount ?? 0 },
      });

      await notifyCriticalAction("admin.user.reset_account", target.email, admin.email);

      return NextResponse.json({ reset: true, snapshotId: snapshot?.id ?? null });
    } catch (error) {
      await failAction(actionLogId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  if (input.action === "reactivate-user") {
    // No 30-day grace-period check — an admin reactivates any time within
    // the 1-year retention window, after a support-quoted recovery has been
    // arranged out-of-band.
    try {
      await userService.reactivateAccount(input.userId, { enforceGracePeriod: false });

      await recordAction({
        actionType: "admin.user.reactivate",
        targetId: input.userId,
        payload: {
          ...who,
          before: {
            deactivatedAt: target.deactivatedAt?.toISOString() ?? null,
            purgeAt: target.purgeAt?.toISOString() ?? null,
          },
        },
      });

      return NextResponse.json({ reactivated: true });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to reactivate account" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
});
