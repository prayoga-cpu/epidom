import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || "";
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}connection_limit=20&pool_timeout=30&connect_timeout=10&statement_timeout=25000&pgbouncer=true`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

async function main() {
  const storeId = "cmi4exhjs0006vi6cyf45rulf";

  console.log(`Checking suppliers for store: ${storeId}`);

  const suppliers = await prisma.supplier.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`Found ${suppliers.length} suppliers.`);
  suppliers.forEach((s) => {
    console.log(`- ${s.name} (ID: ${s.id}, Created: ${s.createdAt})`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
