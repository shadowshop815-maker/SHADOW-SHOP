import { prisma } from "../config/db.js";

export class BusinessDayCalculator {
  /**
   * Adds business days to a given start date.
   * Skips weekends (Saturday, Sunday) and any holidays defined in the Holiday table.
   * @param startDate The date to start counting from
   * @param businessDaysToAdd Number of business days to add
   * @returns The resulting estimated delivery date
   */
  static async addBusinessDays(startDate: Date, businessDaysToAdd: number): Promise<Date> {
    let holidays: Date[] = [];
    
    try {
      // Fetch upcoming holidays to avoid querying for past holidays
      // Only fetch holidays from the start date onwards
      const holidayRecords = await prisma.holiday.findMany({
        where: {
          date: {
            gte: new Date(startDate.setHours(0, 0, 0, 0)),
          }
        },
        select: { date: true }
      });
      holidays = holidayRecords.map((h: { date: Date }) => h.date);
    } catch (err) {
      // If table doesn't exist yet (before db push), just fallback to empty holidays
      console.warn("Holiday table not available yet, ignoring holidays for ETA calculation.");
    }

    // Helper to check if a date is a weekend (0 = Sunday, 6 = Saturday)
    const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

    // Helper to check if a date is a holiday
    const isHoliday = (date: Date) => {
      return holidays.some(h => 
        h.getFullYear() === date.getFullYear() &&
        h.getMonth() === date.getMonth() &&
        h.getDate() === date.getDate()
      );
    };

    let currentDate = new Date(startDate);
    let addedDays = 0;

    // Fast-forward to the end of the required business days
    while (addedDays < businessDaysToAdd) {
      currentDate.setDate(currentDate.getDate() + 1);

      // If it's a weekend or a holiday, we skip counting it as a business day
      if (isWeekend(currentDate) || isHoliday(currentDate)) {
        continue;
      }
      
      addedDays++;
    }

    return currentDate;
  }
}
