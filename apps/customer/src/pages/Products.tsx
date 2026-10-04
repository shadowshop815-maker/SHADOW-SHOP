import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Sparkles } from "lucide-react";
import { api } from "../api";
import type { Product, Category } from "../types";
import { Spinner, Status } from "../components/ui";
import { ProductCard } from "../components/product/ProductCard";
import { Reveal, StaggerContainer, StaggerItem } from "../components/motion/Motion";

export function Products() { 
  const [params, setParams] = useSearchParams(); 
  const query = params.get("q") || ""; 
  const [search, setSearch] = useState(query); 
  
  const selectedCategory = params.get("category") || "";
  const selectedAvailability = params.get("availability") || "";
  const selectedSort = params.get("sort") || "default";
  const currentPage = params.get("page") || "1";

  const path = `/products?search=${encodeURIComponent(query)}&category=${selectedCategory}&availability=${selectedAvailability}&sort=${selectedSort}&page=${currentPage}`; 
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", path],
    queryFn: () => api<{ items: Product[]; pagination: { page: number; pages: number; total: number } }>(path)
  }); 
  
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories")
  }); 
  
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const clearAllFilters = () => {
    setSearch("");
    setParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(query || selectedCategory || selectedAvailability || (selectedSort && selectedSort !== "default"));
  const activeCategoryObj = categories?.find(c => c.slug === selectedCategory);

  return (
    <section className="section page">
      {/* Header */}
      <div className="page-title">
        <span className="eyebrow">CATALOG</span>
        <h1>All Products</h1>
        <p>{data?.pagination.total ?? 0} products available in store.</p>
      </div>

      {/* Sticky Filter & Search Toolbar */}
      <div 
        className="shop-toolbar" 
        style={{ 
          position: "sticky", 
          top: "84px", 
          zIndex: 40, 
          background: "color-mix(in srgb, var(--bg) 85%, transparent)", 
          backdropFilter: "blur(20px)", 
          padding: "16px 0", 
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          marginBottom: "32px"
        }}
      >
        {/* Search Bar */}
        <form 
          onSubmit={e => { e.preventDefault(); set("q", search); }} 
          style={{ 
            display: "flex", 
            alignItems: "center",
            background: "var(--card)",
            borderRadius: "var(--radius-pill)",
            padding: "5px 6px 5px 18px",
            boxShadow: "var(--shadow-sm)",
            border: "1px solid var(--border)",
            width: "100%",
            maxWidth: "360px",
            boxSizing: "border-box"
          }}
        >
          <Search size={17} color="var(--gold)" style={{ flexShrink: 0 }} />
          <input 
            aria-label="Search collection by keywords" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search products, categories..."
            style={{ 
              flex: 1, 
              minWidth: 0,
              fontSize: "14px", 
              padding: "8px 12px", 
              border: "none", 
              background: "transparent",
              outline: "none",
              color: "var(--text)",
              fontWeight: 500
            }}
          />
          {search && (
            <button 
              type="button" 
              onClick={() => { setSearch(""); set("q", ""); }}
              title="Clear search"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "var(--muted)", flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          )}
          <button 
            type="submit"
            style={{ 
              border: 0, 
              background: "var(--ink)", 
              color: "var(--paper)", 
              borderRadius: "var(--radius-pill)", 
              padding: "8px 18px", 
              fontWeight: 700, 
              fontSize: "12.5px",
              marginLeft: "4px", 
              cursor: "pointer",
              transition: "background 0.2s ease",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            Search
          </button>
        </form>

        {/* Category Select */}
        <select 
          aria-label="Filter by Category" 
          value={selectedCategory} 
          onChange={e => set("category", e.target.value)} 
          style={{ background: "var(--card)", borderRadius: "var(--radius-pill)" }}
        >
          <option value="">All Categories</option>
          {categories?.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>

        {/* Availability Select */}
        <select 
          aria-label="Filter by Availability" 
          value={selectedAvailability} 
          onChange={e => set("availability", e.target.value)} 
          style={{ background: "var(--card)", borderRadius: "var(--radius-pill)" }}
        >
          <option value="">All Stock Status</option>
          <option value="in-stock">In Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>

        {/* Sort Select */}
        <select 
          aria-label="Sort Collection" 
          value={selectedSort} 
          onChange={e => set("sort", e.target.value)} 
          style={{ background: "var(--card)", borderRadius: "var(--radius-pill)" }}
        >
          <option value="default">Featured Selection</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="newest">New Arrivals</option>
          <option value="name-asc">Alphabetical: A–Z</option>
          <option value="name-desc">Alphabetical: Z–A</option>
        </select>
      </div>

      {/* Active Filter Chips / Pills */}
      {hasActiveFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
            Active:
          </span>
          {query && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--layer-2)", border: "1px solid var(--border)", borderRadius: "99px", padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>
              Query: "{query}"
              <X size={13} style={{ cursor: "pointer" }} onClick={() => { setSearch(""); set("q", ""); }} />
            </span>
          )}
          {selectedCategory && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--layer-2)", border: "1px solid var(--border)", borderRadius: "99px", padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>
              Category: {activeCategoryObj?.name || selectedCategory}
              <X size={13} style={{ cursor: "pointer" }} onClick={() => set("category", "")} />
            </span>
          )}
          {selectedAvailability && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--layer-2)", border: "1px solid var(--border)", borderRadius: "99px", padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>
              Stock: {selectedAvailability === "in-stock" ? "In Stock" : "Out of Stock"}
              <X size={13} style={{ cursor: "pointer" }} onClick={() => set("availability", "")} />
            </span>
          )}
          <button 
            type="button" 
            onClick={clearAllFilters}
            style={{ background: "transparent", border: "none", color: "var(--gold)", fontSize: "12px", fontWeight: 700, cursor: "pointer", textDecoration: "underline", marginLeft: "6px" }}
          >
            Reset All
          </button>
        </div>
      )}

      {/* Product Grid or States */}
      {isLoading ? (
        <Spinner />
      ) : (
        <Status error={error} empty={!data?.items.length}>
          {data?.items && data.items.length > 0 ? (
            <StaggerContainer className="product-grid">
              {data.items.map((product, idx) => (
                <StaggerItem key={product.id} index={idx} baseDelay={60}>
                  <ProductCard product={product} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ color: "var(--muted)", fontSize: "16px", marginBottom: "16px" }}>
                No pieces match your active selection.
              </p>
              <button 
                type="button" 
                className="button outline-button" 
                onClick={clearAllFilters}
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="pagination" style={{ marginTop: "60px" }}>
              <button 
                disabled={data.pagination.page <= 1} 
                onClick={() => set("page", String(data.pagination.page - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
                Page {data.pagination.page} of {data.pagination.pages}
              </span>
              <button 
                disabled={data.pagination.page >= data.pagination.pages} 
                onClick={() => set("page", String(data.pagination.page + 1))}
              >
                Next
              </button>
            </div>
          )}
        </Status>
      )}
    </section>
  ); 
}
