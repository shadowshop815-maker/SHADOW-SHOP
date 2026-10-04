import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { audit } from "../services/audit.js";
import { enqueueEmailJob } from "../services/email/dispatcher.js";

export const adminReturnsRouter = Router();
adminReturnsRouter.use(requireAuth, requireAdmin);

const pageInfo = (req: any, max = 100) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(max, Math.max(1, Number(req.query.limit) || 20)) });
const paged = <T>(items: T[], total: number, page: number, limit: number) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });

adminReturnsRouter.get("/", asyncHandler(async (req, res) => {
  const { page, limit } = pageInfo(req);
  const status = String(req.query.status || "");
  const search = String(req.query.search || "");
  
  const where: Prisma.ReturnRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { returnNumber: { contains: search } } : {})
  };
  
  const [items, total] = await prisma.$transaction([
    prisma.returnRequest.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, customer: { select: { name: true, email: true } } } },
        items: { include: { orderItem: { include: { product: { select: { name: true } } } } } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.returnRequest.count({ where })
  ]);
  
  return success(res, "Returns loaded.", paged(items, total, page, limit));
}));

adminReturnsRouter.get("/:id", asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: {
      order: { select: { orderNumber: true, customer: { select: { name: true, email: true, phone: true } } } },
      items: { include: { orderItem: { include: { product: true } } } },
      refunds: true
    }
  });
  if (!ret) throw new AppError(404, "Return not found", "NOT_FOUND");
  return success(res, "Return details loaded", ret);
}));

adminReturnsRouter.patch("/:id/status", asyncHandler(async (req, res) => {
  const next = String(req.body.status || "");
  const adminResponse = req.body.adminResponse === undefined ? undefined : String(req.body.adminResponse);
  
  const ret = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
  if (!ret) throw new AppError(404, "Return not found", "NOT_FOUND");
  
  // Basic sanity validation
  const validTransitions: Record<string, string[]> = {
    "RETURN_REQUESTED": ["RETURN_APPROVED", "RETURN_REJECTED"],
    "RETURN_APPROVED": ["PICKUP_SCHEDULED", "RETURN_CANCELLED"],
    "PICKUP_SCHEDULED": ["PICKED_UP"],
    "PICKED_UP": ["RETURN_RECEIVED"],
    "RETURN_RECEIVED": ["INSPECTION_IN_PROGRESS"],
    "INSPECTION_IN_PROGRESS": ["INSPECTION_COMPLETED", "RETURN_REJECTED", "MANUAL_REVIEW"],
    "INSPECTION_COMPLETED": ["REFUND_INITIATED"],
    "REFUND_INITIATED": ["REFUND_COMPLETED", "REFUND_FAILED"]
  };
  
  if (ret.status !== next && !validTransitions[ret.status]?.includes(next)) {
    throw new AppError(409, `Cannot transition return from ${ret.status} to ${next}`, "INVALID_STATUS_TRANSITION");
  }
  
  const updated = await prisma.$transaction(async (tx: any) => {
    const updatedRet = await tx.returnRequest.update({
      where: { id: ret.id },
      data: {
        status: next,
        ...(adminResponse !== undefined ? { adminResponse } : {})
      }
    });

    await tx.returnStatusHistory.create({
      data: {
        returnRequestId: ret.id,
        status: next,
        actorType: "ADMIN",
        actorId: req.auth!.id,
        note: adminResponse
      }
    });

    const orderStatusMap: Record<string, string> = { 
      RETURN_APPROVED: "RETURN_APPROVED", 
      RETURN_REJECTED: "RETURN_REJECTED", 
      PICKUP_SCHEDULED: "RETURN_PICKUP_PENDING", 
      PICKED_UP: "RETURN_PICKED_UP", 
      RETURN_RECEIVED: "RETURN_RECEIVED", 
      REFUND_INITIATED: "REFUND_PENDING", 
      REFUND_COMPLETED: "REFUNDED" 
    };
    if (orderStatusMap[next]) {
      await tx.order.update({ where: { id: ret.orderId }, data: { orderStatus: orderStatusMap[next] as never } });
    }

    if (next === "RETURN_RECEIVED" && req.body.restoreStock === true) {
      const items = await tx.returnItem.findMany({ where: { returnRequestId: ret.id }, include: { orderItem: true } });
      for (const entry of items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: entry.orderItem.productId } });
        const after = product.stock + entry.quantity;
        await tx.product.update({ where: { id: product.id }, data: { stock: after, ...(product.status === "OUT_OF_STOCK" ? { status: "ACTIVE" } : {}) } });
        await tx.inventoryMovement.create({ data: { productId: product.id, type: "RETURN", quantity: entry.quantity, before: product.stock, after, reason: "Accepted returned stock", reference: ret.returnNumber } });
      }
    }
    
    // Auto-update orderItem status for simple tracking
    if (["RETURN_APPROVED", "RETURN_REJECTED", "RETURN_RECEIVED", "REFUND_COMPLETED"].includes(next)) {
      const items = await tx.returnItem.findMany({ where: { returnRequestId: ret.id } });
      for (const item of items) {
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { itemStatus: next }
        });
      }
    }

    if (next === "REFUND_INITIATED") {
      const items = await tx.returnItem.findMany({ where: { returnRequestId: ret.id }, include: { orderItem: true } });
      let refundAmount = 0;
      for (const item of items) {
        // Use finalLineAmount (which includes all pro-rated discounts and GST) divided by purchased qty to get exact unit refund
        const unitPrice = item.orderItem.finalLineAmount / item.orderItem.quantity;
        refundAmount += unitPrice * item.quantity;
      }
      
      const existingRefund = await tx.refund.findFirst({ where: { returnRequestId: ret.id } });
      if (!existingRefund) {
        await tx.refund.create({
          data: {
            orderId: ret.orderId,
            returnRequestId: ret.id,
            amount: refundAmount,
            status: "PENDING",
            notes: "Auto-generated for exact prorated return amount"
          }
        });
      }
    }

    if (next === "REFUND_COMPLETED") {
      await tx.refund.updateMany({
        where: { returnRequestId: ret.id, status: "PENDING" },
        data: { status: "COMPLETED" }
      });
    }
    
    // Enqueue emails for return flow — deterministic keys prevent duplicate sends
    const orderForEmail = await tx.order.findUnique({ where: { id: ret.orderId }, include: { customer: true } });
    if (orderForEmail) {
      const toEmail = orderForEmail.guestEmail || orderForEmail.customer?.email;
      if (toEmail) {
        const emailPayload = {
          ...updatedRet,
          orderNumber: orderForEmail.orderNumber,
          customerName: orderForEmail.guestName || orderForEmail.customer?.name || "Customer",
          orderId: ret.orderId,
        };
        const iKey = (event: string) => `${event}_${ret.id}`;

        if (next === "RETURN_APPROVED")    await enqueueEmailJob(tx, "RETURN_APPROVED",          toEmail, "return_approved",          emailPayload, iKey("RETURN_APPROVED"));
        if (next === "RETURN_REJECTED")    await enqueueEmailJob(tx, "RETURN_REJECTED",          toEmail, "return_rejected",          emailPayload, iKey("RETURN_REJECTED"));
        if (next === "PICKUP_SCHEDULED")   await enqueueEmailJob(tx, "PICKUP_SCHEDULED",         toEmail, "return_pickup_scheduled",  emailPayload, iKey("PICKUP_SCHEDULED"));
        if (next === "PICKED_UP")          await enqueueEmailJob(tx, "PICKED_UP",                toEmail, "return_picked_up",         emailPayload, iKey("PICKED_UP"));
        if (next === "RETURN_RECEIVED")    await enqueueEmailJob(tx, "RETURN_RECEIVED",          toEmail, "return_received",          emailPayload, iKey("RETURN_RECEIVED"));
        if (next === "REFUND_INITIATED")   await enqueueEmailJob(tx, "REFUND_INITIATED",         toEmail, "refund_initiated",         emailPayload, iKey("REFUND_INITIATED"));
        if (next === "REFUND_COMPLETED")   await enqueueEmailJob(tx, "REFUND_COMPLETED",         toEmail, "return_refund_completed",  emailPayload, iKey("REFUND_COMPLETED"));
      }
    }

    return updatedRet;
  });
  
  await audit(req.auth!.id, "RETURN_STATUS_CHANGE", "ReturnRequest", ret.id, { from: ret.status, to: next, adminResponse });
  return success(res, "Return status updated", updated);
}));

// Admin endpoint to manually extend or change deadline
adminReturnsRouter.post("/:id/override", asyncHandler(async (req, res) => {
  const { orderItemId, extendMinutes, newDeadline, reason } = req.body;
  
  if (!reason) throw new AppError(400, "Reason is required for override", "VALIDATION_ERROR");
  
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) throw new AppError(404, "Order item not found", "NOT_FOUND");
  
  let targetDeadline: Date;
  if (extendMinutes) {
    targetDeadline = item.returnDeadline ? new Date(item.returnDeadline.getTime() + Number(extendMinutes) * 60000) : new Date(Date.now() + Number(extendMinutes) * 60000);
  } else if (newDeadline) {
    targetDeadline = new Date(newDeadline);
  } else {
    throw new AppError(400, "Must provide extendMinutes or newDeadline", "VALIDATION_ERROR");
  }
  
  const updated = await prisma.orderItem.update({
    where: { id: item.id },
    data: { returnDeadline: targetDeadline }
  });
  
  await audit(req.auth!.id, "RETURN_DEADLINE_OVERRIDE", "OrderItem", item.id, { oldDeadline: item.returnDeadline, newDeadline: targetDeadline, reason });
  return success(res, "Return deadline updated", updated);
}));
