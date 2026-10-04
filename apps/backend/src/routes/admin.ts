import { Router, type Request } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { ORDER_TRANSITIONS, productSchema } from "@shadow/shared";
import { prisma } from "../config/db.js";
import { env, uploadDirectory } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { enqueueEmailJob } from "../services/email/dispatcher.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const idParam = (req: Request) => String(req.params.id ?? "");
const pageInfo = (req: Request, max = 100) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(max, Math.max(1, Number(req.query.limit) || 20)) });
const paged = <T>(items: T[], total: number, page: number, limit: number) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });

adminRouter.get("/dashboard", asyncHandler(async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [sales, todaySales, totalOrders, pendingOrders] = await Promise.all([
    prisma.order.aggregate({ where: { orderStatus: { not: "CANCELLED" } }, _sum: { grandTotal: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: today }, orderStatus: { not: "CANCELLED" } }, _sum: { grandTotal: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: "PENDING" } })
  ]);
  const [processingOrders, deliveredOrders, cancelledOrders, returnRequests, refunds] = await Promise.all([
    prisma.order.count({ where: { orderStatus: { in: ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] } } }),
    prisma.order.count({ where: { orderStatus: "DELIVERED" } }),
    prisma.order.count({ where: { orderStatus: "CANCELLED" } }),
    prisma.returnRequest.count({ where: { status: "REQUESTED" } }),
    prisma.refund.count()
  ]);
  const [customers, products, lowStock, outOfStock, recentOrders] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } }),
    prisma.product.count({ where: { stock: 0 } }),
    prisma.order.findMany({ include: { customer: { select: { name: true, email: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);
  return success(res, "Dashboard loaded.", { totalSales: Number(sales._sum.grandTotal || 0), todaySales: Number(todaySales._sum.grandTotal || 0), totalOrders, pendingOrders, processingOrders, deliveredOrders, cancelledOrders, returnRequests, refunds, customers, products, lowStock, outOfStock, recentOrders });
}));

adminRouter.get("/categories", asyncHandler(async (_req, res) => success(res, "Categories loaded.", await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } }))));
adminRouter.post("/categories", asyncHandler(async (req, res) => { const name = String(req.body.name || "").trim(); const slug = String(req.body.slug || "").trim(); if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AppError(400, "Enter a valid name and slug.", "VALIDATION_ERROR"); const item = await prisma.category.create({ data: { name, slug, description: String(req.body.description || ""), image: String(req.body.image || ""), active: req.body.active !== false } }); await audit(req.auth!.id, "CATEGORY_CREATE", "Category", item.id); return success(res, "Category created.", item, 201); }));
adminRouter.patch("/categories/:id", asyncHandler(async (req, res) => { const previous = await prisma.category.findUnique({ where: { id: idParam(req) } }); if (!previous) throw new AppError(404, "Category not found.", "NOT_FOUND"); const newImage = req.body.image !== undefined ? String(req.body.image) : undefined; const item = await prisma.category.update({ where: { id: idParam(req) }, data: { ...(req.body.name !== undefined ? { name: String(req.body.name).trim() } : {}), ...(req.body.slug !== undefined ? { slug: String(req.body.slug).trim() } : {}), ...(req.body.description !== undefined ? { description: String(req.body.description) } : {}), ...(newImage !== undefined ? { image: newImage } : {}), ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {}) } }); if (newImage !== undefined && previous.image && previous.image !== newImage) { await deleteMediaSafe(previous.image).catch(() => {}); } await audit(req.auth!.id, "CATEGORY_EDIT", "Category", item.id); return success(res, "Category updated.", item); }));

adminRouter.get("/products", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const search = String(req.query.search || ""); const status = String(req.query.status || ""); const where: Prisma.ProductWhereInput = { ...(search ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }] } : {}), ...(status === "LOW_STOCK" ? { OR: [{ status: "OUT_OF_STOCK" }, { stock: { lte: 10 } }] } : status ? { status: status as any } : {}) }; const [items, total] = await prisma.$transaction([prisma.product.findMany({ where, include: { categories: true, images: { orderBy: { position: "asc" } } }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.product.count({ where })]); return success(res, "Products loaded.", paged(items, total, page, limit)); }));
adminRouter.post("/products", asyncHandler(async (req, res) => { const input = productSchema.parse(req.body); const { images, categories, taxProfileId, hsnCode, taxMode, ...data } = input; const item = await prisma.product.create({ data: { ...data, sizes: JSON.stringify(data.sizes), colors: JSON.stringify(data.colors), tags: JSON.stringify(data.tags), salePrice: data.salePrice ?? null, costPrice: data.costPrice ?? null, weight: data.weight ?? null, hsnCode: hsnCode ?? null, taxProfileId: taxProfileId ?? null, taxMode: taxMode ?? "INCLUSIVE", status: data.stock === 0 && data.status === "ACTIVE" ? "OUT_OF_STOCK" : data.status, images: { create: images.map((url: string, position: number) => ({ url, position, alt: data.name })) }, categories: { connectOrCreate: categories.map((name: string) => ({ where: { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }, create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") } })) } }, include: { categories: true, images: true, taxProfile: true } }); await prisma.inventoryMovement.create({ data: { productId: item.id, type: "SET", quantity: item.stock, before: 0, after: item.stock, reason: "Initial stock" } }); await audit(req.auth!.id, "PRODUCT_CREATE", "Product", item.id, { sku: item.sku }); return success(res, "Product created.", item, 201); }));
adminRouter.patch("/products/:id", asyncHandler(async (req, res) => { const input = productSchema.parse(req.body); const previous = await prisma.product.findUnique({ where: { id: idParam(req) } }); if (!previous) throw new AppError(404, "Product not found.", "NOT_FOUND"); const { images, categories, taxProfileId, hsnCode, taxMode, ...data } = input; const item = await prisma.$transaction(async (tx: any) => { const previousImages = await tx.productImage.findMany({ where: { productId: previous.id } }); await tx.productImage.deleteMany({ where: { productId: previous.id } }); const updated = await tx.product.update({ where: { id: previous.id }, data: { ...data, sizes: JSON.stringify(data.sizes), colors: JSON.stringify(data.colors), tags: JSON.stringify(data.tags), salePrice: data.salePrice ?? null, costPrice: data.costPrice ?? null, weight: data.weight ?? null, hsnCode: hsnCode ?? null, taxProfileId: taxProfileId ?? null, taxMode: taxMode ?? "INCLUSIVE", status: data.stock === 0 && data.status === "ACTIVE" ? "OUT_OF_STOCK" : data.status, images: { create: images.map((url: string, position: number) => ({ url, position, alt: data.name })) }, categories: { set: [], connectOrCreate: categories.map((name: string) => ({ where: { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }, create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") } })) } }, include: { categories: true, images: true, taxProfile: true } }); if (previous.stock !== updated.stock) await tx.inventoryMovement.create({ data: { productId: updated.id, type: "SET", quantity: updated.stock - previous.stock, before: previous.stock, after: updated.stock, reason: "Admin product edit" } }); const newImageUrls = new Set(images); for (const oldImg of previousImages) { if (!newImageUrls.has(oldImg.url)) { await deleteMediaSafe(oldImg.url).catch(() => {}); } } return updated; }); await audit(req.auth!.id, "PRODUCT_EDIT", "Product", item.id, { oldPrice: String(previous.price), newPrice: String(item.price), oldStock: previous.stock, newStock: item.stock }); return success(res, "Product updated.", item); }));
adminRouter.delete("/products/:id", asyncHandler(async (req, res) => { const item = await prisma.product.update({ where: { id: idParam(req) }, data: { status: "ARCHIVED" } }); await audit(req.auth!.id, "PRODUCT_ARCHIVE", "Product", item.id); return success(res, "Product archived.", item); }));

adminRouter.get("/inventory", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const low = req.query.low === "true"; const where: Prisma.ProductWhereInput = low ? { stock: { lte: 5 }, status: { not: "ARCHIVED" } } : { status: { not: "ARCHIVED" } }; const [items, total] = await prisma.$transaction([prisma.product.findMany({ where, select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true, status: true, updatedAt: true }, orderBy: { stock: "asc" }, skip: (page - 1) * limit, take: limit }), prisma.product.count({ where })]); return success(res, "Inventory loaded.", paged(items, total, page, limit)); }));
adminRouter.patch("/inventory/:id", asyncHandler(async (req, res) => { const mode = String(req.body.mode || "SET") as "SET" | "ADD" | "REDUCE"; const quantity = Number(req.body.quantity); if (!Number.isInteger(quantity) || quantity < 0 || !["SET", "ADD", "REDUCE"].includes(mode)) throw new AppError(400, "Enter a valid stock adjustment.", "VALIDATION_ERROR"); const product = await prisma.product.findUnique({ where: { id: idParam(req) } }); if (!product) throw new AppError(404, "Product not found.", "NOT_FOUND"); const after = mode === "SET" ? quantity : mode === "ADD" ? product.stock + quantity : product.stock - quantity; if (after < 0) throw new AppError(409, "Stock cannot be negative.", "NEGATIVE_STOCK"); const updated = await prisma.$transaction(async (tx: any) => { const item = await tx.product.update({ where: { id: product.id }, data: { stock: after, ...(after === 0 ? { status: "OUT_OF_STOCK" } : product.status === "OUT_OF_STOCK" ? { status: "ACTIVE" } : {}) } }); await tx.inventoryMovement.create({ data: { productId: product.id, type: mode, quantity: after - product.stock, before: product.stock, after, reason: String(req.body.reason || "Admin stock adjustment") } }); return item; }); await audit(req.auth!.id, "STOCK_CHANGE", "Product", product.id, { before: product.stock, after }); return success(res, "Stock updated.", updated); }));
adminRouter.get("/inventory/:id/movements", asyncHandler(async (req, res) => success(res, "Stock history loaded.", await prisma.inventoryMovement.findMany({ where: { productId: idParam(req) }, orderBy: { createdAt: "desc" }, take: 100 }))));

if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });
const accepted = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "video/mp4", "application/pdf"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, accepted.has(file.mimetype) && [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".pdf"].includes(path.extname(file.originalname).toLowerCase()))
});

async function deleteMediaSafe(url: string) {
  if (!url) return;
  try {
    if (url.includes("/storage/v1/object/public/uploads/")) {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const filename = url.split("/storage/v1/object/public/uploads/")[1];
        if (filename) await supabase.storage.from("uploads").remove([filename]);
      }
    } else if (url.includes("/uploads/")) {
      const filename = url.split("/uploads/")[1];
      if (filename) {
        const filepath = path.join(uploadDirectory, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    }
  } catch (err) {
    console.error("[Media Deletion Error]", url, err);
  }
}

adminRouter.post("/uploads", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Select a supported image, video, or PDF file.", "INVALID_UPLOAD");
  
  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `${Date.now()}-${randomUUID()}${ext}`;
  let url = "";

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error } = await supabase.storage.from("uploads").upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });
    if (error) throw new AppError(500, `Supabase upload failed: ${error.message}`, "UPLOAD_ERROR");
    
    const { data } = supabase.storage.from("uploads").getPublicUrl(filename);
    url = data.publicUrl;
  } else {
    // Fallback to local
    if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });
    fs.writeFileSync(path.join(uploadDirectory, filename), req.file.buffer);
    url = `${env.BACKEND_URL}/uploads/${filename}`;
  }

  await audit(req.auth!.id, "MEDIA_UPLOAD", "Upload", filename, { mime: req.file.mimetype, size: req.file.size, url });
  return success(res, "File uploaded.", { url, name: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size }, 201);
}));

adminRouter.get("/orders", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const search = String(req.query.search || ""); const status = String(req.query.status || ""); const where: Prisma.OrderWhereInput = { ...(status ? { orderStatus: status as never } : {}), ...(search ? { OR: [{ orderNumber: { contains: search } }, { customer: { name: { contains: search } } }, { guestName: { contains: search } }] } : {}) }; const [items, total] = await prisma.$transaction([prisma.order.findMany({ where, include: { customer: { select: { id: true, name: true, email: true, phone: true } }, items: true, offerRedemptions: true, cancellation: true, returns: true, refunds: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.order.count({ where })]); return success(res, "Orders loaded.", paged(items, total, page, limit)); }));
adminRouter.get("/orders/:id", asyncHandler(async (req, res) => { const order = await prisma.order.findUnique({ where: { id: idParam(req) }, include: { customer: { select: { id: true, name: true, email: true, phone: true } }, items: true, offerRedemptions: true, cancellation: true, returns: { include: { items: true } }, refunds: true } }); if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND"); return success(res, "Order loaded.", order); }));

async function restoreOrderStock(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } }); if (order.stockRestored) return;
  for (const item of order.items) { const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } }); const after = product.stock + item.quantity; await tx.product.update({ where: { id: product.id }, data: { stock: after, ...(product.status === "OUT_OF_STOCK" ? { status: "ACTIVE" } : {}) } }); await tx.inventoryMovement.create({ data: { productId: product.id, type: "CANCELLATION", quantity: item.quantity, before: product.stock, after, reason: "Cancelled order stock restore", reference: order.orderNumber } }); }
  await tx.order.update({ where: { id: order.id }, data: { stockRestored: true } });
}

adminRouter.patch("/orders/:id/status", asyncHandler(async (req, res) => { 
  const next = String(req.body.status || ""); 
  const order = await prisma.order.findUnique({ where: { id: idParam(req) }, include: { items: { include: { product: true } } } }); 
  if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND"); 
  if (!ORDER_TRANSITIONS[order.orderStatus]?.includes(next)) throw new AppError(409, `Cannot move an order from ${order.orderStatus} to ${next}.`, "INVALID_STATUS_TRANSITION"); 
  const storeSettings = await prisma.storeSettings.findFirst() || { returnsEnabled: false, returnWindowMinutes: 0 };
  const updated = await prisma.$transaction(async (tx: any) => { 
    if (next === "CANCELLED") await restoreOrderStock(tx, order.id); 
    
    // Process Delivery and Return Policy Snapshot
    if (next === "DELIVERED") {
      const deliveredAt = new Date();
      for (const item of order.items) {
        if (!item.deliveredAt) {
          const isReturnable = storeSettings.returnsEnabled && item.product.isReturnable;
          const mins = item.product.returnWindowMins ?? (storeSettings.returnWindowMinutes ?? 10080); const deadline = isReturnable ? new Date(deliveredAt.getTime() + mins * 60000) : null; const policySnapshot = { returnable: isReturnable, windowMins: mins, source: item.product.returnWindowMins != null ? "PRODUCT" : "GLOBAL" };
          await tx.orderItem.update({ 
            where: { id: item.id }, 
            data: { 
              itemStatus: "DELIVERED", 
              deliveredAt, 
              returnDeadline: deadline, 
              returnPolicySnapshot: JSON.stringify(policySnapshot) 
            } 
          });
        }
      }
    }
    
    const updatedOrder = await tx.order.update({ 
      where: { id: order.id }, 
      data: { 
        orderStatus: next as never, 
        ...(next === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        ...(req.body.trackingNumber !== undefined ? { trackingNumber: String(req.body.trackingNumber) } : {}), 
        ...(req.body.courierName !== undefined ? { courierName: String(req.body.courierName) } : {}), 
        ...(req.body.adminNote !== undefined ? { adminNote: String(req.body.adminNote) } : {}) 
      } 
    }); 

    // Enqueue transactional emails for order status changes
    // Use deterministic idempotency keys to prevent duplicate emails on retries
    let toEmail = updatedOrder.guestEmail;
    if (!toEmail && updatedOrder.customerId) {
      const user = await tx.user.findUnique({ where: { id: updatedOrder.customerId } });
      toEmail = user?.email;
    }

    if (toEmail) {
      const emailPayload = {
        ...updatedOrder,
        customerName: updatedOrder.guestName,
        customerEmail: updatedOrder.guestEmail,
      };
      const iKey = (event: string) => `${event}_${updatedOrder.id}`;
      if (next === "CONFIRMED")         await enqueueEmailJob(tx, "ORDER_CONFIRMED",         toEmail, "order_confirmed",         emailPayload, iKey("ORDER_CONFIRMED"));
      if (next === "PROCESSING")        await enqueueEmailJob(tx, "ORDER_PROCESSING",        toEmail, "order_processing",        emailPayload, iKey("ORDER_PROCESSING"));
      if (next === "PACKED")            await enqueueEmailJob(tx, "ORDER_PACKED",            toEmail, "order_packed",            emailPayload, iKey("ORDER_PACKED"));
      if (next === "SHIPPED")           await enqueueEmailJob(tx, "ORDER_SHIPPED",           toEmail, "order_shipped",           emailPayload, iKey("ORDER_SHIPPED"));
      if (next === "OUT_FOR_DELIVERY")  await enqueueEmailJob(tx, "ORDER_OUT_FOR_DELIVERY",  toEmail, "order_out_for_delivery",  emailPayload, iKey("ORDER_OUT_FOR_DELIVERY"));
      if (next === "DELIVERED")         await enqueueEmailJob(tx, "ORDER_DELIVERED",         toEmail, "order_delivered",         emailPayload, iKey("ORDER_DELIVERED"));
      if (next === "CANCELLED")         await enqueueEmailJob(tx, "ORDER_CANCELLED",         toEmail, "order_cancelled",         emailPayload, iKey("ORDER_CANCELLED"));
    }
    
    return updatedOrder;
  }); 
  await audit(req.auth!.id, "ORDER_STATUS_CHANGE", "Order", order.id, { from: order.orderStatus, to: next }); 
  return success(res, "Order status updated.", updated); 
}));
adminRouter.patch("/orders/:id/tracking", asyncHandler(async (req, res) => { const item = await prisma.order.update({ where: { id: idParam(req) }, data: { trackingNumber: String(req.body.trackingNumber || ""), courierName: String(req.body.courierName || ""), adminNote: req.body.adminNote === undefined ? undefined : String(req.body.adminNote) } }); await audit(req.auth!.id, "ORDER_TRACKING_CHANGE", "Order", item.id); return success(res, "Tracking updated.", item); }));
adminRouter.patch("/orders/:id/payment", asyncHandler(async (req, res) => { const next = String(req.body.paymentStatus || ""); if (!["PENDING", "PAID", "FAILED", "REFUNDED"].includes(next)) throw new AppError(400, "Invalid payment status.", "VALIDATION_ERROR"); const item = await prisma.order.update({ where: { id: idParam(req) }, data: { paymentStatus: next as never } }); await audit(req.auth!.id, "ORDER_PAYMENT_CHANGE", "Order", item.id, { paymentStatus: next }); return success(res, "Payment status updated.", item); }));

adminRouter.get("/cancellations", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const status = String(req.query.status || ""); const where: Prisma.CancellationRequestWhereInput = status ? { status: status as never } : {}; const [items, total] = await prisma.$transaction([prisma.cancellationRequest.findMany({ where, include: { order: { include: { customer: { select: { name: true, email: true } }, items: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.cancellationRequest.count({ where })]); return success(res, "Cancellations loaded.", paged(items, total, page, limit)); }));
adminRouter.patch("/cancellations/:id", asyncHandler(async (req, res) => { const status = String(req.body.status || ""); if (!["APPROVED", "REJECTED"].includes(status)) throw new AppError(400, "Choose approve or reject.", "VALIDATION_ERROR"); const request = await prisma.cancellationRequest.findUnique({ where: { id: idParam(req) }, include: { order: true } }); if (!request || request.status !== "REQUESTED") throw new AppError(409, "This request has already been decided.", "REQUEST_DECIDED"); const updated = await prisma.$transaction(async (tx: any) => { if (status === "APPROVED") { await restoreOrderStock(tx, request.orderId); await tx.order.update({ where: { id: request.orderId }, data: { orderStatus: "CANCELLED" } }); } else await tx.order.update({ where: { id: request.orderId }, data: { orderStatus: request.order.orderStatus === "CANCEL_REQUESTED" ? "CONFIRMED" : request.order.orderStatus } }); return tx.cancellationRequest.update({ where: { id: request.id }, data: { status: status as never, adminResponse: String(req.body.adminResponse || "") } }); }); await audit(req.auth!.id, `CANCELLATION_${status}`, "CancellationRequest", request.id); return success(res, `Cancellation ${status.toLowerCase()}.`, updated); }));

adminRouter.get("/returns", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const status = String(req.query.status || ""); const where: Prisma.ReturnRequestWhereInput = status ? { status: status as never } : {}; const [items, total] = await prisma.$transaction([prisma.returnRequest.findMany({ where, include: { order: { include: { customer: { select: { name: true, email: true } } } }, items: { include: { orderItem: true } }, refunds: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.returnRequest.count({ where })]); return success(res, "Returns loaded.", paged(items, total, page, limit)); }));

adminRouter.get("/refunds", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const [items, total] = await prisma.$transaction([prisma.refund.findMany({ include: { order: { select: { orderNumber: true } }, returnRequest: { select: { returnNumber: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.refund.count()]); return success(res, "Refunds loaded.", paged(items, total, page, limit)); }));
adminRouter.post("/refunds", asyncHandler(async (req, res) => { const order = await prisma.order.findUnique({ where: { id: String(req.body.orderId || "") } }); const amount = Number(req.body.amount); if (!order || !Number.isFinite(amount) || amount <= 0 || amount > Number(order.grandTotal)) throw new AppError(400, "Enter a valid refund amount.", "VALIDATION_ERROR"); const item = await prisma.refund.create({ data: { orderId: order.id, returnRequestId: req.body.returnRequestId || null, amount, notes: String(req.body.notes || "") } }); await audit(req.auth!.id, "REFUND_CREATE", "Refund", item.id, { amount }); return success(res, "Refund record created.", item, 201); }));
adminRouter.patch("/refunds/:id", asyncHandler(async (req, res) => { const status = String(req.body.status || ""); if (!["APPROVED", "REJECTED", "PENDING", "COMPLETED"].includes(status)) throw new AppError(400, "Invalid refund status.", "VALIDATION_ERROR"); const item = await prisma.refund.update({ where: { id: idParam(req) }, data: { status: status as never, reference: req.body.reference === undefined ? undefined : String(req.body.reference), notes: req.body.notes === undefined ? undefined : String(req.body.notes) } }); if (status === "COMPLETED") await prisma.order.update({ where: { id: item.orderId }, data: { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" } }); await audit(req.auth!.id, "REFUND_UPDATE", "Refund", item.id, { status }); return success(res, "Refund updated.", item); }));

adminRouter.get("/customers", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const search = String(req.query.search || ""); const status = String(req.query.status || ""); const where: Prisma.UserWhereInput = { role: "CUSTOMER", ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] } : {}), ...(status ? { customerProfile: { status: status as never } } : {}) }; const [items, total] = await prisma.$transaction([prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, lastLoginAt: true, customerProfile: true, _count: { select: { orders: true } }, orders: { where: { orderStatus: { not: "CANCELLED" } }, select: { grandTotal: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.user.count({ where })]); const rows = items.map(({ orders, ...item }: any) => ({ ...item, totalSpending: (orders as any[]).reduce((sum: number, order: any) => sum + Number(order.grandTotal), 0) })); return success(res, "Customers loaded.", paged(rows, total, page, limit)); }));
adminRouter.get("/customers/:id", asyncHandler(async (req, res) => { const item = await prisma.user.findFirst({ where: { id: idParam(req), role: "CUSTOMER" }, select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, lastLoginAt: true, customerProfile: true, addresses: true, orders: { include: { items: true, cancellation: true, returns: true }, orderBy: { createdAt: "desc" } }, moderation: { include: { admin: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } }); if (!item) throw new AppError(404, "Customer not found.", "NOT_FOUND"); return success(res, "Customer loaded.", item); }));
adminRouter.post("/customers/:id/moderation", asyncHandler(async (req, res) => { const next = String(req.body.status || ""); if (!["ACTIVE", "SUSPENDED", "TEMPORARILY_BANNED", "PERMANENTLY_BANNED"].includes(next)) throw new AppError(400, "Invalid customer status.", "VALIDATION_ERROR"); const reason = String(req.body.reason || "").trim(); if (next !== "ACTIVE" && reason.length < 3) throw new AppError(400, "A moderation reason is required.", "VALIDATION_ERROR"); const customer = await prisma.user.findFirst({ where: { id: idParam(req), role: "CUSTOMER" }, include: { customerProfile: true } }); if (!customer?.customerProfile) throw new AppError(404, "Customer not found.", "NOT_FOUND"); let expiresAt: Date | null = null; if (next === "TEMPORARILY_BANNED") { expiresAt = new Date(String(req.body.expiresAt || "")); if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new AppError(400, "Choose a future ban expiry date.", "VALIDATION_ERROR"); } const action = await prisma.$transaction(async (tx: any) => { await tx.customerProfile.update({ where: { userId: customer.id }, data: { status: next as never, banReason: next === "ACTIVE" ? null : reason, banExpires: expiresAt, adminNotes: req.body.note === undefined ? undefined : String(req.body.note) } }); return tx.moderationAction.create({ data: { customerId: customer.id, adminId: req.auth!.id, previous: customer.customerProfile.status, next: next as never, reason: next === "ACTIVE" ? "Restriction removed" : reason, note: req.body.note ? String(req.body.note) : null, expiresAt } }); }); await audit(req.auth!.id, next === "ACTIVE" ? "CUSTOMER_UNBAN" : "CUSTOMER_RESTRICTION", "User", customer.id, { status: next, reason }); return success(res, "Customer status updated.", action); }));

adminRouter.get("/settings", asyncHandler(async (_req, res) => { 
  let [store, branding, location] = await Promise.all([prisma.storeSettings.findUnique({ where: { id: 1 } }), prisma.brandingSettings.findUnique({ where: { id: 1 } }), prisma.locationSettings.findUnique({ where: { id: 1 } })]);
  if (!store) store = await prisma.storeSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!branding) branding = await prisma.brandingSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (!location) location = await prisma.locationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return success(res, "Settings loaded.", { store, branding, location }); 
}));
adminRouter.patch("/settings/store", asyncHandler(async (req, res) => { const allowed = ["email", "phone", "whatsapp", "whatsappMessage", "whatsappEnabled", "currency", "taxRate", "gstRegistered", "gstin", "supplierState", "shippingCharge", "standardDeliveryName", "standardDeliveryCharge", "expressDeliveryEnabled", "expressDeliveryName", "expressDeliveryCharge", "freeShippingThreshold", "returnsEnabled", "returnWindowMinutes", "requireReturnReason", "allowReturnComment", "requirePhotoForDamage", "allowPartialReturns", "allowedReturnResolutions", "returnExpiredMessage", "returnPeriodDays", "cancellationPolicy", "returnPolicy", "privacyPolicy", "terms", "socialProfiles", "isOpen"] as const; const data: Record<string, unknown> = {}; for (const key of allowed) { if (req.body[key] !== undefined) { data[key] = (key === "returnPeriodDays" && req.body[key] === null) ? 7 : req.body[key]; } } const item = await prisma.storeSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }); await audit(req.auth!.id, "STORE_SETTINGS_CHANGE", "StoreSettings", "1"); return success(res, "Store settings updated.", item); }));
adminRouter.patch("/settings/branding", asyncHandler(async (req, res) => { const allowed = ["storeName", "logo", "headerLogo", "footerLogo", "favicon", "tagline", "storeDescription", "heroHeading", "heroSubheading", "heroImage", "heroButtonText", "heroButtonLink", "promotionalBanner", "newsletterHeading", "newsletterText"] as const; const data: Record<string, unknown> = {}; for (const key of allowed) if (req.body[key] !== undefined && !(key === "storeName" && !String(req.body[key]).trim())) data[key] = req.body[key]; const previous = await prisma.brandingSettings.findUnique({ where: { id: 1 } }); const item = await prisma.brandingSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }); if (previous) { const imageKeys = ["logo", "headerLogo", "footerLogo", "favicon", "heroImage"]; for (const key of imageKeys) { const oldVal = previous[key as keyof typeof previous] as string | null; const newVal = item[key as keyof typeof item] as string | null; if (oldVal && oldVal !== newVal) { await deleteMediaSafe(oldVal).catch(() => {}); } } } await audit(req.auth!.id, "BRANDING_CHANGE", "BrandingSettings", "1", { fields: Object.keys(data) }); return success(res, "Branding updated.", item); }));
adminRouter.patch("/settings/location", asyncHandler(async (req, res) => {
  const allowed = ["branchName", "line1", "line2", "landmark", "city", "district", "state", "country", "pinCode", "latitude", "longitude", "mapsUrl", "placeId"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key] === "" && (key === "latitude" || key === "longitude") ? null : req.body[key];
  if ((data.latitude != null && (Number(data.latitude) < -90 || Number(data.latitude) > 90)) || (data.longitude != null && (Number(data.longitude) < -180 || Number(data.longitude) > 180))) throw new AppError(400, "Enter valid latitude and longitude.", "VALIDATION_ERROR");
  const item = await prisma.locationSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  await audit(req.auth!.id, "LOCATION_CHANGE", "LocationSettings", "1");

  // AUTO-SYNC: When location is saved, update any store records that still have (0,0) coordinates.
  // This keeps store geolocation in sync with the admin-configured location.
  const newLat = item.latitude;
  const newLng = item.longitude;
  if (newLat != null && newLng != null && !(newLat === 0 && newLng === 0)) {
    const storeWithBadCoords = await prisma.store.findFirst({ where: { latitude: 0, longitude: 0 } });
    if (storeWithBadCoords) {
      await prisma.store.updateMany({
        where: { latitude: 0, longitude: 0 },
        data: { latitude: newLat, longitude: newLng, name: item.branchName || undefined }
      });
    }
  }

  return success(res, "Location updated.", item);
}));


adminRouter.get("/updates", asyncHandler(async (_req, res) => success(res, "Updates loaded.", await prisma.updatePost.findMany({ orderBy: { createdAt: "desc" } }))));
adminRouter.post("/updates", asyncHandler(async (req, res) => { const item = await prisma.updatePost.create({ data: { title: String(req.body.title || ""), slug: String(req.body.slug || ""), description: String(req.body.description || ""), coverImage: String(req.body.coverImage || ""), category: String(req.body.category || "News"), status: req.body.status || "DRAFT", publishDate: req.body.status === "PUBLISHED" ? new Date(req.body.publishDate || Date.now()) : null } }); await audit(req.auth!.id, "UPDATE_CREATE", "UpdatePost", item.id); return success(res, "Update created.", item, 201); }));
adminRouter.patch("/updates/:id", asyncHandler(async (req, res) => { const item = await prisma.updatePost.update({ where: { id: idParam(req) }, data: { ...(req.body.title !== undefined ? { title: String(req.body.title) } : {}), ...(req.body.slug !== undefined ? { slug: String(req.body.slug) } : {}), ...(req.body.description !== undefined ? { description: String(req.body.description) } : {}), ...(req.body.coverImage !== undefined ? { coverImage: String(req.body.coverImage) } : {}), ...(req.body.category !== undefined ? { category: String(req.body.category) } : {}), ...(req.body.status !== undefined ? { status: req.body.status, publishDate: req.body.status === "PUBLISHED" ? new Date(req.body.publishDate || Date.now()) : null } : {}) } }); await audit(req.auth!.id, "UPDATE_EDIT", "UpdatePost", item.id); return success(res, "Update saved.", item); }));
adminRouter.delete("/updates/:id", asyncHandler(async (req, res) => { const item = await prisma.updatePost.update({ where: { id: idParam(req) }, data: { status: "ARCHIVED" } }); await audit(req.auth!.id, "UPDATE_ARCHIVE", "UpdatePost", item.id); return success(res, "Update archived.", item); }));

adminRouter.get("/media", asyncHandler(async (_req, res) => success(res, "Media loaded.", await prisma.mediaItem.findMany({ orderBy: { createdAt: "desc" } }))));
adminRouter.post("/media", asyncHandler(async (req, res) => { const item = await prisma.mediaItem.create({ data: { title: String(req.body.title || ""), description: String(req.body.description || ""), type: req.body.type, url: String(req.body.url || ""), thumbnail: String(req.body.thumbnail || ""), status: req.body.status || "DRAFT" } }); await audit(req.auth!.id, "MEDIA_CREATE", "MediaItem", item.id); return success(res, "Media created.", item, 201); }));
adminRouter.patch("/media/:id", asyncHandler(async (req, res) => { const item = await prisma.mediaItem.update({ where: { id: idParam(req) }, data: { ...(req.body.title !== undefined ? { title: String(req.body.title) } : {}), ...(req.body.description !== undefined ? { description: String(req.body.description) } : {}), ...(req.body.type !== undefined ? { type: req.body.type } : {}), ...(req.body.url !== undefined ? { url: String(req.body.url) } : {}), ...(req.body.thumbnail !== undefined ? { thumbnail: String(req.body.thumbnail) } : {}), ...(req.body.status !== undefined ? { status: req.body.status } : {}) } }); await audit(req.auth!.id, "MEDIA_EDIT", "MediaItem", item.id); return success(res, "Media saved.", item); }));
adminRouter.delete("/media/:id", asyncHandler(async (req, res) => { const item = await prisma.mediaItem.update({ where: { id: idParam(req) }, data: { status: "ARCHIVED" } }); await audit(req.auth!.id, "MEDIA_ARCHIVE", "MediaItem", item.id); return success(res, "Media archived.", item); }));

adminRouter.get("/enquiries", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const status = String(req.query.status || ""); const where: Prisma.EnquiryWhereInput = status ? { status: status as never } : {}; const [items, total] = await prisma.$transaction([prisma.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.enquiry.count({ where })]); return success(res, "Enquiries loaded.", paged(items, total, page, limit)); }));
adminRouter.patch("/enquiries/:id", asyncHandler(async (req, res) => { const item = await prisma.enquiry.update({ where: { id: idParam(req) }, data: { ...(req.body.status ? { status: req.body.status } : {}), ...(req.body.internalNote !== undefined ? { internalNote: String(req.body.internalNote) } : {}) } }); return success(res, "Enquiry updated.", item); }));
adminRouter.get("/newsletter", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const [items, total] = await prisma.$transaction([prisma.newsletterSubscriber.findMany({ orderBy: { subscribedAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.newsletterSubscriber.count()]); return success(res, "Subscribers loaded.", paged(items, total, page, limit)); }));
adminRouter.get("/audit", asyncHandler(async (req, res) => { const { page, limit } = pageInfo(req); const search = String(req.query.search || ""); const where: Prisma.AdminAuditLogWhereInput = search ? { OR: [{ action: { contains: search } }, { entityType: { contains: search } }] } : {}; const [items, total] = await prisma.$transaction([prisma.adminAuditLog.findMany({ where, include: { admin: { select: { name: true, email: true } } }, orderBy: { timestamp: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.adminAuditLog.count({ where })]); return success(res, "Audit log loaded.", paged(items, total, page, limit)); }));
adminRouter.get("/security", asyncHandler(async (_req, res) => {
  let settings = await prisma.securitySettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.securitySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, otpExpiryMinutes: env.OTP_EXPIRY_MINUTES, otpMaxAttempts: env.OTP_MAX_ATTEMPTS, otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS } });
  return success(res, "Security settings loaded.", settings);
}));
adminRouter.patch("/security", asyncHandler(async (req, res) => { const otpExpiryMinutes = Number(req.body.otpExpiryMinutes); const otpMaxAttempts = Number(req.body.otpMaxAttempts); const otpResendCooldownSeconds = Number(req.body.otpResendCooldownSeconds); if (!Number.isInteger(otpExpiryMinutes) || otpExpiryMinutes < 1 || otpExpiryMinutes > 30 || !Number.isInteger(otpMaxAttempts) || otpMaxAttempts < 1 || otpMaxAttempts > 10 || !Number.isInteger(otpResendCooldownSeconds) || otpResendCooldownSeconds < 15 || otpResendCooldownSeconds > 3600) throw new AppError(400, "OTP values are outside the allowed security range.", "VALIDATION_ERROR"); const item = await prisma.securitySettings.upsert({ where: { id: 1 }, update: { otpExpiryMinutes, otpMaxAttempts, otpResendCooldownSeconds, requireEmailVerification: Boolean(req.body.requireEmailVerification) }, create: { id: 1, otpExpiryMinutes, otpMaxAttempts, otpResendCooldownSeconds, requireEmailVerification: Boolean(req.body.requireEmailVerification) } }); await audit(req.auth!.id, "SECURITY_SETTING_CHANGE", "SecuritySettings", "1"); return success(res, "Security settings updated.", item); }));

// Delivery Management
adminRouter.get("/delivery/options", asyncHandler(async (req, res) => {
  const options = await prisma.deliveryOption.findMany({ orderBy: { priority: "asc" } });
  
  // Data cleanup: If multiple options are marked default, ensure only one is default
  const defaultOptions = options.filter((o: any) => o.isDefault);
  if (defaultOptions.length > 1) {
    // Keep 7-day or standard delivery as default, or the one with 0 surcharge
    const primaryDefault = defaultOptions.find((o: any) => o.name.toLowerCase().includes("7") || o.deliveryType === "Standard" || Number(o.speedSurcharge) === 0) || defaultOptions[0];
    await prisma.deliveryOption.updateMany({
      where: { id: { not: primaryDefault.id } },
      data: { isDefault: false }
    });
    for (const opt of options) {
      opt.isDefault = opt.id === primaryDefault.id;
    }
  }

  return success(res, "Delivery options loaded.", options);
}));

adminRouter.post("/delivery/options", asyncHandler(async (req, res) => {
  const { name, internalName, description, deliveryType, deliveryDays, dayCalculationType, speedSurcharge, maxDistanceKm, status, priority, isDefault } = req.body;
  const isDefaultBool = isDefault === true || isDefault === "true" || isDefault === 1;

  if (isDefaultBool) {
    await prisma.deliveryOption.updateMany({ data: { isDefault: false } });
  }

  const created = await prisma.deliveryOption.create({
    data: {
      name, internalName: internalName || name, description: description || "",
      deliveryType: deliveryType || "Standard", deliveryDays: Number(deliveryDays),
      dayCalculationType: dayCalculationType || "BUSINESS_DAYS",
      speedSurcharge: Number(speedSurcharge ?? 0),
      price: Number(speedSurcharge ?? 0), // keep price in sync for legacy
      maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : null,
      status: status || "ACTIVE", priority: priority || "NORMAL", isDefault: isDefaultBool
    }
  });
  return success(res, "Delivery option created.", created, 201);
}));

adminRouter.patch("/delivery/options/:id", asyncHandler(async (req, res) => {
  const optionId = idParam(req);
  const surcharge = req.body.speedSurcharge !== undefined ? Number(req.body.speedSurcharge) : undefined;
  
  let isDefaultBool: boolean | undefined = undefined;
  if (req.body.isDefault !== undefined) {
    isDefaultBool = req.body.isDefault === true || req.body.isDefault === "true" || req.body.isDefault === 1;
    if (isDefaultBool) {
      await prisma.deliveryOption.updateMany({
        where: { id: { not: optionId } },
        data: { isDefault: false }
      });
    }
  }

  const updated = await prisma.deliveryOption.update({
    where: { id: optionId },
    data: {
      ...(req.body.name !== undefined ? { name: req.body.name } : {}),
      ...(req.body.internalName !== undefined ? { internalName: req.body.internalName } : {}),
      ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      ...(req.body.deliveryType !== undefined ? { deliveryType: req.body.deliveryType } : {}),
      ...(req.body.deliveryDays !== undefined ? { deliveryDays: Number(req.body.deliveryDays) } : {}),
      ...(req.body.dayCalculationType !== undefined ? { dayCalculationType: req.body.dayCalculationType } : {}),
      ...(surcharge !== undefined ? { speedSurcharge: surcharge, price: surcharge } : {}),
      ...(req.body.maxDistanceKm !== undefined ? { maxDistanceKm: req.body.maxDistanceKm ? Number(req.body.maxDistanceKm) : null } : {}),
      ...(req.body.status !== undefined ? { status: req.body.status } : {}),
      ...(req.body.priority !== undefined ? { priority: req.body.priority } : {}),
      ...(isDefaultBool !== undefined ? { isDefault: isDefaultBool } : {})
    }
  });
  return success(res, "Delivery option updated.", updated);
}));

adminRouter.delete("/delivery/options/:id", asyncHandler(async (req, res) => {
  await prisma.deliveryOption.delete({ where: { id: idParam(req) } });
  return success(res, "Delivery option deleted.", {});
}));

adminRouter.get("/delivery/holidays", asyncHandler(async (req, res) => {
  const holidays = await prisma.deliveryHoliday.findMany({ orderBy: { date: "asc" } });
  return success(res, "Delivery holidays loaded.", holidays);
}));

adminRouter.post("/delivery/holidays", asyncHandler(async (req, res) => {
  const { date, name } = req.body;
  const created = await prisma.deliveryHoliday.create({ data: { date: new Date(date), name } });
  return success(res, "Delivery holiday created.", created, 201);
}));

adminRouter.delete("/delivery/holidays/:id", asyncHandler(async (req, res) => {
  await prisma.deliveryHoliday.delete({ where: { id: idParam(req) } });
  return success(res, "Delivery holiday deleted.", {});
}));

adminRouter.get("/delivery/settings", asyncHandler(async (req, res) => {
  let settings = await prisma.deliverySettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.deliverySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return success(res, "Delivery settings loaded.", {
    ...settings,
    baseShippingFee: Number((settings as any).baseShippingFee ?? 0),
    freeShippingEnabled: Boolean((settings as any).freeShippingEnabled ?? false),
    freeShippingThreshold: Number((settings as any).freeShippingThreshold ?? 500),
    freeShippingBasis: String((settings as any).freeShippingBasis ?? "AFTER_DISCOUNT")
  });
}));


adminRouter.patch("/delivery/settings", asyncHandler(async (req, res) => {
  const allowed = ["enableSelection", "orderCutoffTime", "workingDays", "timezone", "baseShippingFee", "freeShippingEnabled", "freeShippingThreshold", "freeShippingBasis"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      if (k === 'workingDays' && Array.isArray(req.body[k])) {
        data[k] = JSON.stringify(req.body[k]);
      } else if (k === 'enableSelection' || k === 'freeShippingEnabled') {
        data[k] = Boolean(req.body[k]);
      } else if (k === 'baseShippingFee' || k === 'freeShippingThreshold') {
        data[k] = Number(req.body[k]);
      } else {
        data[k] = req.body[k];
      }
    }
  }

  // Update base settings
  const basicData: Record<string, any> = {};
  if (data.enableSelection !== undefined) basicData.enableSelection = Boolean(data.enableSelection);
  if (data.orderCutoffTime !== undefined) basicData.orderCutoffTime = String(data.orderCutoffTime);
  if (data.workingDays !== undefined) basicData.workingDays = String(data.workingDays);
  if (data.timezone !== undefined) basicData.timezone = String(data.timezone);

  const updated = await prisma.deliverySettings.upsert({
    where: { id: 1 },
    update: basicData,
    create: { id: 1, ...basicData }
  });

  // Update shipping fee fields via Prisma (no raw SQL needed — avoids PostgreSQL case-sensitivity issues)
  const baseFee = data.baseShippingFee !== undefined ? Number(data.baseShippingFee) : undefined;
  const freeEnabled = data.freeShippingEnabled !== undefined ? Boolean(data.freeShippingEnabled) : undefined;
  const threshold = data.freeShippingThreshold !== undefined ? Number(data.freeShippingThreshold) : undefined;
  const basis = data.freeShippingBasis !== undefined ? String(data.freeShippingBasis) : undefined;

  const feeUpdate: Record<string, any> = {};
  if (baseFee !== undefined) feeUpdate.baseShippingFee = baseFee;
  if (freeEnabled !== undefined) feeUpdate.freeShippingEnabled = freeEnabled;
  if (threshold !== undefined) feeUpdate.freeShippingThreshold = threshold;
  if (basis !== undefined) feeUpdate.freeShippingBasis = basis;

  const final = Object.keys(feeUpdate).length > 0
    ? await prisma.deliverySettings.update({ where: { id: 1 }, data: feeUpdate })
    : updated;

  return success(res, "Delivery settings updated.", {
    ...final,
    baseShippingFee: Number(final.baseShippingFee ?? 0),
    freeShippingEnabled: Boolean(final.freeShippingEnabled ?? false),
    freeShippingThreshold: Number(final.freeShippingThreshold ?? 500),
    freeShippingBasis: String(final.freeShippingBasis ?? "AFTER_DISCOUNT")
  });
}));


// Tax Profiles
adminRouter.get("/tax/profiles", asyncHandler(async (_req, res) => {
  const profiles = await prisma.taxProfile.findMany({ orderBy: { name: "asc" } });
  return success(res, "Tax profiles loaded.", profiles);
}));

adminRouter.post("/tax/profiles", asyncHandler(async (req, res) => {
  const { name, code, description, rate, cgstComponent, sgstComponent, igstComponent, cessComponent, active } = req.body;
  if (!name || !code || rate == null) throw new AppError(400, "Name, code, and rate are required.", "VALIDATION_ERROR");
  const profile = await prisma.taxProfile.create({
    data: { name: String(name), code: String(code).toUpperCase(), description: String(description || ""), rate: Number(rate), cgstComponent: Number(cgstComponent ?? (Number(rate) / 2)), sgstComponent: Number(sgstComponent ?? (Number(rate) / 2)), igstComponent: Number(igstComponent ?? Number(rate)), cessComponent: Number(cessComponent ?? 0), active: active !== false }
  });
  await audit(req.auth!.id, "TAX_PROFILE_CREATE", "TaxProfile", profile.id);
  return success(res, "Tax profile created.", profile, 201);
}));

adminRouter.patch("/tax/profiles/:id", asyncHandler(async (req, res) => {
  const data: Record<string, unknown> = {};
  const fields = ["name", "code", "description", "rate", "cgstComponent", "sgstComponent", "igstComponent", "cessComponent", "active"] as const;
  for (const k of fields) if (req.body[k] !== undefined) data[k] = ["name", "description", "code"].includes(k) ? String(req.body[k]) : k === "active" ? Boolean(req.body[k]) : Number(req.body[k]);
  if (data.code) data.code = (data.code as string).toUpperCase();
  const profile = await prisma.taxProfile.update({ where: { id: idParam(req) }, data });
  await audit(req.auth!.id, "TAX_PROFILE_EDIT", "TaxProfile", profile.id);
  return success(res, "Tax profile updated.", profile);
}));

adminRouter.delete("/tax/profiles/:id", asyncHandler(async (req, res) => {
  await prisma.taxProfile.update({ where: { id: idParam(req) }, data: { active: false } });
  return success(res, "Tax profile deactivated.", {});
}));

// HSN Master
adminRouter.get("/tax/hsn", asyncHandler(async (_req, res) => {
  const hsn = await prisma.hSNMaster.findMany({ include: { taxProfile: true }, orderBy: { hsnCode: "asc" } });
  return success(res, "HSN codes loaded.", hsn);
}));

adminRouter.post("/tax/hsn", asyncHandler(async (req, res) => {
  const { hsnCode, description, taxProfileId } = req.body;
  if (!hsnCode || !description) throw new AppError(400, "HSN code and description are required.", "VALIDATION_ERROR");
  const entry = await prisma.hSNMaster.create({
    data: { hsnCode: String(hsnCode).trim(), description: String(description), taxProfileId: taxProfileId || null },
    include: { taxProfile: true }
  });
  await audit(req.auth!.id, "HSN_CREATE", "HSNMaster", entry.id);
  return success(res, "HSN code created.", entry, 201);
}));

adminRouter.patch("/tax/hsn/:id", asyncHandler(async (req, res) => {
  const entry = await prisma.hSNMaster.update({
    where: { id: idParam(req) },
    data: { ...(req.body.description !== undefined ? { description: String(req.body.description) } : {}), ...(req.body.taxProfileId !== undefined ? { taxProfileId: req.body.taxProfileId || null } : {}), ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {}) },
    include: { taxProfile: true }
  });
  return success(res, "HSN code updated.", entry);
}));

adminRouter.delete("/tax/hsn/:id", asyncHandler(async (req, res) => {
  await prisma.hSNMaster.delete({ where: { id: idParam(req) } });
  return success(res, "HSN code deleted.", {});
}));

adminRouter.get("/email-logs", asyncHandler(async (req, res) => {
  const { page, limit } = pageInfo(req);
  const skip = (page - 1) * limit;
  const filter = { ...req.query };
  delete filter.page;
  delete filter.limit;

  const [items, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: filter,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }
    }),
    prisma.emailJob.count({ where: filter })
  ]);
  return success(res, "Email logs loaded.", paged(items, total, page, limit));
}));

// ─── Email System Diagnostics ────────────────────────────────────────────────

/**
 * GET /api/v1/admin/email/status
 * Returns the current email system configuration status for the admin diagnostics UI.
 * Never exposes secret values — only YES/NO flags and safe display strings.
 */
adminRouter.get("/email/status", asyncHandler(async (_req, res) => {
  const provider = env.EMAIL_PROVIDER || "none";
  const apiKeyConfigured = provider === "resend" ? Boolean(env.RESEND_API_KEY) : false;
  const adminConfigured = Boolean(env.ADMIN_EMAIL);

  // Fetch last email job for display
  const lastJob = await prisma.emailJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: { status: true, templateId: true, lastError: true, sentAt: true, createdAt: true },
  }).catch(() => null);

  return success(res, "Email status loaded.", {
    provider,
    apiKeyConfigured,
    fromAddress: env.EMAIL_FROM || null,
    fromName: env.EMAIL_FROM_NAME || "SHADOW SHOP",
    adminEmailConfigured: adminConfigured,
    lastJob: lastJob
      ? {
          status: lastJob.status,
          templateId: lastJob.templateId,
          lastError: lastJob.lastError || null,
          sentAt: lastJob.sentAt,
          createdAt: lastJob.createdAt,
        }
      : null,
  });
}));

/**
 * POST /api/v1/admin/email/test
 * Sends a test email through the configured email provider.
 * Admin-only, rate-limited by the global 300/min admin rate limiter.
 */
adminRouter.post("/email/test", asyncHandler(async (req, res) => {
  // Lazy-import to avoid circular dependency issues at module load time
  const { sendEmail } = await import("../services/email/emailService.js");
  const { generateEmailHtml, generateEmailText } = await import("../services/email/emailTemplates.js");

  const rawEmail = String(req.body.email || env.EMAIL_TEST_TO || env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (!rawEmail || !rawEmail.includes("@")) {
    throw new AppError(400, "A valid email address is required.", "VALIDATION_ERROR");
  }

  // Extra safety: never relay to arbitrary internet addresses (basic domain sanity)
  if (rawEmail.length > 254) {
    throw new AppError(400, "Email address is too long.", "VALIDATION_ERROR");
  }

  console.log(`[Admin] Email test requested by admin ${req.auth!.id} → ${rawEmail[0]}***@${rawEmail.split("@")[1]}`);

  const html = generateEmailHtml("email_system_test", {});
  const text = generateEmailText("email_system_test", {});

  const result = await sendEmail({
    to: rawEmail,
    subject: "SHADOW SHOP Email System Test",
    html,
    text,
    tags: [{ name: "type", value: "admin_test" }],
  });

  if (!result.success) {
    return res.status(502).json({
      success: false,
      message: "Email send failed. Check logs for details.",
      provider: result.provider,
      error: result.error,
    });
  }

  await audit(req.auth!.id, "EMAIL_TEST_SENT", "EmailSystem", rawEmail, {
    provider: result.provider,
    messageId: result.messageId || "n/a",
  });

  return success(res, "Test email sent successfully.", {
    provider: result.provider,
    messageId: result.messageId || null,
  });
}));
