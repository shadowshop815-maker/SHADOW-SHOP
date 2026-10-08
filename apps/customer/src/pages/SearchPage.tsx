import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { api, money, resolveImageUrl } from "../api";
import type { Product } from "../types";
import { Reveal, StaggerContainer, StaggerItem } from "../components/motion/Motion";

export function SearchPage() { 
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || ""); 
  const navigate = useNavigate(); 
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api<{ items: Product[] }>(`/products?search=${encodeURIComponent(q)}&limit=8`),
    enabled: q.trim().length > 1
  }); 
  
  const popularSearches = ["Hoodies", "T-Shirts", "Accessories", "New Season", "Overcoats"];

  return (
    <section className="section page" style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4rem" }}>
      <div style={{ width: "100%", maxWidth: 740, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "clamp(32px, 4.5vw, 54px)", margin: "8px 0", letterSpacing: "-0.03em" }}>
            What are you looking for?
          </h1>
        </div>
        
        {/* Search Input Box */}
        <Reveal direction="up" delay={100}>
          <form 
            onSubmit={e => { e.preventDefault(); if (q.trim()) navigate(`/products?q=${encodeURIComponent(q.trim())}`); }}
            style={{ 
              position: "relative", 
              display: "flex", 
              alignItems: "center",
              background: "var(--card)",
              borderRadius: "var(--radius-pill)",
              padding: "8px 10px 8px 24px",
              boxShadow: "var(--shadow-md)",
              border: "1.5px solid var(--border)",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <Search size={22} color="var(--gold)" style={{ flexShrink: 0 }} />
            <input 
              ref={inputRef}
              placeholder="Search products, categories..." 
              value={q} 
              onChange={e => setQ(e.target.value)}
              style={{ 
                flex: 1, 
                minWidth: 0,
                fontSize: "16px", 
                padding: "12px 16px", 
                border: "none", 
                background: "transparent",
                outline: "none",
                color: "var(--text)"
              }}
            />
            {q && (
              <button 
                type="button" 
                onClick={() => { setQ(""); inputRef.current?.focus(); }}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: 8, display: "flex", alignItems: "center", flexShrink: 0 }}
                title="Clear input"
              >
                <X size={18} />
              </button>
            )}
            <button 
              type="submit" 
              style={{ 
                border: 0, 
                background: "var(--ink)", 
                color: "var(--paper)", 
                borderRadius: "var(--radius-pill)", 
                padding: "12px 28px", 
                fontWeight: 700, 
                fontSize: "14px",
                marginLeft: "6px", 
                cursor: "pointer",
                transition: "background 0.2s ease",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              Search
            </button>
          </form>
        </Reveal>

        {/* Popular Searches Pills */}
        {!q && (
          <Reveal direction="up" delay={200}>
            <div style={{ marginTop: "3rem", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "1.2rem", fontWeight: 700 }}>
                Popular Curations
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                {popularSearches.map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQ(term)}
                    className="outline-button"
                    style={{
                      padding: "8px 18px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "13px",
                      borderColor: "var(--border)"
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
      
      {/* Results Viewport */}
      <div style={{ width: "100%", maxWidth: 960, marginTop: "3.5rem" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--muted)", marginTop: "2rem" }}>
            <Loader2 size={32} className="spin" color="var(--gold)" />
            <p style={{ fontSize: "14px" }}>Searching products...</p>
          </div>
        ) : q.trim().length > 1 && data ? (
          data.items.length > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.4rem", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Matching Products</h2>
                <span style={{ color: "var(--muted)", fontSize: "13px" }}>{data.items.length} products found</span>
              </div>
              
              <StaggerContainer style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {data.items.map((p, idx) => (
                  <StaggerItem key={p.id} index={idx}>
                    <Link 
                      to={`/products/${p.slug}`} 
                      className="card" 
                      style={{ 
                        display: "flex", 
                        gap: "1.2rem", 
                        textDecoration: "none", 
                        color: "inherit", 
                        padding: "1.2rem", 
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-sm)",
                        transition: "all 0.25s ease" 
                      }}
                    >
                      <div style={{ width: 84, height: 84, borderRadius: 12, overflow: "hidden", background: "var(--layer-2)", flexShrink: 0, padding: 6 }}>
                        <img src={resolveImageUrl(p.thumbnail || "/assets/product-fallback.svg")} alt={p.name} onError={(e) => { e.currentTarget.src = "/assets/product-fallback.svg"; }} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 700, textTransform: "uppercase" }}>
                          {p.categories?.map((c: any) => c.name).join(", ") || "Essential"}
                        </span>
                        <h3 style={{ margin: "4px 0", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{p.name}</h3>
                        <span style={{ fontWeight: 800, color: "var(--text)", fontSize: "14px", marginTop: "4px" }}>
                          {money(p.salePrice ?? p.price)}
                        </span>
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerContainer>
              
              <div style={{ textAlign: "center", marginTop: "3rem" }}>
                <Link to={`/products?q=${encodeURIComponent(q)}`} className="button large" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>View Complete Results</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--card)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--layer-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", color: "var(--muted)" }}>
                <Search size={28} />
              </div>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>No matching products found</h2>
              <p style={{ color: "var(--muted)", maxWidth: 420, margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
                We couldn't find any products matching "{q}". Try checking the spelling or browse our collection.
              </p>
              <Link to="/products" className="button outline-button">
                Browse All Products
              </Link>
            </div>
          )
        ) : null}
      </div>
    </section>
  ); 
}
