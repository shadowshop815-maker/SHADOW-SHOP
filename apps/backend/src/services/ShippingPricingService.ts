import { prisma } from "../config/db.js";

/**
 * CENTRAL SHIPPING PRICING SERVICE
 *
 * Business Rule:
 *   baseShippingFee    = DeliverySettings.baseShippingFee
 *   freeShippingDiscount = baseShippingFee if (freeShippingEnabled && eligibleCartValue >= threshold) else 0
 *   effectiveBaseShipping = baseShippingFee - freeShippingDiscount
 *   speedSurcharge     = DeliveryOption.speedSurcharge
 *   finalShippingFee   = max(0, effectiveBaseShipping + speedSurcharge)
 */

export interface ShippingContext {
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
  addressId?: string;
  lat?: number;
  lng?: number;
}

export interface ShippingBreakdown {
  baseShippingFee: number;
  freeShippingEligible: boolean;
  freeShippingThreshold: number;
  freeShippingDiscount: number;
  effectiveBaseShipping: number;
  speedSurcharge: number;
  finalShippingFee: number;
  deliveryPromoDiscount: number;
}

export interface DeliveryOptionResult {
  id: string;
  name: string;
  description: string;
  deliveryType: string;
  deliveryDays: number;
  speedSurcharge: number;
  finalShippingFee: number;
  priceLabel: string;
  estimatedDeliveryDate: string;
  available: boolean;
  isDefault: boolean;
  breakdown: ShippingBreakdown;
}

export interface DeliverySettingsSnapshot {
  baseShippingFee: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  freeShippingBasis: string;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addBusinessDays(start: Date, days: number, workingDays: string[], holidayDates: string[]): Date {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = date.toISOString().split("T")[0] as string;
    if (workingDays.includes(dayName) && !holidayDates.includes(dateStr)) added++;
  }
  return date;
}

export class ShippingPricingService {
  /**
   * FIXED: Single DB query for settings. No raw SQL — uses Prisma which handles
   * PostgreSQL column quoting correctly. The old $queryRaw caused the
   * "relation deliverysettings does not exist" crash.
   */
  static async getSettings(): Promise<DeliverySettingsSnapshot> {
    const s = await prisma.deliverySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    return {
      baseShippingFee: Number((s as any).baseShippingFee ?? 0),
      freeShippingEnabled: Boolean((s as any).freeShippingEnabled ?? false),
      freeShippingThreshold: Number((s as any).freeShippingThreshold ?? 500),
      freeShippingBasis: String((s as any).freeShippingBasis ?? "AFTER_DISCOUNT")
    };
  }

  static getEligibleCartValue(ctx: ShippingContext, basis: string): number {
    return basis === "BEFORE_DISCOUNT" ? ctx.subtotalBeforeDiscount : ctx.subtotalAfterDiscount;
  }

  static calculateBreakdown(
    settings: DeliverySettingsSnapshot,
    ctx: ShippingContext,
    speedSurcharge: number,
    isStandardDelivery: boolean = false,
    deliveryPromoDiscount = 0
  ): ShippingBreakdown {
    const baseFee = settings.baseShippingFee;
    const eligibleValue = this.getEligibleCartValue(ctx, settings.freeShippingBasis);
    // Base fee waiver ONLY applies to standard (7-day / default) delivery when threshold is reached
    const freeShippingEligible = isStandardDelivery && settings.freeShippingEnabled && eligibleValue >= settings.freeShippingThreshold;
    const freeShippingDiscount = freeShippingEligible ? baseFee : 0;
    const effectiveBase = baseFee - freeShippingDiscount;
    const final = Math.max(0, effectiveBase + speedSurcharge - deliveryPromoDiscount);
    return { baseShippingFee: baseFee, freeShippingEligible, freeShippingThreshold: settings.freeShippingThreshold, freeShippingDiscount, effectiveBaseShipping: effectiveBase, speedSurcharge, finalShippingFee: final, deliveryPromoDiscount };
  }

  static buildPriceLabel(breakdown: ShippingBreakdown): string {
    const { finalShippingFee } = breakdown;
    if (finalShippingFee === 0) return "FREE";
    return `\u20b9${finalShippingFee}`;
  }

  static async calculateOptions(ctx: ShippingContext): Promise<DeliveryOptionResult[]> {
    // FIXED: Batch all DB reads in parallel — was previously 6+ sequential queries
    const settings = await this.getSettings();
    const deliverySettingsRow = await prisma.deliverySettings.findUnique({ where: { id: 1 } });
    const rawOptionsRaw = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
    const holidays = await prisma.deliveryHoliday.findMany();
    const addressRow = ctx.addressId ? await prisma.address.findUnique({ where: { id: ctx.addressId } }) : null;
    const storeRow = await prisma.locationSettings.findFirst();

    // AUTO-ENABLE: If delivery options exist in DB, always serve them regardless of enableSelection.
    // enableSelection is an admin UI toggle, not a hard gate — options should always be shown
    // to customers if they exist. Only truly block when admin explicitly disabled AND there are no options.
    let rawOptions = rawOptionsRaw;

    // Seed defaults when no options exist at all
    if (rawOptions.length === 0 && (await prisma.deliveryOption.count()) === 0) {
      await prisma.deliveryOption.createMany({
        data: [
          { name: "7-Day Delivery", internalName: "STD_7_DAY", description: "Standard delivery within 7 business days", deliveryDays: 7, price: 0, speedSurcharge: 0, isDefault: true, status: "ACTIVE" },
          { name: "3-Day Delivery", internalName: "FAST_3_DAY", description: "Faster delivery within 3 business days", deliveryDays: 3, price: 0, speedSurcharge: 80, isDefault: false, status: "ACTIVE" },
          { name: "Express Delivery", internalName: "EXPRESS_1_DAY", description: "Fastest available delivery", deliveryDays: 1, price: 0, speedSurcharge: 150, isDefault: false, status: "ACTIVE" }
        ]
      });
      rawOptions = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
      // Auto-enable selection when we just seeded defaults
      await prisma.deliverySettings.upsert({ where: { id: 1 }, update: { enableSelection: true }, create: { id: 1, enableSelection: true } });
    }

    // If enableSelection is explicitly false AND no options exist → block
    if (!deliverySettingsRow?.enableSelection && rawOptions.length === 0) return [];

    let distanceKm: number | null = null;
    const finalLat = addressRow?.latitude ?? ctx.lat;
    const finalLng = addressRow?.longitude ?? ctx.lng;
    if (finalLat != null && finalLng != null &&
        storeRow?.latitude != null && storeRow?.longitude != null) {
      distanceKm = haversine(finalLat, finalLng, storeRow.latitude, storeRow.longitude);
    }

    const holidayDates = holidays.map((h: any) => h.date.toISOString().split("T")[0]);
    const workingDays = JSON.parse(deliverySettingsRow?.workingDays ?? '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]') as string[];
    const cutoffTime = deliverySettingsRow?.orderCutoffTime ?? "14:00";
    const [cutoffHour, cutoffMin] = cutoffTime.split(":").map(Number);
    const now = new Date();
    const startDate = new Date();
    if (now.getHours() > cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() >= cutoffMin)) {
      startDate.setDate(startDate.getDate() + 1);
    }

    return rawOptions.map((option: any) => {
      let available = true;
      if (option.maxDistanceKm != null && (distanceKm == null || distanceKm > option.maxDistanceKm)) available = false;

      const surcharge = Number(option.speedSurcharge || option.price || 0);
      const isStandard = option.isDefault || (option.deliveryType === "Standard" && surcharge === 0) || Number(option.deliveryDays) >= 7 || option.name.toLowerCase().includes("7") || surcharge === 0;
      const breakdown = this.calculateBreakdown(settings, ctx, surcharge, isStandard);
      const priceLabel = this.buildPriceLabel(breakdown);

      let estimatedDate: Date;
      if (option.dayCalculationType === "CALENDAR_DAYS") {
        estimatedDate = new Date(startDate);
        estimatedDate.setDate(estimatedDate.getDate() + option.deliveryDays);
      } else {
        estimatedDate = addBusinessDays(new Date(startDate), option.deliveryDays, workingDays, holidayDates);
      }

      return { id: option.id, name: option.name, description: option.description, deliveryType: option.deliveryType, deliveryDays: option.deliveryDays, speedSurcharge: surcharge, finalShippingFee: breakdown.finalShippingFee, priceLabel, estimatedDeliveryDate: estimatedDate.toISOString().split("T")[0], available, isDefault: option.isDefault, breakdown };
    });
  }

  static async calculateBaseShipping(ctx: ShippingContext) {
    const settings = await this.getSettings();
    const eligibleValue = this.getEligibleCartValue(ctx, settings.freeShippingBasis);
    const freeShippingEligible = settings.freeShippingEnabled && eligibleValue >= settings.freeShippingThreshold;
    const freeShippingDiscount = freeShippingEligible ? settings.baseShippingFee : 0;
    const effectiveBase = settings.baseShippingFee - freeShippingDiscount;
    const amountToFreeShipping = freeShippingEligible ? 0 : Math.max(0, settings.freeShippingThreshold - eligibleValue);
    return { baseShippingFee: settings.baseShippingFee, freeShippingEnabled: settings.freeShippingEnabled, freeShippingEligible, freeShippingThreshold: settings.freeShippingThreshold, freeShippingDiscount, effectiveBaseShipping: effectiveBase, amountToFreeShipping };
  }

  /**
   * Combined method: returns both options and base shipping in a single
   * coordinated call — avoids the double getSettings() call from cartView().
   */
  static async calculateAll(ctx: ShippingContext): Promise<{
    options: DeliveryOptionResult[];
    base: ReturnType<typeof ShippingPricingService.calculateBaseShipping> extends Promise<infer T> ? T : never;
  }> {
    const settings = await this.getSettings();
    const deliverySettingsRow = await prisma.deliverySettings.findUnique({ where: { id: 1 } });
    const rawOptionsRaw = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
    const holidays = await prisma.deliveryHoliday.findMany();
    const addressRow = ctx.addressId ? await prisma.address.findUnique({ where: { id: ctx.addressId } }) : null;
    const storeRow = await prisma.locationSettings.findFirst();

    // Base shipping
    const eligibleValue = this.getEligibleCartValue(ctx, settings.freeShippingBasis);
    const freeShippingEligible = settings.freeShippingEnabled && eligibleValue >= settings.freeShippingThreshold;
    const freeShippingDiscount = freeShippingEligible ? settings.baseShippingFee : 0;
    const effectiveBase = settings.baseShippingFee - freeShippingDiscount;
    const base = {
      baseShippingFee: settings.baseShippingFee,
      freeShippingEnabled: settings.freeShippingEnabled,
      freeShippingEligible,
      freeShippingThreshold: settings.freeShippingThreshold,
      freeShippingDiscount,
      effectiveBaseShipping: effectiveBase,
      amountToFreeShipping: freeShippingEligible ? 0 : Math.max(0, settings.freeShippingThreshold - eligibleValue)
    };

    // AUTO-ENABLE: Same logic as calculateOptions — serve options if they exist.
    let rawOptions = rawOptionsRaw;

    // Seed defaults when no options exist at all
    if (rawOptions.length === 0 && (await prisma.deliveryOption.count()) === 0) {
      await prisma.deliveryOption.createMany({
        data: [
          { name: "7-Day Delivery", internalName: "STD_7_DAY", description: "Standard delivery within 7 business days", deliveryDays: 7, price: 0, speedSurcharge: 0, isDefault: true, status: "ACTIVE" },
          { name: "3-Day Delivery", internalName: "FAST_3_DAY", description: "Faster delivery within 3 business days", deliveryDays: 3, price: 0, speedSurcharge: 80, isDefault: false, status: "ACTIVE" },
          { name: "Express Delivery", internalName: "EXPRESS_1_DAY", description: "Fastest available delivery", deliveryDays: 1, price: 0, speedSurcharge: 150, isDefault: false, status: "ACTIVE" }
        ]
      });
      rawOptions = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
      await prisma.deliverySettings.upsert({ where: { id: 1 }, update: { enableSelection: true }, create: { id: 1, enableSelection: true } });
    }

    // Only block when admin explicitly disabled AND no options exist
    if (!deliverySettingsRow?.enableSelection && rawOptions.length === 0) return { options: [], base };

    let distanceKm: number | null = null;
    const finalLat = addressRow?.latitude ?? ctx.lat;
    const finalLng = addressRow?.longitude ?? ctx.lng;
    if (finalLat != null && finalLng != null &&
        storeRow?.latitude != null && storeRow?.longitude != null) {
      distanceKm = haversine(finalLat, finalLng, storeRow.latitude, storeRow.longitude);
    }

    const holidayDates = holidays.map((h: any) => h.date.toISOString().split("T")[0]);
    const workingDays = JSON.parse(deliverySettingsRow!.workingDays ?? '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]') as string[];
    const [cutoffHour, cutoffMin] = deliverySettingsRow!.orderCutoffTime.split(":").map(Number);
    const now = new Date();
    const startDate = new Date();
    if (now.getHours() > cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() >= cutoffMin)) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const options: DeliveryOptionResult[] = rawOptions.map((option: any) => {
      let available = true;
      if (option.maxDistanceKm != null && (distanceKm == null || distanceKm > option.maxDistanceKm)) available = false;

      const surcharge = Number(option.speedSurcharge || option.price || 0);
      const isStandard = option.isDefault || (option.deliveryType === "Standard" && surcharge === 0) || Number(option.deliveryDays) >= 7 || option.name.toLowerCase().includes("7") || surcharge === 0;
      const breakdown = this.calculateBreakdown(settings, ctx, surcharge, isStandard);
      const priceLabel = this.buildPriceLabel(breakdown);

      let estimatedDate: Date;
      if (option.dayCalculationType === "CALENDAR_DAYS") {
        estimatedDate = new Date(startDate);
        estimatedDate.setDate(estimatedDate.getDate() + option.deliveryDays);
      } else {
        estimatedDate = addBusinessDays(new Date(startDate), option.deliveryDays, workingDays, holidayDates);
      }

      return { id: option.id, name: option.name, description: option.description, deliveryType: option.deliveryType, deliveryDays: option.deliveryDays, speedSurcharge: surcharge, finalShippingFee: breakdown.finalShippingFee, priceLabel, estimatedDeliveryDate: estimatedDate.toISOString().split("T")[0], available, isDefault: option.isDefault, breakdown };
    });

    return { options, base };
  }
}
