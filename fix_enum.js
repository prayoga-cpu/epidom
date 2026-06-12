const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // We use executeRawUnsafe to bypass Prisma's enum types
    const result = await prisma.$executeRawUnsafe(`UPDATE subscriptions SET plan = 'FREE'::"SubscriptionPlan"`);
    console.log('Updated rows:', result);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
