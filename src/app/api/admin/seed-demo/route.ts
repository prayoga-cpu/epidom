import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { subscriptionService } from "@/lib/services";
import { SubscriptionPlan } from "@prisma/client";

const DEMO_EMAIL = "demo@epidom.fr";
const DEMO_PASSWORD = "password123";
const DEMO_NAME = "Demo User";
const DEMO_STORE_NAME = "Demo Store";

export async function POST(req: Request) {
  const secret = process.env.SEED_DEMO_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SEED_DEMO_SECRET not configured" }, { status: 500 });
  }

  const headerSecret = req.headers.get("x-seed-secret");
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hashedPassword = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  // The account/store steps below are "find, then create if missing" —
  // not atomic on their own, so two overlapping calls to this route (e.g.
  // a double-invoked request) can each find nothing and both create a row,
  // producing duplicate credential Accounts / Stores. An advisory lock
  // scoped to this route serializes the whole seed against itself without
  // needing a schema change (Store, in particular, can't get a blanket
  // unique constraint — multi-store businesses are a real, supported case).
  const { user, business, store } = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('epidom-seed-demo'))`;

      // 1. Upsert user with emailVerified: true
      const user = await tx.user.upsert({
        where: { email: DEMO_EMAIL },
        update: { name: DEMO_NAME, emailVerified: true, updatedAt: now },
        create: {
          email: DEMO_EMAIL,
          name: DEMO_NAME,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      });

      // 2. Upsert credential account with correct scrypt hash
      const existingAccount = await tx.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
      });
      if (existingAccount) {
        await tx.account.update({
          where: { id: existingAccount.id },
          data: { password: hashedPassword, updatedAt: now },
        });
      } else {
        await tx.account.create({
          data: {
            accountId: user.id,
            providerId: "credential",
            userId: user.id,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      // 3. Upsert Business
      const business = await tx.business.upsert({
        where: { userId: user.id },
        update: { name: DEMO_STORE_NAME, updatedAt: now },
        create: { userId: user.id, name: DEMO_STORE_NAME, createdAt: now, updatedAt: now },
      });

      // 4. Ensure at least one Store exists
      let store = await tx.store.findFirst({
        where: { businessId: business.id },
        select: { id: true },
      });
      if (!store) {
        store = await tx.store.create({
          data: { businessId: business.id, name: DEMO_STORE_NAME },
          select: { id: true },
        });

        // Also create a default staff member for demo
        const { hash } = await import("bcryptjs");
        const pinHash = await hash("1234", 10);
        await tx.staffMember.create({
          data: {
            storeId: store.id,
            name: DEMO_NAME,
            email: DEMO_EMAIL,
            role: "OWNER",
            pin: pinHash,
            isActive: true,
            inviteStatus: "accepted",
          },
        });
      }

      return { user, business, store };
    },
    { timeout: 15000 }
  );

  // 5. Provision free OPERATIONS subscription
  await subscriptionService.activateFree(user.id, SubscriptionPlan.OPERATIONS);

  return NextResponse.json({
    ok: true,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    userId: user.id,
    businessId: business.id,
    storeId: store.id,
  });
}
