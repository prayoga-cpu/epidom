import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { subscriptionService } from "@/lib/services";

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

  // 1. Upsert user with emailVerified: true
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME, emailVerified: true, updatedAt: now },
    create: { email: DEMO_EMAIL, name: DEMO_NAME, emailVerified: true, createdAt: now, updatedAt: now },
  });

  // 2. Upsert credential account with correct scrypt hash
  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword, updatedAt: now },
    });
  } else {
    await prisma.account.create({
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
  const business = await prisma.business.upsert({
    where: { userId: user.id },
    update: { name: DEMO_STORE_NAME, updatedAt: now },
    create: { userId: user.id, name: DEMO_STORE_NAME, createdAt: now, updatedAt: now },
  });

  // 4. Ensure at least one Store exists
  let store = await prisma.store.findFirst({
    where: { businessId: business.id },
    select: { id: true },
  });
  if (!store) {
    store = await prisma.store.create({
      data: { businessId: business.id, name: DEMO_STORE_NAME },
      select: { id: true },
    });
  }

  // 5. Provision free OPERATIONS subscription
  await subscriptionService.activateFree(user.id);

  return NextResponse.json({
    ok: true,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    userId: user.id,
    businessId: business.id,
    storeId: store.id,
  });
}
