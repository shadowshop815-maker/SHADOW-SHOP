import { Router, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../config/db.js";
import { env, uploadDirectory } from "../config/env.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { getProductRatingSummary, recalculateProductRating } from "../services/ratingEngine.js";

export const reviewsRouter = Router();

// Multer upload setup for customer review photos (max 5 images, max 5MB each)
const acceptedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedExts = [".jpg", ".jpeg", ".png", ".webp"];

const reviewUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, acceptedMimes.has(file.mimetype) && acceptedExts.includes(ext));
  },
});

/**
 * Anonymize customer name for public display to protect privacy.
 * e.g. "Akshay Raj" -> "Akshay R." or "Akshay Raj" (keeps first name + last initial)
 * NEVER exposes email, phone, or raw User ID.
 */
function formatCustomerDisplayName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== "string") return "Verified Customer";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Verified Customer";
  const first = parts[0] || "Customer";
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1] || "";
  const lastInitial = last && last[0] ? last[0].toUpperCase() + "." : "";
  return `${first} ${lastInitial}`.trim();
}

/**
 * Helper to resolve Product ID from slug or ID parameter.
 */
async function resolveProductId(slugOrId: string): Promise<string> {
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    select: { id: true },
  });
  if (!product) throw new AppError(404, "Product not found.", "NOT_FOUND");
  return product.id;
}

// ─── 1. Public: Rating Summary ───────────────────────────────────────────────
reviewsRouter.get(
  "/products/:slug/rating-summary",
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    const productId = await resolveProductId(slug);
    const summary = await getProductRatingSummary(productId);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=86400");
    return success(res, "Rating summary loaded.", summary);
  })
);

// ─── 2. Public: All Customer Review Photos (for Gallery & Lightbox) ─────────
reviewsRouter.get(
  "/products/:slug/review-photos",
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    const productId = await resolveProductId(slug);
    const images = await prisma.$queryRaw<
      Array<{
        id: string;
        url: string;
        reviewId: string;
        rating: number;
        title: string | null;
        comment: string | null;
        customerName: string;
        createdAt: Date;
      }>
    >`
      SELECT 
        i."id",
        i."url",
        i."reviewId",
        r."rating",
        r."title",
        r."comment",
        u."name" AS "customerName",
        i."createdAt"
      FROM "ReviewImage" i
      JOIN "ProductReview" r ON r."id" = i."reviewId"
      JOIN "User" u ON u."id" = r."customerId"
      WHERE r."productId" = ${productId} AND r."status" = 'PUBLISHED'
      ORDER BY i."createdAt" DESC
      LIMIT 100
    `;

    const mapped = (images as any[]).map((img: any) => ({
      id: img.id,
      url: img.url,
      reviewId: img.reviewId,
      rating: img.rating,
      title: img.title,
      comment: img.comment,
      author: formatCustomerDisplayName(img.customerName),
      createdAt: img.createdAt,
    }));

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=86400");
    return success(res, "Customer photos loaded.", mapped);
  })
);

// ─── 3. Public / Optional Auth: Paginated Product Reviews ────────────────────
reviewsRouter.get(
  "/products/:slug/reviews",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    const productId = await resolveProductId(slug);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const ratingFilter = req.query.rating ? Number(req.query.rating) : null;
    const verifiedOnly = req.query.verified === "true";
    const withPhotosOnly = req.query.hasPhotos === "true";
    const withTextOnly = req.query.hasText === "true";
    const sort = String(req.query.sort || "recent").toLowerCase();

    // Query published reviews with images and replies
    const reviews = await prisma.productReview.findMany({
      where: {
        productId,
        status: "PUBLISHED",
        ...(ratingFilter ? { rating: ratingFilter } : {}),
        ...(verifiedOnly ? { isVerified: true } : {}),
        ...(withTextOnly ? { comment: { not: "" } } : {}),
        ...(withPhotosOnly ? { images: { some: {} } } : {}),
      },
      include: {
        customer: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" } },
        replies: { select: { id: true, replyText: true, createdAt: true } },
      },
      orderBy:
        sort === "highest"
          ? [{ rating: "desc" }, { createdAt: "desc" }]
          : sort === "lowest"
          ? [{ rating: "asc" }, { createdAt: "desc" }]
          : sort === "helpful"
          ? [{ helpfulCount: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      skip: offset,
      take: limit,
    });

    const totalCount = await prisma.productReview.count({
      where: {
        productId,
        status: "PUBLISHED",
        ...(ratingFilter ? { rating: ratingFilter } : {}),
        ...(verifiedOnly ? { isVerified: true } : {}),
        ...(withTextOnly ? { comment: { not: "" } } : {}),
        ...(withPhotosOnly ? { images: { some: {} } } : {}),
      },
    });

    // If user is authenticated, determine their votes on these reviews
    let userVotesMap: Record<string, "HELPFUL" | "NOT_HELPFUL"> = {};
    if (req.auth?.id) {
      const reviewIds = reviews.map((r: any) => r.id);
      if (reviewIds.length > 0) {
        const votes = await prisma.reviewVote.findMany({
          where: { reviewId: { in: reviewIds }, customerId: req.auth.id },
          select: { reviewId: true, voteType: true },
        });
        for (const v of votes) {
          userVotesMap[v.reviewId] = v.voteType as "HELPFUL" | "NOT_HELPFUL";
        }
      }
    }

    const items = reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment || "",
      isVerified: r.isVerified,
      purchasedSize: r.purchasedSize,
      purchasedColor: r.purchasedColor,
      fit: r.fit,
      fabricQuality: r.fabricQuality,
      comfort: r.comfort,
      helpfulCount: r.helpfulCount,
      notHelpfulCount: r.notHelpfulCount,
      createdAt: r.createdAt,
      author: formatCustomerDisplayName(r.customer?.name),
      isOwnReview: req.auth?.id ? r.customerId === req.auth.id : false,
      userVote: userVotesMap[r.id] || null,
      images: r.images.map((img: any) => ({ id: img.id, url: img.url })),
      replies: r.replies.map((rep: any) => ({
        id: rep.id,
        text: rep.replyText,
        createdAt: rep.createdAt,
      })),
    }));

    return success(res, "Reviews loaded.", {
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  })
);

// ─── 4. Authenticated: Check Review Eligibility & Existing Review ───────────
reviewsRouter.get(
  "/products/:slug/review-eligibility",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const slug = String(req.params.slug || "");
    const productId = await resolveProductId(slug);

    // Check if customer already reviewed this product
    const existingReview = await prisma.productReview.findUnique({
      where: { productId_customerId: { productId, customerId } },
      include: { images: true },
    });

    // Check existing orders for delivered purchase of this product
    const deliveredOrder = await prisma.order.findFirst({
      where: {
        customerId,
        OR: [
          { orderStatus: "DELIVERED" },
          { deliveredAt: { not: null } },
          { items: { some: { productId, itemStatus: "DELIVERED" } } },
        ],
        items: { some: { productId } },
      },
      include: {
        items: {
          where: { productId },
          select: { id: true, selectedSize: true, selectedColor: true, deliveredAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const isEligible = Boolean(deliveredOrder);

    return success(res, "Eligibility loaded.", {
      canReview: isEligible || Boolean(existingReview),
      isDeliveredBuyer: isEligible,
      hasExistingReview: Boolean(existingReview),
      existingReview: existingReview
        ? {
            id: existingReview.id,
            rating: existingReview.rating,
            title: existingReview.title,
            comment: existingReview.comment,
            fit: existingReview.fit,
            fabricQuality: existingReview.fabricQuality,
            comfort: existingReview.comfort,
            purchasedSize: existingReview.purchasedSize,
            purchasedColor: existingReview.purchasedColor,
            images: existingReview.images.map((i: any) => ({ id: i.id, url: i.url })),
            status: existingReview.status,
            createdAt: existingReview.createdAt,
          }
        : null,
      purchasedSize: deliveredOrder?.items[0]?.selectedSize || "",
      purchasedColor: deliveredOrder?.items[0]?.selectedColor || "",
      orderId: deliveredOrder?.id || null,
      orderItemId: deliveredOrder?.items[0]?.id || null,
    });
  })
);

// ─── 5. Authenticated: Upload Review Images ─────────────────────────────────
reviewsRouter.post(
  "/reviews/upload-images",
  requireAuth,
  reviewUpload.array("images", 5),
  asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      throw new AppError(400, "Please select at least one valid image (JPEG, PNG, WebP up to 5MB).", "INVALID_UPLOAD");
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `review-${Date.now()}-${randomUUID()}${ext}`;

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { error } = await supabase.storage.from("uploads").upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
        if (error) throw new AppError(500, `Upload failed: ${error.message}`, "UPLOAD_ERROR");
        const { data } = supabase.storage.from("uploads").getPublicUrl(filename);
        uploadedUrls.push(data.publicUrl);
      } else {
        if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });
        fs.writeFileSync(path.join(uploadDirectory, filename), file.buffer);
        uploadedUrls.push(`/uploads/${filename}`);
      }
    }

    return success(res, "Images uploaded successfully.", { urls: uploadedUrls }, 201);
  })
);

// ─── 6. Authenticated: Create Product Review ────────────────────────────────
reviewsRouter.post(
  "/products/:slug/reviews",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const slug = String(req.params.slug || "");
    const productId = await resolveProductId(slug);

    // Verify customer has a delivered order for this product
    const deliveredOrder = await prisma.order.findFirst({
      where: {
        customerId,
        OR: [
          { orderStatus: "DELIVERED" },
          { deliveredAt: { not: null } },
          { items: { some: { productId, itemStatus: "DELIVERED" } } },
        ],
        items: { some: { productId } },
      },
      include: {
        items: {
          where: { productId },
          select: { id: true, selectedSize: true, selectedColor: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!deliveredOrder) {
      throw new AppError(
        403,
        "Only verified buyers who have received this product can submit a review.",
        "DELIVERY_REQUIRED"
      );
    }

    // Check if customer already reviewed this product
    const existing = await prisma.productReview.findUnique({
      where: { productId_customerId: { productId, customerId } },
    });

    if (existing) {
      throw new AppError(
        409,
        "You have already reviewed this product. You can update your existing review.",
        "DUPLICATE_REVIEW"
      );
    }

    const {
      rating,
      title,
      comment,
      images = [],
      fit,
      fabricQuality,
      comfort,
    } = req.body;

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw new AppError(400, "Star rating must be an integer between 1 and 5.", "INVALID_RATING");
    }

    const trimmedTitle = typeof title === "string" ? title.trim().slice(0, 150) : "";
    const trimmedComment = typeof comment === "string" ? comment.trim().slice(0, 3000) : "";
    const safeImages = Array.isArray(images)
      ? images.filter((img) => typeof img === "string" && img.startsWith("http")).slice(0, 5)
      : [];

    const orderItem = deliveredOrder.items[0];

    // Transactionally create review and update aggregates
    const created = await prisma.$transaction(async (tx: any) => {
      const review = await tx.productReview.create({
        data: {
          productId,
          customerId,
          orderId: deliveredOrder.id,
          orderItemId: orderItem?.id || null,
          rating: numRating,
          title: trimmedTitle || null,
          comment: trimmedComment || null,
          status: "PUBLISHED",
          isVerified: true,
          purchasedSize: orderItem?.selectedSize || null,
          purchasedColor: orderItem?.selectedColor || null,
          fit: typeof fit === "string" ? fit.slice(0, 50) : null,
          fabricQuality: typeof fabricQuality === "string" ? fabricQuality.slice(0, 50) : null,
          comfort: typeof comfort === "string" ? comfort.slice(0, 50) : null,
          images: {
            create: safeImages.map((url, idx) => ({
              url,
              sortOrder: idx,
            })),
          },
        },
        include: { images: true },
      });

      await recalculateProductRating(productId, tx);
      return review;
    });

    return success(res, "Review published successfully! Thank you for your feedback.", created, 201);
  })
);

// ─── 7. Authenticated: Update Own Review ────────────────────────────────────
reviewsRouter.put(
  "/reviews/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const reviewId = String(req.params.id || "");

    const existing = await prisma.productReview.findUnique({
      where: { id: reviewId },
      include: { images: true },
    });

    if (!existing) throw new AppError(404, "Review not found.", "NOT_FOUND");
    if (existing.customerId !== customerId) {
      throw new AppError(403, "You can only edit your own reviews.", "FORBIDDEN");
    }

    const {
      rating,
      title,
      comment,
      images,
      fit,
      fabricQuality,
      comfort,
    } = req.body;

    const numRating = rating !== undefined ? Number(rating) : existing.rating;
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw new AppError(400, "Star rating must be an integer between 1 and 5.", "INVALID_RATING");
    }

    const trimmedTitle = title !== undefined ? String(title).trim().slice(0, 150) : existing.title;
    const trimmedComment = comment !== undefined ? String(comment).trim().slice(0, 3000) : existing.comment;

    const updated = await prisma.$transaction(async (tx: any) => {
      // If images array is provided, replace images
      if (Array.isArray(images)) {
        await tx.reviewImage.deleteMany({ where: { reviewId } });
        const safeImages = images
          .filter((img) => typeof img === "string" && img.startsWith("http"))
          .slice(0, 5);

        if (safeImages.length > 0) {
          await tx.reviewImage.createMany({
            data: safeImages.map((url, idx) => ({
              reviewId,
              url,
              sortOrder: idx,
            })),
          });
        }
      }

      const review = await tx.productReview.update({
        where: { id: reviewId },
        data: {
          rating: numRating,
          title: trimmedTitle || null,
          comment: trimmedComment || null,
          fit: fit !== undefined ? (typeof fit === "string" ? fit.slice(0, 50) : null) : existing.fit,
          fabricQuality:
            fabricQuality !== undefined
              ? typeof fabricQuality === "string"
                ? fabricQuality.slice(0, 50)
                : null
              : existing.fabricQuality,
          comfort:
            comfort !== undefined
              ? typeof comfort === "string"
                ? comfort.slice(0, 50)
                : null
              : existing.comfort,
          updatedAt: new Date(),
        },
        include: { images: true },
      });

      await recalculateProductRating(existing.productId, tx);
      return review;
    });

    return success(res, "Review updated successfully.", updated);
  })
);

// ─── 8. Authenticated: Vote on Review (Helpful / Not Helpful) ───────────────
reviewsRouter.post(
  "/reviews/:id/vote",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const reviewId = String(req.params.id || "");
    const voteType = String(req.body.voteType || "").toUpperCase();

    if (voteType !== "HELPFUL" && voteType !== "NOT_HELPFUL") {
      throw new AppError(400, "Vote type must be HELPFUL or NOT_HELPFUL.", "INVALID_VOTE");
    }

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: { id: true, customerId: true, status: true },
    });

    if (!review || review.status !== "PUBLISHED") {
      throw new AppError(404, "Review not found or not published.", "NOT_FOUND");
    }

    // Customers cannot vote on their own reviews
    if (review.customerId === customerId) {
      throw new AppError(400, "You cannot vote on your own review.", "SELF_VOTE_NOT_ALLOWED");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Upsert the customer's vote
      await tx.reviewVote.upsert({
        where: { reviewId_customerId: { reviewId, customerId } },
        create: { reviewId, customerId, voteType },
        update: { voteType, updatedAt: new Date() },
      });

      // Recalculate helpful / notHelpful counts from the DB table
      const helpfulCount = await tx.reviewVote.count({
        where: { reviewId, voteType: "HELPFUL" },
      });
      const notHelpfulCount = await tx.reviewVote.count({
        where: { reviewId, voteType: "NOT_HELPFUL" },
      });

      await tx.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount, notHelpfulCount },
      });

      return { helpfulCount, notHelpfulCount, userVote: voteType };
    });

    return success(res, "Vote recorded.", result);
  })
);

// ─── 9. Authenticated: Remove Vote on Review ────────────────────────────────
reviewsRouter.delete(
  "/reviews/:id/vote",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const reviewId = String(req.params.id || "");

    const result = await prisma.$transaction(async (tx: any) => {
      await tx.reviewVote.deleteMany({
        where: { reviewId, customerId },
      });

      const helpfulCount = await tx.reviewVote.count({
        where: { reviewId, voteType: "HELPFUL" },
      });
      const notHelpfulCount = await tx.reviewVote.count({
        where: { reviewId, voteType: "NOT_HELPFUL" },
      });

      await tx.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount, notHelpfulCount },
      });

      return { helpfulCount, notHelpfulCount, userVote: null };
    });

    return success(res, "Vote removed.", result);
  })
);

// ─── 10. Authenticated: Customer My Reviews ────────────────────────────────
reviewsRouter.get(
  "/reviews/my-reviews",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;
    const reviews = await prisma.productReview.findMany({
      where: { customerId },
      include: {
        product: { select: { id: true, name: true, slug: true, thumbnail: true, price: true, salePrice: true } },
        images: { orderBy: { sortOrder: "asc" } },
        replies: { select: { id: true, replyText: true, createdAt: true } },
        order: { select: { id: true, orderNumber: true, deliveredAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = reviews.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name || "Product",
      productSlug: r.product?.slug || "",
      productThumbnail: r.product?.thumbnail || "",
      productPrice: r.product?.salePrice || r.product?.price || 0,
      rating: r.rating,
      title: r.title || "",
      comment: r.comment || "",
      status: r.status,
      isVerified: r.isVerified,
      purchasedSize: r.purchasedSize,
      purchasedColor: r.purchasedColor,
      fit: r.fit,
      fabricQuality: r.fabricQuality,
      comfort: r.comfort,
      helpfulCount: r.helpfulCount,
      notHelpfulCount: r.notHelpfulCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      images: r.images.map((img: any) => ({ id: img.id, url: img.url })),
      replies: r.replies.map((rep: any) => ({ id: rep.id, text: rep.replyText, createdAt: rep.createdAt })),
      orderNumber: r.order?.orderNumber || null,
      deliveredAt: r.order?.deliveredAt || null,
    }));

    return success(res, "My reviews loaded.", items);
  })
);

// ─── 11. Authenticated: Customer Eligible Delivered Items for Review ────────
reviewsRouter.get(
  "/reviews/my-eligible-items",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.auth!.id;

    // Find all delivered orders belonging to this customer
    const deliveredOrders = await prisma.order.findMany({
      where: {
        customerId,
        OR: [
          { orderStatus: "DELIVERED" },
          { deliveredAt: { not: null } },
          { items: { some: { itemStatus: "DELIVERED" } } },
        ],
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, thumbnail: true, price: true, salePrice: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get all existing reviews by this customer to map them
    const existingReviews = await prisma.productReview.findMany({
      where: { customerId },
      include: {
        images: true,
      },
    });
    const reviewByProductId = new Map<string, any>(existingReviews.map((r: any) => [r.productId, r]));

    // Map unique products from delivered orders
    const seenProductIds = new Set<string>();
    const eligibleItems: any[] = [];

    for (const order of deliveredOrders) {
      for (const item of order.items) {
        const isItemDelivered =
          order.orderStatus === "DELIVERED" ||
          Boolean(order.deliveredAt) ||
          item.itemStatus === "DELIVERED" ||
          Boolean(item.deliveredAt);
        if (!isItemDelivered) continue;

        if (!seenProductIds.has(item.productId)) {
          seenProductIds.add(item.productId);
          const existingRev: any = reviewByProductId.get(item.productId);

          eligibleItems.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderItemId: item.id,
            deliveredAt: item.deliveredAt || order.deliveredAt || order.updatedAt,
            productId: item.productId,
            productName: item.product?.name || item.productNameSnapshot,
            productSlug: item.product?.slug || "",
            productThumbnail: item.product?.thumbnail || item.productImageSnapshot || "",
            productPrice: item.unitPriceSnapshot,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            hasReview: Boolean(existingRev),
            review: existingRev
              ? {
                  id: existingRev.id,
                  rating: existingRev.rating,
                  title: existingRev.title || "",
                  comment: existingRev.comment || "",
                  status: existingRev.status,
                  createdAt: existingRev.createdAt,
                  images: (existingRev.images || []).map((i: any) => ({ id: i.id, url: i.url })),
                }
              : null,
          });
        }
      }
    }

    return success(res, "Eligible review items loaded.", eligibleItems);
  })
);
