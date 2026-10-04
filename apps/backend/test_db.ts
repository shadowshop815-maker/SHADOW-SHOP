import { prisma } from './src/config/db.js';
async function main() {
  try {
    await prisma.$executeRaw`UPDATE DeliverySettings SET baseShippingFee = 1 WHERE id = 1`;
    console.log('success');
  } catch(e) {
    console.error(e);
  }
}
main();
