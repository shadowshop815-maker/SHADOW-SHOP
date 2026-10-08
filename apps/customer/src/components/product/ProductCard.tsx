import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Check, ArrowRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, money, resolveImageUrl } from "../../api";
import type { Product } from "../../types";

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isWishlisted, setIsWishlisted] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
      return list.includes(product.id);
    } catch {
      return false;
    }
  });

  const [addState, setAddState] = useState<"idle" | "adding" | "added">("idle");

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const list: string[] = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
      let next: string[];
      if (list.includes(product.id)) {
        next = list.filter(id => id !== product.id);
        setIsWishlisted(false);
      } else {
        next = [...list, product.id];
        setIsWishlisted(true);
      }
      localStorage.setItem("shadow_wishlist", JSON.stringify(next));
    } catch {
      setIsWishlisted(!isWishlisted);
    }
  };

  const hasVariants = (product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0);
  const secondaryImage = product.images && product.images.length > 1 ? resolveImageUrl(product.images[1]?.url) : null;
  const primaryImage = resolveImageUrl(product.thumbnail || product.images?.[0]?.url);

  const effectivePrice = product.salePrice ?? product.price;
  const discountPercent = product.salePrice && Number(product.price) > 0
    ? Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100)
    : 0;

  // Quick Add mutation for items with no variant requirements
  const quickAddMutation = useMutation({
    mutationFn: () =>
      api("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          selectedSize: "",
          selectedColor: ""
        })
      }),
    onMutate: () => setAddState("adding"),
    onSuccess: () => {
      setAddState("added");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setTimeout(() => setAddState("idle"), 2200);
    },
    onError: () => {
      setAddState("idle");
      navigate(`/products/${product.slug}`);
    }
  });

  const handleQuickAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock === 0) return;

    if (hasVariants) {
      navigate(`/products/${product.slug}`);
    } else {
      quickAddMutation.mutate();
    }
  };

  return (
    <article className="product-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Image Container */}
      <div className="product-image-wrap">
        <Link to={`/products/${product.slug}`} style={{ display: "block", width: "100%", height: "100%" }}>
          <img
            src={primaryImage}
            alt={product.name}
            className={`product-image-primary ${secondaryImage ? "has-secondary" : ""}`}
            loading="lazy"
          />
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt={`${product.name} alternate view`}
              className="product-image-secondary"
              loading="lazy"
            />
          )}
        </Link>

        {/* Badges */}
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
          {discountPercent > 0 && (
            <span className="badge gold" style={{ position: "static" }}>
              -{discountPercent}% OFF
            </span>
          )}
        </div>

        {product.stock === 0 && (
          <span className="sold">Out of stock</span>
        )}

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={toggleWishlist}
          className={`wishlist-btn ${isWishlisted ? "active" : ""}`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        {/* Quick Add / Select Options Action */}
        {product.stock > 0 && (
          <button
            type="button"
            className="quick-add-btn"
            onClick={handleQuickAction}
            disabled={addState === "adding"}
            aria-label={hasVariants ? "Choose size and color options" : "Quick add item to cart"}
          >
            {addState === "adding" ? (
              <span>Adding to bag...</span>
            ) : addState === "added" ? (
              <>
                <Check size={15} />
                <span>Added to Bag</span>
              </>
            ) : hasVariants ? (
              <>
                <span>Select Options</span>
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                <ShoppingBag size={14} />
                <span>Quick Add</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Product Metadata & Pricing */}
      <div className="product-copy" style={{ flex: 1, justifyContent: "space-between" }}>
        <div>
          <p>{product.categories?.map(c => c.name).join(", ") || (product.brand ? product.brand : "Curated")}</p>
          <Link to={`/products/${product.slug}`}>
            <h3 title={product.name}>{product.name}</h3>
          </Link>
        </div>

        <div className="price" style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
          <strong style={{ fontSize: "16px", color: "var(--text)" }}>{money(effectivePrice)}</strong>
          {product.salePrice && Number(product.salePrice) < Number(product.price) && (
            <s>{money(product.price)}</s>
          )}
        </div>
      </div>
    </article>
  );
}
