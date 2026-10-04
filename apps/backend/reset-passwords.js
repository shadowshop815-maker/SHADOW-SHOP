const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.updateMany({
    where: { email: { in: ['admin@shadowshop.local', 'sarkarsoumyajit055@gmail.com'] } },
    data: { passwordHash: hash }
  });
  console.log('Passwords reset successfully to Admin@123');
}

run().catch(console.error).finally(() => prisma.$disconnect());
