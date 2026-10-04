import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, LocateFixed, Search, X, CheckCircle2, MapPin } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState } from "../../components/ui";
import { HeroSlideEditor } from "../../components/HeroSlideEditor";
import { PromoBannerEditor } from "../../components/PromoBannerEditor";
import { DeliveryConfig } from "./Delivery";

type StoreSettings = { store: Record<string, unknown>; branding: Record<string, unknown>; location: Record<string, unknown> };

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, v => v.toUpperCase());
}

const markerIcon = L.divIcon({ className: "map-marker", html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 24] });

function MapEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) { 
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) }); 
  return null; 
}

function AdminLocationPicker({ form, setForm, logo }: { form: Record<string, unknown>; setForm: (f: Record<string, unknown>) => void; logo?: string }) {
  const [busy, setBusy] = useState(false);

  const reverse = async (lat: number, lng: number) => {
    setBusy(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { "accept-language": "en" } });
      const result = await response.json();
      const p = result.address || {};
      const streetOrArea = p.road || p.neighbourhood || p.suburb || p.hamlet || p.commercial || p.residential || "";
      const currentLandmark = String(form.landmark || "");
      const isJunkLandmark = /^a+$/i.test(currentLandmark.trim());
      setForm({
        ...form,
        latitude: lat,
        longitude: lng,
        line1: streetOrArea || form.line1 || "",
        landmark: isJunkLandmark ? "" : form.landmark,
        city: p.city || p.municipality || p.town || p.village || form.city || "",
        district: p.state_district || p.county || form.district || "",
        state: p.state || form.state || "",
        pinCode: p.postcode || form.pinCode || "",
        country: p.country || form.country || "India",
        mapsUrl: form.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      });
    } catch {
      setForm({ 
        ...form, 
        latitude: lat, 
        longitude: lng,
        mapsUrl: form.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      });
    } finally {
      setBusy(false);
    }
  };

  const locate = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) alert("Geolocation not supported by your browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => void reverse(pos.coords.latitude, pos.coords.longitude),
      () => { 
        setBusy(false); 
        if (!silent) alert("Location permission denied."); 
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (form.latitude == null && form.longitude == null && navigator.geolocation) {
      locate(true);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&limit=5`);
          const result = await response.json();
          setSuggestions(result || []);
          setShowSuggestions(true);
        } catch {}
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

  const searchLocation = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
    }
  };

  const lat = form.latitude != null && form.latitude !== "" ? Number(form.latitude) : null;
  const lng = form.longitude != null && form.longitude !== "" ? Number(form.longitude) : null;
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : [20.5937, 78.9629];
  
  const markerIcon = L.divIcon({ 
    className: "map-marker-container", 
    html: logo ? `<div style="width:40px;height:40px;background:var(--panel);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.5);"><img src="${logo}" style="width:85%;height:85%;object-fit:contain;" /></div>` : `<span class="map-marker"><span></span></span>`, 
    iconSize: logo ? [40, 40] : [24, 24], 
    iconAnchor: logo ? [20, 20] : [12, 24] 
  });

  return (
    <div className="location-picker wide" style={{ gridColumn: "1 / -1", marginTop: 10 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 15, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <Search size={16} style={{ position: "absolute", left: 14, color: "var(--muted)", pointerEvents: "none", zIndex: 2 }} />
          <input 
            type="text" 
            placeholder="Search for a place (e.g. Park Street, Kolkata)" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchLocation(); } }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            style={{ width: "100%", paddingLeft: "38px", paddingRight: searchQuery ? "38px" : "12px", border: "1px solid var(--line)", borderRadius: 10, height: 42, background: "var(--panel2)", color: "var(--ink)", boxSizing: "border-box", position: "relative", zIndex: 1 }} 
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
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
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
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--line)" : "none",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    background: "transparent",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--panel3)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <MapPin size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ color: "var(--ink)", lineHeight: "1.4" }}>{place.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="secondary" onClick={() => searchLocation()} disabled={busy || !searchQuery.trim()} style={{ height: 42 }}>Search</button>
        <button type="button" className="ghost" onClick={() => locate(false)} disabled={busy} style={{ height: 42 }}><LocateFixed size={16}/>{busy ? "Locating..." : "Use my location"}</button>
      </div>
      <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={lat != null ? 16 : 4} scrollWheelZoom={false} attributionControl={false} style={{ height: 400, borderRadius: 16, zIndex: 1, background: "#1a1a1a" }}>
        <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0','mt1','mt2','mt3']} attribution="Google Maps" />
        <MapEvents onPick={(lat, lng) => void reverse(lat, lng)} />
        {lat != null && lng != null && (
          <Marker 
            position={[lat, lng]} 
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

      {/* Precision tip */}
      <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "rgba(181,138,53,0.08)", border: "1px solid rgba(181,138,53,0.22)", borderRadius: 10, fontSize: 12 }}>
        <span style={{ color: "var(--gold)", fontSize: 16, lineHeight: 1 }}>📍</span>
        <div style={{ color: "var(--muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--ink)" }}>For 100% accurate location:</strong> Zoom into the map → search your address → then <strong>drag the pin</strong> to the exact building entrance. The marker position is what customers will see on the map.
          {lat != null && lng != null && (
            <span style={{ display: "inline-block", marginLeft: 10 }}>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--gold)", fontWeight: 700 }}
              >
                Verify in Google Maps ↗
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsForm({ section, initial, fields, textareas = [], numberFields = [], booleans = [], uploadFields = [], hiddenFields = [], renderExtra, isSaving, onSave }: { section: string; initial: Record<string, unknown>; fields: string[]; textareas?: string[]; numberFields?: string[]; booleans?: string[]; uploadFields?: string[]; hiddenFields?: string[]; renderExtra?: (form: Record<string, unknown>, setForm: (f: Record<string, unknown>) => void) => React.ReactNode; isSaving?: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const next: Record<string, unknown> = {};
    [...fields, ...booleans, ...hiddenFields].forEach(k => next[k] = initial[k] ?? (booleans.includes(k) ? false : ""));
    return next;
  });
  
  const [busy, setBusy] = useState("");
  
  const upload = async (file: File, key: string) => {
    setBusy(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<{ url: string }>("/admin/uploads", { method: "POST", body: fd });
      setForm({ ...form, [key]: result.url });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  
  return (
    <form className="card settings-form" onSubmit={e => {
      e.preventDefault();
      const body = { ...form };
      numberFields.forEach(k => body[k] = body[k] === "" || body[k] == null ? null : Number(body[k]));
      onSave(body);
    }}>
      <div className="settings-title">
        <div>
          <h2>{labelize(section)}</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            Configure and synchronize {section} variables across the customer storefront and control center.
          </p>
        </div>
      </div>
      
      <div className="form-grid">
        {fields.filter(key => !uploadFields.includes(key)).map(key => (
          <label className={textareas.includes(key) ? "wide" : ""} key={key}>
            <span>{labelize(key)}</span>
            {textareas.includes(key) ? (
              <textarea rows={5} value={String(form[key] ?? "")} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            ) : (
              <input type={numberFields.includes(key) || ["taxRate", "shippingCharge", "freeShippingThreshold", "returnPeriodDays"].includes(key) ? "number" : "text"} step="any" value={String(form[key] ?? "")} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>

      {fields.some(key => uploadFields.includes(key)) && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", color: "var(--gold)", textTransform: "uppercase", marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            Media & Assets
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 24 }}>
            {fields.filter(key => uploadFields.includes(key)).map(key => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{labelize(key)}</span>
                <div>
                  {form[key] ? (
                    <div 
                      className="image-upload-preview"
                      onMouseEnter={e => {
                        const overlay = e.currentTarget.querySelector('.image-upload-overlay') as HTMLDivElement;
                        if (overlay) overlay.style.opacity = '1';
                      }}
                      onMouseLeave={e => {
                        const overlay = e.currentTarget.querySelector('.image-upload-overlay') as HTMLDivElement;
                        if (overlay && busy !== key) overlay.style.opacity = '0';
                      }}
                      style={{ 
                        width: "100%", 
                        height: 180, 
                        borderRadius: 16, 
                        border: "1px solid var(--line)", 
                        background: "var(--panel3)", 
                        overflow: "hidden", 
                        display: "flex", 
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        cursor: "pointer",
                        boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)"
                      }}
                    >
                      <img src={String(form[key])} alt={key} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", zIndex: 1, padding: 12 }} />
                      <div 
                        className="image-upload-overlay"
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.7)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          color: "#fff",
                          opacity: busy === key ? 1 : 0,
                          transition: "opacity 0.2s",
                          backdropFilter: "blur(6px)",
                          zIndex: 2,
                          pointerEvents: "none"
                        }}
                      >
                        <Upload size={26} />
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {busy === key ? "Uploading..." : "Change Image"}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => e.target.files?.[0] && void upload(e.target.files[0], key)} 
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", zIndex: 10 }} 
                        title="Click to change image"
                      />
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        width: "100%", 
                        height: 180, 
                        borderRadius: 16, 
                        border: "2px dashed var(--line)", 
                        background: "var(--panel2)", 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        position: "relative", 
                        gap: 12, 
                        color: "var(--muted)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--gold)";
                        e.currentTarget.style.color = "var(--text)";
                        e.currentTarget.style.background = "var(--panel3)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--line)";
                        e.currentTarget.style.color = "var(--muted)";
                        e.currentTarget.style.background = "var(--panel2)";
                      }}
                    >
                      <Upload size={28} />
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {busy === key ? "Uploading..." : "Upload Image"}
                      </span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => e.target.files?.[0] && void upload(e.target.files[0], key)} 
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", zIndex: 10 }} 
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {renderExtra?.(form, setForm)}
      
      <div className="boolean-grid">
        {booleans.map(key => (
          <label className="check" key={key}>
            <input type="checkbox" checked={Boolean(form[key])} onChange={e => setForm({ ...form, [key]: e.target.checked })} />
            {labelize(key)}
          </label>
        ))}
      </div>
      
      <div className="form-actions" style={{ marginTop: "28px" }}>
        <button type="submit" className="primary" disabled={isSaving} style={{ minWidth: 160, justifyContent: "center" }}>
          {isSaving ? (
            <>
              <svg className="spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Saving...
            </>
          ) : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const confirm = useConfirm();
  const client = useQueryClient();
  const location = useLocation();
  const [tab, setTab] = useState<"branding" | "store" | "location" | "delivery">((location.state as any)?.tab || "branding");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["settings-admin"],
    queryFn: () => api<StoreSettings>("/admin/settings")
  });
  
  const mutation = useMutation({
    mutationFn: ({ section, body }: { section: string; body: Record<string, unknown> }) => api(`/admin/settings/${section}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_, variables) => {
      client.invalidateQueries({ queryKey: ["settings-admin"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setToast({ message: `${labelize(variables.section)} settings saved and updated across the platform.`, type: "success" });
      setTimeout(() => setToast(null), 4000);
    },
    onError: err => {
      setToast({ message: (err as Error).message || "Failed to update settings.", type: "error" });
    }
  });
  
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} />;
  
  return (
    <>
      <PageHead eyebrow="SYSTEM ARCHITECTURE" title="Platform Configurations" description="Core parameters and systemic variables for the SHADOW SHOP ecosystem." />
      
      {toast && (
        <div style={{
          background: toast.type === "success" ? "rgba(48, 209, 88, 0.12)" : "rgba(255, 69, 58, 0.12)",
          border: toast.type === "success" ? "1px solid rgba(48, 209, 88, 0.3)" : "1px solid rgba(255, 69, 58, 0.3)",
          color: toast.type === "success" ? "#30D158" : "#FF453A",
          padding: "14px 18px",
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <span>⚠</span>}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="tabs">
        {(["branding", "store", "delivery", "location"] as const).map(v => (
          <button className={tab === v ? "active" : ""} onClick={() => setTab(v as any)} key={v}>{v}</button>
        ))}
      </div>
      
      {tab === "branding" && <SettingsForm key={`brand-${String(data.branding.updatedAt)}`} section="branding" initial={data.branding} isSaving={mutation.isPending} fields={["storeName", "logo", "headerLogo", "footerLogo", "favicon", "tagline", "storeDescription", "heroHeading", "heroSubheading", "heroButtonText", "heroButtonLink", "newsletterHeading", "newsletterText"]} hiddenFields={["heroImage", "promotionalBanner"]} textareas={["storeDescription", "heroSubheading", "newsletterText"]} uploadFields={["logo", "headerLogo", "footerLogo", "favicon"]} renderExtra={(form, setForm) => (
        <>
          <PromoBannerEditor value={String(form.promotionalBanner || "")} onChange={val => setForm({ ...form, promotionalBanner: val })} />
          <HeroSlideEditor value={String(form.heroImage || "")} onChange={val => setForm({ ...form, heroImage: val })} />
        </>
      )} onSave={body => {
        mutation.mutate({ section: "branding", body });
      }} />}
      
      {tab === "store" && <SettingsForm key={`store-${String(data.store.updatedAt)}`} section="store" initial={data.store} isSaving={mutation.isPending} fields={["email", "phone", "whatsapp", "whatsappMessage", "currency", "taxRate", "returnsEnabled", "requireReturnReason", "allowReturnComment", "requirePhotoForDamage", "allowPartialReturns", "allowedReturnResolutions", "returnExpiredMessage", "cancellationPolicy", "returnPolicy", "privacyPolicy", "terms"]} textareas={["whatsappMessage", "cancellationPolicy", "returnPolicy", "privacyPolicy", "terms", "returnExpiredMessage", "allowedReturnResolutions"]} booleans={["whatsappEnabled", "isOpen", "returnsEnabled", "requireReturnReason", "allowReturnComment", "requirePhotoForDamage", "allowPartialReturns"]} numberFields={["taxRate"]} hiddenFields={["socialProfiles", "returnWindowMinutes", "returnPeriodDays"]} renderExtra={(form, setForm) => {
        let profiles: Record<string, string> = {};
        try { profiles = JSON.parse(String(form.socialProfiles || "{}")); } catch {}
        const updateProfile = (k: string, v: string) => setForm({ ...form, socialProfiles: JSON.stringify({ ...profiles, [k]: v }) });
        
        const totalMins = Number(form.returnWindowMinutes || 0);
        const windowDays = Math.floor(totalMins / 1440);
        const windowHours = Math.floor((totalMins % 1440) / 60);
        const windowMinsRemainder = totalMins % 60;
        
        const updateWindow = (d: number, h: number, m: number) => {
          setForm({ ...form, returnWindowMinutes: (d * 1440) + (h * 60) + m });
        };
        
        return (
          <>
            <div className="wide" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Return Policy Window</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "-10px 0 16px" }}>Configure how long customers have to request a return after delivery.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <label><span>Days</span><input type="number" min="0" value={windowDays} onChange={e => updateWindow(Number(e.target.value), windowHours, windowMinsRemainder)} /></label>
                <label><span>Hours</span><input type="number" min="0" max="23" value={windowHours} onChange={e => updateWindow(windowDays, Number(e.target.value), windowMinsRemainder)} /></label>
                <label><span>Minutes</span><input type="number" min="0" max="59" value={windowMinsRemainder} onChange={e => updateWindow(windowDays, windowHours, Number(e.target.value))} /></label>
              </div>
            </div>
            
            <div className="wide" style={{ marginTop: 30 }}>
              <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Social Profiles</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                <label><span>Instagram URL</span><input type="text" value={profiles.instagram || ""} onChange={e => updateProfile("instagram", e.target.value)} /></label>
                <label><span>Facebook URL</span><input type="text" value={profiles.facebook || ""} onChange={e => updateProfile("facebook", e.target.value)} /></label>
                <label><span>Twitter (X) URL</span><input type="text" value={profiles.twitter || ""} onChange={e => updateProfile("twitter", e.target.value)} /></label>
                <label><span>YouTube URL</span><input type="text" value={profiles.youtube || ""} onChange={e => updateProfile("youtube", e.target.value)} /></label>
              </div>
            </div>
          </>
        );
      }} onSave={body => {
        mutation.mutate({ section: "store", body });
      }} />}
      
      {tab === "delivery" && <DeliveryConfig />}

      {tab === "location" && <SettingsForm key={`loc-${String(data.location.updatedAt)}`} section="location" initial={data.location} isSaving={mutation.isPending} fields={["branchName", "line1", "line2", "landmark", "city", "district", "state", "country", "pinCode", "latitude", "longitude", "mapsUrl", "placeId"]} numberFields={["latitude", "longitude"]} renderExtra={(form, setForm) => <AdminLocationPicker form={form} setForm={setForm} logo={data.branding.logo as string | undefined} />} onSave={body => {
        mutation.mutate({ section: "location", body });
      }} />}
      
      {mutation.error && <p className="form-error" style={{ marginTop: "16px" }}>{mutation.error.message}</p>}
    </>
  );
}
