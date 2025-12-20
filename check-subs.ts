import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSubscriptions() {
  const subs = await prisma.subscription.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  console.log(JSON.stringify(subs, null, 2));
}

checkSubscriptions()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
