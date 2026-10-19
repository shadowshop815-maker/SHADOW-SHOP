import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "shadowshop815@gmail.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "SHADOWSHOP8587";
  const name = process.env.ADMIN_NAME || "Shadow Shop Administrator";

  console.log(`\n========================================`);
  console.log(`🔐 SHADOW SHOP - Setting Up Admin User`);
  console.log(`========================================`);
  console.log(`Target Email: ${email}`);
  console.log(`Target Name:  ${name}`);
  console.log(`Connecting to database...`);

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      passwordHash,
      name,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      role: "ADMIN",
      passwordHash,
      name,
      emailVerifiedAt: new Date(),
    },
  });

  // Ensure customerProfile exists and is ACTIVE if needed
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    update: { status: "ACTIVE", banExpires: null, banReason: null },
    create: { userId: user.id, status: "ACTIVE" },
  });

  console.log(`\n✅ SUCCESS! Admin account is ready.`);
  console.log(`👉 Email:    ${email}`);
  console.log(`👉 Password: ${password}`);
  console.log(`👉 Role:     ${user.role}`);
  console.log(`👉 User ID:  ${user.id}`);
  console.log(`========================================\n`);
}

main()
  .catch((e) => {
    console.error("❌ Failed to set admin account:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
