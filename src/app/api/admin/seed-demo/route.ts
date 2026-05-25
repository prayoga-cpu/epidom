import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";

const DEMO_EMAIL = "demo@epidom.com";
const DEMO_PASSWORD = "password123";
const DEMO_NAME = "Demo User";

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

  // Upsert user with emailVerified: true
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_NAME,
      emailVerified: true,
      updatedAt: now,
    },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Upsert credential account with correct scrypt hash
  const existing = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
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

  return NextResponse.json({
    ok: true,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    userId: user.id,
  });
}
