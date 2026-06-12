
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const order = await prisma.order.findFirst({ orderBy: { createdAt: "desc" } });
  console.log(JSON.stringify(order, null, 2));
}
run();

