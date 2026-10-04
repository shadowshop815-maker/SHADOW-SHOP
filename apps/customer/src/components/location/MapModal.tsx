import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Navigation, LocateFixed, Compass, Route as RouteIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { api } from "../../api";
import type { StoreData } from "../../types";

const storeMarkerIcon = L.divIcon({
  className: "store-flagship-marker",
  html: `<div style="width:42px;height:42px;background:#070709;border:2px solid #D4AF37;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 25px rgba(212,175,55,0.6);cursor:pointer;position:relative;"><span style="color:#D4AF37;font-family:'Cinzel',serif;font-weight:900;font-size:14px;letter-spacing:1px;">SS</span><div style="position:absolute;bottom:-6px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #D4AF37;"></div></div>`,
  iconSize: [42, 48],
  iconAnchor: [21, 48]
});

const userMarkerIcon = L.divIcon({
  className: "user-location-marker",
  html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(0,122,255,0.25);animation:pulse-ring 2s infinite ease-out;"></div><div style="width:16px;height:16px;border-radius:50%;background:#007AFF;border:3px solid #FFFFFF;box-shadow:0 0 12px rgba(0,122,255,0.8);"></div></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

function MapBoundsUpdater({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
      } catch {
        // ignore bounds errors
      }
    }
  }, [map, bounds]);
  return null;
}

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

export function MapModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: settings } = useQuery({ 
    queryKey: ["settings"], 
    queryFn: () => api<StoreData>("/settings") 
  });

  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; summary?: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locRequested, setLocRequested] = useState(false);

  // Fallback defaults in case DB isn't loaded
  const fallback: StoreData["location"] = {
    branchName: "Kolkata Flagship",
    line1: "Park Street Commercial Hub, 15 Park Street",
    line2: "Park Street Area",
    landmark: "",
    district: "Kolkata",
    city: "Kolkata",
    state: "West Bengal",
    country: "India",
    pinCode: "700016",
    latitude: 22.5511,
    longitude: 88.3524,
    mapsUrl: "https://maps.google.com/?q=22.5511,88.3524",
    placeId: ""
  };

  const loc = settings?.location || fallback;
  const lat = loc.latitude ?? fallback.latitude ?? 22.5511;
  const lng = loc.longitude ?? fallback.longitude ?? 88.3524;
  const storeName = settings?.branding?.storeName || "SHADOW SHOP";
  const branchName = loc.branchName || fallback.branchName;

  // Clean address handling
  const cleanLandmark = loc.landmark && !/^a+$/i.test(loc.landmark.trim()) ? loc.landmark.trim() : "";
  const addressLine1 = loc.line1?.trim() 
    || cleanLandmark 
    || (loc.city ? `${branchName}, ${loc.city}` : fallback.line1);
  
  const state = loc.state || fallback.state || "West Bengal";
  const addressLine2 = loc.line2?.trim() 
    || (loc.district && loc.district !== loc.city ? `${loc.district}` : (loc.line1 ? "" : fallback.line2));
  const addressLine3 = `${loc.city || fallback.city}${addressLine2 ? "" : ""}, ${state} ${loc.pinCode || fallback.pinCode}`;

  // Request user location and fetch real road route
  const requestUserRoute = (force = false) => {
    if (!navigator.geolocation) return;
    if (locRequested && !force && userLoc) return;
    setIsLocating(true);
    setLocRequested(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserLoc([uLat, uLng]);
        setIsLocating(false);

        // Fetch OSRM real driving route
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${lng},${lat}?overview=full&geometries=geojson`
          );
          const data = await res.json();
          if (data?.routes?.[0]) {
            const r = data.routes[0];
            const coords: [number, number][] = r.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
            coords.unshift([lat, lng]); // Connect to store marker
            coords.push([uLat, uLng]); // Connect to user marker
            setRouteCoords(coords);
            const distKm = (r.distance / 1000).toFixed(1);
            const mins = Math.round(r.duration / 60);
            setRouteInfo({
              distance: `${distKm} km`,
              duration: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`,
              summary: r.legs?.[0]?.summary || ""
            });
            return;
          }
        } catch {
          // OSRM fallback
        }

        // Direct fallback route
        setRouteCoords([[uLat, uLng], [lat, lng]]);
        const dist = calculateDistanceKm(uLat, uLng, lat, lng).toFixed(1);
        setRouteInfo({ distance: `${dist} km`, duration: `~${Math.round(Number(dist) * 2)} min` });
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      requestUserRoute();
    }
  }, [isOpen, lat, lng]);

  if (!isOpen) return null;

  const customMapsUrl = typeof loc.mapsUrl === "string" && loc.mapsUrl.trim() !== "" ? loc.mapsUrl : null;
  const customPlaceId = typeof loc.placeId === "string" && loc.placeId.trim() !== "" ? loc.placeId : null;
  
  const destQuery = customPlaceId ? `query_place_id=${customPlaceId}&query=${lat},${lng}` : `query=${lat},${lng}`;
  const mapsUrl = customMapsUrl && !customMapsUrl.includes("?q=") && !customMapsUrl.includes("api=1&query")
    ? customMapsUrl 
    : `https://www.google.com/maps/search/?api=1&${destQuery}`;

  let dirUrl = `https://www.google.com/maps/dir/?api=1&travelmode=driving`;
  // Let Google Maps automatically use the device's real-time location as origin.
  
  if (customPlaceId) {
    dirUrl += `&destination=${lat},${lng}&destination_place_id=${customPlaceId}`;
  } else {
    // Exact lat,lng to prevent snapping to wrong business without place ID
    dirUrl += `&destination=${lat},${lng}`;
  }

  const mapBounds: L.LatLngBoundsExpression | null = userLoc ? [userLoc, [lat, lng]] : null;

  return createPortal(
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="map-modal-card" 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          color: 'var(--text)',
          width: '100%',
          maxWidth: '600px',
          padding: '40px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <button 
          onClick={onClose} 
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--layer-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            cursor: 'pointer',
            padding: '8px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s',
            zIndex: 10
          }}
          aria-label="Close store location modal"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--layer-2)'}
        >
          <X size={18} />
        </button>
        
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <span className="eyebrow" style={{ color: "var(--gold)" }}>
            FLAGSHIP STORE
          </span>
          <h2 style={{ fontSize: '32px', letterSpacing: '0.02em', margin: '8px 0 4px', color: 'var(--text)', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
            {storeName}
          </h2>
          {branchName && branchName.toLowerCase() !== storeName.toLowerCase() && (
            <p style={{ fontSize: '12px', margin: '0', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', fontWeight: 600 }}>
              {branchName}
            </p>
          )}
        </div>

        {/* Live Interactive Map with Real Road Routing */}
        <div style={{ height: "280px", borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border)", position: "relative", zIndex: 1, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
          <MapContainer 
            key={`${lat}-${lng}-${userLoc ? 'routed' : 'single'}`} 
            center={userLoc ? [(lat + userLoc[0]) / 2, (lng + userLoc[1]) / 2] : [lat, lng]} 
            zoom={userLoc ? 12 : 16} 
            scrollWheelZoom={false} 
            attributionControl={false}
            style={{ width: "100%", height: "100%", background: "var(--layer-2)" }}
          >
            <TileLayer 
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
              subdomains={['mt0','mt1','mt2','mt3']} 
            />
            {mapBounds && <MapBoundsUpdater bounds={mapBounds} />}

            {/* Road route line */}
            {routeCoords.length > 0 && (
              <Polyline 
                positions={routeCoords} 
                pathOptions={{ 
                  color: "#D4AF37", 
                  weight: 4, 
                  opacity: 0.9,
                }} 
              />
            )}

            {/* User marker */}
            {userLoc && (
              <Marker position={userLoc} icon={userMarkerIcon} />
            )}

            {/* Store marker */}
            <Marker position={[lat, lng]} icon={storeMarkerIcon} />
          </MapContainer>

          {/* Quick Route status badge over map */}
          {routeInfo && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 1000,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
              <RouteIcon size={12} style={{ color: "var(--gold)" }} />
              <span><b>{routeInfo.distance}</b> • ~{routeInfo.duration}</span>
            </div>
          )}

          {/* GPS re-locate button */}
          <button 
            type="button"
            onClick={() => requestUserRoute(true)}
            disabled={isLocating}
            title="Update route from current location"
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              zIndex: 1000,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '99px',
              padding: '6px 14px',
              color: isLocating ? 'var(--muted)' : 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}
          >
            <LocateFixed size={12} style={{ color: "var(--gold)" }} />
            {isLocating ? "Routing…" : (userLoc ? "Recalculate" : "Live Route")}
          </button>
        </div>
        
        {/* Verified Store Address */}
        <div style={{ textAlign: "center", lineHeight: '1.5', fontSize: '13px', color: 'var(--text)' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>{addressLine1}</p>
          {addressLine2 && <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{addressLine2}</p>}
          <p style={{ margin: '2px 0 0', color: 'var(--muted)' }}>{addressLine3}</p>
        </div>

        {/* GPS Coordinates Badge */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'var(--layer-2)', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border)' }}>
            LAT: {Number(lat).toFixed(5)}
          </span>
          <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'var(--layer-2)', color: 'var(--text-secondary)', fontWeight: 600, border: '1px solid var(--border)' }}>
            LNG: {Number(lng).toFixed(5)}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
          <a 
            href={mapsUrl} 
            target="_blank" 
            rel="noreferrer"
            className="outline-button"
            style={{ padding: "14px", fontSize: "13px", display: "flex", justifyContent: "center", gap: "8px" }}
          >
            <MapPin size={16}/> View on Map
          </a>
          <a 
            href={dirUrl} 
            target="_blank" 
            rel="noreferrer"
            className="button"
            style={{ padding: "14px", fontSize: "13px", display: "flex", justifyContent: "center", gap: "8px" }}
          >
            <Navigation size={16}/> Get Directions
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

