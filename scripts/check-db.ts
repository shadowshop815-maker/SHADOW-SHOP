import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, status: true, price: true, salePrice: true, stock: true },
    orderBy: { createdAt: "desc" }
  });
  console.log(`TOTAL PRODUCTS IN DB: ${products.length}`);
  console.log(JSON.stringify(products, null, 2));

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  console.log("STORE SETTINGS:", JSON.stringify(storeSettings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
