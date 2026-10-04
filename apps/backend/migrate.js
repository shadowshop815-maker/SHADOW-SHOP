import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  if (fs.existsSync(dbPath)) {
    console.log('Deleting dev.db...');
    fs.unlinkSync(dbPath);
  }
  console.log('Running prisma db push...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('Migration completed successfully.');
} catch (e) {
  console.error(e);
  process.exit(1);
}
