const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const offers = await prisma.offer.findMany();
  console.log("All offers:", JSON.stringify(offers, null, 2));
}
run();
