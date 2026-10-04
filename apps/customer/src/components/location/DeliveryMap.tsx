import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, Plus, Minus, Layers, Maximize2, Phone, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";

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

function createRiderIcon(bearing: number) {
  return L.divIcon({
    className: "rider-vehicle-marker",
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(212, 175, 55, 0.2); animation: pulse-ring 2s infinite ease-out;"></div>
        <div style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(212, 175, 55, 0.35); animation: pulse-ring 2s infinite ease-out 0.6s;"></div>
        
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
        <span>DELIVERY DESTINATION</span>
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

  useMapEvents({
    dragstart: () => setIsAutoFollow(false),
    zoomstart: () => setIsAutoFollow(false)
  });

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

  useEffect(() => {
    if (zoomAction === "in") {
      map.zoomIn();
      setZoomAction(null);
    } else if (zoomAction === "out") {
      map.zoomOut();
      setZoomAction(null);
    }
  }, [zoomAction, map, setZoomAction]);

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
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<any>("/settings")
  });

  const custLat = useMemo(() => (customerLat && !isNaN(customerLat) ? Number(customerLat) : 22.5726), [customerLat]);
  const custLng = useMemo(() => (customerLng && !isNaN(customerLng) ? Number(customerLng) : 88.3639), [customerLng]);

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

  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeIndex, setRouteIndex] = useState<number>(0);
  const [bearing, setBearing] = useState<number>(45);
  const [speed, setSpeed] = useState<number>(33);
  const [isAutoFollow, setIsAutoFollow] = useState<boolean>(true);
  const [zoomAction, setZoomAction] = useState<"in" | "out" | null>(null);
  const [fitRouteTrigger, setFitRouteTrigger] = useState<number>(0);
  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");

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

  useEffect(() => {
    if (route.length < 2) return;

    const timer = setInterval(() => {
      setRouteIndex((prev) => {
        const next = prev + 1;
        if (next >= route.length - 1) {
          return 0;
        }

        const currentPt = route[prev];
        const nextPt = route[next];
        if (currentPt && nextPt) {
          const newBearing = calculateBearing(currentPt[0], currentPt[1], nextPt[0], nextPt[1]);
          setBearing(Math.round(newBearing));
        }

        setSpeed(Math.floor(29 + Math.random() * 12));
        return next;
      });
    }, 1100);

    return () => clearInterval(timer);
  }, [route]);

  const riderPos = useMemo<[number, number]>(() => {
    if (route.length > 0 && route[routeIndex]) {
      return route[routeIndex];
    }
    return [originLat, originLng];
  }, [route, routeIndex, originLat, originLng]);

  const traveledRoute = useMemo(() => route.slice(0, routeIndex + 1), [route, routeIndex]);
  const remainingRoute = useMemo(() => route.slice(routeIndex), [route, routeIndex]);

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
      height: "350px",
      borderRadius: "12px",
      overflow: "hidden",
      position: "relative",
      zIndex: 1,
      marginTop: "16px",
      border: "1px solid var(--border, rgba(0,0,0,0.1))",
      background: "var(--card, #fff)",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
      fontFamily: "var(--font-sans, 'Inter', sans-serif)"
    }}>


      <div style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}>
        {!isAutoFollow && (
          <button
            title="Recenter on Rider"
            onClick={() => setIsAutoFollow(true)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--card, #fff)",
              color: "var(--gold, #D4AF37)",
              border: "1px solid var(--border, #eaeaea)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              animation: "bounce 1.5s infinite"
            }}
          >
            <Navigation size={16} />
          </button>
        )}

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
            background: "var(--card, #fff)",
            color: "var(--ink, #000)",
            border: "1px solid var(--border, #eaeaea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
        >
          <Maximize2 size={15} />
        </button>

        <button
          title="Zoom In"
          onClick={() => setZoomAction("in")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px 8px 0 0",
            background: "var(--card, #fff)",
            color: "var(--ink, #000)",
            border: "1px solid var(--border, #eaeaea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}
        >
          <Plus size={16} />
        </button>

        <button
          title="Zoom Out"
          onClick={() => setZoomAction("out")}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "0 0 8px 8px",
            background: "var(--card, #fff)",
            color: "var(--ink, #000)",
            border: "1px solid var(--border, #eaeaea)",
            borderTop: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            marginTop: "-1px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
          }}
        >
          <Minus size={16} />
        </button>

        <button
          title="Toggle Satellite View"
          onClick={() => setMapType((prev) => (prev === "streets" ? "satellite" : "streets"))}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: mapType === "satellite" ? "var(--ink, #000)" : "var(--card, #fff)",
            color: mapType === "satellite" ? "var(--bg, #fff)" : "var(--ink, #000)",
            border: "1px solid var(--border, #eaeaea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginTop: "6px"
          }}
        >
          <Layers size={15} />
        </button>
      </div>

      <MapContainer
        center={[custLat, custLng]}
        zoom={14}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0a0a0c" }}
      >
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

        <Marker position={[originLat, originLng]} icon={warehouseIcon} />
        <Marker position={[custLat, custLng]} icon={customerIcon} />

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

        {riderPos && (
          <Marker position={riderPos} icon={createRiderIcon(bearing)} />
        )}

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
