import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, Trash2, ShieldCheck, Truck } from "lucide-react";
import { api, money } from "../api";
import type { Cart } from "../types";
import { Spinner, Status } from "../components/ui";
import { OfferPanel } from "../components/ui/OfferPanel";
import { Reveal, AnimatedPrice } from "../components/motion/Motion";

export function CartPage() { 
  const client = useQueryClient(); 
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Cart>("/cart")
  }); 
  
  const mutate = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: object }) => 
      api<Cart>(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onMutate: async ({ path, method, body }) => {
      await client.cancelQueries({ queryKey: ["cart"] });
      const previousCart = client.getQueryData(["cart"]);

      if (path.startsWith("/cart/items/") && method === "PATCH" && body) {
        const itemId = path.split("/").pop();
        const newQuantity = (body as any).quantity;
        client.setQueryData(["cart"], (old: any) => {
          if (!old) return old;
          
          const newItems = old.items.map((i: any) => i.id === itemId ? { ...i, quantity: newQuantity } : i);
          
          let newSubtotal = 0;
          newItems.forEach((item: any) => {
            const price = Number(item.product.salePrice ?? item.product.price);
            newSubtotal += price * item.quantity;
          });
          
          const diff = newSubtotal - Number(old.totals.subtotal);

          return {
            ...old,
            items: newItems,
            totals: {
              ...old.totals,
              subtotal: newSubtotal,
              grandTotal: Number(old.totals.grandTotal) + diff
            }
          };
        });
      }
      return { previousCart };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousCart) {
        client.setQueryData(["cart"], context.previousCart);
      }
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["cart"] });
      client.invalidateQueries({ queryKey: ["availableOffers"] });
    }
  }); 
  
  const { data: offersData, isLoading: offersLoading, isError: offersError, refetch: refetchOffers } = useQuery({
    queryKey: ["availableOffers", data?.totals?.subtotal],
    queryFn: () => api<any[]>("/offers/available"),
    enabled: !!data
  });

  if (isLoading) return <Spinner/>; 
  
  // Real dynamic shipping calculations from backend
  const subtotal = data?.totals.subtotal ?? 0;
  const freeShippingThreshold = data?.shipping?.freeShippingThreshold ?? 500;
  const isFreeShippingUnlocked = subtotal >= freeShippingThreshold;
  const amountNeededForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  return (
    <section className="section page">
      <Reveal direction="up">
        <div className="page-title">
          <span className="eyebrow">SHOPPING BAG</span>
          <h1>Your Cart</h1>
        </div>
      </Reveal>
      
      <Status error={error} empty={!data?.items.length}>
        {data && data.items.length > 0 && (
          <div className="cart-layout">
            {/* LEFT COLUMN: CART ITEMS & FREE SHIPPING PROGRESS */}
            <div>
              {/* Free Shipping Progress Card */}
              <div className="shipping-progress-card">
                <div className="shipping-progress-header">
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
                    <Truck size={16} color="var(--gold)" />
                    {isFreeShippingUnlocked ? (
                      <span style={{ color: "var(--success)" }}>
                        ✓ Complimentary standard shipping unlocked
                      </span>
                    ) : (
                      <span>
                        Add <strong style={{ color: "var(--gold)" }}>{money(amountNeededForFreeShipping)}</strong> more to unlock complimentary standard delivery
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--gold)" }}>
                    {progressPercent}%
                  </span>
                </div>

                <div className="shipping-progress-bar-bg">
                  <div 
                    className="shipping-progress-bar-fill" 
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="cart-items" style={{ padding: "10px 30px" }}>
                {data.items.map(item => {
                  const effectivePrice = item.product.salePrice ?? item.product.price;
                  const itemSpecs = [item.selectedSize, item.selectedColor].filter(Boolean).join(" · ");
                  return (
                    <article className="cart-item" key={item.id} style={{ alignItems: "center" }}>
                      <Link to={`/products/${item.product.slug}`} style={{ display: "block" }}>
                        <img 
                          src={item.product.thumbnail || "/assets/product-fallback.svg"} 
                          alt={item.product.name}
                          style={{ borderRadius: "var(--radius-md)", objectFit: "contain", background: "var(--layer-2)", padding: 8 }}
                        />
                      </Link>

                      <div>
                        <Link to={`/products/${item.product.slug}`}>
                          <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>
                            {item.product.name}
                          </h3>
                        </Link>
                        {itemSpecs ? (
                          <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "var(--muted)" }}>
                            {itemSpecs}
                          </p>
                        ) : null}

                        {/* Quantity Controls */}
                        <div className="quantity small" style={{ borderRadius: "var(--radius-pill)", border: "1px solid var(--border)" }}>
                          <button 
                            type="button"
                            aria-label="Decrease quantity" 
                            onClick={() => item.quantity === 1 
                              ? mutate.mutate({ path: `/cart/items/${item.id}`, method: "DELETE" }) 
                              : mutate.mutate({ path: `/cart/items/${item.id}`, method: "PATCH", body: { quantity: item.quantity - 1 } })
                            }
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontSize: "13px", fontWeight: 700 }}>{item.quantity}</span>
                          <button 
                            type="button"
                            aria-label="Increase quantity" 
                            disabled={item.quantity >= item.product.stock} 
                            onClick={() => mutate.mutate({ path: `/cart/items/${item.id}`, method: "PATCH", body: { quantity: item.quantity + 1 } })}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Item Total Price and Remove Action */}
                      <div className="cart-price" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "16px" }}>
                        <strong style={{ fontSize: "16px", color: "var(--text)" }}>
                          {money(Number(effectivePrice) * item.quantity)}
                        </strong>

                        <button 
                          type="button"
                          className="text-btn danger" 
                          disabled={mutate.isPending} 
                          onClick={() => mutate.mutate({ path: `/cart/items/${item.id}`, method: "DELETE" })}
                          style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", padding: 0, textDecoration: "none" }}
                          aria-label={`Remove ${item.product.name} from bag`}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Security & Authenticity Footnote */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px", color: "var(--muted)", fontSize: "13px" }}>
                <ShieldCheck size={18} color="var(--gold)" />
                <span>All items are held in your cart session. Free shipping rules update automatically.</span>
              </div>
            </div>

            {/* RIGHT COLUMN: STICKY ORDER SUMMARY */}
            <aside className="summary" style={{ position: "sticky", top: "100px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase", marginBottom: "16px" }}>
                Order Summary
              </h2>

              <div className="summary-section" style={{ display: "flex", flexDirection: "column", width: "100%", gap: "10px" }}>
                {/* Subtotal */}
                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px" }}>
                  <span style={{ color: "var(--muted)" }}>Subtotal</span>
                  <strong style={{ color: "var(--text)" }}>{money(data.totals.subtotal)}</strong>
                </div>

                {/* Offer Discount */}
                {Number(data.totals.offerDiscount) > 0 && (
                  <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", color: "var(--success)" }}>
                    <span>Offer Applied ({data.appliedOfferCode})</span>
                    <strong>-{money(data.totals.offerDiscount)}</strong>
                  </div>
                )}

                {/* Shipping Row — always shows, content depends on shippingStatus */}
                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "13.5px" }}>
                  <span style={{ color: "var(--muted)" }}>Shipping</span>
                  {data.shipping?.shippingStatus === "CONFIRMED" ? (
                    <strong>
                      {Number(data.totals.shipping) === 0 ? (
                        <span style={{ color: "var(--success)", fontWeight: 700 }}>FREE</span>
                      ) : (
                        money(data.totals.shipping)
                      )}
                    </strong>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "12px", textAlign: "right", lineHeight: 1.4 }}>
                      Calculated at checkout
                    </span>
                  )}
                </div>

                {/* GST Inclusive Notice */}
                <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px", color: "var(--muted)" }}>
                  <span>Estimated Tax (GST Inc.)</span>
                  <span>{money(data.totals.tax)}</span>
                </div>

                {/* Grand Total — label changes based on shipping status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700 }}>
                    {data.shipping?.shippingStatus === "CONFIRMED" ? "Total" : "Estimated Total"}
                  </span>
                  <strong style={{ fontSize: "22px", color: "var(--gold)" }}>
                    <AnimatedPrice value={data.totals.grandTotal} />
                  </strong>
                </div>

              </div>

              {/* OFFERS SECTION — inline accordion panel */}
              <div className="summary-section" style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <OfferPanel
                  offers={offersData || []}
                  isLoading={offersLoading}
                  isError={offersError}
                  onRetry={refetchOffers}
                  appliedCode={data.appliedOfferCode || null}
                  isApplying={mutate.isPending}
                  cartError={mutate.error?.message || null}
                  onApply={(code, onError) => {
                    mutate.mutate(
                      { path: "/cart/apply-offer", method: "POST", body: { code } },
                      { onError: (err: any) => onError && onError(err.message) }
                    );
                  }}
                  onRemove={() => {
                    mutate.mutate({ path: "/cart/remove-offer", method: "POST" });
                  }}
                />
              </div>

              {/* Checkout CTA */}
              <button 
                type="button"
                className="button full large" 
                onClick={() => navigate("/checkout")}
                style={{ marginTop: "20px", minHeight: "52px", fontSize: "14px", fontWeight: 800, letterSpacing: "0.08em" }}
              >
                <span>PROCEED TO CHECKOUT</span>
                <ArrowRight size={17} />
              </button>

              <small style={{ textAlign: "center", display: "block", marginTop: "12px", color: "var(--muted)", fontSize: "12px" }}>
                Delivery speed options and address selected at next step.
              </small>
            </aside>
          </div>
        )}
      </Status>


    </section>
  ); 
}
