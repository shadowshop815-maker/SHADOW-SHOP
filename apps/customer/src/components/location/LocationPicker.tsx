import { useState, useEffect } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Address } from "../../types";
import { resolveImageUrl } from "../../api";

export const blankAddress: Address = { fullName: "", phone: "", line1: "", line2: "", landmark: "", town: "", city: "", district: "", state: "", pinCode: "", country: "India", latitude: null, longitude: null, formattedAddress: null, isDefault: false };

const markerIcon = L.divIcon({ className: "map-marker", html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 24] });

function MapEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) { 
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) }); 
  return null; 
}

export function LocationPicker({ address, onChange, logo }: { address: Address; onChange: (value: Address) => void; logo?: string }) { 
  const [busy, setBusy] = useState(false); 
  
  const reverse = async (lat: number, lng: number) => {
    setBusy(true);
    try {
      const apiKey = (import.meta as any).env.VITE_LOCATION_IQ_API_KEY;
      if (!apiKey) {
        throw new Error("LocationIQ API Key is missing");
      }
      const response = await fetch(`https://us1.locationiq.com/v1/reverse?key=${apiKey}&lat=${lat}&lon=${lng}&format=json`, { headers: { "accept-language": "en" } });
      const result = await response.json();
      
      if (!result.error) {
        const p = result.address || {};
        onChange({
          ...address, 
          latitude: lat, 
          longitude: lng, 
          formattedAddress: result.display_name || null, 
          line1: address.line1 || p.road || p.neighbourhood || "", 
          town: address.town || p.village || p.town || p.suburb || "", 
          city: address.city || p.city || p.municipality || "", 
          district: address.district || p.state_district || p.county || "", 
          state: address.state || p.state || "", 
          pinCode: address.pinCode || p.postcode || "", 
          country: address.country || p.country || ""
        });
      } else {
        onChange({ ...address, latitude: lat, longitude: lng });
      }
    } catch (error) {
      console.warn("Geocoding failed, falling back to basic coords", error);
      onChange({ ...address, latitude: lat, longitude: lng });
    } finally {
      setBusy(false)
    }
  }; 
  
  const locate = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) alert("Geolocation is not supported by this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => void reverse(pos.coords.latitude, pos.coords.longitude), 
      () => {
        setBusy(false);
        if (!silent) alert("Location permission was not granted. You can still click the map to choose a point.");
      }, 
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };
  
  useEffect(() => {
    // Auto-locate on mount if no location is set
    if (address.latitude == null && navigator.geolocation) {
      locate(true); // silent locate
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        try {
          const apiKey = (import.meta as any).env.VITE_LOCATION_IQ_API_KEY;
          if (!apiKey) return;
          const response = await fetch(`https://api.locationiq.com/v1/autocomplete?key=${apiKey}&q=${encodeURIComponent(searchQuery)}&limit=5`);
          const result = await response.json();
          if (!result.error && Array.isArray(result)) {
            setSuggestions(result);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        } catch {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const selectSuggestion = async (place: any) => {
    setShowSuggestions(false);
    setSearchQuery(place.display_name);
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    await reverse(lat, lng);
  };
  
  const searchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
    }
  };

  const center: [number, number] = address.latitude != null && address.longitude != null ? [address.latitude, address.longitude] : [20.5937, 78.9629]; 
  
  const markerIcon = L.divIcon({ 
    className: "map-marker-container", 
    html: logo ? `<div style="width:40px;height:40px;background:var(--panel);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.5);"><img src="${resolveImageUrl(logo)}" style="width:85%;height:85%;object-fit:contain;" /></div>` : `<span class="map-marker"><span></span></span>`, 
    iconSize: logo ? [40, 40] : [24, 24], 
    iconAnchor: logo ? [20, 20] : [12, 24] 
  });

  return (
    <div className="location-picker" style={{ gridColumn: "1 / -1", marginTop: "15px" }}>
      <form onSubmit={searchLocation} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <Search size={16} style={{ position: "absolute", left: 14, color: "var(--muted)", pointerEvents: "none", zIndex: 2 }} />
          <input 
            type="text" 
            placeholder="Search for a place (e.g. Park Street, Kolkata)" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            style={{ width: "100%", paddingLeft: "38px", paddingRight: searchQuery ? "38px" : "12px", height: "42px", borderRadius: "8px", position: "relative", zIndex: 1 }}
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery("")}
              title="Clear search"
              style={{ position: "absolute", right: 10, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", padding: 2, zIndex: 2 }}
            >
              <X size={14} />
            </button>
          )}
          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              zIndex: 1000,
              overflow: "hidden"
            }}>
              {suggestions.map((place, i) => (
                <div 
                  key={i}
                  onClick={() => selectSuggestion(place)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    background: "transparent",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--layer-2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <MapPin size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ color: "var(--text)", lineHeight: "1.4" }}>{place.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="button" disabled={busy || !searchQuery.trim()} style={{ height: "42px", padding: "0 20px" }}>
          Search
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
        <button type="button" className="outline-button" onClick={() => locate()} disabled={busy}>
          <LocateFixed size={17}/>{busy ? "Locating…" : "Use my current location"}
        </button>
        <span className="hint">Or click the map to drop a pin.</span>
      </div>
      
      <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={address.latitude == null ? 4 : 16} scrollWheelZoom={false} style={{ background: "#1a1a1a", borderRadius: "12px", border: "1px solid var(--border)", zIndex: 1, height: "400px" }}>
        <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0','mt1','mt2','mt3']} attribution="Google Maps" />
        <MapEvents onPick={(lat, lng) => void reverse(lat, lng)}/>
        {address.latitude != null && address.longitude != null && (
          <Marker 
            position={[address.latitude, address.longitude]} 
            icon={markerIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                reverse(position.lat, position.lng);
              }
            }}
          />
        )}
      </MapContainer>
      
      {address.formattedAddress && (
        <p className="located"><MapPin size={16}/>{address.formattedAddress}</p>
      )}
    </div>
  ); 
}

export function Field({ label, name, value, onChange, type = "text", required = false }: { label: string; name: keyof Address; value: string; onChange: (name: keyof Address, value: string) => void; type?: string; required?: boolean }) {
  return (
    <label>
      <span>{label}{required && " *"}</span>
      <input type={type} value={value} required={required} onChange={e => onChange(name, e.target.value)}/>
    </label>
  );
}

export function AddressFields({ value, onChange, showMap = true, logo }: { value: Address; onChange: (a: Address) => void; showMap?: boolean; logo?: string }) { 
  const field = (name: keyof Address, v: string) => onChange({ ...value, [name]: v }); 
  
  return (
    <>
      <div className="form-grid">
        <Field label="Full name" name="fullName" value={value.fullName} onChange={field} required/>
        <Field label="Phone" name="phone" value={value.phone} onChange={field} required/>
        <Field label="Address line 1" name="line1" value={value.line1} onChange={field} required/>
        <Field label="Address line 2" name="line2" value={value.line2} onChange={field}/>
        <Field label="Landmark" name="landmark" value={value.landmark} onChange={field}/>
        <Field label="Village / Town" name="town" value={value.town} onChange={field} required/>
        <Field label="City" name="city" value={value.city} onChange={field} required/>
        <Field label="District" name="district" value={value.district} onChange={field} required/>
        <Field label="State" name="state" value={value.state} onChange={field} required/>
        <Field label="PIN code" name="pinCode" value={value.pinCode} onChange={field} required/>
        <Field label="Country" name="country" value={value.country} onChange={field} required/>
      </div>
      {showMap && <LocationPicker address={value} onChange={onChange} logo={logo}/>}
    </>
  ); 
}
