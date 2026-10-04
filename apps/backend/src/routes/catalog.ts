import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { asyncHandler, success } from "../utils/http.js";

export const catalogRouter = Router();

catalogRouter.get("/categories", asyncHandler(async (_req, res) => success(res, "Categories loaded.", await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }))));

catalogRouter.get("/products", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
  const search = String(req.query.search || "").trim(); const category = String(req.query.category || ""); const availability = String(req.query.availability || ""); const sort = String(req.query.sort || "default");
  const where: Prisma.ProductWhereInput = {
    status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
            { tags: { contains: search } }
          ]
        }
      : {}),
    ...(category ? { categories: { some: { slug: category } } } : {}),
    ...(availability === "in-stock" ? { stock: { gt: 0 } } : availability === "out-of-stock" ? { stock: 0 } : {})
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === "price-asc" ? [{ salePrice: "asc" }, { price: "asc" }] : sort === "price-desc" ? [{ salePrice: "desc" }, { price: "desc" }] : sort === "name-asc" ? [{ name: "asc" }] : sort === "name-desc" ? [{ name: "desc" }] : sort === "newest" ? [{ createdAt: "desc" }] : sort === "featured" ? [{ featured: "desc" }, { createdAt: "desc" }] : [{ featured: "desc" }, { createdAt: "desc" }];
  const [items, total] = await prisma.$transaction([prisma.product.findMany({ where, include: { categories: true, images: { orderBy: { position: "asc" } }, taxProfile: true }, orderBy, skip: (page - 1) * limit, take: limit }), prisma.product.count({ where })]);
  return success(res, "Products loaded.", { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

catalogRouter.get("/products/:slug", asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "");
  const product = await prisma.product.findFirst({ where: { OR: [{ slug }, { id: slug }], status: { in: ["ACTIVE", "OUT_OF_STOCK"] } }, include: { categories: true, images: { orderBy: { position: "asc" } }, taxProfile: true } });
  if (!product) return res.status(404).json({ success: false, message: "Product not found.", error: { code: "NOT_FOUND" } });
  const categoryIds = product.categories.map((c: any) => c.id);
  const related = await prisma.product.findMany({ where: { categories: { some: { id: { in: categoryIds } } }, id: { not: product.id }, status: "ACTIVE" }, include: { categories: true, taxProfile: true }, take: 4, orderBy: { featured: "desc" } });
  return success(res, "Product loaded.", { product, related });
}));
