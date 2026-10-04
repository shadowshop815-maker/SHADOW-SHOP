export class DistanceService {
  /**
   * Calculate real driving distance between two coordinates in Kilometers using OSRM routing API.
   * Falls back to Haversine (straight-line) if the routing API fails.
   */
  static async calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
    try {
      // Use OSRM for real driving distance (free, open-source routing)
      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3-second timeout for fast checkout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const meters = data.routes[0].distance;
          return meters / 1000; // Convert to km
        }
      }
    } catch (e) {
      console.warn("OSRM routing failed, falling back to Haversine distance", e);
    }

    // Fallback: Haversine straight-line distance
    return this.haversineKm(lat1, lon1, lat2, lon2);
  }

  private static haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
