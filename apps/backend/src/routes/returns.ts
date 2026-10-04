import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { audit } from "../services/audit.js";
import { randomUUID } from "node:crypto";

export const returnsRouter = Router();
returnsRouter.use(requireAuth);

// Helper to determine if an item is eligible for return based on snapshot
function getReturnEligibility(item: any, serverTime: Date) {
  if (!item.deliveredAt) return { eligible: false, reason: "ORDER_NOT_DELIVERED" };
  if (!item.returnPolicySnapshot) return { eligible: false, reason: "NOT_RETURNABLE" };
  
  try {
    const policy = JSON.parse(item.returnPolicySnapshot);
    if (!policy.returnable) return { eligible: false, reason: "PRODUCT_NOT_RETURNABLE" };
    if (!item.returnDeadline) return { eligible: false, reason: "DEADLINE_MISSING" };
    
    const deadline = new Date(item.returnDeadline);
    const remainingSeconds = Math.max(0, Math.floor((deadline.getTime() - serverTime.getTime()) / 1000));
    
    if (remainingSeconds <= 0) return { eligible: false, reason: "RETURN_WINDOW_EXPIRED", deadline, remainingSeconds: 0 };
    return { eligible: true, deadline, remainingSeconds, policy };
  } catch {
    return { eligible: false, reason: "INVALID_POLICY_SNAPSHOT" };
  }
}

returnsRouter.get("/eligibility/:orderId/:itemId", asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== req.auth!.id) throw new AppError(404, "Order not found", "NOT_FOUND");
  
  const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== order.id) throw new AppError(404, "Item not found", "NOT_FOUND");
  
  const existingReturn = await prisma.returnItem.findFirst({ where: { orderItemId: item.id }, include: { returnRequest: true } });
  
  const serverTime = new Date();
  const eligibility = getReturnEligibility(item, serverTime);
  const storeSettings = await prisma.storeSettings.findFirst();
  
  return success(res, "Return eligibility loaded", {
    ...eligibility,
    serverTime,
    deliveredAt: item.deliveredAt,
    existingReturnRequest: existingReturn?.returnRequest || null,
    settings: {
      requireReturnReason: storeSettings?.requireReturnReason ?? true,
      allowReturnComment: storeSettings?.allowReturnComment ?? true,
      allowPartialReturns: storeSettings?.allowPartialReturns ?? true,
      allowedReturnResolutions: JSON.parse(storeSettings?.allowedReturnResolutions || '["REFUND", "REPLACEMENT"]')
    }
  });
}));

returnsRouter.post("/", asyncHandler(async (req, res) => {
  const { orderId, orderItemId, quantity, reason, comment, resolution, upiId, evidence } = req.body;
  
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== req.auth!.id) throw new AppError(404, "Order not found", "NOT_FOUND");
  
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item || item.orderId !== order.id) throw new AppError(404, "Item not found", "NOT_FOUND");
  
  const storeSettings = await prisma.storeSettings.findFirst();
  if (!storeSettings?.returnsEnabled) throw new AppError(403, "Returns are currently disabled.", "RETURN_DISABLED");
  
  const eligibility = getReturnEligibility(item, new Date());
  if (!eligibility.eligible) throw new AppError(400, eligibility.reason || "Not eligible", eligibility.reason || "NOT_ELIGIBLE");
  
  const existingReturn = await prisma.returnItem.findFirst({ where: { orderItemId: item.id } });
  if (existingReturn) throw new AppError(409, "A return has already been requested for this item.", "RETURN_ALREADY_REQUESTED");
  
  const returnQty = Number(quantity);
  if (isNaN(returnQty) || returnQty < 1 || returnQty > item.quantity) throw new AppError(400, "Invalid return quantity.", "INVALID_RETURN_QUANTITY");
  if (!storeSettings.allowPartialReturns && returnQty !== item.quantity) throw new AppError(400, "Partial returns are not allowed.", "INVALID_RETURN_QUANTITY");
  
  if (storeSettings.requireReturnReason && !reason) throw new AppError(400, "Return reason is required.", "RETURN_REASON_REQUIRED");
  
  const returnNumber = `RET-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  
  const ret = await prisma.$transaction(async (tx: any) => {
    const returnRequest = await tx.returnRequest.create({
      data: {
        returnNumber,
        orderId,
        reason: String(reason || "Other"),
        description: storeSettings.allowReturnComment ? String(comment || "") : "",
        evidence: Array.isArray(evidence) ? JSON.stringify(evidence) : "[]",
        resolution: String(resolution || "REFUND"),
        upiId: upiId ? String(upiId) : null,
        status: "REQUESTED",
        items: {
          create: {
            orderItemId: item.id,
            quantity: returnQty
          }
        }
      }
    });
    
    await tx.orderItem.update({ where: { id: item.id }, data: { itemStatus: "RETURN_REQUESTED" } });
    return returnRequest;
  });
  
  await audit(req.auth!.id, "RETURN_REQUESTED", "ReturnRequest", ret.id, { returnNumber, orderId, orderItemId });
  return success(res, "Return request submitted successfully.", ret, 201);
}));

returnsRouter.get("/", asyncHandler(async (req, res) => {
  const returns = await prisma.returnRequest.findMany({
    where: { order: { customerId: req.auth!.id } },
    include: { items: { include: { orderItem: true } } },
    orderBy: { createdAt: "desc" }
  });
  return success(res, "Returns loaded.", returns);
}));

returnsRouter.get("/:id", asyncHandler(async (req, res) => {
  const ret = await prisma.returnRequest.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { orderItem: true } }, order: true, refunds: true }
  });
  if (!ret || ret.order.customerId !== req.auth!.id) throw new AppError(404, "Return not found", "NOT_FOUND");
  return success(res, "Return details loaded.", ret);
}));
