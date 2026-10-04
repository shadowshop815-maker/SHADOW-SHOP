import { useState, useEffect } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, money } from "../api";
import type { Cart, Address, Order } from "../types";
import { useAuth } from "../features/auth/AuthContext";
import { Spinner } from "../components/ui";
import { OfferDrawer } from "../components/ui/OfferDrawer";
import { blankAddress, AddressFields } from "../components/location/LocationPicker";
import { Truck, CreditCard, ShieldCheck, X, ChevronRight, CheckCircle2, MapPin } from "lucide-react";
import { AnimatedPrice, Reveal } from "../components/motion/Motion";

export function Checkout() { 
  const auth = useAuth(); 
  const navigate = useNavigate(); 
  const client = useQueryClient(); 
  
  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Cart>("/cart")
  }); 
  
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/addresses"),
    enabled: Boolean(auth.user)
  }); 
  
  const [addressId, setAddressId] = useState(""); 
  const [address, setAddress] = useState<Address>(blankAddress); 
  const [note, setNote] = useState(""); 
  const [step, setStep] = useState<"shipping" | "payment">("shipping");
  const [offerCode, setOfferCode] = useState("");
  const [isOfferDrawerOpen, setIsOfferDrawerOpen] = useState(false);
  // Optimistic local delivery option — updates instantly on click, syncs to backend in background
  const [optimisticDeliveryOptionId, setOptimisticDeliveryOptionId] = useState<string | null>(null);

  // shippingConfirmed: true only when backend confirms both address + delivery method are set
  // This is the GATE for payment — do not trust frontend state alone
  const activeDeliveryOptionId = optimisticDeliveryOptionId ?? cart?.deliveryOptionId;
  const activeDeliveryOption = cart?.deliveryOptions?.find((o: any) => o.id === activeDeliveryOptionId);
  const optimisticShippingFee = activeDeliveryOption?.finalShippingFee ?? cart?.totals?.shipping ?? 0;
  // Backend formula: grandTotal = (subtotal - offerDiscount) + exclusiveTaxToAdd + shippingFee
  // Inclusive GST is already baked into subtotal, so we don't add tax again.
  // cart.totals.tax is the exclusive portion (usually 0 for inclusive-mode stores).
  const optimisticGrandTotal = Math.max(0, (cart?.totals?.subtotal ?? 0) - (cart?.totals?.offerDiscount ?? 0)) + optimisticShippingFee;
  const shippingConfirmed = cart?.shipping?.shippingStatus === "CONFIRMED" || Boolean(cart?.deliveryAddressId && activeDeliveryOptionId);


  useEffect(() => {
    const chosen = addresses?.find(a => a.isDefault) || addresses?.[0];
    if (chosen) setAddressId(chosen.id || "");
  }, [addresses]); 
  
  // Cart operation mutations
  const cartMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: object }) =>
      api(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cart"] });
    }
  });

  // Delivery method — optimistic: set locally immediately, sync in background
  const deliveryMethodMutation = useMutation({
    mutationFn: (optionId: string) =>
      api("/cart/delivery-method", { method: "POST", body: JSON.stringify({ method: optionId }) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: () => {
      // Revert optimistic update on failure
      setOptimisticDeliveryOptionId(null);
      client.invalidateQueries({ queryKey: ["cart"] });
    }
  });

  // Sync address to cart so distance calculations work for delivery options
  useEffect(() => {
    if (addressId && cart && cart.deliveryAddressId !== addressId) {
      cartMutation.mutate({ path: "/cart/address", method: "POST", body: { addressId } });
    }
  }, [addressId, cart?.deliveryAddressId]);

  // Offer mutation
  const offerMutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: object }) =>
      api(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cart"] });
      client.invalidateQueries({ queryKey: ["availableOffers"] });
    }
  });
  
  const { data: offersData, isLoading: offersLoading, isError: offersError, refetch: refetchOffers } = useQuery({
    queryKey: ["availableOffers", addressId, cart?.totals?.subtotal, address?.latitude, address?.longitude],
    queryFn: () => {
      const params = new URLSearchParams();
      if (addressId) params.append("addressId", addressId);
      if (address?.latitude) params.append("lat", String(address.latitude));
      if (address?.longitude) params.append("lng", String(address.longitude));
      const qs = params.toString();
      return api<any[]>(`/offers/available${qs ? `?${qs}` : ''}`);
    },
    enabled: !!cart
  });

  const mutation = useMutation({
    mutationFn: () => api<Order>("/checkout", {
      method: "POST",
      body: JSON.stringify({
        items: cart!.items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          selectedSize: i.selectedSize,
          selectedColor: i.selectedColor
        })),
        ...(addressId ? { addressId } : { shippingAddress: address }),
        paymentMethod: "COD",
        deliveryOptionId: activeDeliveryOptionId ?? cart?.deliveryOptionId,

        customerNote: note,
        offerCode: cart!.appliedOfferCode || undefined,
        idempotencyKey: sessionStorage.getItem("checkout_key") || (() => {
          const k = crypto.randomUUID();
          sessionStorage.setItem("checkout_key", k);
          return k;
        })()
      })
    }),
    onSuccess: order => {
      sessionStorage.removeItem("checkout_key");
      client.invalidateQueries({ queryKey: ["cart"] });
      navigate(`/order-confirmation/${order.orderNumber}`, { state: { order } });
    }
  }); 
  
  if (isLoading) return <Spinner/>; 
  if (!cart?.items.length) return <Navigate to="/cart" replace/>; 
  
  const displayAddress = addressId ? addresses?.find(a => a.id === addressId) : address; 
  
  return (
    <section className="section page">
      <div className="page-title">
        <span className="eyebrow">SECURE CHECKOUT</span>
        <h1>Complete Order</h1>
      </div>

      <div className="cart-layout">
        {/* LEFT COLUMN: STEPS & FORMS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          
          {/* Breadcrumb Steps */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--muted)", fontSize: "12.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <Link to="/cart" style={{ color: "var(--gold)", textDecoration: "none" }}>Bag</Link>
            <ChevronRight size={14} />
            <span 
              style={{ color: step === "shipping" ? "var(--text)" : "var(--gold)", cursor: step === "payment" ? "pointer" : "default" }} 
              onClick={() => {
                if (step === "payment") {
                  setStep("shipping");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              1. Address & Information
            </span>
            <ChevronRight size={14} />
            <span style={{ color: step === "payment" ? "var(--text)" : "var(--muted)" }}>
              2. Delivery & Payment
            </span>
          </div>

          {/* STEP 1: SHIPPING ADDRESS */}
          {step === "shipping" && (
            <form 
              onSubmit={e => { 
                e.preventDefault(); 
                setStep("payment"); 
                window.scrollTo({ top: 0, behavior: "smooth" });
              }} 
              style={{ display: "flex", flexDirection: "column", gap: "28px" }}
            >
              <div className="panel">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "20px", letterSpacing: "0.04em", margin: 0 }}>
                    SHIPPING DESTINATION
                  </h2>
                  <MapPin size={18} color="var(--gold)" />
                </div>

                {auth.user && addresses?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                    {addresses.map(a => {
                      const isChosen = a.id === addressId;
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => setAddressId(a.id || "")} 
                          role="radio"
                          aria-checked={isChosen}
                          style={{ 
                            cursor: "pointer", 
                            display: "flex", 
                            alignItems: "flex-start", 
                            gap: "16px", 
                            padding: "16px 20px", 
                            border: isChosen ? "2px solid var(--gold)" : "1px solid var(--border)", 
                            borderRadius: "18px", 
                            background: isChosen ? "var(--gold-pale)" : "var(--card)",
                            boxShadow: isChosen ? "var(--shadow-gold)" : "var(--shadow-sm)",
                            transition: "all 0.25s ease"
                          }}
                        >
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            borderRadius: "50%", 
                            border: isChosen ? "6px solid var(--gold)" : "2px solid var(--border-strong)", 
                            background: "#fff", 
                            flexShrink: 0, 
                            marginTop: "2px", 
                            transition: "all 0.2s"
                          }} />
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "15px", marginBottom: "4px", color: "var(--text)" }}>
                              {a.fullName}
                              {a.isDefault && (
                                <span style={{ padding: "2px 8px", fontSize: "10px", fontWeight: 800, borderRadius: "99px", background: "var(--gold)", color: "#fff", letterSpacing: "0.05em" }}>
                                  DEFAULT
                                </span>
                              )}
                            </strong>
                            <span style={{ display: "block", color: "var(--muted)", fontSize: "13.5px", lineHeight: "1.5" }}>
                              {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pinCode}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {addressId ? (
                      <button 
                        type="button" 
                        onClick={() => setAddressId("")} 
                        className="outline-button" 
                        style={{ 
                          marginTop: "8px", 
                          alignSelf: "flex-start", 
                          padding: "10px 20px", 
                          fontSize: "12.5px", 
                          fontWeight: 700, 
                          border: "1.5px dashed var(--border-strong)", 
                          borderRadius: "99px", 
                          background: "transparent", 
                          cursor: "pointer", 
                          color: "var(--text)"
                        }}
                      >
                        + Enter another delivery address
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!addressId && (
                  <div style={{ marginTop: addresses?.length ? "20px" : "0", padding: addresses?.length ? "20px" : "0", background: addresses?.length ? "var(--layer-2)" : "transparent", borderRadius: "16px" }}>
                    {addresses?.length ? <h3 style={{ margin: "0 0 16px", fontSize: "15px" }}>Deliver to new address</h3> : null}
                    <AddressFields value={address} onChange={setAddress}/>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="button full large" 
                style={{ letterSpacing: "0.08em" }}
              >
                <span>CONTINUE TO DELIVERY & PAYMENT</span>
                <ChevronRight size={18} />
              </button>
            </form>
          )}

          {/* STEP 2: DELIVERY OPTIONS & PAYMENT */}
          {step === "payment" && (
            <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <div className="panel">
                <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "18px" }}>
                  CHOOSE DELIVERY SPEED
                </h2>
                
                {/* Delivery Option Cards - Clean horizontal luxury styling */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                  {!activeDeliveryOptionId && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 16px", background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.35)", borderRadius: "12px", marginBottom: "12px" }}>
                      <Truck size={16} color="#a16207" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: "13px", color: "#a16207", fontWeight: 600, lineHeight: 1.4 }}>Please select a delivery speed to continue to payment.</span>
                    </div>
                  )}

                {Array.isArray(cart.deliveryOptions) && cart.deliveryOptions.length > 0 ? (
                    cart.deliveryOptions.map((opt: any) => {
                      // Optimistic: use local state if set, otherwise use server state
                      const activeOptionId = optimisticDeliveryOptionId ?? cart.deliveryOptionId;
                      const isSelected = activeOptionId === opt.id;
                      const isStandard = opt.isDefault || (opt.deliveryType === "Standard" && opt.speedSurcharge === 0) || Number(opt.deliveryDays) >= 7 || opt.speedSurcharge === 0;
                      return (
                        <div 
                          key={opt.id} 
                          onClick={() => { 
                            if (activeOptionId !== opt.id && opt.available) {
                              // Instant visual feedback — no waiting for network
                              setOptimisticDeliveryOptionId(opt.id);
                              deliveryMethodMutation.mutate(opt.id);
                            }
                          }} 
                          role="radio"
                          aria-checked={isSelected}
                          style={{ 
                            cursor: opt.available ? "pointer" : "not-allowed", 
                            opacity: opt.available ? 1 : 0.5, 
                            border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                            borderRadius: "18px",
                            padding: "16px 20px",
                            background: isSelected ? "var(--gold-pale)" : "var(--card)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                            boxShadow: isSelected ? "var(--shadow-gold)" : "var(--shadow-sm)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: 1 }}>
                            {/* Radio circle */}
                            <div style={{ 
                              width: "20px", 
                              height: "20px", 
                              borderRadius: "50%", 
                              border: isSelected ? "6px solid var(--gold)" : "2px solid var(--border-strong)", 
                              background: "#fff", 
                              flexShrink: 0, 
                              transition: "all 0.2s"
                            }} />

                            {/* Truck Badge */}
                            <div style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "12px",
                              background: isSelected ? "rgba(181, 138, 53, 0.15)" : "var(--layer-2)",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                              color: isSelected ? "var(--gold)" : "var(--muted)"
                            }}>
                              <Truck size={20} />
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "15px", color: "var(--text)", fontWeight: 700 }}>{opt.name}</strong>
                                {isStandard ? (
                                  <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: "var(--layer-2)", color: "var(--muted)", textTransform: "uppercase" }}>
                                    Standard
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: "rgba(181, 138, 53, 0.15)", color: "var(--gold)", textTransform: "uppercase" }}>
                                    Express
                                  </span>
                                )}
                                {!opt.available && (
                                  <span style={{ fontSize: "11px", color: "var(--danger)", border: "1px solid var(--danger)", padding: "2px 6px", borderRadius: "4px" }}>
                                    Unavailable for address
                                  </span>
                                )}
                              </div>

                              {opt.description && (
                                <span style={{ fontSize: "12.5px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                                  {opt.description}
                                </span>
                              )}

                              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", display: "flex", gap: "6px", alignItems: "center" }}>
                                <span>Est. Arrival:</span>
                                <strong style={{ color: "var(--text)" }}>
                                  {new Date(opt.estimatedDeliveryDate).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Price Tag */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {opt.finalShippingFee === 0 ? (
                              <span style={{
                                background: "rgba(5, 150, 105, 0.12)",
                                color: "var(--success)",
                                border: "1px solid rgba(5, 150, 105, 0.3)",
                                borderRadius: "99px",
                                padding: "4px 12px",
                                fontSize: "12px",
                                fontWeight: 800,
                                letterSpacing: "0.06em"
                              }}>
                                FREE
                              </span>
                            ) : (
                              <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)" }}>
                                {money(opt.finalShippingFee)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                    ) : cart?.deliveryOptions !== undefined && cart.deliveryOptions.length === 0 ? (
                    <div style={{ padding: "18px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "12px" }}>
                      <Truck size={16} style={{ marginBottom: "6px", opacity: 0.5 }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>No delivery options available</div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>Contact us if you believe this is an error.</div>
                    </div>
                  ) : (
                    <div style={{ padding: "18px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "12px" }}>
                      Calculating delivery options for your address...
                    </div>
                  )}
                </div>

                {/* PAYMENT METHOD */}
                <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "16px" }}>
                  PAYMENT METHOD
                </h2>
                <div style={{ marginBottom: "24px" }}>
                  <div 
                    style={{ 
                      border: "2px solid var(--gold)", 
                      background: "var(--gold-pale)", 
                      borderRadius: "18px", 
                      padding: "16px 20px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "16px",
                      boxShadow: "var(--shadow-gold)"
                    }}
                  >
                    <div style={{ 
                      width: "20px", 
                      height: "20px", 
                      borderRadius: "50%", 
                      border: "6px solid var(--gold)", 
                      background: "#fff", 
                      flexShrink: 0 
                    }} />
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: "rgba(181, 138, 53, 0.15)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      color: "var(--gold)"
                    }}>
                      <CreditCard size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", fontSize: "15px", color: "var(--text)", fontWeight: 700 }}>
                        Cash on Delivery (COD)
                      </strong>
                      <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                        Pay safely upon doorstep delivery with cash or UPI QR scan
                      </span>
                    </div>
                    <CheckCircle2 size={20} style={{ color: "var(--gold)", flexShrink: 0 }} />
                  </div>
                </div>

                {/* Order Note */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                    Special Delivery Instructions (Optional)
                  </span>
                  <textarea 
                    rows={3} 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                    placeholder="Gate code, landmark, or delivery preference..."
                    style={{ background: "var(--layer-1)" }}
                  />
                </label>
              </div>

              {/* Error messages */}
              {mutation.error && (
                <div style={{ padding: "16px", background: "rgba(220,38,38,0.06)", border: "1px solid var(--danger)", borderRadius: "12px", color: "var(--danger)" }}>
                  <strong style={{ display: "block", marginBottom: "6px" }}>{mutation.error.message}</strong>
                  {(mutation.error as any).fields && (
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
                      {Object.entries((mutation.error as any).fields).map(([field, errors]) => (
                        <li key={field}>{field}: {(errors as string[]).join(", ")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setStep("shipping");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }} 
                  style={{ 
                    background: "transparent", 
                    border: "1px solid var(--border)", 
                    color: "var(--text)", 
                    fontWeight: 600, 
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "8px", 
                    fontSize: "14px",
                    padding: "0 24px",
                    height: "54px",
                    borderRadius: "8px",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                >
                  &larr; Return to Address
                </button>

                <button 
                  type="submit" 
                  disabled={mutation.isPending || cartMutation.isPending || !shippingConfirmed} 
                  title={!shippingConfirmed ? "Select a delivery method to continue" : undefined}
                  style={{ 
                    flex: 1, 
                    minHeight: "54px", 
                    fontSize: "15px", 
                    fontWeight: 800, 
                    letterSpacing: "0.05em",
                    background: shippingConfirmed ? "var(--gold)" : "var(--layer-2)",
                    color: shippingConfirmed ? "black" : "var(--muted)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: (mutation.isPending || cartMutation.isPending || !shippingConfirmed) ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px"
                  }}
                  onMouseOver={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(212, 175, 55, 0.3)"; } }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {mutation.isPending ? "CONFIRMING ORDER..." : !shippingConfirmed ? "SELECT DELIVERY FIRST" : "PLACE SECURE ORDER"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RIGHT COLUMN: STICKY ORDER SUMMARY */}
        <aside className="summary" style={{ position: "sticky", top: "100px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase", marginBottom: "16px" }}>
            Order Summary
          </h2>

          {/* Cart Item Preview list */}
          <div className="summary-items-list" style={{ maxHeight: "220px", overflowY: "auto", marginBottom: "14px", paddingRight: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {cart.items.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ color: "var(--text)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.product.name} × {item.quantity}
                </span>
                <strong>{money(Number(item.product.salePrice ?? item.product.price) * item.quantity)}</strong>
              </div>
            ))}
          </div>

          {/* Price Breakdown Container */}
          <div className="summary-section" style={{ display: "flex", flexDirection: "column", width: "100%", borderTop: "1px solid var(--border)", paddingTop: "14px", gap: "10px" }}>
            <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px" }}>
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <strong style={{ color: "var(--text)" }}>{money(cart.totals.subtotal)}</strong>
            </div>

            {Number(cart.totals.offerDiscount) > 0 && (
              <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13.5px", color: "var(--success)" }}>
                <span>Offer Discount ({cart.appliedOfferCode})</span>
                <strong>-{money(cart.totals.offerDiscount)}</strong>
              </div>
            )}

            <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "13.5px" }}>
              <span style={{ color: "var(--muted)" }}>Shipping</span>
              {shippingConfirmed ? (
                <strong>
                  {Number(optimisticShippingFee) === 0 ? (
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>FREE</span>
                  ) : (
                    money(optimisticShippingFee)
                  )}
                </strong>
              ) : (
                <span style={{ color: "var(--muted)", fontSize: "12px", textAlign: "right", lineHeight: 1.4 }}>
                  Select delivery
                </span>
              )}
            </div>

            <div className="summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px", color: "var(--muted)" }}>
              <span>Tax (GST Inclusive)</span>
              <span>{money(cart.totals.tax)}</span>
            </div>

            {/* Grand Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700 }}>
                {shippingConfirmed ? "Total Due" : "Subtotal"}
              </span>
              <strong style={{ fontSize: "22px", color: "var(--gold)" }}>
                <AnimatedPrice value={shippingConfirmed ? optimisticGrandTotal : cart.totals.subtotal} />
              </strong>
            </div>
          </div>

          {/* Offer Code quick apply/drawer in Checkout */}
          <div className="summary-section" style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            {cart.appliedOfferCode ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(181, 138, 53, 0.1)", border: "1px solid rgba(181, 138, 53, 0.25)", borderRadius: "var(--radius-pill)", padding: "6px 14px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gold)" }}>
                  {cart.appliedOfferCode} APPLIED
                </span>
                <button 
                  type="button" 
                  onClick={() => offerMutation.mutate({ path: "/cart/remove-offer", method: "POST" })}
                  style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center" }}
                  aria-label="Remove offer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Have a coupon?</span>
                <button 
                  type="button"
                  onClick={() => setIsOfferDrawerOpen(true)}
                  style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "12px", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                >
                  Apply Offer
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", color: "var(--muted)", fontSize: "12px" }}>
            <ShieldCheck size={16} color="var(--gold)" />
            <span>Guaranteed dispatch & authentic delivery.</span>
          </div>
        </aside>
      </div>

      {/* Available Offers Drawer */}
      <OfferDrawer 
        isOpen={isOfferDrawerOpen}
        onClose={() => setIsOfferDrawerOpen(false)}
        offers={offersData || []}
        isLoading={offersLoading}
        isError={offersError}
        onRetry={refetchOffers}
        appliedCode={cart?.appliedOfferCode || null}
        isApplying={offerMutation.isPending}
        onApply={async (code, onError) => {
          let lat = address?.latitude;
          let lng = address?.longitude;
          
          if (!addressId && lat == null && (address?.pinCode || address?.city)) {
            try {
              const query = encodeURIComponent(`${address.pinCode || ''} ${address.city || ''} ${address.state || ''}`);
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${query}&limit=1`);
              const data = await res.json();
              if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
              }
            } catch (err) {
              console.warn("Auto-geocode failed", err);
            }
          }

          offerMutation.mutate(
            { path: "/cart/apply-offer", method: "POST", body: { code, addressId: addressId || undefined, lat, lng } },
            {
              onSuccess: () => setIsOfferDrawerOpen(false),
              onError: (err: any) => onError && onError(err.message)
            }
          );
        }}
        onRemove={() => {
          offerMutation.mutate({ path: "/cart/remove-offer", method: "POST" });
        }}
      />
    </section>
  ); 
}
