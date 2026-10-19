import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { audit } from "../services/audit.js";
import { recalculateProductRating, recalculateAllProducts } from "../services/ratingEngine.js";

export const adminReviewsRouter = Router();

// Protect all admin review routes
adminReviewsRouter.use(requireAuth, requireAdmin);

// ─── 1. Admin Review Dashboard Metrics ──────────────────────────────────────
adminReviewsRouter.get(
  "/metrics",
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, published, pending, hidden, rejected] = await Promise.all([
      prisma.productReview.count(),
      prisma.productReview.count({ where: { status: "PUBLISHED" } }),
      prisma.productReview.count({ where: { status: "PENDING" } }),
      prisma.productReview.count({ where: { status: "HIDDEN" } }),
      prisma.productReview.count({ where: { status: "REJECTED" } }),
    ]);

    // Calculate store-wide average rating across all published reviews
    const avgResult: { avg: number | null }[] = await prisma.$queryRaw`
      SELECT AVG("rating") as avg FROM "ProductReview" WHERE "status" = 'PUBLISHED'
    `;
    const storeAverage = avgResult[0]?.avg ? Math.round(Number(avgResult[0].avg) * 10) / 10 : 0;

    return success(res, "Review metrics loaded.", {
      total,
      published,
      pending,
      hidden,
      rejected,
      storeAverage,
    });
  })
);

// ─── 2. Admin Reviews List (Filtered & Paginated) ───────────────────────────
adminReviewsRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const status = String(req.query.status || "").toUpperCase();
    const rating = req.query.rating ? Number(req.query.rating) : null;
    const productId = String(req.query.productId || "").trim();
    const search = String(req.query.search || "").trim();

    const where: any = {
      ...(status && status !== "ALL" ? { status: status as never } : {}),
      ...(rating ? { rating } : {}),
      ...(productId ? { productId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { comment: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { email: { contains: search, mode: "insensitive" } } },
              { product: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          images: { orderBy: { sortOrder: "asc" } },
          replies: {
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          moderationAudits: {
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.productReview.count({ where }),
    ]);

    return success(res, "Admin reviews loaded.", {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// ─── 3. Admin: Moderate Review Status (Approve / Hide / Restore / Reject) ───
adminReviewsRouter.patch(
  "/:id/status",
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.auth!.id;
    const reviewId = String(req.params.id || "");
    const { status, reason = "" } = req.body;

    const validStatuses = ["PUBLISHED", "HIDDEN", "REJECTED", "PENDING"];
    const targetStatus = String(status || "").toUpperCase();

    if (!validStatuses.includes(targetStatus)) {
      throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, "INVALID_STATUS");
    }

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true, status: true },
    });

    if (!review) throw new AppError(404, "Review not found.", "NOT_FOUND");

    const previousStatus = review.status;

    await prisma.$transaction(async (tx: any) => {
      // 1. Update review status
      await tx.productReview.update({
        where: { id: reviewId },
        data: { status: targetStatus, updatedAt: new Date() },
      });

      // 2. Record moderation audit trail
      await tx.reviewModerationAudit.create({
        data: {
          reviewId,
          adminId,
          action: targetStatus,
          reason: typeof reason === "string" ? reason.trim().slice(0, 500) : null,
        },
      });

      // 3. Recalculate product rating aggregates
      await recalculateProductRating(review.productId, tx);
    });

    await audit(adminId, "REVIEW_MODERATION", "ProductReview", reviewId, {
      fromStatus: previousStatus,
      toStatus: targetStatus,
      reason,
    });

    return success(res, `Review status updated to ${targetStatus}.`);
  })
);

// ─── 4. Admin: Add or Update Official Store Response ────────────────────────
adminReviewsRouter.post(
  "/:id/reply",
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.auth!.id;
    const reviewId = String(req.params.id || "");
    const { text } = req.body;

    const replyText = typeof text === "string" ? text.trim() : "";
    if (!replyText) {
      throw new AppError(400, "Official response text cannot be empty.", "EMPTY_REPLY");
    }

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!review) throw new AppError(404, "Review not found.", "NOT_FOUND");

    // Upsert or create reply
    const reply = await prisma.reviewReply.create({
      data: {
        reviewId,
        adminId,
        replyText: replyText.slice(0, 2000),
      },
    });

    await audit(adminId, "REVIEW_REPLY", "ProductReview", reviewId, { replyId: reply.id });

    return success(res, "Official response added.", reply, 201);
  })
);

// ─── 5. Admin: Remove Inappropriate Review Photo ────────────────────────────
adminReviewsRouter.delete(
  "/:id/images/:imageId",
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.auth!.id;
    const reviewId = String(req.params.id || "");
    const imageId = String(req.params.imageId || "");
    const { reason = "Violates media policy" } = req.body || {};

    const image = await prisma.reviewImage.findFirst({
      where: { id: imageId, reviewId },
    });

    if (!image) throw new AppError(404, "Review image not found.", "NOT_FOUND");

    await prisma.$transaction(async (tx: any) => {
      await tx.reviewImage.delete({ where: { id: imageId } });

      await tx.reviewModerationAudit.create({
        data: {
          reviewId,
          adminId,
          action: "DELETE_IMAGE",
          reason: typeof reason === "string" ? reason : "Removed by moderator",
        },
      });
    });

    await audit(adminId, "REVIEW_IMAGE_DELETE", "ReviewImage", imageId, { reviewId, reason });

    return success(res, "Review image removed by moderator.");
  })
);

// ─── 6. Admin Maintenance: Recalculate All Product Ratings ──────────────────
adminReviewsRouter.post(
  "/recalculate-all",
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.auth!.id;
    const result = await recalculateAllProducts();

    await audit(adminId, "REVIEWS_RECALCULATE_ALL", "ProductReview", "ALL", result);

    return success(res, `All product ratings recalculated successfully (${result.processed} products).`, result);
  })
);
