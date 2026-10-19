import { useState, useEffect, useRef } from "react";
import { LocateFixed, MapPin, Search, X, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles, Navigation, AlertCircle, RefreshCw } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import type { Address } from "../../types";
import { resolveImageUrl } from "../../api";

export const blankAddress: Address = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  town: "",
  city: "",
  district: "",
  state: "",
  pinCode: "",
  country: "India",
  latitude: null,
  longitude: null,
  formattedAddress: null,
  isDefault: false,
};

function MapEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  const lastCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (center[0] && center[1]) {
      const isSame =
        lastCenter.current &&
        Math.abs(lastCenter.current[0] - center[0]) < 0.0001 &&
        Math.abs(lastCenter.current[1] - center[1]) < 0.0001;

      if (!isSame) {
        lastCenter.current = center;
        try {
          map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 1.2 });
        } catch {}
      }
    }
  }, [center[0], center[1], map]);

  return null;
}

/**
 * Robust Multi-Tier Reverse Geocoding Engine.
 * 1. BigDataCloud Client API (Designed for web client GPS coordinates, zero-auth, high accuracy).
 * 2. OpenStreetMap Nominatim (Extracts street, road, house number, suburb).
 * 3. India Post Official Directory (Validates 6-digit PIN and populates official District & State).
 */
async function reverseGeocodeCoords(lat: number, lng: number): Promise<{
  partial: Partial<Address>;
  postOffices: string[];
}> {
  let partial: Partial<Address> = {
    latitude: lat,
    longitude: lng,
    country: "India",
  };
  let postOffices: string[] = [];

  // 1. Query BigDataCloud Client API (Free, high-speed, no CORS blocks)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (bdcRes.ok) {
      const bdc = await bdcRes.json();
      const bdcPin = bdc.postcode ? String(bdc.postcode).replace(/\D/g, "").slice(0, 6) : "";
      const bdcLocality = bdc.locality || "";
      const bdcCity = bdc.city || bdc.locality || "";
      const bdcState = bdc.principalSubdivision || "";

      // Extract district from administrative levels if available
      let bdcDistrict = "";
      if (Array.isArray(bdc.localityInfo?.administrative)) {
        const distObj = bdc.localityInfo.administrative.find(
          (a: any) =>
            a.description?.toLowerCase().includes("district") ||
            a.order === 4 ||
            a.adminLevel === 5
        );
        if (distObj?.name) bdcDistrict = distObj.name;
      }

      partial = {
        ...partial,
        town: bdcLocality,
        city: bdcCity,
        district: bdcDistrict || bdcCity,
        state: bdcState,
        pinCode: bdcPin,
        country: bdc.countryName || "India",
        formattedAddress: `${bdcLocality ? bdcLocality + ", " : ""}${bdcCity ? bdcCity + ", " : ""}${bdcState}`,
      };
    }
  } catch (err) {
    console.warn("BigDataCloud geocode failed, falling back to Nominatim:", err);
  }

  // 2. Query OpenStreetMap Nominatim for street/building precision
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
      { headers: { "Accept-Language": "en" } }
    );
    if (nomRes.ok) {
      const data = await nomRes.json();
      if (data && data.address) {
        const a = data.address;
        const street = a.road || a.street || a.neighbourhood || a.suburb || a.residential || "";
        const houseNo = a.house_number || a.building || "";
        const detectedLine1 = houseNo && street ? `${houseNo}, ${street}` : street || a.hamlet || "";
        const detectedTown = a.suburb || a.neighbourhood || a.town || a.village || a.hamlet || a.locality || "";
        const detectedCity = a.city || a.municipality || a.county || a.town || a.village || "";
        const detectedDistrict = a.state_district || a.county || a.district || "";
        const detectedState = a.state || a.province || "";
        const detectedPin = a.postcode ? String(a.postcode).replace(/\D/g, "").slice(0, 6) : "";

        partial = {
          ...partial,
          formattedAddress: data.display_name || partial.formattedAddress,
          line1: detectedLine1 || partial.line1 || detectedTown || detectedCity || "Main Road",
          town: detectedTown || partial.town || detectedCity || "",
          city: detectedCity || partial.city || detectedDistrict || "",
          district: detectedDistrict || partial.district || detectedCity || "",
          state: detectedState || partial.state || "",
          pinCode: detectedPin || partial.pinCode || "",
          country: a.country || partial.country || "India",
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim geocode failed:", err);
  }

  // Guarantee line1 is non-empty
  if (!partial.line1 || partial.line1.trim().length < 3) {
    partial.line1 = partial.town || partial.city || "Main Road";
  }

  // 3. Enrich with India Post Official Directory if 6-digit PIN is available
  if (partial.pinCode && partial.pinCode.length === 6) {
    try {
      const postRes = await fetch(`https://api.postalpincode.in/pincode/${partial.pinCode}`);
      if (postRes.ok) {
        const postData = await postRes.json();
        if (postData?.[0]?.Status === "Success" && Array.isArray(postData[0].PostOffice) && postData[0].PostOffice.length > 0) {
          const poList = postData[0].PostOffice;
          const po = poList[0];
          partial.district = po.District || partial.district;
          partial.state = po.State || partial.state;
          if (!partial.city) partial.city = po.District || po.Division || "";
          if (!partial.town) partial.town = po.Name || "";

          // Extract area post offices for quick selection
          postOffices = poList.map((p: any) => p.Name).filter(Boolean).slice(0, 8);
        }
      }
    } catch (err) {
      console.warn("India Post PIN enrichment failed:", err);
    }
  }

  return { partial, postOffices };
}

/**
 * Autocomplete place search using Photon Komoot + Nominatim.
 */
async function searchPlaces(query: string): Promise<any[]> {
  if (!query || query.trim().length < 2) return [];

  // Try Photon Komoot (Ultra fast OSM search)
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7&lang=en`);
    if (res.ok) {
      const data = await res.json();
      if (data?.features?.length > 0) {
        return data.features.map((f: any) => {
          const props = f.properties || {};
          const nameParts = [props.name, props.street, props.district || props.city, props.state, props.country].filter(Boolean);
          return {
            display_name: nameParts.join(", ") || props.name,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            properties: props,
          };
        });
      }
    }
  } catch {}

  // Fallback to OpenStreetMap Nominatim Search
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&q=${encodeURIComponent(query)}&limit=6&countrycodes=in`
    );
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}

  return [];
}

/**
 * LocationPicker Map & Interactive Pin Component
 */
export function LocationPicker({
  address,
  onChange,
  logo,
  onPostOfficesLoaded,
}: {
  address: Address;
  onChange: (value: Address) => void;
  logo?: string;
  onPostOfficesLoaded?: (offices: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [accuracyNotice, setAccuracyNotice] = useState<string | null>(null);

  const reverse = async (lat: number, lng: number, accuracyMeters?: number) => {
    setBusy(true);
    setStatusText("Pinpointing address details...");
    try {
      const { partial, postOffices } = await reverseGeocodeCoords(lat, lng);

      if (accuracyMeters != null) {
        setAccuracyNotice(`GPS Accuracy: ±${Math.round(accuracyMeters)}m`);
      } else {
        setAccuracyNotice("Pin placed on map");
      }

      if (onPostOfficesLoaded && postOffices.length > 0) {
        onPostOfficesLoaded(postOffices);
      }

      onChange({
        ...address,
        ...partial,
        latitude: lat,
        longitude: lng,
        // Preserve user's name & phone if already entered
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1 && address.line1.length > 4 ? address.line1 : partial.line1 || address.line1 || "",
        town: partial.town || address.town || "",
        city: partial.city || address.city || "",
        district: partial.district || address.district || "",
        state: partial.state || address.state || "",
        pinCode: partial.pinCode || address.pinCode || "",
        country: partial.country || address.country || "India",
        formattedAddress: partial.formattedAddress || address.formattedAddress,
      });
      setStatusText(null);
    } catch (err) {
      console.error("Reverse geocoding error:", err);
      setStatusText("Failed to retrieve details. You can type them manually below.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Resilient Location Detector:
   * Tier 1: High Accuracy GPS (hardware GPS / mobile antenna)
   * Tier 2: Low Accuracy (WiFi / cell tower triangulation)
   * Tier 3: IP Geolocation fallback
   */
  const locate = () => {
    if (!navigator.geolocation) {
      fallbackIpLocation("Browser geolocation not supported");
      return;
    }

    setBusy(true);
    setStatusText("Acquiring high-accuracy GPS fix...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void reverse(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        console.warn("High-accuracy GPS failed, trying network fallback:", err.message);
        setStatusText("Refining with network location...");

        // Tier 2: Lower accuracy / longer maximumAge
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void reverse(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          },
          (err2) => {
            console.warn("Network geolocation failed, falling back to IP:", err2.message);
            fallbackIpLocation(
              err2.code === 1
                ? "Location permission denied. Detected approximate city via network."
                : "GPS timed out. Detected approximate city via network."
            );
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
    );
  };

  // Tier 3: IP Location fallback
  const fallbackIpLocation = async (message: string) => {
    setStatusText("Detecting city from network...");
    try {
      const res = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en");
      if (res.ok) {
        const bdc = await res.json();
        if (bdc.latitude && bdc.longitude) {
          setAccuracyNotice(message);
          void reverse(bdc.latitude, bdc.longitude);
          return;
        }
      }
    } catch {}
    setBusy(false);
    setStatusText(null);
    alert("Unable to detect location. Please search your area or click on the map.");
  };

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery.trim().length >= 3) {
        const results = await searchPlaces(searchQuery);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const selectSuggestion = async (place: any) => {
    setShowSuggestions(false);
    setSearchQuery(place.display_name);
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    await reverse(lat, lng);
  };

  const center: [number, number] =
    address.latitude != null && address.longitude != null
      ? [address.latitude, address.longitude]
      : [22.5726, 88.3639]; // Default to Kolkata/Bengal coordinates

  const markerIcon = L.divIcon({
    className: "map-marker-container",
    html: logo
      ? `<div style="width:42px;height:42px;background:#0d0d11;border:2.5px solid #d97706;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.6);"><img src="${resolveImageUrl(logo)}" style="width:80%;height:80%;object-fit:contain;" /></div>`
      : `<div style="position:relative;width:32px;height:40px;display:flex;align-items:center;justify-content:center;">
           <span style="display:block;width:24px;height:24px;background:linear-gradient(135deg, #f59e0b, #b45309);border:3px solid #ffffff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,0.4);"></span>
           <span style="position:absolute;bottom:0;width:8px;height:8px;background:rgba(0,0,0,0.3);border-radius:50%;filter:blur(2px);"></span>
         </div>`,
    iconSize: logo ? [42, 42] : [32, 40],
    iconAnchor: logo ? [21, 21] : [16, 38],
  });

  return (
    <div className="location-picker-card" style={{ gridColumn: "1 / -1", margin: "16px 0 24px 0" }}>
      {/* 1. Search Bar */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 14, color: "var(--muted)", pointerEvents: "none", zIndex: 2 }} />
            <input
              type="text"
              placeholder="Search your street, building, area, village or PIN code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              style={{
                width: "100%",
                paddingLeft: "42px",
                paddingRight: searchQuery ? "38px" : "14px",
                height: "46px",
                borderRadius: "12px",
                border: "1.5px solid var(--border)",
                background: "var(--layer-2)",
                color: "var(--text)",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                title="Clear search"
                style={{ position: "absolute", right: 10, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 6, zIndex: 2 }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="button"
            onClick={() => { if (suggestions.length > 0) selectSuggestion(suggestions[0]); }}
            disabled={busy || searchQuery.trim().length < 3}
            style={{ height: "46px", padding: "0 22px", borderRadius: "12px", fontSize: "13.5px", fontWeight: 700 }}
          >
            Search
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              zIndex: 1000,
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            {suggestions.map((place, i) => (
              <div
                key={i}
                onMouseDown={() => selectSuggestion(place)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  lineHeight: 1.45,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--layer-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <MapPin size={16} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ color: "var(--text)" }}>{place.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Action & Status Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
        <button
          type="button"
          className="button"
          onClick={locate}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "42px",
            padding: "0 20px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #d97706, #b45309)",
            color: "#ffffff",
            boxShadow: "0 4px 14px rgba(217, 119, 6, 0.3)",
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
          <span>{busy ? (statusText || "Detecting location...") : "Use My Exact Location"}</span>
        </button>

        {accuracyNotice && (
          <span style={{ fontSize: "12px", color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
            <Navigation size={13} /> {accuracyNotice}
          </span>
        )}

        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          📍 Click anywhere or drag the pin to set your exact doorstep.
        </span>
      </div>

      {/* 3. Interactive Leaflet Map (CartoDB Voyager: Crisp, reliable & global) */}
      <div style={{ borderRadius: "16px", overflow: "hidden", border: "1.5px solid var(--border)", position: "relative", boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}>
        <MapContainer
          key={`${center[0]}-${center[1]}`}
          center={center}
          zoom={address.latitude != null ? 16 : 6}
          scrollWheelZoom={false}
          style={{ height: "340px", background: "#1c1c24", zIndex: 1 }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          />
          <MapController center={center} />
          <MapEvents onPick={(lat, lng) => void reverse(lat, lng)} />

          {address.latitude != null && address.longitude != null && (
            <Marker
              position={[address.latitude, address.longitude]}
              icon={markerIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  void reverse(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* 4. Detected Address Summary Bar */}
      {address.formattedAddress && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "12px",
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            fontSize: "13px",
            color: "var(--text)",
          }}
        >
          <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, lineHeight: 1.45 }}>
            <strong style={{ color: "#059669" }}>Location Locked: </strong>
            <span>{address.formattedAddress}</span>
            {address.latitude != null && address.longitude != null && (
              <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                GPS: {address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  helperText = "",
}: {
  label: string;
  name: keyof Address;
  value: string;
  onChange: (name: keyof Address, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
        {label}
        {required && <span style={{ color: "var(--gold)", marginLeft: "4px" }}>*</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
        style={{
          height: "44px",
          padding: "0 14px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--layer-2)",
          color: "var(--text)",
          fontSize: "14px",
          outline: "none",
        }}
      />
      {helperText && <span style={{ fontSize: "11px", color: "var(--muted)" }}>{helperText}</span>}
    </label>
  );
}

/**
 * Enterprise Production Address Form (Amazon & Flipkart standard)
 * 1. Prominent High-Precision Location Detection at the top
 * 2. Instant India Post PIN Code Validation & Post Office area auto-fill
 * 3. Complete field synchronization with GPS coordinates
 */
export function AddressFields({
  value,
  onChange,
  showMap = true,
  logo,
}: {
  value: Address;
  onChange: (a: Address) => void;
  showMap?: boolean;
  logo?: string;
}) {
  const [mapOpen, setMapOpen] = useState(showMap);
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [pincodeSuccess, setPincodeSuccess] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [availablePostOffices, setAvailablePostOffices] = useState<string[]>([]);

  const field = (name: keyof Address, v: string) => {
    onChange({ ...value, [name]: v });
  };

  // Live India Post PIN Code Auto-Lookup on 6-digit PIN input
  const handlePinCodeChange = async (name: keyof Address, pin: string) => {
    const cleaned = pin.replace(/\D/g, "").slice(0, 6);
    field(name, cleaned);

    if (cleaned.length === 6) {
      setPincodeChecking(true);
      setPincodeSuccess(null);
      setPincodeError(null);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.[0]?.Status === "Success" && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
            const poList = data[0].PostOffice;
            const po = poList[0];
            const district = po.District || "";
            const state = po.State || "";
            const city = po.District || po.Division || "";
            const town = po.Name || "";

            const offices = poList.map((p: any) => p.Name).filter(Boolean).slice(0, 8);
            setAvailablePostOffices(offices);

            onChange({
              ...value,
              pinCode: cleaned,
              district: district || value.district,
              state: state || value.state,
              city: value.city || city,
              town: value.town || town,
              country: "India",
            });
            setPincodeSuccess(`${district}, ${state}`);
          } else {
            setPincodeError("Invalid Indian PIN code. Please check.");
            setAvailablePostOffices([]);
          }
        }
      } catch {
        setPincodeError(null);
      }
      setPincodeChecking(false);
    } else {
      setPincodeSuccess(null);
      setPincodeError(null);
      setAvailablePostOffices([]);
    }
  };

  const selectPostOffice = (poName: string) => {
    onChange({
      ...value,
      town: poName,
      line2: value.line2 ? `${value.line2}, ${poName}` : poName,
    });
  };

  return (
    <div className="address-fields-wrapper" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. TOP HEADER: Quick Location Detection & Map Toggle (Flipkart style) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "16px 20px",
          borderRadius: "14px",
          background: "rgba(217, 119, 6, 0.08)",
          border: "1px solid rgba(217, 119, 6, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={20} color="var(--gold)" />
          <div>
            <strong style={{ fontSize: "14px", color: "var(--text)", display: "block" }}>
              Quick Delivery Location
            </strong>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Auto-fill your exact street, city, district, state &amp; PIN code directly from GPS
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMapOpen(!mapOpen)}
          className="button ghost"
          style={{ height: "36px", padding: "0 14px", fontSize: "12.5px", borderRadius: "8px" }}
        >
          {mapOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span>{mapOpen ? "Hide Map & Search" : "Show Map & Search"}</span>
        </button>
      </div>

      {/* Expandable Location Picker & Leaflet Map */}
      {mapOpen && (
        <LocationPicker
          address={value}
          onChange={onChange}
          logo={logo}
          onPostOfficesLoaded={(offices) => setAvailablePostOffices(offices)}
        />
      )}

      {/* Post Office Suggestions Bar */}
      {availablePostOffices.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "var(--layer-2)",
            border: "1px solid var(--border)",
            fontSize: "12.5px",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--text)", display: "block", marginBottom: "8px" }}>
            📍 Select your local post office / area:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {availablePostOffices.map((po, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectPostOffice(po)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "99px",
                  border: value.town === po ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                  background: value.town === po ? "rgba(217, 119, 6, 0.15)" : "var(--card)",
                  color: value.town === po ? "var(--gold)" : "var(--text)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {po}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Structured Form Grid */}
      <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        <Field
          label="Full Name"
          name="fullName"
          value={value.fullName}
          onChange={field}
          required
          placeholder="e.g. Rahul Sharma"
        />

        <Field
          label="Contact Phone"
          name="phone"
          value={value.phone}
          onChange={field}
          type="tel"
          required
          placeholder="10-digit mobile number"
        />

        <div style={{ gridColumn: "1 / -1" }}>
          <Field
            label="Flat / House No. / Building / Street"
            name="line1"
            value={value.line1}
            onChange={field}
            required
            placeholder="e.g. Flat 4B, Shivalik Heights, 15 Park Street"
            helperText="Auto-populated from GPS or search. You can add your flat or door number."
          />
        </div>

        <Field
          label="Area / Sector / Colony (Line 2)"
          name="line2"
          value={value.line2}
          onChange={field}
          placeholder="e.g. Near City Center / Sector 5"
        />

        <Field
          label="Landmark (Optional)"
          name="landmark"
          value={value.landmark}
          onChange={field}
          placeholder="e.g. Opposite Metro Gate 2"
        />

        <Field
          label="Town / Village / Suburb"
          name="town"
          value={value.town}
          onChange={field}
          required
          placeholder="e.g. Park Street / Salt Lake"
        />

        <Field
          label="City"
          name="city"
          value={value.city}
          onChange={field}
          required
          placeholder="e.g. Kolkata"
        />

        <Field
          label="District"
          name="district"
          value={value.district}
          onChange={field}
          required
          placeholder="e.g. Kolkata / North 24 Parganas"
        />

        <Field
          label="State"
          name="state"
          value={value.state}
          onChange={field}
          required
          placeholder="e.g. West Bengal"
        />

        <div>
          <Field
            label="6-Digit PIN Code"
            name="pinCode"
            value={value.pinCode}
            onChange={handlePinCodeChange}
            required
            placeholder="e.g. 700016"
          />
          {pincodeChecking && (
            <span style={{ fontSize: "11px", color: "var(--gold)", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
              <Loader2 size={12} className="animate-spin" /> Verifying with India Post...
            </span>
          )}
          {pincodeSuccess && (
            <span style={{ fontSize: "11px", color: "#059669", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontWeight: 600 }}>
              <CheckCircle2 size={12} color="#059669" /> India Post: {pincodeSuccess}
            </span>
          )}
          {pincodeError && (
            <span style={{ fontSize: "11px", color: "var(--danger, #ef4444)", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontWeight: 600 }}>
              <AlertCircle size={12} /> {pincodeError}
            </span>
          )}
        </div>

        <Field
          label="Country"
          name="country"
          value={value.country || "India"}
          onChange={field}
          required
          placeholder="India"
        />
      </div>
    </div>
  );
}
