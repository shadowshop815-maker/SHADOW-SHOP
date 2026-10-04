import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.store.findMany().then(s => {
  console.log(JSON.stringify(s, null, 2));
  p.$disconnect();
});
