import { prisma } from './src/lib/prisma';

async function run() {
  const stores = await prisma.store.findMany({ include: { staffMembers: true } });
  
  for (const store of stores) {
    if (store.staffMembers.length === 0) {
      console.log(`Store ${store.name} has no staff. Creating Owner staff...`);
      await prisma.staffMember.create({
        data: {
          storeId: store.id,
          name: "Owner",
          role: "OWNER",
          isActive: true,
        }
      });
      console.log(`Created Owner staff for ${store.name}`);
    }
  }
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
