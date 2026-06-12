import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Stripe from 'stripe';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover', // use latest or project default
});

async function main() {
  const ownerEmail = process.env.EPIDOM_OWNER_EMAIL || "epidom@owner.com";
  console.log(`Starting Stripe setup for owner: ${ownerEmail}`);

  // 1. Get or create Epidom Owner user
  let user = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!user) {
    console.log(`User ${ownerEmail} not found in DB. Creating...`);
    user = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Epidom Owner",
        isAdmin: true,
        hasOnboarded: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  let accountId = user.stripeConnectAccountId;

  // 2. Create Express Account if missing
  if (!accountId) {
    console.log("Creating Stripe Express Connect Account...");
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR", // France (EU compliance)
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        url: "https://epidom.id",
        mcc: "8911", // Software
      },
      metadata: {
        userId: user.id,
        role: "epidom_owner",
      },
    });

    accountId = account.id;

    console.log(`Created Express Account: ${accountId}`);

    // Update User
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeConnectAccountId: accountId,
        // Optional: for development bypass, we could set onboarded to true,
        // but it's better to do actual onboarding or test mode bypass.
      },
    });
  } else {
    console.log(`User already has Express Account: ${accountId}`);
  }

  // 3. Generate Onboarding Link
  console.log("Generating Account Onboarding Link...");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/profile?connect=refresh`,
    return_url: `${appUrl}/profile?connect=success`,
    type: "account_onboarding",
  });

  console.log("\n========================================================");
  console.log("✅ STRIPE SETUP SUCCESS");
  console.log("========================================================");
  console.log("🔗 ACTION REQUIRED: Open this link to complete Stripe Onboarding:");
  console.log(accountLink.url);
  console.log("========================================================");
  console.log("If testing locally, click 'Skip form' in the test mode Stripe page.");
  console.log("After that, the checkout 80/20 split will work perfectly.");
}

main()
  .catch((e) => {
    console.error("Setup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
