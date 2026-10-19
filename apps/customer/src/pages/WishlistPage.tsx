import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, money } from "../api";
import { ProductCard } from "../components/product/ProductCard";
import type { Product } from "../types";
import { HeartCrack, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { StaggerContainer, StaggerItem } from "../components/motion/Motion";

export function WishlistPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const list = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
        setWishlistIds(Array.isArray(list) ? list : []);
      } catch {
        setWishlistIds([]);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("shadow_wishlist_updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("shadow_wishlist_updated", handleStorage);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist", wishlistIds],
    queryFn: async () => {
      let items: any[] = [];
      try {
        const payload = await api<any>("/wishlist");
        if (payload?.items && payload.items.length > 0) {
          items = payload.items;
          const backendIds = items.map((i: any) => i.productId || i.product?.id).filter(Boolean);
          if (backendIds.length > 0) {
            localStorage.setItem("shadow_wishlist", JSON.stringify(backendIds));
            window.dispatchEvent(new Event("shadow_wishlist_updated"));
          }
        }
      } catch {
        // Backend fallback
      }

      // If backend has no items but we have locally saved wishlist IDs
      if (items.length === 0) {
        const localList: string[] = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
        if (localList.length > 0) {
          try {
            const fallback = await api<{ items: Product[] }>(`/products?limit=100&ids=${localList.join(",")}`);
            if (fallback?.items) {
              items = fallback.items.map((product) => ({ product, productId: product.id }));
            }
          } catch {}
        }
      }
      return { items };
    },
    staleTime: 30_000,
  });

  const clearAllWishlist = () => {
    localStorage.setItem("shadow_wishlist", "[]");
    setWishlistIds([]);
    window.dispatchEvent(new Event("shadow_wishlist_updated"));
    queryClient.setQueryData(["wishlist", []], { items: [] });
    queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    // Attempt backend clear by deleting current items
    (data?.items || []).forEach((item: any) => {
      const pid = item.productId || item.product?.id;
      if (pid) api(`/wishlist/items/${pid}`, { method: "DELETE" }).catch(() => {});
    });
  };

  const displayItems = (data?.items || []).filter((item: any) => item?.product?.id);
  const emptyCondition = !isLoading && (displayItems.length === 0 || wishlistIds.length === 0);

  return (
    <div className="section page" style={{ minHeight: "65vh", paddingTop: "50px" }}>
      <div className="section-head" style={{ marginBottom: "35px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span className="eyebrow">YOUR COLLECTION</span>
          <h1 style={{ margin: "8px 0" }}>Wishlist</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            {displayItems.length} {displayItems.length === 1 ? "item" : "items"} saved for later.
          </p>
        </div>

        {!emptyCondition && displayItems.length > 0 && (
          <button
            onClick={clearAllWishlist}
            className="outline-button"
            style={{ fontSize: "12px", padding: "8px 16px", borderRadius: "var(--radius-pill)", gap: "6px" }}
            aria-label="Clear all items from wishlist"
          >
            <Trash2 size={14} />
            <span>Clear Wishlist</span>
          </button>
        )}
      </div>

      {emptyCondition ? (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--card)", borderRadius: "24px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--layer-2)", display: "grid", placeItems: "center" }}>
              <HeartCrack size={28} color="var(--muted)" />
            </div>
          </div>
          <h2 style={{ fontSize: "22px", marginBottom: "10px" }}>Your wishlist is empty</h2>
          <p style={{ color: "var(--muted)", marginBottom: "25px", maxWidth: "400px", margin: "0 auto 25px" }}>
            Explore our curated catalog and tap the heart icon on any product to save it here.
          </p>
          <Link to="/products" className="button" style={{ display: "inline-flex", gap: "8px" }}>
            <span>Browse Products</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : isLoading ? (
        <div className="product-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: "380px", background: "var(--card)", borderRadius: "24px", border: "1px solid var(--border)", animation: "pulse 1.8s infinite" }} />
          ))}
        </div>
      ) : (
        <StaggerContainer className="product-grid">
          {displayItems.map((item: any, idx: number) => (
            <StaggerItem key={item.product.id} index={idx}>
              <ProductCard product={item.product} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}
