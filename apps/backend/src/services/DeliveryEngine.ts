import { prisma } from "../config/db.js";

// Helper for distance calculation (Haversine formula in km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

export class DeliveryEngine {
  static async calculateOptions(context: { addressId?: string, subtotal: number }) {
    let settings = await prisma.deliverySettings.findUnique({ where: { id: 1 } });
    if (!settings) settings = await prisma.deliverySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    if (!settings.enableSelection) {
      return [];
    }

    let options = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
    
    // Auto-seed initial options if the table is completely empty
    if (options.length === 0) {
      const allCount = await prisma.deliveryOption.count();
      if (allCount === 0) {
        await prisma.deliveryOption.create({
          data: {
            name: "3-Day Delivery",
            internalName: "FAST_3_DAY",
            description: "Get it within 3 business days",
            deliveryDays: 3,
            price: 99.00,
            status: "ACTIVE",
            isDefault: false
          }
        });
        await prisma.deliveryOption.create({
          data: {
            name: "7-Day Delivery",
            internalName: "STD_7_DAY",
            description: "Get it within 7 business days",
            deliveryDays: 7,
            price: 0,
            freeDelivery: true,
            status: "ACTIVE",
            isDefault: true
          }
        });
        // Fetch them again
        options = await prisma.deliveryOption.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
      }
    }

    let distanceKm: number | null = null;

    if (context.addressId) {
      const address = await prisma.address.findUnique({ where: { id: context.addressId } });
      if (address && address.latitude != null && address.longitude != null) {
        const storeLocation = await prisma.locationSettings.findUnique({ where: { id: 1 } });
        if (storeLocation && storeLocation.latitude != null && storeLocation.longitude != null) {
          distanceKm = calculateDistance(address.latitude, address.longitude, storeLocation.latitude, storeLocation.longitude);
        }
      }
    }

    const holidays = await prisma.deliveryHoliday.findMany();
    const holidayDates = holidays.map((h: any) => h.date.toISOString().split("T")[0]);
    const workingDays = JSON.parse(settings.workingDays) as string[];

    const result = options.map((option: any) => {
      let isAvailable = true;
      if (option.maxDistanceKm != null) {
        if (distanceKm == null || distanceKm > option.maxDistanceKm) {
          isAvailable = false;
        }
      }

      let charge = Number(option.price);
      if (option.freeDelivery || (option.freeAboveAmount != null && context.subtotal >= Number(option.freeAboveAmount))) {
        charge = 0;
      }

      // Calculate estimated delivery date
      let estimatedDate = new Date();
      // Handle cut-off time (assume server local time for now)
      const [cutoffHour, cutoffMinute] = settings.orderCutoffTime.split(":").map(Number);
      const now = new Date();
      if (now.getHours() > cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() >= cutoffMinute)) {
        estimatedDate.setDate(estimatedDate.getDate() + 1); // Start next day
      }

      if (option.dayCalculationType === "CALENDAR_DAYS") {
        estimatedDate.setDate(estimatedDate.getDate() + option.deliveryDays);
      } else {
        // Business Days
        let daysAdded = 0;
        while (daysAdded < option.deliveryDays) {
          estimatedDate.setDate(estimatedDate.getDate() + 1);
          const dayName = estimatedDate.toLocaleDateString("en-US", { weekday: "long" });
          const dateString = estimatedDate.toISOString().split("T")[0];
          
          if (workingDays.includes(dayName) && !holidayDates.includes(dateString)) {
            daysAdded++;
          }
        }
      }

      return {
        id: option.id,
        name: option.name,
        description: option.description,
        deliveryDays: option.deliveryDays,
        price: charge,
        estimatedDeliveryDate: estimatedDate.toISOString().split("T")[0],
        available: isAvailable,
        isDefault: option.isDefault
      };
    });

    return result;
  }
}
