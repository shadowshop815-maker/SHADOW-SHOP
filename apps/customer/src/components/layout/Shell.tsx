import { useEffect, useState, useRef, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, CircleUserRound, ShoppingBag, Menu, X, Sun, Moon, Sparkles } from "lucide-react";
import { api, money } from "../../api";
import type { Cart, StoreData } from "../../types";
import { useAuth } from "../../features/auth/AuthContext";
import { Brand } from "../ui";
import { Footer } from "./Footer";

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const prevCartCount = useRef<number>(0);
  
  const auth = useAuth();
  const location = useLocation();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<StoreData>("/settings")
  });
  
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Cart>("/cart")
  });

  // Track scroll position for subtle frosted glass transition
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile drawer on route change & smooth scroll to top
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  // Dark/Light mode theme state
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Set favicon and page title
  useEffect(() => {
    if (settings?.branding.favicon) {
      let favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.append(favicon);
      }
      favicon.href = settings.branding.favicon;
    }
    document.title = settings?.branding.storeName || "SHADOW SHOP";
  }, [settings]);

  // Animate cart badge when item count increases
  const cartItemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  useEffect(() => {
    if (cartItemCount !== prevCartCount.current) {
      if (cartItemCount > prevCartCount.current) {
        setCartPulse(true);
        const timer = setTimeout(() => setCartPulse(false), 500);
        return () => clearTimeout(timer);
      }
      prevCartCount.current = cartItemCount;
    }
  }, [cartItemCount]);

  const name = settings?.branding.storeName || "SHADOW SHOP";
  const freeShippingThreshold = cart?.shipping?.freeShippingThreshold ?? 500;
  const isFreeShippingEnabled = cart?.shipping?.freeShippingEnabled ?? true;
  const announcement = settings?.branding.tagline || (isFreeShippingEnabled ? `Complimentary standard delivery on orders above ${money(freeShippingThreshold)}` : `Welcome to ${name} · Official Online Store`);

  return (
    <div className="site">
      {/* Store Closed Banner if Admin sets store.isOpen = false */}
      {settings?.store && settings.store.isOpen === false && (
        <div style={{
          background: "#dc2626",
          color: "#ffffff",
          textAlign: "center",
          padding: "9px 16px",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 95
        }}>
          Notice: Store is temporarily closed for new orders. You may browse our catalog.
        </div>
      )}

      {/* Dynamic Announcement Bar controlled by Admin Branding Tagline / Free Shipping */}
      <aside className="announcement-bar" role="region" aria-label="Store Announcement">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={13} style={{ color: "var(--gold)" }} />
          <span>{announcement}</span>
        </span>
      </aside>

      {/* Main Navbar */}
      <header
        className="top"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 80,
          padding: scrolled ? "8px 20px" : "14px 20px",
          background: scrolled
            ? "color-mix(in srgb, var(--bg) 85%, transparent)"
            : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        <div
          className="nav-shell"
          style={{
            background: scrolled
              ? "var(--nav-bg)"
              : "color-mix(in srgb, var(--nav-bg) 92%, transparent)",
            boxShadow: scrolled
              ? "0 10px 30px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)"
              : "0 2px 12px rgba(0,0,0,0.03)",
            borderColor: scrolled ? "var(--border-strong)" : "var(--border)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <Brand logo={settings?.branding.headerLogo || settings?.branding.logo} name={name} />

          {/* Mobile hamburger button */}
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Navigation Links - Preserving the store's authentic sections */}
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            {[
              ["/", "Home"],
              ["/updates", "Updates"],
              ["/products", "Products"],
              ["/media", "Media"],
              ["/contact", "Contact"]
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
              >
                {label}
              </NavLink>
            ))}

            <NavLink to="/search" aria-label="Search">
              <Search size={17} />
              <span className="desktop-only">Search</span>
              <span className="mobile-only">Search</span>
            </NavLink>

            <NavLink to={auth.user ? "/account" : "/login"} aria-label="Account">
              <CircleUserRound size={17} />
              <span className="desktop-only">
                {auth.user?.name ? auth.user.name.split(" ")[0] : "Sign in"}
              </span>
              <span className="mobile-only">Account</span>
            </NavLink>

            <NavLink
              to="/cart"
              className={`cart-link ${cartPulse ? "cart-badge-pulse" : ""}`}
              aria-label={`Cart with ${cartItemCount} items`}
            >
              <ShoppingBag size={17} />
              <span className="mobile-only">Cart</span>
              {cartItemCount > 0 ? (
                <i className={cartPulse ? "cart-badge-pulse" : ""}>
                  {cartItemCount}
                </i>
              ) : null}
            </NavLink>

            {/* Theme Toggle Button */}
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main id="main-content">{children}</main>

      {/* Footer */}
      <Footer settings={settings} />

      {/* WhatsApp Concierge floating button (controlled by Admin store.whatsappEnabled) */}
      {settings?.store.whatsappEnabled && settings.store.whatsapp ? (
        <a
          className="whatsapp"
          href={`https://wa.me/${settings.store.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
            settings.store.whatsappMessage || "Hello SHADOW SHOP, I have an enquiry."
          )}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Connect with SHADOW SHOP on WhatsApp"
        >
          WA
        </a>
      ) : null}
    </div>
  );
}
