import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const REAL_PRODUCTS = [
  {
    slug: "shadow-signature-oxford-shirt",
    name: "Men Slim Fit Sky Blue Oxford Casual Shirt",
    shortDescription: "100% fine spun Egyptian cotton with a classic button-down collar and mother-of-pearl buttons.",
    description: "Crafted from breathable 100% Egyptian Giza cotton, this signature sky blue shirt delivers an impeccable balance of comfort and sharp tailoring. Features a reinforced button-down collar, single chest pocket, barrel cuffs, and a curved hemline suited for both tucked and untucked styling.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-SHIRT-001",
    price: "2499",
    salePrice: "1199",
    costPrice: "420",
    stock: 24,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Sky Blue", "Classic White", "Navy Blue"],
    tags: ["Men Casual Shirt", "Oxford Cotton", "Slim Fit", "Office Wear"],
    weight: 260,
    shippingInfo: "Delivery in 2-4 business days. Standard & Express shipping available.",
    returnPolicy: "7-day doorstep return and exchange guarantee.",
    categoryName: "Men’s Clothing",
    categorySlug: "men-s-clothing",
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "men-vintage-mint-green-poplin-shirt",
    name: "Men Relaxed Fit Mint Green Poplin Casual Shirt",
    shortDescription: "Pre-washed lightweight cotton poplin with a relaxed drop-shoulder silhouette and resort collar.",
    description: "Step into effortless modern luxury with our Mint Green Poplin Shirt. Cut in a contemporary relaxed fit from lightweight, breathable combed cotton with custom tonal stitching and a relaxed camp collar. Pairs seamlessly with linen trousers or relaxed denim.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-SHIRT-002",
    price: "2299",
    salePrice: "999",
    costPrice: "380",
    stock: 20,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1620012253295-c15c429f66bf?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Mint Green", "Sage", "Olive"],
    tags: ["Mint Green", "Poplin Shirt", "Summer Wear", "Relaxed Fit"],
    weight: 240,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "Men’s Clothing",
    categorySlug: "men-s-clothing",
    images: [
      "https://images.unsplash.com/photo-1620012253295-c15c429f66bf?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "heavyweight-oversized-tee-vintage-black",
    name: "240 GSM Heavyweight Combed Cotton Oversized T-Shirt",
    shortDescription: "Substantial 240 GSM high-density cotton jersey with seamless side construction and thick ribbed collar.",
    description: "A masterclass in daily streetwear luxury. Engineered with ultra-dense 240 GSM 100% combed cotton that holds its boxy structure through every wash. Features drop shoulders, a 1-inch seamless ribbed neckband, and a clean matte finish with zero transparency.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-TEE-001",
    price: "1899",
    salePrice: "849",
    costPrice: "290",
    stock: 35,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Vintage Black", "Anthracite", "Clay"],
    tags: ["Heavyweight Tee", "Oversized Fit", "240 GSM", "Streetwear"],
    weight: 270,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "T-Shirts",
    categorySlug: "t-shirts",
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "minimalist-raw-white-heavyweight-tee",
    name: "Heavyweight Boxy Fit Crew Neck T-Shirt in Raw White",
    shortDescription: "Pre-shrunk 220 GSM pure cotton with a clean architectural drape and stay-flat ribbed neckline.",
    description: "The ultimate wardrobe foundation. Crafted from unbleached premium long-staple cotton with a substantial hand feel. Designed with precision proportions, reinforced double-needle stitching, and a clean silhouette that elevates any outfit.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-TEE-002",
    price: "1799",
    salePrice: "799",
    costPrice: "270",
    stock: 30,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Raw White", "Off-White", "Chalk"],
    tags: ["White T-Shirt", "Boxy Fit", "Heavyweight", "Basics"],
    weight: 250,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "T-Shirts",
    categorySlug: "t-shirts",
    images: [
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "men-textured-charcoal-grid-casual-shirt",
    name: "Men Tailored Full Sleeve Textured Charcoal Grid Shirt",
    shortDescription: "Subtle micro-grid texture woven from two-ply melange yarn for rich depth and crease resistance.",
    description: "An essential for smart evenings and workdays. This charcoal grid shirt uses specialized double-twisted yarn to deliver subtle tactile texture, natural stretch, and all-day wrinkle recovery. Cut in our modern tailored silhouette with adjustable cuffs.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-SHIRT-003",
    price: "2399",
    salePrice: "1099",
    costPrice: "400",
    stock: 18,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Charcoal Grid", "Slate Grey"],
    tags: ["Charcoal Shirt", "Tailored Fit", "Smart Casual", "Full Sleeve"],
    weight: 260,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "Men’s Clothing",
    categorySlug: "men-s-clothing",
    images: [
      "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1602810316498-ab67cf68c8e1?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "autumn-rust-checkered-flannel-overshirt",
    name: "Men Heavy Flannel Rust Checkered Button Down Overshirt",
    shortDescription: "Brushed twill flannel in warm amber and navy plaid with twin flap pockets and horn-style buttons.",
    description: "Built for layered versatility in cooler weather. Crafted from brushed double-face cotton flannel that feels exceptionally soft against the skin while offering substantial warmth. Designed with twin buttoned chest pockets and sturdy reinforced seams.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-SHIRT-004",
    price: "2699",
    salePrice: "1249",
    costPrice: "450",
    stock: 16,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Rust Check", "Navy Rust Plaid"],
    tags: ["Flannel Overshirt", "Rust Check", "Winter Layering", "Heavy Cotton"],
    weight: 340,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "Jackets & Overshirts",
    categorySlug: "jackets-overshirts",
    images: [
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "deep-indigo-classic-denim-trucker-jacket",
    name: "Men 13.5 Oz Indigo Raw Denim Trucker Jacket",
    shortDescription: "Rugged 100% rigid cotton denim with brass shank hardware and signature welt pockets.",
    description: "A timeless wardrobe cornerstone. Cut from authentic 13.5 oz heavy ring-spun indigo denim that develops unique personal fading with wear. Finished with antique brass hardware, waist cinch adjusters, and deep interior drop pockets.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-JKT-001",
    price: "3499",
    salePrice: "1699",
    costPrice: "650",
    stock: 15,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Deep Indigo", "Washed Blue"],
    tags: ["Denim Jacket", "Trucker Jacket", "Indigo Denim", "Outerwear"],
    weight: 580,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "Jackets & Overshirts",
    categorySlug: "jackets-overshirts",
    images: [
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1000&q=80"
    ]
  },
  {
    slug: "loopback-french-terry-oversized-hoodie-charcoal",
    name: "400 GSM Heavyweight French Terry Hoodie in Washed Charcoal",
    shortDescription: "Dense loopback cotton fleece with double-layer crossover hood and hidden kangaroo pocket.",
    description: "Uncompromising comfort meets high-end street aesthetics. Made from custom-milled 400 GSM French Terry with a dense diagonal loop interior. Features a double-lined structured hood with no drawstrings, heavy 2x2 ribbed cuffs, and a seamless relaxed body.",
    brand: "SHADOW ARCHIVE",
    sku: "SS-HD-001",
    price: "3299",
    salePrice: "1499",
    costPrice: "580",
    stock: 22,
    lowStockThreshold: 5,
    status: "ACTIVE",
    featured: true,
    thumbnail: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Washed Charcoal", "Jet Black", "Sand Khaki"],
    tags: ["Heavyweight Hoodie", "French Terry", "400 GSM", "Streetwear"],
    weight: 620,
    shippingInfo: "Delivery in 2-4 business days.",
    returnPolicy: "7-day return guarantee.",
    categoryName: "Hoodies & Sweats",
    categorySlug: "hoodies-sweats",
    images: [
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80",
      "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1000&q=80"
    ]
  }
];

async function seedRealCatalog() {
  console.log("Seeding real luxury fashion catalog to database...");

  // 0. Clean up legacy demo items & vector placeholders
  console.log("Cleaning up legacy demo items...");
  const oldDemoSlugs = [
    "premium-navy-blue-cotton-shirt",
    "men-mint-green-casual-shirt",
    "men-grey-checkered-cotton-shirt",
    "men-rust-checkered-casual-shirt"
  ];
  try {
    await prisma.product.deleteMany({
      where: {
        OR: [
          { slug: { in: oldDemoSlugs } },
          { brand: "THE BEAR HOUSE" },
          { thumbnail: { contains: ".svg" } },
          { thumbnail: { contains: "1791542599420-508515da-74a5-4c0a-8afb-6e6fb1d1f993" } }
        ]
      }
    });
    console.log("✓ Cleared old demo items and vector silhouettes from DB.");
  } catch (err) {
    console.warn("Archiving legacy demo products...");
    await prisma.product.updateMany({
      where: {
        OR: [
          { slug: { in: oldDemoSlugs } },
          { brand: "THE BEAR HOUSE" },
          { thumbnail: { contains: ".svg" } },
          { thumbnail: { contains: "1791542599420-508515da-74a5-4c0a-8afb-6e6fb1d1f993" } }
        ]
      },
      data: { status: "ARCHIVED" }
    });
  }

  // Also update branding with real studio campaign banners
  try {
    await prisma.brandingSettings.upsert({
      where: { id: 1 },
      update: {
        storeName: "SHADOW SHOP",
        tagline: "Own the shadow. Define the style.",
        heroHeading: "Style that follows no one",
        heroSubheading: "Curated heavyweight streetwear and fine tailored shirts crafted for the bold.",
        heroImage: JSON.stringify([
          { id: "hero-1", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85", link: "/products" },
          { id: "hero-2", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=85", link: "/products" }
        ]),
        promotionalBanner: JSON.stringify([
          { id: "promo-1", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80", link: "/products", title: "Autumn / Winter Heavyweight Essentials" },
          { id: "promo-2", image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=80", link: "/products", title: "100% Egyptian Giza & Heavyweight Cotton" }
        ]),
      },
      create: {
        id: 1,
        storeName: "SHADOW SHOP",
        tagline: "Own the shadow. Define the style.",
        heroHeading: "Style that follows no one",
        heroSubheading: "Curated heavyweight streetwear and fine tailored shirts crafted for the bold.",
        heroImage: JSON.stringify([
          { id: "hero-1", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85", link: "/products" },
          { id: "hero-2", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=85", link: "/products" }
        ]),
        promotionalBanner: JSON.stringify([
          { id: "promo-1", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80", link: "/products", title: "Autumn / Winter Heavyweight Essentials" },
          { id: "promo-2", image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=80", link: "/products", title: "100% Egyptian Giza & Heavyweight Cotton" }
        ]),
      }
    });
    console.log("✓ Updated branding settings with high-fashion editorial campaign banners.");
  } catch (err) {
    console.warn("Could not update branding settings in DB:", err);
  }

  // 1. Ensure categories exist
  const categoryCache = new Map<string, any>();
  for (const item of REAL_PRODUCTS) {
    if (!categoryCache.has(item.categorySlug)) {
      const cat = await prisma.category.upsert({
        where: { slug: item.categorySlug },
        update: { name: item.categoryName },
        create: {
          name: item.categoryName,
          slug: item.categorySlug,
          description: `Curated ${item.categoryName} from SHADOW SHOP archive.`,
          active: true,
        },
      });
      categoryCache.set(item.categorySlug, cat);
    }
  }

  // 2. Upsert each real product into database
  const createdProducts: any[] = [];
  for (const p of REAL_PRODUCTS) {
    const category = categoryCache.get(p.categorySlug);

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        brand: p.brand,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        status: p.status,
        featured: p.featured,
        thumbnail: p.thumbnail,
        sizes: JSON.stringify(p.sizes),
        colors: JSON.stringify(p.colors),
        tags: JSON.stringify(p.tags),
        weight: p.weight,
        shippingInfo: p.shippingInfo,
        returnPolicy: p.returnPolicy,
        isReturnable: true,
        returnWindowMins: 10080,
        taxMode: "INCLUSIVE",
        categories: {
          set: [],
          connect: [{ id: category.id }],
        },
      },
      create: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        brand: p.brand,
        sku: p.sku,
        price: p.price,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        status: p.status,
        featured: p.featured,
        thumbnail: p.thumbnail,
        sizes: JSON.stringify(p.sizes),
        colors: JSON.stringify(p.colors),
        tags: JSON.stringify(p.tags),
        weight: p.weight,
        shippingInfo: p.shippingInfo,
        returnPolicy: p.returnPolicy,
        isReturnable: true,
        returnWindowMins: 10080,
        taxMode: "INCLUSIVE",
        categories: {
          connect: [{ id: category.id }],
        },
      },
      include: {
        categories: true,
        images: true,
      },
    });

    // Replace product images
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (p.images && p.images.length > 0) {
      await prisma.productImage.createMany({
        data: p.images.map((url, position) => ({
          productId: product.id,
          url,
          position,
          alt: `${p.name} - View ${position + 1}`,
        })),
      });
    }

    const refreshed = await prisma.product.findUnique({
      where: { id: product.id },
      include: { categories: true, images: { orderBy: { position: "asc" } } },
    });
    createdProducts.push(refreshed);
    console.log(`✓ Upserted: ${p.name}`);
  }

  // 3. Update apps/customer/public/catalog-snapshot.json with real products
  const publicDir = path.join(process.cwd(), "apps/customer/public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const snapshotData = {
    success: true,
    data: {
      items: createdProducts,
      pagination: {
        page: 1,
        limit: createdProducts.length,
        total: createdProducts.length,
        pages: 1,
      },
    },
  };

  fs.writeFileSync(
    path.join(publicDir, "catalog-snapshot.json"),
    JSON.stringify(snapshotData, null, 2)
  );
  console.log(`\n✅ Successfully generated apps/customer/public/catalog-snapshot.json with ${createdProducts.length} real products!`);

  // Also clean up any old demo SVG files from public/catalog-snapshot if needed
  console.log("All real products have high-resolution studio photography and zero demo vectors!");
}

seedRealCatalog()
  .catch((e) => {
    console.error("Error seeding real catalog:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
