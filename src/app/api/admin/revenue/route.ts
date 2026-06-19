import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { STRIPE_CONFIG } from "@/config/stripe.config";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, isAdmin: true },
    });

    if (!user || !isAdminUser(user.email, user.isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use groupBy to prevent OOM
    const grouped = await prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: "ACTIVE" },
      _count: { plan: true },
    });

    let totalMonthlyRevenueEur = 0;
    let posCount = 0;
    let operationsCount = 0;

    for (const group of grouped) {
      if (group.plan === "POS") {
        posCount = group._count.plan;
        totalMonthlyRevenueEur += STRIPE_CONFIG.PLAN_LIMITS.POS.price * posCount;
      } else if (group.plan === "OPERATIONS") {
        operationsCount = group._count.plan;
        totalMonthlyRevenueEur += STRIPE_CONFIG.PLAN_LIMITS.OPERATIONS.price * operationsCount;
      }
    }

    // 60% Epidom, 40% Developer (Darwin)
    const epidomShare = totalMonthlyRevenueEur * 0.6;
    const developerShare = totalMonthlyRevenueEur * 0.4;

    return NextResponse.json({
      data: {
        totalMonthlyRevenueEur,
        epidomShare,
        developerShare,
        breakdown: {
          posCount,
          posPrice: STRIPE_CONFIG.PLAN_LIMITS.POS.price,
          operationsCount,
          operationsPrice: STRIPE_CONFIG.PLAN_LIMITS.OPERATIONS.price,
        }
      }
    });
  } catch (error: any) {
    console.error("Failed to fetch revenue:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
