import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    include: {
      subscription: true,
      business: {
        include: {
          stores: true,
        },
      },
    },
  });

  console.log(JSON.stringify(users, null, 2));
}

checkUsers()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
