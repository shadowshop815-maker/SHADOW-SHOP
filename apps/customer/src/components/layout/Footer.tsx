import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import type { StoreData } from "../../types";
import { Brand } from "../ui";
import { useSettings } from "../../context/SettingsContext";

export function Footer({ settings }: { settings?: StoreData }) { 
  const { openMapModal } = useSettings();
  const storeName = settings?.branding.storeName || "SHADOW SHOP";
  const storeDesc = settings?.branding.storeDescription || "Independent essentials for people who move differently.";
  const locationText = [settings?.location.line1, settings?.location.city, settings?.location.state, settings?.location.pinCode].filter(Boolean).join(", ");

  return (
    <footer>
      <div className="footer-grid">
        <div>
          <Brand logo={settings?.branding.footerLogo || settings?.branding.logo} name={storeName} />
          <p>{storeDesc}</p>
        </div>
        <div>
          <h3>Explore</h3>
          <Link to="/products">Shop all</Link>
          <Link to="/updates">Updates</Link>
          <Link to="/media">Media</Link>
        </div>
        <div>
          <h3>Help</h3>
          <Link to="/contact">Contact</Link>
          <Link to="/policies">Policies</Link>
          <Link to="/account">Your account</Link>
        </div>
        <div>
          <h3>Visit</h3>
          <p>{locationText || "Store location available soon"}</p>
          <button 
            type="button"
            onClick={openMapModal} 
            style={{ 
              background: "transparent", 
              border: "none", 
              color: "inherit", 
              padding: 0, 
              textDecoration: "underline", 
              cursor: "pointer", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px",
              marginTop: "4px"
            }}
          >
            <MapPin size={13} color="var(--gold)" />
            <span>View on map</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
      <div className="copyright">
        <span>© {new Date().getFullYear()} {storeName}. All rights reserved.</span>
        <div style={{ display: "flex", gap: "20px" }}>
          <Link to="/policies" style={{ color: "inherit" }}>Policies</Link>
          <Link to="/contact" style={{ color: "inherit" }}>Contact</Link>
        </div>
      </div>
    </footer>
  ); 
}
