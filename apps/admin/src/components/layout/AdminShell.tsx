import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, ShoppingBag, Tags, Boxes, ClipboardList, X, 
  RotateCcw, RefreshCw, Users, Newspaper, Image, MessageSquareMore, 
  Settings, ShieldAlert, BarChart3, Menu, Sun, Moon, LogOut, Receipt, Mail
} from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import { api } from "../../api";

const nav = [
  { label: "Dashboard", items: [["/", LayoutDashboard, "Overview"]] },
  { label: "Catalog", items: [["/products", ShoppingBag, "Products"], ["/categories", Tags, "Categories"], ["/inventory", Boxes, "Inventory"]] },
  { label: "Sales", items: [["/orders", ClipboardList, "Orders"], ["/cancellations", X, "Cancellations"], ["/returns", RotateCcw, "Returns"], ["/refunds", RefreshCw, "Refunds"]] },
  { label: "Customers", items: [["/customers", Users, "All customers"]] },
  { label: "Content", items: [["/updates", Newspaper, "Updates"], ["/media", Image, "Media"], ["/newsletter", MessageSquareMore, "Newsletter"]] },
  { label: "Marketing", items: [["/offers", Tags, "Offers & Promotions"]] },
  { label: "Communication", items: [["/enquiries", MessageSquareMore, "Enquiries"]] },
  { label: "System", items: [["/settings", Settings, "Store settings"], ["/tax", Receipt, "Tax & GST"], ["/email-logs", Mail, "Email Logs"], ["/security", ShieldAlert, "Authentication & OTP"], ["/audit", BarChart3, "Audit logs"]] }
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [sidebar, setSidebar] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("shadow_admin_theme") !== "light");
  const location = useLocation();

  const { data: settings } = useQuery({
    queryKey: ["settings-admin"],
    queryFn: () => api<{ branding: Record<string, unknown>; store: Record<string, unknown>; location: Record<string, unknown> }>("/settings")
  });

  useEffect(() => setSidebar(false), [location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("shadow_admin_theme", dark ? "dark" : "light");
  }, [dark]);

  const storeName = (settings?.branding?.storeName as string) || "SHADOW SHOP";
  const headerLogo = (settings?.branding?.headerLogo as string) || (settings?.branding?.logo as string);

  return (
    <div className="admin-shell">
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <div className="control-brand">
          {headerLogo ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <img src={headerLogo} alt={storeName} style={{ maxHeight: "24px", maxWidth: "100%", objectFit: "contain" }} />
              <small>CONTROL CENTER</small>
            </div>
          ) : (
            <>
              <span>{storeName.split(" ")[0]}</span><b>{storeName.split(" ").slice(1).join(" ")}</b>
              <small>CONTROL CENTER</small>
            </>
          )}
        </div>
        <nav>
          {nav.map(section => (
            <div className="nav-group" key={section.label}>
              <p>{section.label}</p>
              {section.items.map(([to, Icon, label]: any) => (
                <NavLink to={to as string} end={to === "/"} key={to as string}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      
      {sidebar && <button className="sidebar-shade" onClick={() => setSidebar(false)} aria-label="Close menu" />}
      
      <div className="admin-main">
        <header className="admin-top">
          <button className="mobile-toggle" onClick={() => setSidebar(!sidebar)}><Menu /></button>
          <div>
            <span>Operations workspace</span>
            <b>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</b>
          </div>
          <div className="top-actions">
            <a className="store-link" href="http://localhost:3000" target="_blank" rel="noreferrer">View store ↗</a>
            <button onClick={() => setDark(!dark)} aria-label="Toggle color theme">{dark ? <Sun /> : <Moon />}</button>
            <span className="avatar">{auth.user?.name.slice(0, 2).toUpperCase()}</span>
            <button onClick={auth.logout} aria-label="Sign out"><LogOut /></button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
