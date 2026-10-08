import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../../api";
import { useAuth } from "../../features/auth/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import type { StoreData } from "../../types";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { Mail, Phone, MapPin, MessageCircle, Send, CheckCircle2, Loader2 } from "lucide-react";

const MapDisplay = ({ lat, lng, logo }: { lat: number; lng: number; logo?: string }) => {
  const markerIcon = L.divIcon({ 
    className: "map-marker-container", 
    html: logo ? `<div style="width:48px;height:48px;background:var(--bg);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.2);"><img src="${resolveImageUrl(logo)}" style="width:85%;height:85%;object-fit:contain;" /></div>` : `<span class="map-marker"><span></span></span>`, 
    iconSize: logo ? [48, 48] : [24, 24], 
    iconAnchor: logo ? [24, 48] : [12, 24] 
  });
  return (
    <div style={{ height: "100%", minHeight: 300, width: "100%", borderRadius: 16, overflow: "hidden", position: "relative", zIndex: 1, border: "1px solid var(--border)", background: "var(--layer-2)" }}>
      <MapContainer key={`${lat}-${lng}`} center={[lat, lng]} zoom={15} scrollWheelZoom={false} attributionControl={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={['mt0','mt1','mt2','mt3']} attribution="Google Maps" />
        <Marker position={[lat, lng]} icon={markerIcon} />
      </MapContainer>
    </div>
  );
};

export function Contact() { 
  const auth = useAuth(); 
  const { openMapModal } = useSettings();
  const [form, setForm] = useState({ name: auth.user?.name || "", email: auth.user?.email || "", phone: auth.user?.phone || "", subject: "", message: "" }); 
  const [sent, setSent] = useState(false); 
  
  const mutation = useMutation({
    mutationFn: () => api("/enquiries", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => setSent(true)
  }); 
  
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api<StoreData>("/settings") });
  const loc = settings?.location;
  const store = settings?.store;
  
  const addressString = loc ? [loc.line1, loc.line2, loc.landmark, loc.city, loc.state, loc.pinCode].filter(Boolean).join(", ") : "";

  return (
    <section className="section page" style={{ minHeight: "80vh", paddingTop: "4rem" }}>
      
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <span className="eyebrow" style={{ color: "var(--gold)" }}>GET IN TOUCH</span>
        <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "1rem 0", fontWeight: 800, letterSpacing: "-0.05em" }}>Contact Us</h1>
        <p style={{ color: "var(--muted)", fontSize: "1.1rem", maxWidth: 600, margin: "0 auto" }}>
          Have a question about our products, your order, or just want to say hi? We'd love to hear from you.
        </p>
      </div>
      
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2.5rem" }}>
        
        {/* Left Column: Contact Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", margin: 0 }}>
            <h3 style={{ fontSize: "1.3rem", margin: 0, fontWeight: 700 }}>Contact Information</h3>
            
            {store?.email && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--layer-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", flexShrink: 0 }}>
                  <Mail size={18} />
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</p>
                  <a href={`mailto:${store.email}`} style={{ color: "var(--muted)", textDecoration: "none" }}>{store.email}</a>
                </div>
              </div>
            )}
            
            {store?.phone && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--layer-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", flexShrink: 0 }}>
                  <Phone size={18} />
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</p>
                  <a href={`tel:${store.phone}`} style={{ color: "var(--muted)", textDecoration: "none" }}>{store.phone}</a>
                </div>
              </div>
            )}
            
            {store?.whatsappEnabled && store.whatsapp && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--layer-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#25D366", flexShrink: 0 }}>
                  <MessageCircle size={18} />
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>WhatsApp</p>
                  <a href={`https://wa.me/${store.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ color: "var(--muted)", textDecoration: "none" }}>{store.whatsapp}</a>
                </div>
              </div>
            )}
            
            {addressString && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--layer-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", flexShrink: 0 }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Store Address</p>
                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>{addressString}</p>
                  <button onClick={openMapModal} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', padding: '10px 0 0 0', textDecoration: 'underline', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                    View Store Location on Map <MapPin size={14}/>
                  </button>
                </div>
              </div>
            )}
          </div>

          {loc?.latitude != null && loc?.longitude != null && (
            <div style={{ flex: 1, minHeight: 300 }}>
              <MapDisplay lat={loc.latitude} lng={loc.longitude} logo={settings?.branding.logo} />
            </div>
          )}
          
        </div>

        {/* Right Column: Form */}
        <div className="panel" style={{ margin: 0, padding: "3rem", borderRadius: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.06)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--card)" }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(37, 211, 102, 0.1)", color: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                <CheckCircle2 size={40} />
              </div>
              <h2 style={{ fontSize: "1.75rem", marginBottom: "1rem", fontWeight: 800 }}>Message sent!</h2>
              <p style={{ color: "var(--muted)", fontSize: "1.05rem", lineHeight: 1.6, marginBottom: "2rem" }}>
                Thank you for reaching out. We have received your message and will get back to you at <strong>{form.email}</strong> shortly.
              </p>
              <button className="button outline-button" onClick={() => { setSent(false); setForm({ ...form, subject: "", message: "" }); }}>Send another</button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: "1.75rem", margin: "0 0 2rem 0", fontWeight: 800 }}>Send us a message</h2>
              <style>{`
                .professional-input {
                  padding: 16px 20px !important;
                  border-radius: 14px !important;
                  border: 1px solid var(--border) !important;
                  background: var(--layer-2) !important;
                  font-size: 15px !important;
                  color: var(--text) !important;
                  transition: all 0.25s ease !important;
                  width: 100%;
                  box-sizing: border-box;
                }
                .professional-input:focus {
                  background: var(--card) !important;
                  border-color: var(--gold) !important;
                  box-shadow: 0 0 0 4px rgba(181, 138, 53, 0.15) !important;
                }
                .professional-label {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                  margin-bottom: 1.25rem;
                }
                .professional-label span {
                  font-size: 13px;
                  font-weight: 700;
                  color: var(--text);
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }
                .professional-form-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 0 1.5rem;
                }
                @media (max-width: 600px) {
                  .professional-form-grid { grid-template-columns: 1fr; }
                }
              `}</style>
              <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} style={{ display: "flex", flexDirection: "column" }}>
                
                <div className="professional-form-grid">
                  <label className="professional-label">
                    <span>Name *</span>
                    <input className="professional-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                  </label>
                  <label className="professional-label">
                    <span>Email *</span>
                    <input className="professional-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                  </label>
                  <label className="professional-label">
                    <span>Phone</span>
                    <input className="professional-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                  </label>
                  <label className="professional-label">
                    <span>Subject *</span>
                    <input className="professional-input" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
                  </label>
                </div>
                
                <label className="professional-label" style={{ marginBottom: "0.5rem" }}>
                  <span>Message *</span>
                  <textarea className="professional-input" rows={5} required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Your message here..." style={{ resize: "vertical", minHeight: "120px" }} />
                </label>
                
                {mutation.error && <p className="error-text" style={{ margin: "10px 0", fontWeight: 600 }}>{mutation.error.message}</p>}
                
                <button 
                  className="button full" 
                  disabled={mutation.isPending} 
                  style={{ 
                    marginTop: "1.5rem", 
                    padding: "18px", 
                    fontSize: "16px", 
                    fontWeight: 800, 
                    borderRadius: "100px",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
                    letterSpacing: "0.03em"
                  }}
                >
                  {mutation.isPending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                  {mutation.isPending ? "Sending Message..." : "Send Message"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  ); 
}
