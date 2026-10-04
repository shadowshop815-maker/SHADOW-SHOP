import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const passwords = ['postgres', 'root', 'admin', '1234', '123456', 'password', ''];

async function test() {
  console.log("Searching for your local PostgreSQL password...");
  
  for (const p of passwords) {
    // Try connecting to the default 'postgres' database
    const url = `postgresql://postgres:${p}@localhost:5432/postgres?schema=public`;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    
    try {
      await prisma.$connect();
      console.log(`\n✅ SUCCESS! Found your PostgreSQL password: "${p}"`);
      
      // Update .env files with the correct password for shadow_shop
      const envPath1 = './.env';
      const envPath2 = './apps/backend/.env';
      const newUrl = `postgresql://postgres:${p}@localhost:5432/shadow_shop?schema=public`;
      
      [envPath1, envPath2].forEach(path => {
        if (fs.existsSync(path)) {
          let content = fs.readFileSync(path, 'utf8');
          content = content.replace(/DATABASE_URL=.*/, `DATABASE_URL=${newUrl}`);
          fs.writeFileSync(path, content);
        }
      });
      
      console.log('✅ Updated .env files automatically!');
      console.log('\n👉 NOW RUN THESE COMMANDS:');
      console.log('   npm run db:migrate');
      console.log('   npm run db:seed');
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (e) {
      process.stdout.write('.');
    } finally {
      await prisma.$disconnect();
    }
  }
  console.log('\n❌ Could not find your password automatically.');
  console.log('Please reset your PostgreSQL password manually, or reinstall PostgreSQL.');
}

test();
