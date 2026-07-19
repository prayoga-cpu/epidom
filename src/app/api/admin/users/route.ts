import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user || !isAdminUser(user.email, user.isAdmin)) return null;
  return user;
}

/**
 * GET /api/admin/users
 * List all users with subscription, business, store count, and login methods.
 */
export async function GET() {
  if (!(await requireAdmin())) {
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
      currency: true,
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
    return { ...u, accounts: undefined, providers, hasPassword };
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
]);

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (input.action === "set-plan") {
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
    return NextResponse.json({ subscription });
  }

  if (input.action === "set-period") {
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
    return NextResponse.json({ subscription });
  }

  if (input.action === "set-admin") {
    const user = await prisma.user.update({
      where: { id: input.userId },
      data: { isAdmin: input.isAdmin },
      select: { id: true, email: true, isAdmin: true },
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

    // Return the plaintext temp password — shown once to admin, never stored
    return NextResponse.json({ tempPassword: temp });
  }

  if (input.action === "delete-user") {
    await prisma.user.delete({ where: { id: input.userId } });
    return NextResponse.json({ deleted: true });
  }

  if (input.action === "reset-account") {
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
    return NextResponse.json({ reset: true });
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
}
