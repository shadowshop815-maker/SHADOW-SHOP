import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, ShoppingBag, ShieldCheck, Truck, RefreshCw, Heart, Sparkles, ArrowRight } from "lucide-react";
import { api, money, resolveImageUrl } from "../api";
import { useAuth } from "../features/auth/AuthContext";
import type { Product } from "../types";
import { Spinner, Status } from "../components/ui";
import { ProductCard } from "../components/product/ProductCard";
import { Reveal, AnimatedPrice, StaggerContainer, StaggerItem } from "../components/motion/Motion";

export function ProductDetail() { 
  const { slug } = useParams(); 
  const navigate = useNavigate(); 
  const location = useLocation(); 
  const queryClient = useQueryClient(); 
  const auth = useAuth(); 
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<{ product: Product; related: Product[] }>(`/products/${slug}`)
  }); 
  
  const [image, setImage] = useState(""); 
  const [size, setSize] = useState(""); 
  const [color, setColor] = useState(""); 
  const [quantity, setQuantity] = useState(1); 
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [buttonState, setButtonState] = useState<"idle" | "loading" | "success">("idle");
  
  useEffect(() => {
    if (data?.product) {
      const thumb = data.product.thumbnail || data.product.images[0]?.url || "";
      setImage(thumb ? resolveImageUrl(thumb) : "");
      setSize(data.product.sizes[0] || "");
      setColor(data.product.colors[0] || "");
      setQuantity(1);

      try {
        const list: string[] = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
        setIsWishlisted(list.includes(data.product.id));
      } catch {
        setIsWishlisted(false);
      }
    }
  }, [data]);

  const toggleWishlist = () => {
    if (!data?.product) return;
    try {
      const list: string[] = JSON.parse(localStorage.getItem("shadow_wishlist") || "[]");
      let next: string[];
      if (list.includes(data.product.id)) {
        next = list.filter(id => id !== data.product.id);
        setIsWishlisted(false);
      } else {
        next = [...list, data.product.id];
        setIsWishlisted(true);
      }
      localStorage.setItem("shadow_wishlist", JSON.stringify(next));
    } catch {
      setIsWishlisted(!isWishlisted);
    }
  };
  
  const mutation = useMutation({
    mutationFn: () => api("/cart/items", { 
      method: "POST", 
      body: JSON.stringify({ 
        productId: data!.product.id, 
        quantity, 
        selectedSize: size, 
        selectedColor: color 
      }) 
    }),
    onMutate: () => setButtonState("loading"),
    onSuccess: () => {
      setButtonState("success");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setTimeout(() => setButtonState("idle"), 2500);
    },
    onError: () => setButtonState("idle")
  }); 

  const handleAddToCart = () => {
    if (!auth.user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    mutation.mutate();
  };

  const handleBuyNow = () => {
    if (!auth.user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    mutation.mutate(undefined, {
      onSuccess: () => navigate("/checkout")
    });
  };
  
  if (isLoading) return <Spinner/>; 
  if (error || !data) return <Status error={error}>{null}</Status>; 
  
  const p = data.product; 
  const gallery = [p.thumbnail, ...p.images.map(i => i.url)]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .map(url => resolveImageUrl(url)); 
  const effectivePrice = p.salePrice ?? p.price;
  const discountPercent = p.salePrice && Number(p.price) > 0
    ? Math.round((1 - Number(p.salePrice) / Number(p.price)) * 100) 
    : 0; 
  
  return (
    <section className="section page" style={{ paddingTop: "30px" }}>
      <div className="product-detail">
        {/* LEFT COLUMN: PRODUCT GALLERY */}
        <div className="gallery" style={{ position: "sticky", top: "100px", height: "max-content" }}>
          <div 
            className="main-image" 
            style={{ 
              borderRadius: "var(--radius-xl)", 
              overflow: "hidden", 
              position: "relative",
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)"
            }}
          >
            <img 
              src={image || "/assets/product-fallback.svg"} 
              alt={p.name} 
              onError={(e) => { e.currentTarget.src = "/assets/product-fallback.svg"; }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transition: "opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            />

            {/* Badges */}
            <div style={{ position: "absolute", top: 20, left: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
              {discountPercent > 0 && (
                <span className="badge gold" style={{ position: "static", padding: "6px 14px", fontSize: "11px" }}>
                  -{discountPercent}% OFF
                </span>
              )}
            </div>

            {p.stock === 0 && (
              <span className="sold" style={{ padding: "14px 26px", fontSize: "13px", fontWeight: 800 }}>
                OUT OF STOCK
              </span>
            )}

            {/* Wishlist Button on Gallery */}
            <button
              type="button"
              onClick={toggleWishlist}
              className={`wishlist-btn ${isWishlisted ? "active" : ""}`}
              style={{ top: 20, right: 20, width: 44, height: 44 }}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Thumbnail Rail */}
          {gallery.length > 1 && (
            <div className="thumbs" style={{ display: "flex", gap: "12px", marginTop: "16px", overflowX: "auto", paddingBottom: "4px" }}>
              {gallery.map(src => (
                <button 
                  key={src} 
                  type="button"
                  className={src === image ? "active" : ""} 
                  onClick={() => setImage(src)}
                  style={{
                    width: 76,
                    height: 76,
                    padding: 0,
                    borderRadius: "var(--radius-sm)",
                    border: src === image ? "2px solid var(--gold)" : "1px solid var(--border)",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "var(--card)",
                    flexShrink: 0,
                    transition: "all 0.2s ease"
                  }}
                >
                  <img src={src} alt="Thumbnail preview" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PRODUCT INFO & PURCHASE CONTROLS */}
        <div className="detail-copy" style={{ padding: "10px 0 60px" }}>
          <Reveal direction="up" delay={50}>
            <p className="eyebrow" style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "12px" }}>
              {p.categories?.map(c => c.name).join(", ")} · {p.brand}
            </p>
          </Reveal>

          <Reveal direction="up" delay={100}>
            <h1 style={{ letterSpacing: "0.04em", fontSize: "clamp(36px, 4.5vw, 64px)", lineHeight: "1.02", margin: "0 0 16px 0" }}>
              {p.name}
            </h1>
          </Reveal>

          {/* Pricing & GST Notice */}
          <Reveal direction="up" delay={150}>
            <div className="detail-price" style={{ margin: "20px 0 8px", display: "flex", alignItems: "baseline", gap: "12px" }}>
              <strong style={{ fontSize: "32px", color: "var(--text)" }}>
                <AnimatedPrice value={effectivePrice} />
              </strong>
              {p.salePrice && Number(p.salePrice) < Number(p.price) && (
                <s>{money(p.price)}</s>
              )}
              {discountPercent > 0 && (
                <span style={{ background: "var(--ink)", color: "var(--paper)", fontSize: "12px", padding: "6px 12px", borderRadius: "99px", fontWeight: 800 }}>
                  SAVE {discountPercent}%
                </span>
              )}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "0 0 24px" }}>
              MRP inclusive of all applicable GST & taxes.
            </p>
          </Reveal>

          {p.shortDescription && (
            <Reveal direction="up" delay={200}>
              <p className="lead" style={{ fontSize: "18px", fontFamily: '"Playfair Display", serif', fontStyle: "italic", color: "var(--text)", lineHeight: 1.6, marginBottom: "20px" }}>
                {p.shortDescription}
              </p>
            </Reveal>
          )}

          <Reveal direction="up" delay={250}>
            <p style={{ lineHeight: "1.8", fontSize: "14.5px", color: "var(--muted)", marginBottom: "30px" }}>
              {p.description}
            </p>
          </Reveal>

          {/* Metadata Block */}
          <div className="meta" style={{ marginBottom: "30px" }}>
            <span>SKU</span><b>{p.sku || "SHADOW-ARCHIVE"}</b>
            <span>Availability</span>
            <b className={p.stock > 0 ? "in-stock" : "out-stock"} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {p.stock > 0 ? `${p.stock} Available in stock` : "Currently Out of Stock"}
            </b>
          </div>
          
          {/* Size Variant Selector */}
          {p.sizes && p.sizes.length > 0 && (
            <fieldset style={{ margin: "32px 0", border: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px", color: "var(--muted)" }}>
                Size: <span style={{ color: "var(--text)", fontWeight: 700, marginLeft: "4px" }}>{size}</span>
              </legend>
              <div className="choices" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {p.sizes.map(v => (
                  <button 
                    type="button" 
                    className={v === size ? "active" : ""} 
                    key={v} 
                    onClick={() => setSize(v)}
                    onMouseEnter={(e) => { if (v !== size) e.currentTarget.style.borderColor = "var(--text)"; }}
                    onMouseLeave={(e) => { if (v !== size) e.currentTarget.style.borderColor = "var(--border)"; }}
                    style={{
                      border: v === size ? "1px solid var(--text)" : "1px solid var(--border)",
                      background: v === size ? "var(--text)" : "transparent",
                      color: v === size ? "var(--bg)" : "var(--text)",
                      fontWeight: v === size ? 600 : 500,
                      fontSize: "13px",
                      padding: "10px 24px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      letterSpacing: "0.02em"
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          
          {/* Color Variant Selector */}
          {p.colors && p.colors.length > 0 && (
            <fieldset style={{ margin: "32px 0", border: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px", color: "var(--muted)" }}>
                Color: <span style={{ color: "var(--text)", fontWeight: 700, marginLeft: "4px" }}>{color}</span>
              </legend>
              <div className="choices" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {p.colors.map(v => (
                  <button 
                    type="button" 
                    className={v === color ? "active" : ""} 
                    key={v} 
                    onClick={() => setColor(v)}
                    onMouseEnter={(e) => { if (v !== color) e.currentTarget.style.borderColor = "var(--text)"; }}
                    onMouseLeave={(e) => { if (v !== color) e.currentTarget.style.borderColor = "var(--border)"; }}
                    style={{
                      border: v === color ? "1px solid var(--text)" : "1px solid var(--border)",
                      background: v === color ? "var(--text)" : "transparent",
                      color: v === color ? "var(--bg)" : "var(--text)",
                      fontWeight: v === color ? 600 : 500,
                      fontSize: "13px",
                      padding: "10px 24px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      letterSpacing: "0.02em"
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          
          {/* Action Row: Quantity + Add to Cart + Buy Now */}
          <div className="buy-row" style={{ marginTop: "36px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <div className="quantity" style={{ borderRadius: "var(--radius-pill)", border: "1px solid var(--border)" }}>
              <button 
                type="button"
                aria-label="Decrease quantity" 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={15} />
              </button>
              <span style={{ fontWeight: 700, minWidth: "36px", textAlign: "center" }}>{quantity}</span>
              <button 
                type="button"
                aria-label="Increase quantity" 
                disabled={quantity >= p.stock} 
                onClick={() => setQuantity(Math.min(p.stock, quantity + 1))}
              >
                <Plus size={15} />
              </button>
            </div>

            <button 
              type="button"
              className="button ghost grow" 
              style={{ fontSize: "14px", letterSpacing: "0.08em", minHeight: "52px" }} 
              disabled={p.stock === 0 || buttonState === "loading"} 
              onClick={handleAddToCart}
            >
              {buttonState === "loading" ? (
                <span>Adding to Bag...</span>
              ) : buttonState === "success" ? (
                <>
                  <Check size={18} />
                  <span>Added to Bag ✓</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={18} />
                  <span>Add to Bag</span>
                </>
              )}
            </button>

            <button 
              type="button"
              className="button grow" 
              style={{ 
                fontSize: "14px", 
                letterSpacing: "0.08em", 
                background: "var(--gold)", 
                color: "#ffffff",
                minHeight: "52px"
              }} 
              disabled={p.stock === 0 || buttonState === "loading"} 
              onClick={handleBuyNow}
            >
              <span>Instant Buy</span>
              <ArrowRight size={16} />
            </button>
          </div>
          
          {/* Feedback messages */}
          {buttonState === "success" && (
            <p className="success-text" style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Check size={16} /> Item confirmed in your bag. <Link to="/cart" style={{ textDecoration: "underline", fontWeight: 700 }}>Proceed to bag & checkout</Link>
            </p>
          )}

          {mutation.error && (
            <p className="error-text" style={{ marginTop: "16px", color: "var(--danger)" }}>
              {mutation.error.message}
            </p>
          )}
          
          {/* Shipping & Return Details Accordion */}
          <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)" }}>
            <details style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", listStyle: "none" }}>
                <Truck size={17} color="var(--gold)" />
                <span>Shipping, Dispatch & Delivery Times</span>
              </summary>
              <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
                {p.shippingInfo || "Dispatched in bespoke packaging. Multiple delivery options (Standard, Fast, Express) calculated live based on destination at checkout."}
              </p>
            </details>

            <details style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", listStyle: "none" }}>
                <RefreshCw size={17} color="var(--gold)" />
                <span>Return Policy & Guarantee</span>
              </summary>
              <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
                {p.returnPolicy || "Eligible for doorstep return and exchange within the official return window post-delivery. Instant refund or store credit processed upon inspection."}
              </p>
            </details>

            <details style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}>
              <summary style={{ fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", listStyle: "none" }}>
                <ShieldCheck size={17} color="var(--gold)" />
                <span>Authenticity & Craftsmanship</span>
              </summary>
              <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
                100% verified original SHADOW SHOP design. Precision stitched with luxury attention to detail.
              </p>
            </details>
          </div>
        </div>
      </div>
      
      {/* Sticky Mobile Add to Cart Bar */}
      <div className="mobile-sticky-bar">
        <div>
          <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Price</div>
          <strong style={{ fontSize: "17px", color: "var(--text)" }}>{money(effectivePrice)}</strong>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            type="button"
            className="button"
            style={{ padding: "12px 20px", fontSize: "13px", background: "var(--gold)" }}
            disabled={p.stock === 0 || buttonState === "loading"}
            onClick={handleAddToCart}
          >
            {buttonState === "loading" ? "Adding..." : buttonState === "success" ? "Added ✓" : "Add to Bag"}
          </button>
        </div>
      </div>

      {/* Related Products Grid */}
      {data.related && data.related.length > 0 && (
        <div className="related" style={{ marginTop: "80px" }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">RECOMMENDED</span>
              <h2>You May Also Like</h2>
            </div>
            <Link to="/products" className="button ghost">
              <span>View All</span>
              <ArrowRight size={16} />
            </Link>
          </div>
          <StaggerContainer className="product-grid">
            {data.related.slice(0, 4).map((relProduct, idx) => (
              <StaggerItem key={relProduct.id} index={idx}>
                <ProductCard product={relProduct} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      )}
    </section>
  ); 
}
