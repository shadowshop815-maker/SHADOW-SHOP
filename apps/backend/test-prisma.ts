import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findFirst();
  if (p) {
    const ids = [p.id];
    console.log("Finding with ids:", ids);
    const result = await prisma.product.findMany({
      where: { id: { in: ids } }
    });
    console.log("Result length:", result.length);
  } else {
    console.log("No products found in DB");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
