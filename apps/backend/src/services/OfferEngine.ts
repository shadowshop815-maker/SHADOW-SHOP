import { prisma } from "../config/db.js";
import { DistanceService } from "./DistanceService.js";


export interface CartContext {
  userId?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    product: any;
  }[];
  subtotal: number;
}

export interface EligibilityResult {
  eligible: boolean;
  code?: string;
  message?: string;
  discountAmount?: number;
  distanceKm?: number;
  offerId?: string;
  offerCode?: string;
  offerName?: string;
  storeId?: string;
  maximumDistanceKm?: number;
  discountType?: string;
  discountValue?: number;
}

export class OfferEngine {
  /**
   * Evaluates if a given offer is applicable to the current cart context.
   * This is the AUTHORITATIVE server-side validation. Never trust client-side distance.
   */
  static async evaluateOffer(offerCode: string, context: CartContext): Promise<EligibilityResult> {
    const offer = await (prisma as any).offer.findFirst({
      where: { code: { equals: offerCode, mode: 'insensitive' } },
      include: {
        locationRules: { include: { store: true } },
        productRules: true,
        categoryRules: true,
      }
    });

    if (!offer) return { eligible: false, code: "OFFER_NOT_FOUND", message: "Offer not found." };
    if (offer.status !== "ACTIVE") return { eligible: false, code: "OFFER_INACTIVE", message: "Offer is not active." };

    // FIXED: Strict date validation with no grace period.
    // The offer must be active RIGHT NOW — no buffer of any kind.
    const now = new Date();
    if (offer.startsAt && now < offer.startsAt) {
      return { eligible: false, code: "OFFER_NOT_STARTED", message: "Offer has not started yet." };
    }
    if (offer.endsAt && now > offer.endsAt) {
      return { eligible: false, code: "OFFER_EXPIRED", message: "Offer has expired." };
    }

    if (offer.minOrderAmount && context.subtotal < Number(offer.minOrderAmount)) {
      return { eligible: false, code: "MINIMUM_ORDER_NOT_MET", message: `Minimum order amount of ₹${offer.minOrderAmount} not met.` };
    }
    if (offer.maxOrderAmount && context.subtotal > Number(offer.maxOrderAmount)) {
      return { eligible: false, code: "MAXIMUM_ORDER_EXCEEDED", message: `Maximum order amount exceeded.` };
    }

    if (offer.usageLimit) {
      const globalCount = await (prisma as any).offerRedemption.count({ where: { offerId: offer.id } });
      if (globalCount >= offer.usageLimit) {
        return { eligible: false, code: "USAGE_LIMIT_REACHED", message: "Offer usage limit reached." };
      }
    }

    if (offer.perCustomerLimit && context.userId) {
      const userCount = await (prisma as any).offerRedemption.count({ where: { offerId: offer.id, userId: context.userId } });
      if (userCount >= offer.perCustomerLimit) {
        return { eligible: false, code: "CUSTOMER_USAGE_LIMIT_REACHED", message: "You have already used this offer." };
      }
    }

    // FIXED: Fetch full product data for items that are missing it.
    // This is needed when the checkout path passes product: null.
    const itemsWithProducts = await Promise.all(
      context.items.map(async (item) => {
        if (item.product && item.product.categories != null) return item;
        // Fetch the product + categories if missing
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { categories: true }
        });
        return { ...item, product };
      })
    );

    // Determine eligible items in cart based on product and category rules
    let eligibleSubtotal = 0;
    const hasProductRules = offer.productRules.length > 0;
    const hasCategoryRules = offer.categoryRules.length > 0;

    const eligibleItems = itemsWithProducts.filter(item => {
      // 1. Check Product Exclusions
      const prodRule = offer.productRules.find((pr: any) => pr.productId === item.productId);
      if (prodRule?.isExclusion) return false;

      // 2. Check Category Exclusions
      const productCategoryIds = item.product?.categories?.map((c: any) => c.id) || [];
      const hasCategoryExclusion = offer.categoryRules.some((cr: any) => cr.isExclusion && productCategoryIds.includes(cr.categoryId));
      if (hasCategoryExclusion) return false;

      // 3. Check Inclusions — only if there ARE inclusion rules
      const hasProductInclusions = offer.productRules.some((pr: any) => !pr.isExclusion);
      const hasCategoryInclusions = offer.categoryRules.some((cr: any) => !cr.isExclusion);

      // If there are specific inclusions, the item MUST match at least one
      if (hasProductInclusions || hasCategoryInclusions) {
        let matchesProduct = false;
        let matchesCategory = false;

        if (hasProductInclusions && prodRule && !prodRule.isExclusion) {
          matchesProduct = true;
        }

        if (hasCategoryInclusions) {
          matchesCategory = offer.categoryRules.some((cr: any) => !cr.isExclusion && productCategoryIds.includes(cr.categoryId));
        }

        if (!matchesProduct && !matchesCategory) return false;
      }

      return true;
    });

    // FIXED: Only reject on no-eligible-items if there were actual product/category rules.
    // If no product/category rules exist, all items in the cart are eligible.
    if ((hasProductRules || hasCategoryRules) && eligibleItems.length === 0 && context.items.length > 0) {
      return { eligible: false, code: "PRODUCT_NOT_ELIGIBLE", message: "No eligible products in cart for this offer." };
    }

    const effectiveItems = (hasProductRules || hasCategoryRules) ? eligibleItems : itemsWithProducts;
    for (const item of effectiveItems) {
      eligibleSubtotal += item.unitPrice * item.quantity;
    }

    // ─── Location Rules ──────────────────────────────────────────────────────
    // AUTHORITATIVE: The server always calculates distance. Never trust the client.
    let distanceKm: number | undefined;
    let storeId: string | undefined;
    let maximumDistanceKm: number | undefined;

    if (offer.locationRules.length > 0) {
      const activeLocRules = offer.locationRules.filter((r: any) => r.enabled && r.store.active);
      if (activeLocRules.length === 0) {
        return { eligible: false, code: "NO_ACTIVE_STORES", message: "No active stores for this offer." };
      }

      // FIXED: Validate store coordinates upfront. A store at (0,0) is invalid (null island).
      // Do NOT silently patch store coordinates here — that corrupts the data model.
      // Instead, skip rules for stores with invalid coordinates.
      const validLocRules = activeLocRules.filter((r: any) => {
        const hasValidCoords = r.store.latitude !== 0 || r.store.longitude !== 0;
        if (!hasValidCoords) {
          console.warn(`[OfferEngine] Store "${r.store.name}" (${r.store.id}) has invalid coordinates (0,0). Fix via Admin → Settings → Location.`);
        }
        return hasValidCoords;
      });

      if (validLocRules.length === 0) {
        return {
          eligible: false,
          code: "STORE_COORDINATES_INVALID",
          message: "Offer location is not configured correctly. Please contact support."
        };
      }

      // Resolve delivery coordinates. Priority:
      // 1. Explicit lat/lng passed in context (from browser, already sent to backend via apply-offer)
      // 2. Saved address coordinates (if addressId provided)
      let lat = context.latitude;
      let lng = context.longitude;

      if ((lat == null || lng == null) && context.addressId) {
        const address = await prisma.address.findUnique({ where: { id: context.addressId } });
        if (address && address.latitude != null && address.longitude != null) {
          lat = address.latitude;
          lng = address.longitude;
        }
      }

      if (lat == null || lng == null) {
        return {
          eligible: false,
          code: "ADDRESS_REQUIRED",
          message: "Select your delivery location to check this offer.",
          maximumDistanceKm: validLocRules[0].radiusKm
        };
      }

      // Check if delivery location is within radius of any active store
      let closestValidRule: typeof validLocRules[0] | null = null;
      let minDistance = Infinity;

      for (const rule of validLocRules) {
        const d = await DistanceService.calculateDistanceKm(lat, lng, rule.store.latitude, rule.store.longitude);
        if (d <= rule.radiusKm && d < minDistance) {
          minDistance = d;
          closestValidRule = rule;
        }
      }

      if (!closestValidRule) {
        // Find nearest distance for a helpful error message
        let nearestDist = Infinity;
        let allowedDist = validLocRules[0].radiusKm;
        for (const rule of validLocRules) {
          const d = await DistanceService.calculateDistanceKm(lat!, lng!, rule.store.latitude, rule.store.longitude);
          if (d < nearestDist) {
            nearestDist = d;
            allowedDist = rule.radiusKm;
          }
        }
        return {
          eligible: false,
          code: "OUTSIDE_OFFER_RADIUS",
          message: `This offer is available within ${allowedDist} KM. Your selected delivery address is ${nearestDist.toFixed(1)} KM away.`,
          distanceKm: nearestDist,
          maximumDistanceKm: allowedDist
        };
      }

      distanceKm = minDistance;
      storeId = closestValidRule.storeId;
      maximumDistanceKm = closestValidRule.radiusKm;
    }

    // ─── Calculate Discount ───────────────────────────────────────────────────
    let discountAmount = 0;
    if (offer.discountType === "FIXED") {
      discountAmount = Number(offer.discountValue);
      if (discountAmount > eligibleSubtotal) discountAmount = eligibleSubtotal;
    } else if (offer.discountType === "PERCENTAGE") {
      discountAmount = (eligibleSubtotal * Number(offer.discountValue)) / 100;
      if (offer.maxDiscountAmount && discountAmount > Number(offer.maxDiscountAmount)) {
        discountAmount = Number(offer.maxDiscountAmount);
      }
    } else if (offer.discountType === "FREE_DELIVERY") {
      discountAmount = 0; // Shipping handled separately
    }

    return {
      eligible: true,
      offerId: offer.id,
      offerCode: offer.code,
      offerName: offer.name,
      discountAmount,
      distanceKm,
      maximumDistanceKm,
      storeId,
      discountType: offer.discountType,
      discountValue: Number(offer.discountValue)
    };
  }


  /**
   * Returns ALL customer-visible active offers, each annotated with eligibility.
   *
   * KEY RULE: Offers are VISIBLE even when ineligible.
   * Ineligible offers show the reason (outside radius, min not met, etc.).
   * Only truly invisible states (inactive, archived) are filtered.
   *
   * PERF: Runs all eligibility checks in parallel via Promise.all.
   * Pre-fetches address coordinates once instead of per-offer.
   */
  static async findAvailableOffers(context: CartContext) {
    // Fetch all active offers in one query with all relations needed
    const offers = await (prisma as any).offer.findMany({
      where: { status: "ACTIVE" },
      include: {
        locationRules: { include: { store: true } },
        productRules: true,
        categoryRules: true
      },
      orderBy: { createdAt: "desc" }
    });

    if (offers.length === 0) return [];

    // Pre-fetch address coords once — avoids N address DB lookups in evaluateOffer
    let resolvedLat = context.latitude;
    let resolvedLng = context.longitude;
    if ((resolvedLat == null || resolvedLng == null) && context.addressId) {
      const addr = await prisma.address.findUnique({ where: { id: context.addressId } });
      if (addr?.latitude != null && addr?.longitude != null) {
        resolvedLat = addr.latitude;
        resolvedLng = addr.longitude;
      }
    }

    // Enrich context with resolved coordinates so evaluateOffer doesn't re-fetch
    const enrichedContext: CartContext = {
      ...context,
      latitude: resolvedLat,
      longitude: resolvedLng
    };

    // PERF: Evaluate all offers in parallel
    const results = await Promise.all(
      offers.map(async (o: any) => {
        const res = await this.evaluateOffer(o.code, enrichedContext);
        const radiusKm = o.locationRules?.[0]?.radiusKm ?? null;
        return {
          id: o.id,
          name: o.name,
          code: o.code,
          description: o.description,
          discountType: o.discountType,
          discountValue: Number(o.discountValue),
          maxDiscountAmount: o.maxDiscountAmount ? Number(o.maxDiscountAmount) : null,
          minOrderAmount: o.minOrderAmount ? Number(o.minOrderAmount) : null,
          maxOrderAmount: o.maxOrderAmount ? Number(o.maxOrderAmount) : null,
          usageLimit: o.usageLimit,
          perCustomerLimit: o.perCustomerLimit,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          status: o.status,
          radiusKm,
          priority: o.priority ?? 0,
          eligibility: res
        };
      })
    );

    // Sort: eligible first, then by priority/discount
    results.sort((a: any, b: any) => {
      if (a.eligibility.eligible && !b.eligibility.eligible) return -1;
      if (!a.eligibility.eligible && b.eligibility.eligible) return 1;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    return results;
  }
}

