const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const options = await prisma.deliveryOption.findMany();
  console.log('Options:', options);
  if (options.length === 0) {
    console.log('No options found, creating defaults...');
    await prisma.deliveryOption.create({
      data: {
        name: '3-Day Delivery',
        internalName: 'FAST_3_DAY',
        description: 'Get it within 3 business days',
        deliveryDays: 3,
        price: 99.00,
        status: 'ACTIVE',
        isDefault: false
      }
    });
    await prisma.deliveryOption.create({
      data: {
        name: '7-Day Delivery',
        internalName: 'STD_7_DAY',
        description: 'Get it within 7 business days',
        deliveryDays: 7,
        price: 0,
        freeDelivery: true,
        status: 'ACTIVE',
        isDefault: true
      }
    });
    console.log('Created default options');
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
