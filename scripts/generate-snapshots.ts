import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function generateSnapshots() {
  console.log("Generating static snapshots for Firebase Hosting...");

  const publicDir = path.join(process.cwd(), "apps/customer/public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    // 1. Generate Settings Snapshot
    console.log("Fetching settings...");
    let store = await prisma.storeSettings.findUnique({ where: { id: 1 } });
    let branding = await prisma.brandingSettings.findUnique({ where: { id: 1 } });
    let location = await prisma.locationSettings.findUnique({ where: { id: 1 } });

    if (store || branding || location) {
      const settingsData = { success: true, data: { store, branding, location } };
      fs.writeFileSync(
        path.join(publicDir, "settings-snapshot.json"),
        JSON.stringify(settingsData)
      );
      console.log("✅ settings-snapshot.json created.");
    }

    // 2. Generate Catalog Snapshot (Home Page Products)
    console.log("Fetching featured products...");
    const limit = 8;
    const where = { status: { in: ["ACTIVE", "OUT_OF_STOCK"] } };
    const orderBy = [{ featured: "desc" as const }, { createdAt: "desc" as const }];
    
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          categories: true,
          images: { orderBy: { position: "asc" } },
          taxProfile: true,
        },
        orderBy,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const catalogData = {
      success: true,
      data: { items, pagination: { page: 1, limit, total, pages: Math.ceil(total / limit) } },
    };

    fs.writeFileSync(
      path.join(publicDir, "catalog-snapshot.json"),
      JSON.stringify(catalogData)
    );
    console.log("✅ catalog-snapshot.json created.");

  } catch (error) {
    console.error("❌ Error generating snapshots:", error);
  } finally {
    await prisma.$disconnect();
  }
}

generateSnapshots();
