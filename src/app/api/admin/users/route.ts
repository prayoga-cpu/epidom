import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { z } from "zod";
import bcrypt from "bcryptjs";

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
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      accounts: {
        select: { providerId: true },
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
  const sanitized = await Promise.all(
    users.map(async (u) => {
      const accounts = await prisma.account.findMany({
        where: { userId: u.id },
        select: { providerId: true, password: true },
      });
      const providers = accounts.map((a) => a.providerId);
      const hasPassword = accounts.some(
        (a) => a.providerId === "credential" && !!a.password
      );
      return { ...u, accounts: undefined, providers, hasPassword };
    })
  );

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
]);

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const input = updateSchema.parse(body);

  if (
    (input.action === "set-admin" || input.action === "delete-user") &&
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
    const hashed = await bcrypt.hash(input.newPassword, 12);

    // Upsert the credential account — create if they only have OAuth
    const existing = await prisma.account.findFirst({
      where: { userId: input.userId, providerId: "credential" },
    });

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { password: hashed },
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
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

    return NextResponse.json({ ok: true });
  }

  if (input.action === "temp-password") {
    // Generate a readable 12-char temp password, e.g. "Kx7#mP2@nQ9w"
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    const temp = Array.from({ length: 12 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const hashed = await bcrypt.hash(temp, 12);

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

    // Return the plaintext temp password — shown once to admin, never stored
    return NextResponse.json({ tempPassword: temp });
  }

  if (input.action === "delete-user") {
    await prisma.user.delete({ where: { id: input.userId } });
    return NextResponse.json({ deleted: true });
  }
}
