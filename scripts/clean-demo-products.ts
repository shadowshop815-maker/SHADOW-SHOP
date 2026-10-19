import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SKUS = [
  "SS-HD-001",
  "SS-JKT-001",
  "SS-SHIRT-004",
  "SS-SHIRT-003",
  "SS-TEE-002",
  "SS-TEE-001",
  "SS-SHIRT-002",
  "SS-SHIRT-001"
];

const DEMO_SLUGS = [
  "loopback-french-terry-oversized-hoodie-charcoal",
  "deep-indigo-classic-denim-trucker-jacket",
  "autumn-rust-checkered-flannel-overshirt",
  "men-textured-charcoal-grid-casual-shirt",
  "minimalist-raw-white-heavyweight-tee",
  "heavyweight-oversized-tee-vintage-black",
  "men-vintage-mint-green-poplin-shirt",
  "shadow-signature-oxford-shirt"
];

async function main() {
  console.log("Searching for demo products in database...");

  const demoProducts = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { in: DEMO_SKUS } },
        { slug: { in: DEMO_SLUGS } }
      ]
    }
  });

  console.log(`Found ${demoProducts.length} demo product(s) to remove:`);
  for (const p of demoProducts) {
    console.log(` - [${p.sku}] ${p.name} (${p.slug})`);
  }

  for (const p of demoProducts) {
    const ordersCount = await prisma.orderItem.count({ where: { productId: p.id } });
    if (ordersCount > 0) {
      console.log(`⚠️ Product ${p.sku} has ${ordersCount} order(s); archiving instead of deleting.`);
      await prisma.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId: p.id } });
      await tx.wishlistItem.deleteMany({ where: { productId: p.id } });
      await tx.offerProductRule.deleteMany({ where: { productId: p.id } });
      await tx.inventoryMovement.deleteMany({ where: { productId: p.id } });

      const reviews = await tx.productReview.findMany({ where: { productId: p.id }, select: { id: true } });
      for (const r of reviews) {
        await tx.reviewReply.deleteMany({ where: { reviewId: r.id } });
        await tx.reviewVote.deleteMany({ where: { reviewId: r.id } });
        await tx.reviewImage.deleteMany({ where: { reviewId: r.id } });
        await tx.reviewModerationAudit.deleteMany({ where: { reviewId: r.id } });
      }
      await tx.productReview.deleteMany({ where: { productId: p.id } });
      await tx.productImage.deleteMany({ where: { productId: p.id } });
      await tx.productVariant.deleteMany({ where: { productId: p.id } });
      await tx.product.delete({ where: { id: p.id } });
    });
    console.log(`✓ Permanently deleted demo product: ${p.sku} (${p.name})`);
  }

  console.log("\nRemaining real products in catalog:");
  const remaining = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, status: true, stock: true }
  });
  console.table(remaining);
  console.log("Demo cleanup complete!");
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
