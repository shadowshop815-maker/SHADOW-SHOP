import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Truck, RefreshCw, Headphones, Sparkles } from "lucide-react";
import { api, resolveImageUrl } from "../api";
import type { StoreData, Product } from "../types";
import { Spinner } from "../components/ui";
import { ProductCard } from "../components/product/ProductCard";
import { Newsletter } from "../components/Newsletter";
import { HeroCarousel } from "../components/HeroCarousel";
import { PromoCarousel } from "../components/PromoCarousel";
import { useSettings } from "../context/SettingsContext";
import { Reveal, StaggerContainer, StaggerItem, useMouseParallax } from "../components/motion/Motion";

const TICKER_ITEMS = [
  "Free Delivery on Orders Above ₹500",
  "Premium Quality, Everyday Style",
  "Easy Returns Policy",
  "Curated Drops Every Season",
  "COD Available Across India",
  "100% Authentic Products",
];

const TRUST_PILLARS = [
  { Icon: Truck,        title: "Free Delivery",   desc: "Complimentary standard shipping on all orders above ₹500 across India." },
  { Icon: ShieldCheck,  title: "100% Authentic",  desc: "Every item is sourced directly and verified for quality before dispatch." },
  { Icon: RefreshCw,    title: "Easy Returns",    desc: "Changed your mind? Hassle-free returns within the stated return window." },
  { Icon: Headphones,   title: "Premium Support", desc: "Available via WhatsApp and email — we respond to every query." },
];

export function Home() {
  const { openMapModal } = useSettings();
  const mouseParallax = useMouseParallax(10);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<StoreData>("/settings"),
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", "home"],
    queryFn: () => api<{ items: Product[] }>("/products?sort=featured&limit=8"),
  });

  const { data: updates } = useQuery({
    queryKey: ["updates"],
    queryFn: () =>
      api<Array<{ id: string; title: string; description: string; coverImage: string; publishDate: string }>>(
        "/updates"
      ),
  });

  const branding = settings?.branding;
  const store = settings?.store;

  /* Detect whether carousel has any real image slides */
  let heroSlides: any[] = [];
  try {
    heroSlides = JSON.parse(branding?.heroImage || "[]");
    if (!Array.isArray(heroSlides)) heroSlides = [];
  } catch {
    if (branding?.heroImage && !branding.heroImage.startsWith("[")) {
      heroSlides = [{ id: "legacy", image: branding.heroImage, link: branding.heroButtonLink || "/products" }];
    }
  }
  const hasHeroImages = heroSlides.some((s: any) => s.image && String(s.image).trim() !== "");

  /* Parse promotional banners — supports both old string URL and new JSON array */
  let promoSlides: Array<{ id?: string; image: string; link?: string; title?: string }> = [];
  try {
    const raw = branding?.promotionalBanner;
    if (raw && typeof raw === "string") {
      if (raw.startsWith("[")) {
        promoSlides = JSON.parse(raw);
        if (!Array.isArray(promoSlides)) promoSlides = [];
      } else if (raw.trim() !== "") {
        // Legacy single-URL
        promoSlides = [{ id: "legacy", image: raw, link: "/products" }];
      }
    }
    promoSlides = promoSlides.filter((b) => b.image && String(b.image).trim() !== "");
  } catch {
    promoSlides = [];
  }
  return (
    <>
      {/* ── 1. HERO ────────────────────────────────── */}
      <section className="hero">
        {/* Left: copy */}
        <div className="hero-copy">
          <Reveal delay={80} direction="up">
            <span className="eyebrow">
              {store?.isOpen === false ? "STORE TEMPORARILY CLOSED" : "OFFICIAL STORE"}
            </span>
          </Reveal>

          <Reveal delay={160} direction="up" distance={25}>
            <h1>{branding?.heroHeading || "Style that follows no one"}</h1>
          </Reveal>

          <Reveal delay={240} direction="up">
            <p>
              {branding?.heroSubheading ||
                "Discover premium essentials curated for a bold, modern wardrobe."}
            </p>
          </Reveal>

          <Reveal delay={320} direction="up">
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
              <Link className="button large" to={branding?.heroButtonLink || "/products"}>
                <span>{branding?.heroButtonText || "Shop the collection"}</span>
                <ArrowRight size={18} />
              </Link>
              <button type="button" className="button large ghost" onClick={openMapModal}>
                <span>Store Location</span>
              </button>
            </div>
          </Reveal>

          {/* Floating stat pills */}
          <Reveal delay={420} direction="up">
            <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
              {[
                { label: "Products",      value: "100+" },
                { label: "Happy Orders",  value: "500+" },
                { label: "Free Delivery", value: "₹500+" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-pill)",
                    padding: "10px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <strong style={{ fontSize: 18, fontWeight: 800, color: "var(--gold)", lineHeight: 1 }}>
                    {value}
                  </strong>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right: visual — carousel if images exist, premium art otherwise */}
        <div
          className="hero-visual"
          style={{
            transform: `translate3d(${mouseParallax.x}px, ${mouseParallax.y}px, 0)`,
            transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <Reveal delay={200} direction="none" duration={700}>
            {hasHeroImages ? (
              <HeroCarousel heroImage={branding?.heroImage} link={branding?.heroButtonLink} />
            ) : (
              /* Premium cinematic placeholder when no banner uploaded */
              <div className="hero-art-premium">
                <div className="hero-ring hero-ring-1" />
                <div className="hero-ring hero-ring-2" />
                <div className="hero-ring hero-ring-3" />
                <div className="hero-emblem">
                  <Sparkles size={20} color="var(--gold)" style={{ marginBottom: 16, opacity: 0.7 }} />
                  <span className="hero-emblem-word">{branding?.storeName?.split(" ")[0] || "SHADOW"}</span>
                  <span className="hero-emblem-word" style={{ color: "var(--gold)" }}>{branding?.storeName?.split(" ").slice(1).join(" ") || "SHOP"}</span>
                  <span className="hero-emblem-tagline">
                    {branding?.tagline || "Own the shadow. Define the edge."}
                  </span>
                </div>
                <span className="hero-art-num">01</span>
                <div className="hero-float-badge">
                  <Sparkles size={13} />
                  <span>New Season</span>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── 2. LUXURY TICKER ─────────────────────── */}
      <div className="luxury-ticker" role="marquee" aria-label="Store announcements">
        <div className="luxury-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="luxury-ticker-item">
              {item}
              <span className="luxury-ticker-dot" aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. FEATURED PRODUCTS ─────────────────── */}
      <section className="section dark-section">
        <Reveal direction="up">
          <div className="section-head">
            <div>
              <span className="eyebrow">CURATED COLLECTION</span>
              <h2>Featured Products</h2>
            </div>
            <Link to="/products" className="button ghost">
              <span>View all products</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>

        {productsLoading ? (
          <Spinner />
        ) : (
          <StaggerContainer className="product-grid">
            {products?.items.slice(0, 8).map((product, idx) => (
              <StaggerItem key={product.id} index={idx} baseDelay={70}>
                <ProductCard product={product} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </section>

      {/* ── 4. PROMOTIONAL BANNERS ───────────────── */}
      {promoSlides.length > 0 && (
        <section className="promo section">
          <Reveal direction="up" duration={500}>
            <div className="section-head" style={{ marginBottom: 30 }}>
              <div>
                <span className="eyebrow">EXCLUSIVE OFFERS</span>
                <h2>Promotional Banners</h2>
              </div>
            </div>
          </Reveal>

          {promoSlides.length === 1 ? (
            <Reveal direction="up" duration={600} delay={100}>
              {/* Single banner — full width */}
              {promoSlides[0].link && promoSlides[0].link !== "none" ? (
                <Link to={promoSlides[0].link} style={{ display: "block" }}>
                  <img
                    src={resolveImageUrl(promoSlides[0].image)}
                    alt={promoSlides[0].title || "SHADOW SHOP promotion"}
                    loading="lazy"
                    style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block", objectFit: "cover", maxHeight: 500 }}
                  />
                </Link>
              ) : (
                <img
                  src={resolveImageUrl(promoSlides[0].image)}
                  alt={promoSlides[0].title || "SHADOW SHOP promotion"}
                  loading="lazy"
                  style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block", objectFit: "cover", maxHeight: 500 }}
                />
              )}
            </Reveal>
          ) : (
            <PromoCarousel banners={promoSlides} />
          )}
        </section>
      )}

      {/* ── 5. TRUST PILLARS ─────────────────────── */}
      <section className="section" style={{ paddingTop: 20, paddingBottom: 60 }}>
        <div className="trust-grid">
          {TRUST_PILLARS.map(({ Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 80} direction="up">
              <div className="trust-item">
                <div className="trust-icon-box">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 6. STORE UPDATES ─────────────────────── */}
      {updates && updates.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <Reveal direction="up">
            <div className="section-head">
              <div>
                <span className="eyebrow">LATEST NEWS</span>
                <h2>Store Updates &amp; Stories</h2>
              </div>
              <Link to="/updates" className="button outline-button">
                <span>View all updates</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>

          <StaggerContainer className="story-grid">
            {updates.slice(0, 3).map((item, idx) => (
              <StaggerItem key={item.id} index={idx}>
                <article className="story" style={{ height: "100%" }}>
                  {item.coverImage ? (
                    <img src={resolveImageUrl(item.coverImage)} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="story-art">SS</div>
                  )}
                  <time>
                    {item.publishDate
                      ? new Date(item.publishDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </time>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      )}

      {/* ── 7. NEWSLETTER ────────────────────────── */}
      <Newsletter settings={settings} />
    </>
  );
}

