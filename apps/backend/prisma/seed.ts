import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/db.js";

async function main() {
  // Catalog and dummy products removed to keep production clean.
  await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, email: "hello@shadowshop.example", phone: "+91 00000 00000", currency: "INR", shippingCharge: 99, freeShippingThreshold: 2500, returnWindowMinutes: 10080 } });
  await prisma.brandingSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, storeDescription: "Independent essentials for people who move differently." } });
  await prisma.locationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.securitySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.updatePost.upsert({ where: { slug: "welcome-to-the-new-shadow-shop" }, update: {}, create: { title: "Welcome to the new SHADOW SHOP", slug: "welcome-to-the-new-shadow-shop", description: "A sharper store, a smoother checkout, and the same uncompromising point of view.", category: "Store", status: "PUBLISHED", publishDate: new Date() } });
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase(); const adminPassword = process.env.ADMIN_PASSWORD; const adminName = process.env.ADMIN_NAME?.trim();
  if (!adminEmail || !adminPassword || !adminName || adminPassword.length < 8) throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and a strong ADMIN_PASSWORD before seeding.");
  await prisma.user.upsert({ where: { email: adminEmail }, update: { role: "ADMIN", passwordHash: bcrypt.hashSync(adminPassword, 12), name: adminName }, create: { email: adminEmail, role: "ADMIN", passwordHash: bcrypt.hashSync(adminPassword, 12), name: adminName, emailVerifiedAt: new Date() } });

  console.log(`Seed complete. Admin: ${adminEmail}`);
  
  // Fix Store coordinates
  await prisma.store.updateMany({
    data: {
      latitude: 22.5726,
      longitude: 88.3639
    }
  });
  console.log("Updated Store coordinates to Kolkata");
}

main().finally(() => prisma.$disconnect());
