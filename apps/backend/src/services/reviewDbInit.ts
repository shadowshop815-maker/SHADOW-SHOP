import { prisma } from "../config/db.js";

/**
 * Execute a single DDL SQL command safely with graceful error isolation.
 */
async function exec(statement: string): Promise<void> {
  const trimmed = statement.trim();
  if (!trimmed) return;
  try {
    await prisma.$executeRawUnsafe(trimmed);
  } catch (err: any) {
    // If already exists or minor schema conflict, log and continue smoothly
    const msg = err?.message || String(err);
    if (!msg.includes("already exists")) {
      console.warn(`[Review DB Init] Notice for statement (${trimmed.slice(0, 50)}...):`, msg);
    }
  }
}

/**
 * Idempotent DB initialiser for Review & Rating system.
 * Executes safe, isolated DDL statements to guarantee that all tables, columns,
 * foreign keys, and indexes exist in PostgreSQL/Supabase on server startup.
 */
export async function initReviewDatabase(): Promise<void> {
  try {
    // 1. Add columns to Product if not present
    await exec(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "averageRating" DECIMAL(65,30) NOT NULL DEFAULT 0`);
    await exec(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0`);
    await exec(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0`);

    // 2. Create ProductReview table
    await exec(`
      CREATE TABLE IF NOT EXISTS "ProductReview" (
        "id" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "orderId" TEXT,
        "orderItemId" TEXT,
        "rating" INTEGER NOT NULL,
        "title" TEXT,
        "comment" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
        "isVerified" BOOLEAN NOT NULL DEFAULT false,
        "purchasedSize" TEXT,
        "purchasedColor" TEXT,
        "fit" TEXT,
        "fabricQuality" TEXT,
        "comfort" TEXT,
        "helpfulCount" INTEGER NOT NULL DEFAULT 0,
        "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
      )
    `);

    // 3. Create ReviewImage table
    await exec(`
      CREATE TABLE IF NOT EXISTS "ReviewImage" (
        "id" TEXT NOT NULL,
        "reviewId" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
      )
    `);

    // 4. Create ReviewVote table
    await exec(`
      CREATE TABLE IF NOT EXISTS "ReviewVote" (
        "id" TEXT NOT NULL,
        "reviewId" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "voteType" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
      )
    `);

    // 5. Create ReviewReply table
    await exec(`
      CREATE TABLE IF NOT EXISTS "ReviewReply" (
        "id" TEXT NOT NULL,
        "reviewId" TEXT NOT NULL,
        "adminId" TEXT NOT NULL,
        "replyText" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
      )
    `);

    // 6. Create ReviewModerationAudit table
    await exec(`
      CREATE TABLE IF NOT EXISTS "ReviewModerationAudit" (
        "id" TEXT NOT NULL,
        "reviewId" TEXT NOT NULL,
        "adminId" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewModerationAudit_pkey" PRIMARY KEY ("id")
      )
    `);

    // 7. Create Indexes individually
    const indexStatements = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "ProductReview_productId_customerId_key" ON "ProductReview"("productId", "customerId")`,
      `CREATE INDEX IF NOT EXISTS "ProductReview_productId_status_createdAt_idx" ON "ProductReview"("productId", "status", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "ProductReview_customerId_idx" ON "ProductReview"("customerId")`,
      `CREATE INDEX IF NOT EXISTS "ProductReview_status_idx" ON "ProductReview"("status")`,
      `CREATE INDEX IF NOT EXISTS "ProductReview_rating_idx" ON "ProductReview"("rating")`,
      `CREATE INDEX IF NOT EXISTS "Product_status_createdAt_idx" ON "Product"("status", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "Product_status_salePrice_idx" ON "Product"("status", "salePrice")`,
      `CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewImage_reviewId_sortOrder_idx" ON "ReviewImage"("reviewId", "sortOrder")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "ReviewVote_reviewId_customerId_key" ON "ReviewVote"("reviewId", "customerId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewVote_reviewId_idx" ON "ReviewVote"("reviewId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewVote_customerId_idx" ON "ReviewVote"("customerId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewReply_reviewId_idx" ON "ReviewReply"("reviewId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewModerationAudit_reviewId_idx" ON "ReviewModerationAudit"("reviewId")`,
      `CREATE INDEX IF NOT EXISTS "ReviewModerationAudit_adminId_idx" ON "ReviewModerationAudit"("adminId")`,
    ];

    for (const sql of indexStatements) {
      await exec(sql);
    }

    // 8. Add Foreign Keys safely (each wrapped in its own isolated DO block)
    const foreignKeys = [
      { name: "ProductReview_productId_fkey", table: "ProductReview", col: "productId", refTable: "Product", refCol: "id", onDel: "CASCADE" },
      { name: "ProductReview_customerId_fkey", table: "ProductReview", col: "customerId", refTable: "User", refCol: "id", onDel: "CASCADE" },
      { name: "ProductReview_orderId_fkey", table: "ProductReview", col: "orderId", refTable: "Order", refCol: "id", onDel: "SET NULL" },
      { name: "ReviewImage_reviewId_fkey", table: "ReviewImage", col: "reviewId", refTable: "ProductReview", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewVote_reviewId_fkey", table: "ReviewVote", col: "reviewId", refTable: "ProductReview", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewVote_customerId_fkey", table: "ReviewVote", col: "customerId", refTable: "User", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewReply_reviewId_fkey", table: "ReviewReply", col: "reviewId", refTable: "ProductReview", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewReply_adminId_fkey", table: "ReviewReply", col: "adminId", refTable: "User", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewModerationAudit_reviewId_fkey", table: "ReviewModerationAudit", col: "reviewId", refTable: "ProductReview", refCol: "id", onDel: "CASCADE" },
      { name: "ReviewModerationAudit_adminId_fkey", table: "ReviewModerationAudit", col: "adminId", refTable: "User", refCol: "id", onDel: "CASCADE" },
    ];

    for (const fk of foreignKeys) {
      await exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.name}') THEN
            ALTER TABLE "${fk.table}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.col}") REFERENCES "${fk.refTable}"("${fk.refCol}") ON DELETE ${fk.onDel} ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
    }

    console.log("✓ Review database schema initialized successfully.");
  } catch (error) {
    console.error("[Review DB Init Error]", error);
  }
}
