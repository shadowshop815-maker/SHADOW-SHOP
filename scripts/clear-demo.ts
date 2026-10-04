import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing demo data...");
  
  // Delete all orders, carts, and inventory movements first
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cancellationRequest.deleteMany({});
  await prisma.returnRequest.deleteMany({});
  await prisma.refund.deleteMany({});
  
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.inventoryMovement.deleteMany({});
  
  // Delete catalog
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  
  // Delete customers (keep admins)
  await prisma.address.deleteMany({});
  await prisma.moderationAction.deleteMany({});
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" } });
  for (const customer of customers) {
    await prisma.customerProfile.deleteMany({ where: { userId: customer.id } });
    await prisma.user.delete({ where: { id: customer.id } });
  }
  
  // Delete content & communication
  await prisma.updatePost.deleteMany({});
  await prisma.mediaItem.deleteMany({});
  await prisma.enquiry.deleteMany({});
  
  console.log("Demo data cleared successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
