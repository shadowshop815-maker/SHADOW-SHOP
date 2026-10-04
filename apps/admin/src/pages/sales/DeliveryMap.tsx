import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Plus, Minus, Layers, Maximize2, Phone, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";

// Haversine formula to compute distance in KM
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Compute bearing angle in degrees between two coordinates
function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  const startLatRad = startLat * Math.PI / 180;
  const startLngRad = startLng * Math.PI / 180;
  const destLatRad = destLat * Math.PI / 180;
  const destLngRad = destLng * Math.PI / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
            Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Fallback realistic road path if OSRM is blocked or slow
function generateRealisticRoute(
  startLat: number, startLng: number, 
  endLat: number, endLng: number, 
  steps = 40
): [number, number][] {
  const points: [number, number][] = [];
  const midLat = (startLat + endLat) / 2 + (startLng - endLng) * 0.12;
  const midLng = (startLng + endLng) / 2 - (startLat - endLat) * 0.12;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * midLat + t * t * endLat;
    const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * midLng + t * t * endLng;
    const jitter = Math.sin(i * 1.5) * 0.00025;
    points.push([lat + jitter, lng + jitter]);
  }
  return points;
}

// Custom Leaflet DivIcons
function createRiderIcon(bearing: number) {
  return L.divIcon({
    className: "rider-vehicle-marker",
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <!-- Pulsing radar ring -->
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(212, 175, 55, 0.2); animation: pulse-ring 2s infinite ease-out;"></div>
        <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(212, 175, 55, 0.35); animation: pulse-ring 2s infinite ease-out 0.6s;"></div>
        
        <!-- Rotating Vehicle Marker -->
        <div style="
          width: 32px; 
          height: 32px; 
          background: #0B0B0D; 
          border: 2px solid #D4AF37; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          box-shadow: 0 0 15px rgba(212, 175, 55, 0.7), inset 0 0 8px rgba(212, 175, 55, 0.4);
          transform: rotate(${bearing}deg);
          transition: transform 0.3s ease-out;
        ">
          <!-- Direction Arrow -->
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2" fill="#D4AF37" fill-opacity="0.35"></polygon>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

const customerIcon = L.divIcon({
  className: "destination-pin-custom",
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: none;">
      <div style="
        padding: 5px 10px; 
        background: #D4AF37; 
        border: 1.5px solid #000; 
        border-radius: 6px; 
        color: #000; 
        font-size: 10px; 
        font-weight: 900; 
        letter-spacing: 0.5px; 
        box-shadow: 0 4px 15px rgba(212, 175, 55, 0.5);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span>📍</span>
        <span>CUSTOMER DESTINATION</span>
      </div>
      <div style="width: 2px; height: 8px; background: #D4AF37;"></div>
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #D4AF37; border: 2px solid #000; box-shadow: 0 0 8px rgba(212, 175, 55, 0.8);"></div>
    </div>
  `,
  iconSize: [160, 42],
  iconAnchor: [80, 42]
});

const warehouseIcon = L.divIcon({
  className: "warehouse-pin-custom",
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: none;">
      <div style="
        padding: 5px 10px; 
        background: #0B0B0D; 
        border: 1.5px solid #D4AF37; 
        border-radius: 6px; 
        color: #D4AF37; 
        font-size: 10px; 
        font-weight: 800; 
        letter-spacing: 1px; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.7);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 5px;
      ">
        <span style="display:inline-block; width:6px; height:6px; background:#D4AF37; border-radius:50%; box-shadow: 0 0 6px #D4AF37;"></span>
        SHADOW HUB
      </div>
      <div style="width: 2px; height: 8px; background: #D4AF37;"></div>
      <div style="width: 6px; height: 6px; border-radius: 50%; background: #D4AF37;"></div>
    </div>
  `,
  iconSize: [110, 40],
  iconAnchor: [55, 40]
});

// Map Controller for touch stability and custom controls
function MapInteractionController({
  isAutoFollow,
  setIsAutoFollow,
  riderPos,
  route,
  zoomAction,
  setZoomAction,
  fitRouteTrigger,
  mapType
}: {
  isAutoFollow: boolean;
  setIsAutoFollow: (val: boolean) => void;
  riderPos: [number, number] | null;
  route: [number, number][];
  zoomAction: "in" | "out" | null;
  setZoomAction: (val: "in" | "out" | null) => void;
  fitRouteTrigger: number;
  mapType: "streets" | "satellite";
}) {
  const map = useMap();
  const initialFitDone = useRef(false);

  // Safely hook touch and drag gestures so map NEVER hangs or collides
  useMapEvents({
    dragstart: () => setIsAutoFollow(false),
    zoomstart: () => setIsAutoFollow(false),
    ...({ touchstart: () => setIsAutoFollow(false) } as any)
  });

  // Fit route bounds ONCE on initial load
  useEffect(() => {
    if (!initialFitDone.current && route.length > 1) {
      initialFitDone.current = true;
      try {
        const bounds = L.latLngBounds(route);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      } catch (e) {
        // Safe fallback
      }
    }
  }, [route, map]);

  // Fit route when requested by user
  useEffect(() => {
    if (fitRouteTrigger > 0 && route.length > 1) {
      try {
        const bounds = L.latLngBounds(route);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      } catch (e) {
        // Safe fallback
      }
    }
  }, [fitRouteTrigger, route, map]);

  // Handle custom zoom controls
  useEffect(() => {
    if (zoomAction === "in") {
      map.zoomIn();
      setZoomAction(null);
    } else if (zoomAction === "out") {
      map.zoomOut();
      setZoomAction(null);
    }
  }, [zoomAction, map, setZoomAction]);

  // Smoothly pan when auto-follow is active without resetting zoom
  useEffect(() => {
    if (isAutoFollow && riderPos) {
      map.panTo(riderPos, { animate: true, duration: 0.8 });
    }
  }, [riderPos, isAutoFollow, map]);

  return null;
}

export interface DeliveryMapProps {
  customerLat?: number | null;
  customerLng?: number | null;
  customerName?: string;
  orderNumber?: string;
}

export function DeliveryMap({ customerLat, customerLng, customerName, orderNumber }: DeliveryMapProps) {
  // Fetch real physical store location from settings
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<any>("/settings")
  });

  // Customer Coordinates (defaulting to Kolkata if null)
  const custLat = useMemo(() => (customerLat && !isNaN(customerLat) ? Number(customerLat) : 22.5726), [customerLat]);
  const custLng = useMemo(() => (customerLng && !isNaN(customerLng) ? Number(customerLng) : 88.3639), [customerLng]);

  // Origin Hub Location from actual Store Settings or calculated realistic dispatch depot
  const originLat = useMemo(() => {
    const configured = settingsData?.location?.latitude;
    if (configured && !isNaN(Number(configured))) return Number(configured);
    return custLat - 0.026;
  }, [settingsData, custLat]);

  const originLng = useMemo(() => {
    const configured = settingsData?.location?.longitude;
    if (configured && !isNaN(Number(configured))) return Number(configured);
    return custLng - 0.022;
  }, [settingsData, custLng]);

  // State
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeIndex, setRouteIndex] = useState<number>(0);
  const [bearing, setBearing] = useState<number>(45);
  const [speed, setSpeed] = useState<number>(33);
  const [isAutoFollow, setIsAutoFollow] = useState<boolean>(true);
  const [zoomAction, setZoomAction] = useState<"in" | "out" | null>(null);
  const [fitRouteTrigger, setFitRouteTrigger] = useState<number>(0);
  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");

  // 1. Fetch genuine driving road route from OSRM
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${custLng},${custLat}?overview=full&geometries=geojson&steps=true`;

    fetch(osrmUrl, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("OSRM unreachable");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.routes && data.routes[0]?.geometry?.coordinates?.length > 1) {
          const rawCoords = data.routes[0].geometry.coordinates;
          const mapped: [number, number][] = rawCoords.map((c: [number, number]) => [c[1], c[0]]);
          setRoute(mapped);
          setRouteIndex(0);
        } else {
          throw new Error("No road geometry returned");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallbackRoute = generateRealisticRoute(originLat, originLng, custLat, custLng, 45);
        setRoute(fallbackRoute);
        setRouteIndex(0);
      });

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [originLat, originLng, custLat, custLng]);

  // 2. Real-time vehicle simulation along the roads
  useEffect(() => {
    if (route.length < 2) return;

    const timer = setInterval(() => {
      setRouteIndex((prev) => {
        const next = prev + 1;
        if (next >= route.length - 1) {
          return 0; // Seamless loop for simulation
        }

        const currentPt = route[prev];
        const nextPt = route[next];
        if (currentPt && nextPt) {
          const newBearing = calculateBearing(currentPt[0], currentPt[1], nextPt[0], nextPt[1]);
          setBearing(Math.round(newBearing));
        }

        // Realistic fluctuating speed
        setSpeed(Math.floor(29 + Math.random() * 12));
        return next;
      });
    }, 1100);

    return () => clearInterval(timer);
  }, [route]);

  // Current Rider position
  const riderPos = useMemo<[number, number]>(() => {
    if (route.length > 0 && route[routeIndex]) {
      return route[routeIndex];
    }
    return [originLat, originLng];
  }, [route, routeIndex, originLat, originLng]);

  // Traveled vs Remaining routes
  const traveledRoute = useMemo(() => route.slice(0, routeIndex + 1), [route, routeIndex]);
  const remainingRoute = useMemo(() => route.slice(routeIndex), [route, routeIndex]);

  // Remaining distance & ETA
  const remainingDistanceKm = useMemo(() => {
    if (remainingRoute.length < 2) return 0.2;
    let dist = 0;
    for (let i = 0; i < remainingRoute.length - 1; i++) {
      dist += calculateDistanceKm(
        remainingRoute[i][0], remainingRoute[i][1],
        remainingRoute[i + 1][0], remainingRoute[i + 1][1]
      );
    }
    return Math.max(0.1, Number(dist.toFixed(1)));
  }, [remainingRoute]);

  const etaMinutes = useMemo(() => {
    const mins = Math.ceil((remainingDistanceKm / (speed || 30)) * 60);
    return Math.max(1, mins);
  }, [remainingDistanceKm, speed]);

  const progressPercent = useMemo(() => {
    if (!route.length) return 0;
    return Math.min(100, Math.round((routeIndex / (route.length - 1)) * 100));
  }, [routeIndex, route.length]);

  return (
    <div style={{
      width: "100%",
      height: "500px",
      borderRadius: "14px",
      overflow: "hidden",
      position: "relative",
      marginTop: "1.25rem",
      border: "1px solid rgba(212, 175, 55, 0.35)",
      background: "#08080A",
      boxShadow: "0 14px 45px rgba(0, 0, 0, 0.75)",
      fontFamily: "var(--font-sans, 'Inter', sans-serif)"
    }}>
      {/* 1. Sleek Top Status & Rider Header (Compact & Crisp) */}
      <div style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        right: "60px", // Leaves space on the right for floating map controls
        zIndex: 1000,
        background: "rgba(11, 11, 13, 0.90)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(212, 175, 55, 0.28)",
        borderRadius: "10px",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 8px 25px rgba(0,0,0,0.65)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          {/* Live Pulsing Beacon */}
          <div style={{ position: "relative", width: "10px", height: "10px", flexShrink: 0 }}>
            <span style={{
              position: "absolute",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#22c55e",
              opacity: 0.75,
              animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
            }} />
            <span style={{
              position: "relative",
              display: "block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#22c55e"
            }} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "1px", color: "var(--gold, #D4AF37)", textTransform: "uppercase" }}>
                LIVE GPS DISPATCH • RAPIDO EXPRESS
              </span>
              <ShieldCheck size={12} color="#22c55e" />
            </div>
            <div style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Rahul K. (Bajaj Pulsar NS200 • WB-02-AK-9821) <span style={{ color: "#D4AF37", marginLeft: "4px" }}>★ 4.9</span>
            </div>
          </div>
        </div>

        {/* Live Speed Indicator */}
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "3px 8px",
          borderRadius: "6px",
          textAlign: "right",
          flexShrink: 0
        }}>
          <div style={{ fontSize: "9px", color: "#8E8E93", textTransform: "uppercase", letterSpacing: "0.5px" }}>Speed</div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#D4AF37" }}>{speed} km/h</div>
        </div>
      </div>

      {/* 2. Custom Floating Map Controls (Right Side - No Overlap!) */}
      <div style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}>
        {/* Recenter Button */}
        {!isAutoFollow && (
          <button
            title="Recenter on Rider"
            onClick={() => setIsAutoFollow(true)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#D4AF37",
              color: "#000000",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(212, 175, 55, 0.5)",
              animation: "bounce 1.5s infinite"
            }}
          >
            <Navigation size={16} fill="#000" />
          </button>
        )}

        {/* Fit Entire Route */}
        <button
          title="Fit Route in View"
          onClick={() => {
            setIsAutoFollow(false);
            setFitRouteTrigger((prev) => prev + 1);
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(11, 11, 13, 0.9)",
            color: "#D4AF37",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
          }}
        >
          <Maximize2 size={15} />
        </button>

        {/* Zoom In */}
        <button
          title="Zoom In"
          onClick={() => setZoomAction("in")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px 8px 0 0",
            background: "rgba(11, 11, 13, 0.9)",
            color: "#FFFFFF",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <Plus size={16} />
        </button>

        {/* Zoom Out */}
        <button
          title="Zoom Out"
          onClick={() => setZoomAction("out")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "0 0 8px 8px",
            background: "rgba(11, 11, 13, 0.9)",
            color: "#FFFFFF",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            borderTop: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            marginTop: "-6px"
          }}
        >
          <Minus size={16} />
        </button>

        {/* Toggle Satellite / Road view */}
        <button
          title="Toggle Satellite View"
          onClick={() => setMapType((prev) => (prev === "streets" ? "satellite" : "streets"))}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: mapType === "satellite" ? "#D4AF37" : "rgba(11, 11, 13, 0.9)",
            color: mapType === "satellite" ? "#000" : "#D4AF37",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
          }}
        >
          <Layers size={15} />
        </button>
      </div>

      {/* 3. Main Leaflet Map Canvas (Clean & No Default Zoom Box!) */}
      <MapContainer
        center={[custLat, custLng]}
        zoom={14}
        zoomControl={false} // Crucial: Removes the default top-left box that collided with the HUD!
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0a0a0c" }}
      >
        {/* Google Maps Road / Satellite Layer */}
        {mapType === "streets" ? (
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
          />
        ) : (
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
            maxZoom={20}
          />
        )}

        {/* Warehouse / Hub Marker */}
        <Marker position={[originLat, originLng]} icon={warehouseIcon} />

        {/* Customer Destination Marker */}
        <Marker position={[custLat, custLng]} icon={customerIcon} />

        {/* Traveled Route Line (Dimmed trail behind rider) */}
        {traveledRoute.length > 1 && (
          <Polyline
            positions={traveledRoute}
            pathOptions={{
              color: "#6b7280",
              weight: 4,
              opacity: 0.55,
              dashArray: "6, 8"
            }}
          />
        )}

        {/* Remaining Road Route (Vibrant Haute Gold) */}
        {remainingRoute.length > 1 && (
          <Polyline
            positions={remainingRoute}
            pathOptions={{
              color: "#D4AF37",
              weight: 6,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round"
            }}
          />
        )}

        {/* Live Moving Vehicle Marker */}
        {riderPos && (
          <Marker position={riderPos} icon={createRiderIcon(bearing)} />
        )}

        {/* Gesture and Interaction Controller */}
        <MapInteractionController
          isAutoFollow={isAutoFollow}
          setIsAutoFollow={setIsAutoFollow}
          riderPos={riderPos}
          route={route}
          zoomAction={zoomAction}
          setZoomAction={setZoomAction}
          fitRouteTrigger={fitRouteTrigger}
          mapType={mapType}
        />
      </MapContainer>

      {/* 4. Streamlined Bottom Telemetry & Navigation Status Bar */}
      <div style={{
        position: "absolute",
        bottom: "12px",
        left: "12px",
        right: "12px",
        zIndex: 1000,
        background: "rgba(11, 11, 13, 0.92)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(212, 175, 55, 0.28)",
        borderRadius: "10px",
        padding: "10px 14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.8)"
      }}>
        {/* ETA & Distance Telemetry */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#8E8E93", letterSpacing: "1px", fontWeight: 700 }}>
                ESTIMATED TIME (ETA)
              </div>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#FFFFFF", display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span>{etaMinutes}</span>
                <span style={{ fontSize: "11px", color: "#D4AF37", fontWeight: 700 }}>MINUTES</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#8E8E93", letterSpacing: "1px", fontWeight: 700 }}>
                DISTANCE REMAINING
              </div>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#FFFFFF", display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span>{remainingDistanceKm}</span>
                <span style={{ fontSize: "11px", color: "#D4AF37", fontWeight: 700 }}>KM</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href="tel:+917384403001"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                background: "rgba(212, 175, 55, 0.15)",
                border: "1px solid #D4AF37",
                borderRadius: "6px",
                color: "#D4AF37",
                fontSize: "11px",
                fontWeight: 700,
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <Phone size={12} />
              CALL RIDER
            </a>
          </div>
        </div>

        {/* Live Trip Progress Bar */}
        <div style={{ marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#A0A0A0", marginBottom: "4px", fontWeight: 600 }}>
            <span>Dispatched from Shadow Hub</span>
            <span style={{ color: "#D4AF37" }}>{progressPercent}% en route</span>
            <span>Customer: {customerName || "Recipient"}</span>
          </div>
          <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #D4AF37, #fef08a)",
              boxShadow: "0 0 8px rgba(212, 175, 55, 0.8)",
              transition: "width 0.8s ease-in-out"
            }} />
          </div>
        </div>
      </div>

      {/* Embedded Keyframe Animations */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .leaflet-container {
          font-family: inherit !important;
          touch-action: pan-x pan-y !important;
        }
      `}</style>
    </div>
  );
}
