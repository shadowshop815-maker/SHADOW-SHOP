import { Router } from "express";
import { z } from "zod";
import { enquirySchema, emailSchema } from "@shadow/shared";
import { prisma } from "../config/db.js";
import { asyncHandler, success } from "../utils/http.js";

export const contentRouter = Router();

contentRouter.get("/settings", asyncHandler(async (_req, res) => {
  let [store, branding, location] = await Promise.all([prisma.storeSettings.findUnique({ where: { id: 1 } }), prisma.brandingSettings.findUnique({ where: { id: 1 } }), prisma.locationSettings.findUnique({ where: { id: 1 } })]);
  if (!store) store = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!branding) branding = await prisma.brandingSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!location) location = await prisma.locationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return success(res, "Store settings loaded.", { store, branding, location });
}));
contentRouter.get("/updates", asyncHandler(async (req, res) => success(res, "Updates loaded.", await prisma.updatePost.findMany({ where: { status: "PUBLISHED", ...(req.query.search ? { OR: [{ title: { contains: String(req.query.search) } }, { description: { contains: String(req.query.search) } }] } : {}) }, orderBy: { publishDate: "desc" } }))));
contentRouter.get("/media", asyncHandler(async (req, res) => success(res, "Media loaded.", await prisma.mediaItem.findMany({ where: { status: "PUBLISHED", ...(req.query.search ? { title: { contains: String(req.query.search) } } : {}) }, orderBy: { createdAt: "desc" } }))));
contentRouter.post("/enquiries", asyncHandler(async (req, res) => success(res, "Your enquiry has been received.", await prisma.enquiry.create({ data: enquirySchema.parse(req.body) }), 201)));
contentRouter.post("/newsletter", asyncHandler(async (req, res) => {
  const email = emailSchema.parse(req.body.email);
  const subscriber = await prisma.newsletterSubscriber.upsert({ where: { email }, update: { active: true }, create: { email } });
  return success(res, "You are subscribed.", subscriber, 201);
}));
contentRouter.get("/search", asyncHandler(async (req, res) => {
  const query = z.string().min(2).parse(req.query.q); const type = String(req.query.type || "all");
  const [products, updates, media] = await Promise.all([
    type === "all" || type === "products" ? prisma.product.findMany({ where: { status: "ACTIVE", name: { contains: query } }, select: { id: true, name: true, slug: true, thumbnail: true, price: true, salePrice: true }, take: 10 }) : [],
    type === "all" || type === "updates" ? prisma.updatePost.findMany({ where: { status: "PUBLISHED", title: { contains: query } }, take: 10 }) : [],
    type === "all" || type === "media" ? prisma.mediaItem.findMany({ where: { status: "PUBLISHED", title: { contains: query } }, take: 10 }) : []
  ]);
  return success(res, "Search completed.", { products, updates, media });
}));
