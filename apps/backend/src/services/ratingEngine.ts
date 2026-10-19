import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

export interface RatingBreakdown {
  averageRating: number;
  totalRatings: number;
  verifiedBuyerRatings: number;
  ratingLabel: string;
  stars: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  starPercentages: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  totalReviewsWithText: number;
  totalReviewsWithPhotos: number;
  attributes: {
    fit: { label: string; count: number; percentage: number }[];
    fabricQuality: { label: string; count: number; percentage: number }[];
    comfort: { label: string; count: number; percentage: number }[];
  };
}

/**
 * Returns human-readable Flipkart-style rating label.
 */
export function getRatingLabel(rating: number): string {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4.0) return "Very Good";
  if (rating >= 3.0) return "Good";
  if (rating >= 2.0) return "Average";
  if (rating > 0) return "Poor";
  return "No Ratings";
}

/**
 * Atomic recalculation of a product's average rating and counts.
 * Uses Prisma $transaction or an existing transaction client.
 * ONLY PUBLISHED reviews contribute to the public rating.
 */
export async function recalculateProductRating(
  productId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ averageRating: number; ratingCount: number; reviewCount: number }> {
  // Query all published ratings for this product
  const rows: { rating: number; has_text: boolean }[] = await client.$queryRaw`
    SELECT "rating", (TRIM(COALESCE("comment", '')) != '') AS "has_text"
    FROM "ProductReview"
    WHERE "productId" = ${productId} AND "status" = 'PUBLISHED'
  `;

  const totalRatings = rows.length;
  let totalReviewTextCount = 0;
  let sum = 0;

  for (const r of rows) {
    sum += Number(r.rating);
    if (r.has_text) totalReviewTextCount++;
  }

  const rawAvg = totalRatings > 0 ? sum / totalRatings : 0;
  // Round to 1 decimal place (e.g. 4.14 -> 4.1, 4.15 -> 4.2)
  const averageRating = totalRatings > 0 ? Math.round(rawAvg * 10) / 10 : 0;

  await client.$executeRaw`
    UPDATE "Product"
    SET "averageRating" = ${averageRating},
        "ratingCount" = ${totalRatings},
        "reviewCount" = ${totalReviewTextCount},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${productId}
  `;

  return { averageRating, ratingCount: totalRatings, reviewCount: totalReviewTextCount };
}

/**
 * Generates the full rating summary and distribution for a product.
 */
export async function getProductRatingSummary(productId: string): Promise<RatingBreakdown> {
  const reviews: Array<{
    rating: number;
    isVerified: boolean;
    comment: string | null;
    fit: string | null;
    fabricQuality: string | null;
    comfort: string | null;
    photo_count: bigint;
  }> = await prisma.$queryRaw`
    SELECT 
      r."rating",
      r."isVerified",
      r."comment",
      r."fit",
      r."fabricQuality",
      r."comfort",
      COUNT(i."id") AS "photo_count"
    FROM "ProductReview" r
    LEFT JOIN "ReviewImage" i ON i."reviewId" = r."id"
    WHERE r."productId" = ${productId} AND r."status" = 'PUBLISHED'
    GROUP BY r."id"
  `;

  const total = reviews.length;
  const stars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let verifiedCount = 0;
  let withText = 0;
  let withPhotos = 0;
  let sum = 0;

  const fitCounts: Record<string, number> = {};
  const fabricCounts: Record<string, number> = {};
  const comfortCounts: Record<string, number> = {};

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    stars[star] = (stars[star] || 0) + 1;
    sum += Number(r.rating);

    if (r.isVerified) verifiedCount++;
    if (r.comment && r.comment.trim().length > 0) withText++;
    if (Number(r.photo_count) > 0) withPhotos++;

    if (r.fit) fitCounts[r.fit] = (fitCounts[r.fit] || 0) + 1;
    if (r.fabricQuality) fabricCounts[r.fabricQuality] = (fabricCounts[r.fabricQuality] || 0) + 1;
    if (r.comfort) comfortCounts[r.comfort] = (comfortCounts[r.comfort] || 0) + 1;
  }

  const rawAvg = total > 0 ? sum / total : 0;
  const averageRating = total > 0 ? Math.round(rawAvg * 10) / 10 : 0;

  const starPercentages = {
    5: total > 0 ? Math.round((stars[5] / total) * 100) : 0,
    4: total > 0 ? Math.round((stars[4] / total) * 100) : 0,
    3: total > 0 ? Math.round((stars[3] / total) * 100) : 0,
    2: total > 0 ? Math.round((stars[2] / total) * 100) : 0,
    1: total > 0 ? Math.round((stars[1] / total) * 100) : 0,
  };

  const toPercentList = (dict: Record<string, number>) =>
    Object.entries(dict)
      .map(([label, count]) => ({
        label: formatAttributeLabel(label),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

  return {
    averageRating,
    totalRatings: total,
    verifiedBuyerRatings: verifiedCount,
    ratingLabel: getRatingLabel(averageRating),
    stars,
    starPercentages,
    totalReviewsWithText: withText,
    totalReviewsWithPhotos: withPhotos,
    attributes: {
      fit: toPercentList(fitCounts),
      fabricQuality: toPercentList(fabricCounts),
      comfort: toPercentList(comfortCounts),
    },
  };
}

function formatAttributeLabel(key: string): string {
  return key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Maintenance helper: recalculates all product rating aggregates.
 */
export async function recalculateAllProducts(): Promise<{ processed: number }> {
  const products: { id: string }[] = await prisma.$queryRaw`
    SELECT "id" FROM "Product"
  `;

  for (const p of products) {
    await recalculateProductRating(p.id);
  }

  return { processed: products.length };
}
