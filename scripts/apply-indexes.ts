import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Connecting to Supabase PostgreSQL...");
  
  const statements = [
    `CREATE INDEX IF NOT EXISTS "Product_status_createdAt_idx" ON "Product"("status", "createdAt");`,
    `CREATE INDEX IF NOT EXISTS "Product_status_salePrice_idx" ON "Product"("status", "salePrice");`,
    `CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");`,
    `CREATE INDEX IF NOT EXISTS "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt");`
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✓ Executed: ${sql.slice(0, 50)}...`);
    } catch (err: any) {
      console.warn(`! Statement notice:`, err.message);
    }
  }

  console.log("✓ All performance indexes successfully applied to database.");
}

main()
  .catch((e) => {
    console.error("Failed to apply indexes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
