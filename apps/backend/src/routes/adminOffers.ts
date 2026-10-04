import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { AppError, asyncHandler, success } from "../utils/http.js";

export const adminOffersRouter = Router();

// Apply auth middleware for all routes
adminOffersRouter.use(requireAuth, requireAdmin);

const offerSchema = z.object({
  name: z.string().min(2),
  internalName: z.string().optional(),
  description: z.string().optional(),
  code: z.string().min(2),
  type: z.enum(["AUTOMATIC", "COUPON"]).default("AUTOMATIC"),
  discountType: z.enum(["FIXED", "PERCENTAGE", "FREE_DELIVERY"]).default("FIXED"),
  discountValue: z.coerce.number().nonnegative(),
  maxDiscountAmount: z.coerce.number().nullable().optional(),
  minOrderAmount: z.coerce.number().nullable().optional(),
  maxOrderAmount: z.coerce.number().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "SCHEDULED", "EXPIRED", "DISABLED"]).default("ACTIVE"),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  usageLimit: z.coerce.number().int().nullable().optional(),
  perCustomerLimit: z.coerce.number().int().nullable().optional(),
  stackable: z.boolean().default(false),
  priority: z.coerce.number().int().default(0),
  
  locationRules: z.array(z.object({
    storeId: z.string().uuid().optional(),
    radiusKm: z.coerce.number().positive(),
    enabled: z.boolean().default(true)
  })).optional(),
  
  productRules: z.array(z.object({
    productId: z.string().uuid(),
    isExclusion: z.boolean().default(false)
  })).optional(),
  
  categoryRules: z.array(z.object({
    categoryId: z.string().uuid(),
    isExclusion: z.boolean().default(false)
  })).optional(),
});

adminOffersRouter.get("/", asyncHandler(async (req, res) => {
  const offers = await prisma.offer.findMany({
    include: { locationRules: true, productRules: true, categoryRules: true, _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" }
  });
  return success(res, "Offers loaded", offers);
}));

adminOffersRouter.get("/:id", asyncHandler(async (req, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { locationRules: { include: { store: true } }, productRules: true, categoryRules: true }
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  return success(res, "Offer loaded", offer);
}));

adminOffersRouter.post("/", asyncHandler(async (req, res) => {
  const input = offerSchema.parse(req.body);
  
  let defaultStoreId = "";
  if (input.locationRules?.length) {
    let store = await prisma.store.findFirst();
    const loc = await prisma.locationSettings.findFirst();
    const locLat = loc?.latitude ?? 0;
    const locLng = loc?.longitude ?? 0;

    if (!store) {
      // FIXED: Create store with actual coordinates from LocationSettings.
      // Never create a store at (0,0) — that's null island and breaks all distance checks.
      store = await prisma.store.create({
        data: {
          name: loc?.branchName || "Main Store",
          latitude: locLat,
          longitude: locLng
        }
      });
    } else if ((store.latitude === 0 && store.longitude === 0) && (locLat !== 0 || locLng !== 0)) {
      // FIXED: If the store was previously created with 0,0 but we now have valid
      // coordinates from LocationSettings, update the store record.
      store = await prisma.store.update({
        where: { id: store.id },
        data: { latitude: locLat, longitude: locLng }
      });
    }
    defaultStoreId = store.id;
  }

  const created = await prisma.offer.create({
    data: {
      name: input.name,
      internalName: input.internalName,
      description: input.description,
      code: input.code,
      type: input.type,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      minOrderAmount: input.minOrderAmount,
      maxOrderAmount: input.maxOrderAmount,
      status: input.status,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      usageLimit: input.usageLimit,
      perCustomerLimit: input.perCustomerLimit,
      stackable: input.stackable,
      priority: input.priority,
      createdBy: req.auth!.id,
      locationRules: input.locationRules?.length ? {
        create: input.locationRules.map((r: any) => ({ storeId: r.storeId || defaultStoreId, radiusKm: r.radiusKm, enabled: r.enabled }))
      } : undefined,
      productRules: input.productRules?.length ? {
        create: input.productRules.map((r: any) => ({ productId: r.productId, isExclusion: r.isExclusion }))
      } : undefined,
      categoryRules: input.categoryRules?.length ? {
        create: input.categoryRules.map((r: any) => ({ categoryId: r.categoryId, isExclusion: r.isExclusion }))
      } : undefined,
    }
  });
  return success(res, "Offer created", created, 201);
}));

adminOffersRouter.patch("/:id", asyncHandler(async (req, res) => {
  const input = offerSchema.parse(req.body);
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  
  let defaultStoreId = "";
  if (input.locationRules?.length) {
    let store = await prisma.store.findFirst();
    const loc = await prisma.locationSettings.findFirst();
    const locLat = loc?.latitude ?? 0;
    const locLng = loc?.longitude ?? 0;

    if (!store) {
      store = await prisma.store.create({
        data: {
          name: loc?.branchName || "Main Store",
          latitude: locLat,
          longitude: locLng
        }
      });
    } else if ((store.latitude === 0 && store.longitude === 0) && (locLat !== 0 || locLng !== 0)) {
      store = await prisma.store.update({
        where: { id: store.id },
        data: { latitude: locLat, longitude: locLng }
      });
    }
    defaultStoreId = store.id;
  }

  await prisma.offerLocationRule.deleteMany({ where: { offerId: offer.id } });
  await prisma.offerProductRule.deleteMany({ where: { offerId: offer.id } });
  await prisma.offerCategoryRule.deleteMany({ where: { offerId: offer.id } });

  const updated = await prisma.offer.update({
    where: { id: offer.id },
    data: {
      name: input.name,
      internalName: input.internalName,
      description: input.description,
      code: input.code,
      type: input.type,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount,
      minOrderAmount: input.minOrderAmount,
      maxOrderAmount: input.maxOrderAmount,
      status: input.status,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      usageLimit: input.usageLimit,
      perCustomerLimit: input.perCustomerLimit,
      stackable: input.stackable,
      priority: input.priority,
      locationRules: input.locationRules?.length ? {
        create: input.locationRules.map((r: any) => ({ storeId: r.storeId || defaultStoreId, radiusKm: r.radiusKm, enabled: r.enabled }))
      } : undefined,
      productRules: input.productRules?.length ? {
        create: input.productRules.map((r: any) => ({ productId: r.productId, isExclusion: r.isExclusion }))
      } : undefined,
      categoryRules: input.categoryRules?.length ? {
        create: input.categoryRules.map((r: any) => ({ categoryId: r.categoryId, isExclusion: r.isExclusion }))
      } : undefined,
    }
  });
  return success(res, "Offer updated", updated);
}));

adminOffersRouter.post("/:id/activate", asyncHandler(async (req, res) => {
  const updated = await prisma.offer.update({ where: { id: req.params.id }, data: { status: "ACTIVE" } });
  return success(res, "Offer activated", updated);
}));

adminOffersRouter.post("/:id/pause", asyncHandler(async (req, res) => {
  const updated = await prisma.offer.update({ where: { id: req.params.id }, data: { status: "PAUSED" } });
  return success(res, "Offer paused", updated);
}));

adminOffersRouter.get("/:id/analytics", asyncHandler(async (req, res) => {
  const offerId = req.params.id;
  const redemptions = await prisma.offerRedemption.findMany({ where: { offerId }, include: { order: { select: { grandTotal: true, createdAt: true } } } });
  const totalRedemptions = redemptions.length;
  const totalDiscount = redemptions.reduce((acc: number, r: any) => acc + Number(r.actualDiscountAmount), 0);
  const totalRevenue = redemptions.reduce((acc: number, r: any) => acc + Number(r.order.grandTotal), 0);
  const avgOrderValue = totalRedemptions > 0 ? totalRevenue / totalRedemptions : 0;
  
  let distanceSum = 0;
  let distanceCount = 0;
  for (const r of redemptions) {
     if (r.actualDistanceKm != null) { distanceSum += r.actualDistanceKm; distanceCount++; }
  }
  const avgDistance = distanceCount > 0 ? distanceSum / distanceCount : null;

  return success(res, "Offer analytics", { totalRedemptions, totalDiscount, totalRevenue, avgOrderValue, avgDistance, recentRedemptions: redemptions.slice(-10) });
}));

/**
 * POST /admin/offers/stores/sync
 * Syncs the main store's coordinates from LocationSettings.
 * Run this after updating the store location in Settings → Location.
 * Also auto-runs when creating/updating location-restricted offers.
 */
adminOffersRouter.post("/stores/sync", asyncHandler(async (_req, res) => {
  const loc = await prisma.locationSettings.findFirst();
  if (!loc || (loc.latitude == null && loc.longitude == null)) {
    throw new AppError(400, "No location configured. Go to Settings → Location and set store coordinates first.", "LOCATION_NOT_SET");
  }
  const lat = loc.latitude ?? 0;
  const lng = loc.longitude ?? 0;
  if (lat === 0 && lng === 0) {
    throw new AppError(400, "Store coordinates are still (0, 0). Set valid coordinates in Settings → Location first.", "INVALID_COORDINATES");
  }

  const stores = await prisma.store.findMany();
  let updated = 0;
  for (const store of stores) {
    if (store.latitude === 0 && store.longitude === 0) {
      await prisma.store.update({
        where: { id: store.id },
        data: { latitude: lat, longitude: lng, name: loc.branchName || store.name }
      });
      updated++;
    }
  }

  return success(res, `Store sync complete. ${updated} store(s) updated with coordinates from LocationSettings.`, {
    storesUpdated: updated,
    latitude: lat,
    longitude: lng
  });
}));

/**
 * GET /admin/offers/stores
 * Returns current store records — useful for diagnosing coordinate issues.
 */
adminOffersRouter.get("/stores", asyncHandler(async (_req, res) => {
  const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" } });
  const loc = await prisma.locationSettings.findFirst();
  return success(res, "Stores loaded.", {
    stores,
    locationSettings: loc ? { latitude: loc.latitude, longitude: loc.longitude, branchName: loc.branchName } : null
  });
}));
