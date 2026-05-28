import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { z } from "zod";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session.user;
}

/**
 * GET /api/admin/users
 * List all users with their subscription and store counts.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          status: true,
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

const updateSchema = z.object({
  userId: z.string(),
  plan: z.enum(["FREE", "POS", "OPERATIONS", "ENTERPRISE"]),
  status: z.enum(["ACTIVE", "CANCELED", "PAST_DUE", "INCOMPLETE"]),
});

/**
 * PATCH /api/admin/users
 * Update a user's subscription plan/status directly.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, plan, status } = updateSchema.parse(body);

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: { plan, status },
    create: {
      userId,
      stripeCustomerId: `admin_${userId}`,
      plan,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  return NextResponse.json({ subscription });
}
