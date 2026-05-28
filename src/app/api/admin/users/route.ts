import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { z } from "zod";

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
 * List all users with subscription, business, store count.
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

  return NextResponse.json({ users });
}

const updateSchema = z.discriminatedUnion("action", [
  // Set plan + status
  z.object({
    action: z.literal("set-plan"),
    userId: z.string(),
    plan: z.enum(["FREE", "POS", "OPERATIONS", "ENTERPRISE"]),
    status: z.enum(["ACTIVE", "CANCELED", "PAST_DUE", "INCOMPLETE"]),
  }),
  // Set subscription period
  z.object({
    action: z.literal("set-period"),
    userId: z.string(),
    months: z.number().int().min(1).max(1200).optional(), // null = lifetime
    lifetime: z.boolean().optional(),
  }),
  // Grant / revoke admin
  z.object({
    action: z.literal("set-admin"),
    userId: z.string(),
    isAdmin: z.boolean(),
  }),
  // Delete account
  z.object({
    action: z.literal("delete-user"),
    userId: z.string(),
  }),
]);

/**
 * PATCH /api/admin/users
 * Perform admin actions on a user.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const input = updateSchema.parse(body);

  // Prevent self-demotion / self-deletion
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
    // lifetime = 200 years from now
    const LIFETIME = new Date(now.getTime() + 200 * 365 * 24 * 60 * 60 * 1000);
    const periodEnd = input.lifetime
      ? LIFETIME
      : new Date(now.getTime() + (input.months ?? 1) * 30 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.upsert({
      where: { userId: input.userId },
      update: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
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

  if (input.action === "delete-user") {
    await prisma.user.delete({ where: { id: input.userId } });
    return NextResponse.json({ deleted: true });
  }
}
