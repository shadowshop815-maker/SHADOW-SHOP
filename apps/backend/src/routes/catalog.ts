import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { asyncHandler, success } from "../utils/http.js";

export const catalogRouter = Router();

// In-memory catalog cache with TTL
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs: number) {
  // Bounded cache size to prevent memory leaks
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCatalogCache() {
  cache.clear();
}

catalogRouter.get("/categories", asyncHandler(async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
  
  const cacheKey = "categories:active";
  const cached = getCached<any[]>(cacheKey);
  if (cached) {
    return success(res, "Categories loaded.", cached);
  }

  const categories = await prisma.category.findMany({ 
    where: { active: true }, 
    orderBy: { name: "asc" } 
  });
  
  setCached(cacheKey, categories, 300_000); // 5 minutes
  return success(res, "Categories loaded.", categories);
}));

catalogRouter.get("/products", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); 
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
  const search = String(req.query.search || "").trim(); 
  const category = String(req.query.category || ""); 
  const availability = String(req.query.availability || ""); 
  const sort = String(req.query.sort || "default");
  const idsParam = String(req.query.ids || "").trim();
  const ids = idsParam ? idsParam.split(",").map(id => id.trim()).filter(Boolean) : null;

  const cacheKey = `products:${page}:${limit}:${search}:${category}:${availability}:${sort}:${idsParam}`;
  const cached = getCached<{ items: any[]; pagination: any }>(cacheKey);
  if (cached) {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    return success(res, "Products loaded.", cached);
  }

  const where: Prisma.ProductWhereInput = {
    status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
    ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { tags: { contains: search, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(category ? { categories: { some: { slug: category } } } : {}),
    ...(availability === "in-stock" ? { stock: { gt: 0 } } : availability === "out-of-stock" ? { stock: 0 } : {})
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = 
    sort === "price-asc" ? [{ salePrice: "asc" }, { price: "asc" }] :
    sort === "price-desc" ? [{ salePrice: "desc" }, { price: "desc" }] :
    sort === "name-asc" ? [{ name: "asc" }] :
    sort === "name-desc" ? [{ name: "desc" }] :
    sort === "newest" ? [{ createdAt: "desc" }] :
    [{ featured: "desc" }, { createdAt: "desc" }];

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ 
      where, 
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        brand: true,
        sku: true,
        price: true,
        salePrice: true,
        stock: true,
        status: true,
        featured: true,
        thumbnail: true,
        sizes: true,
        colors: true,
        tags: true,
        averageRating: true,
        ratingCount: true,
        reviewCount: true,
        isReturnable: true,
        returnWindowMins: true,
        createdAt: true,
        categories: { select: { id: true, name: true, slug: true } },
        images: { 
          orderBy: { position: "asc" },
          take: 2,
          select: { id: true, url: true, alt: true, color: true, position: true }
        }
      }, 
      orderBy, 
      skip: (page - 1) * limit, 
      take: limit 
    }), 
    prisma.product.count({ where })
  ]);

  const payload = { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  setCached(cacheKey, payload, 60_000); // 1 minute TTL

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return success(res, "Products loaded.", payload);
}));

catalogRouter.get("/products/:slug", asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "");
  const cacheKey = `product:${slug}`;
  const cached = getCached<{ product: any; related: any[] }>(cacheKey);
  if (cached) {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    return success(res, "Product loaded.", cached);
  }

  const product = await prisma.product.findFirst({ 
    where: { OR: [{ slug }, { id: slug }], status: { in: ["ACTIVE", "OUT_OF_STOCK"] } }, 
    include: { 
      categories: true, 
      images: { orderBy: { position: "asc" } }, 
      taxProfile: true 
    } 
  });

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found.", error: { code: "NOT_FOUND" } });
  }

  const categoryIds = product.categories.map((c: any) => c.id);
  const related = await prisma.product.findMany({ 
    where: { 
      categories: { some: { id: { in: categoryIds } } }, 
      id: { not: product.id }, 
      status: "ACTIVE" 
    }, 
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      brand: true,
      sku: true,
      price: true,
      salePrice: true,
      stock: true,
      status: true,
      featured: true,
      thumbnail: true,
      sizes: true,
      colors: true,
      averageRating: true,
      ratingCount: true,
      categories: { select: { id: true, name: true, slug: true } },
      images: { take: 2, orderBy: { position: "asc" } }
    },
    take: 4, 
    orderBy: { featured: "desc" } 
  });

  const payload = { product, related };
  setCached(cacheKey, payload, 60_000); // 1 minute TTL

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  return success(res, "Product loaded.", payload);
}));
