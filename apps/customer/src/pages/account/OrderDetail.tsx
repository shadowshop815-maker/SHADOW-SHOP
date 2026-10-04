import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Printer, ArrowLeft, Calendar, Clock, Truck, ShieldCheck, Package, AlertCircle } from "lucide-react";
import { api, money } from "../../api";
import type { Order } from "../../types";
import { Spinner, Status } from "../../components/ui";
import { Invoice } from "../../components/ui/Invoice";
import { ReturnItemButton } from "../../components/returns/ReturnItemButton";

const orderSteps = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export function OrderDetail() { 
  const { id } = useParams(); 
  const client = useQueryClient(); 
  
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<Order>(`/orders/${id}`)
  }); 
  
  const [reason, setReason] = useState(""); 
  
  const cancel = useMutation({
    mutationFn: () => api(`/orders/${id}/cancellation`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["order", id] });
      client.invalidateQueries({ queryKey: ["orders"] });
    }
  }); 
  
  if (isLoading) return <Spinner/>; 
  if (error || !order) return <Status error={error}>{null}</Status>; 
  
  const active = orderSteps.indexOf(order.orderStatus); 
  const cancellable = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"].includes(order.orderStatus) && !order.cancellation; 
  
  const delivery = typeof order.deliverySnapshot === "string" 
    ? JSON.parse(order.deliverySnapshot || "{}") 
    : (order.deliverySnapshot || {});

  let expectedDate: Date | null = null;
  if (delivery?.deliveryDays) {
    const d = new Date(order.createdAt);
    d.setDate(d.getDate() + delivery.deliveryDays);
    expectedDate = d;
  }

  const progressPercent = active >= 0 ? Math.min(100, Math.max(0, (active / (orderSteps.length - 1)) * 100)) : 0;

  return (
    <section className="section page" style={{ paddingTop: "36px", paddingBottom: "80px" }}>
      {/* Back to Orders Button */}
      <Link 
        to="/account"
        className="outline-button"
        style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "8px", 
          marginBottom: "24px",
          padding: "9px 18px",
          fontSize: "12.5px"
        }}
      >
        <ArrowLeft size={15} /> Back to all orders
      </Link>

      {/* Order Title & Header Card */}
      <div className="order-title">
        <div>
          <span className="eyebrow">ORDER DETAILS</span>
          <h1 style={{ 
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif", 
            fontSize: "clamp(22px, 3.2vw, 32px)", 
            fontWeight: 800, 
            letterSpacing: "-0.025em",
            margin: "6px 0 0 0",
            color: "var(--text)"
          }}>
            Order <span style={{ fontFamily: "monospace", color: "var(--gold)" }}>#{order.orderNumber}</span>
          </h1>

          {/* Quick Meta Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--layer-2)", padding: "6px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border)" }}>
              <Calendar size={14} color="var(--muted)" />
              <div style={{ display: "flex", gap: "6px", fontSize: "13px" }}>
                <span style={{ color: "var(--muted)" }}>Placed:</span>
                <b style={{ color: "var(--text)" }}>{new Date(order.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
              </div>
            </div>

            {delivery?.name && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--layer-2)", padding: "6px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border)" }}>
                <Truck size={14} color="var(--muted)" />
                <div style={{ display: "flex", gap: "6px", fontSize: "13px" }}>
                  <span style={{ color: "var(--muted)" }}>Shipping:</span>
                  <b style={{ color: "var(--text)" }}>{delivery.name}</b>
                </div>
              </div>
            )}

            {expectedDate && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--gold-pale)", padding: "6px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--gold)" }}>
                <Clock size={14} color="var(--gold)" />
                <div style={{ display: "flex", gap: "6px", fontSize: "13px" }}>
                  <span style={{ color: "var(--gold)", fontWeight: 600 }}>Arrival:</span>
                  <b style={{ color: "var(--gold)" }}>{expectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side Status & Action */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
          <span className={`status ${order.orderStatus.toLowerCase()}`} style={{ fontSize: "12px", padding: "8px 18px", fontWeight: 800, letterSpacing: "0.06em" }}>
            {order.orderStatus.replaceAll("_", " ")}
          </span>
          {order.orderStatus === "DELIVERED" && (
            <button 
              type="button" 
              className="button ghost" 
              onClick={() => window.print()} 
              style={{ padding: "8px 16px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={14} /> Download Invoice
            </button>
          )}
        </div>
      </div>
      
      {/* Live Order Status Timeline Stepper */}
      {active >= 0 && (
        <div className="tracking-stepper-card">
          <div className="tracking-stepper-head">
            <div className="tracking-live-badge">
              <span className="pulse-dot"></span>
              <span>Live Tracking · Status: <strong style={{ color: "var(--gold)" }}>{order.orderStatus.replaceAll("_", " ")}</strong></span>
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--muted)", fontWeight: 700 }}>
              Stage {active + 1} of {orderSteps.length}
            </div>
          </div>

          <div className="timeline">
            {/* Background & Filled Progress Bar Track */}
            <div className="timeline-track-bg">
              <div className="timeline-track-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>

            {orderSteps.map((step, index) => {
              const isCompleted = index < active;
              const isActive = index === active;
              return (
                <div 
                  className={`timeline-step ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`} 
                  key={step}
                >
                  <div className="timeline-step-circle">
                    {isCompleted ? <Check size={16} strokeWidth={2.8} /> : index + 1}
                  </div>
                  <span className="timeline-step-label">
                    {step.replaceAll("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="order-detail-grid">
        {/* Left Column: Items & Address */}
        <div>
          {/* Purchased Items Panel */}
          <div className="panel" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Package size={20} color="var(--gold)" />
                <h2 style={{ fontSize: "18px", letterSpacing: "-0.01em", margin: 0, fontWeight: 800 }}>Purchased Items</h2>
              </div>
              <span style={{ fontSize: "12.5px", color: "var(--muted)", background: "var(--layer-2)", padding: "3px 10px", borderRadius: "var(--radius-pill)", fontWeight: 700 }}>
                {order.items.length} item{order.items.length > 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {order.items.map(i => (
                <div 
                  className="order-item" 
                  key={i.id} 
                  style={{ 
                    display: "grid", 
                    gridTemplateColumns: "80px 1fr auto", 
                    gap: "18px", 
                    alignItems: "center", 
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)"
                  }}
                >
                  <div style={{ 
                    width: 80, 
                    height: 88, 
                    borderRadius: "12px", 
                    background: "var(--layer-2)", 
                    border: "1px solid var(--border)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    overflow: "hidden", 
                    padding: "6px" 
                  }}>
                    <img 
                      src={i.productImageSnapshot || "/assets/product-fallback.svg"} 
                      alt={i.productNameSnapshot} 
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
                    />
                  </div>

                  <div>
                    <b style={{ fontSize: "15.5px", color: "var(--text)", display: "block", marginBottom: "4px" }}>
                      {i.productNameSnapshot}
                    </b>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "6px 0 8px 0" }}>
                      {i.selectedSize && (
                        <span style={{ fontSize: "11.5px", background: "var(--layer-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "6px", color: "var(--text)", fontWeight: 600 }}>
                          Size: {i.selectedSize}
                        </span>
                      )}
                      {i.selectedColor && (
                        <span style={{ fontSize: "11.5px", background: "var(--layer-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "6px", color: "var(--text)", fontWeight: 600 }}>
                          Color: {i.selectedColor}
                        </span>
                      )}
                      <span style={{ fontSize: "11.5px", background: "var(--layer-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "6px", color: "var(--muted)", fontWeight: 600 }}>
                        Qty: {i.quantity}
                      </span>
                    </div>
                    <ReturnItemButton order={order} item={i} />
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: "16px", color: "var(--text)", display: "block" }}>
                      {money(Number(i.unitPriceSnapshot) * i.quantity)}
                    </strong>
                    {i.quantity > 1 && (
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {money(Number(i.unitPriceSnapshot))} each
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Address & GPS Tracking */}
          <div className="panel" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <MapPin size={18} color="var(--gold)" />
                <h2 style={{ fontSize: "18px", letterSpacing: "-0.01em", margin: 0, fontWeight: 800 }}>Delivery Address</h2>
              </div>
            </div>

            <div style={{ background: "var(--layer-2)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)", marginBottom: "6px" }}>
                {order.shippingAddressSnapshot.fullName}
              </div>
              <address style={{ fontStyle: "normal", fontSize: "13.5px", lineHeight: 1.65, color: "var(--muted)" }}>
                {order.shippingAddressSnapshot.line1}
                {order.shippingAddressSnapshot.town ? `, ${order.shippingAddressSnapshot.town}` : ""}<br/>
                {order.shippingAddressSnapshot.city}, {order.shippingAddressSnapshot.state} {order.shippingAddressSnapshot.pinCode}<br/>
                {order.shippingAddressSnapshot.country}
              </address>
              {order.shippingAddressSnapshot.phone && (
                <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text)", fontWeight: 600 }}>
                  Phone: {order.shippingAddressSnapshot.phone}
                </div>
              )}
            </div>

            {order.trackingNumber && (
              <div style={{ marginTop: "18px", padding: "16px 20px", background: "var(--layer-2)", borderRadius: "14px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", display: "block", marginBottom: "6px", fontWeight: 700 }}>
                  Live Waybill / Tracking ID
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", fontFamily: "monospace" }}>
                      {order.trackingNumber}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                      Carrier: {order.courierName || "Shadow Logistics"}
                    </div>
                  </div>
                  <a 
                    href={`https://www.google.com/search?q=${order.trackingNumber}+tracking`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="button ghost" 
                    style={{ fontSize: "12px", padding: "8px 16px" }}
                  >
                    Track with Carrier
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
        
        {/* Right Column: Payment & Charges Summary Sidebar */}
        <aside className="summary">
          <h2 style={{ fontSize: "18px", letterSpacing: "-0.01em", margin: "0 0 20px 0", fontWeight: 800 }}>Payment Details</h2>
          
          <div className="summary-row">
            <span>Payment Method</span>
            <span className="pay-badge method">{order.paymentMethod}</span>
          </div>

          <div className="summary-row">
            <span>Payment Status</span>
            <span className={`pay-badge ${order.paymentStatus === "PAID" ? "status-paid" : "status-pending"}`}>
              {order.paymentStatus}
            </span>
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <b style={{ color: "var(--text)" }}>{money(order.subtotal)}</b>
          </div>
          
          {order.offerRedemptions && order.offerRedemptions.length > 0 && (
            <>
              {order.offerRedemptions.map((offer: any, idx: number) => (
                <div className="summary-row" key={idx} style={{ color: "var(--success)" }}>
                  <span>Offer ({offer.offerCode})</span>
                  <b className="discount" style={{ fontWeight: 700 }}>-{money(offer.actualDiscountAmount)}</b>
                </div>
              ))}
            </>
          )}

          {Number(order.discount) - ((order.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0) > 0 && (
            <div className="summary-row" style={{ color: "var(--success)" }}>
              <span>Additional Discount</span>
              <b className="discount" style={{ fontWeight: 700 }}>
                -{money(Number(order.discount) - ((order.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0))}
              </b>
            </div>
          )}

          <div className="summary-row">
            <span>Delivery Charge</span>
            <b>{Number(order.shippingCharge) === 0 ? <span style={{ color: "var(--success)", fontWeight: 700 }}>FREE</span> : money(order.shippingCharge)}</b>
          </div>

          <div className="summary-row">
            <span>Taxes (Included)</span>
            <span style={{ color: "var(--muted)" }}>{money(order.tax)}</span>
          </div>

          <div className="summary-row summary-total">
            <div>
              <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", display: "block" }}>Total Amount</span>
              <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", margin: 0 }}>Taxes & delivery included</small>
            </div>
            <b style={{ color: "var(--gold)", fontSize: "22px", fontWeight: 800 }}>{money(order.grandTotal)}</b>
          </div>

          {/* Security & Guarantee Seal */}
          <div style={{ 
            marginTop: "22px", 
            paddingTop: "16px", 
            borderTop: "1px dashed var(--border)", 
            display: "flex", 
            alignItems: "center", 
            gap: "10px", 
            color: "var(--muted)", 
            fontSize: "12px" 
          }}>
            <ShieldCheck size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
            <span>Encrypted transaction · 100% Authentic brand guarantee</span>
          </div>
        </aside>
      </div>
      
      {/* Cancellation Status */}
      {order.cancellation && (
        <div className="panel notice" style={{ marginTop: "24px", borderLeftColor: "var(--gold)" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 800, marginBottom: "8px" }}>Cancellation Status: {order.cancellation.status}</h2>
          <p style={{ margin: "4px 0", color: "var(--muted)" }}>{order.cancellation.reason}</p>
          {order.cancellation.adminResponse && (
            <p style={{ marginTop: "8px", fontWeight: 600, color: "var(--text)" }}>Store response: {order.cancellation.adminResponse}</p>
          )}
        </div>
      )}
      
      {/* Return Requests Steppers */}
      {order.returns?.map(r => {
        const returnStepsMap = [
          "RETURN_REQUESTED",
          "RETURN_APPROVED",
          "PICKUP_SCHEDULED",
          "PICKED_UP",
          "RETURN_RECEIVED",
          "INSPECTION_IN_PROGRESS",
          "INSPECTION_COMPLETED",
          "REFUND_INITIATED",
          "REFUND_COMPLETED"
        ];
        const isRejected = r.status.includes("REJECTED") || r.status.includes("CANCELLED");
        const activeIdx = returnStepsMap.indexOf(r.status);
        const steps = isRejected ? [returnStepsMap[0], r.status] : returnStepsMap;
        const currentActive = isRejected ? 1 : activeIdx;
        const progress = currentActive >= 0 ? Math.min(100, Math.max(0, (currentActive / (steps.length - 1)) * 100)) : 0;
        
        return (
          <div 
            key={r.id} 
            className="panel" 
            style={{ 
              marginTop: "24px", 
              padding: 0, 
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            {/* Header Section */}
            <div style={{ 
              padding: "24px", 
              background: "var(--layer-2)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Return Tracker</h2>
                  <span style={{ 
                    fontSize: "11px", 
                    fontWeight: 700, 
                    padding: "4px 10px", 
                    background: isRejected ? "var(--danger-pale)" : "var(--gold-pale)", 
                    color: isRejected ? "var(--danger)" : "var(--gold)",
                    borderRadius: "100px",
                    border: `1px solid ${isRejected ? "var(--danger)" : "var(--gold)"}`
                  }}>
                    {r.returnNumber}
                  </span>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", fontSize: "13.5px" }}>
                    <span style={{ color: "var(--muted)", width: "120px", flexShrink: 0 }}>Reason:</span>
                    <strong style={{ color: "var(--text)" }}>{r.reason}</strong>
                  </div>
                  {(r as any).description && (
                    <div style={{ display: "flex", gap: "8px", fontSize: "13.5px" }}>
                      <span style={{ color: "var(--muted)", width: "120px", flexShrink: 0 }}>Details:</span>
                      <span style={{ color: "var(--text-secondary)" }}>"{(r as any).description}"</span>
                    </div>
                  )}
                  {r.adminResponse && (
                    <div style={{ display: "flex", gap: "8px", fontSize: "13.5px", marginTop: "8px", padding: "12px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--gold)", width: "108px", flexShrink: 0, fontWeight: 600 }}>Store Message:</span>
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>{r.adminResponse}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Stepper Section */}
            <div style={{ padding: "32px 24px" }}>
              <div className="tracking-stepper-head" style={{ padding: "0 0 24px 0", border: "none", marginBottom: 0 }}>
                <div className="tracking-live-badge" style={{ background: "transparent", padding: 0, border: "none" }}>
                  {!isRejected && <span className="pulse-dot" style={{ background: "var(--gold)" }}></span>}
                  <span style={{ fontSize: "14px" }}>Current Status: <strong style={{ color: isRejected ? "var(--danger)" : "var(--gold)" }}>{r.status.replaceAll("_", " ")}</strong></span>
                </div>
                {!isRejected && (
                  <div style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 700, background: "var(--layer-2)", padding: "4px 12px", borderRadius: "100px", border: "1px solid var(--border)" }}>
                    Stage {currentActive + 1} of {steps.length}
                  </div>
                )}
              </div>

              <div className="timeline" style={{ paddingBottom: "10px" }}>
                <div className="timeline-track-bg" style={{ height: "4px", borderRadius: "4px", background: "var(--layer-2)", border: "1px solid var(--border)" }}>
                  <div className="timeline-track-fill" style={{ width: `${progress}%`, height: "100%", background: isRejected ? "var(--danger)" : "var(--gold)", borderRadius: "4px", boxShadow: `0 0 10px ${isRejected ? "var(--danger)" : "var(--gold)"}` }}></div>
                </div>

                {steps.map((step, index) => {
                  const isCompleted = index <= currentActive;
                  const isActive = index === currentActive;
                  const histRec = r.history?.find((h: any) => h.status === step);
                  
                  return (
                    <div 
                      className={`timeline-step ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`} 
                      key={step}
                    >
                      <div 
                        className="timeline-step-circle" 
                        style={{ 
                          width: isActive ? "32px" : "28px",
                          height: isActive ? "32px" : "28px",
                          borderColor: isCompleted ? (isRejected ? "var(--danger)" : "var(--gold)") : "var(--border)", 
                          background: isCompleted ? (isRejected ? "var(--danger)" : "var(--gold)") : "var(--layer-2)",
                          color: isCompleted ? "#fff" : "var(--muted)",
                          fontWeight: isActive ? 800 : 600,
                          fontSize: "12px",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: isActive ? `0 0 0 4px ${isRejected ? "var(--danger-pale)" : "var(--gold-pale)"}` : "none"
                        }}
                      >
                        {isCompleted ? <Check size={16} strokeWidth={3} /> : index + 1}
                      </div>
                      <span 
                        className="timeline-step-label" 
                        style={{ 
                          color: isActive ? "var(--text)" : (isCompleted ? "var(--text-secondary)" : "var(--muted)"),
                          fontWeight: isActive ? 700 : 500,
                          fontSize: isActive ? "12px" : "11px",
                          marginTop: "12px",
                          letterSpacing: "0.02em"
                        }}
                      >
                        {step.replaceAll("_", " ")}
                        {histRec && (
                          <small style={{ 
                            display: "block", 
                            fontSize: "10.5px", 
                            marginTop: "6px", 
                            color: "var(--muted)",
                            fontWeight: 500
                          }}>
                            {new Date(histRec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </small>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Order Cancellation Form */}
      {cancellable && (
        <div className="cancellation-card" style={{ 
          marginTop: "32px", 
          border: "1px solid var(--danger-pale, #fecaca)", 
          borderRadius: "12px",
          backgroundColor: "#fffafa",
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(239, 68, 68, 0.05)"
        }}>
          <details className="action-panel-premium group" style={{ cursor: "pointer" }}>
            <summary style={{ 
              display: "flex", 
              alignItems: "center", 
              padding: "20px 24px", 
              fontWeight: 700, 
              color: "var(--danger)",
              listStyle: "none",
              outline: "none",
            }}>
              <AlertCircle size={20} style={{ marginRight: "12px" }} />
              <span style={{ fontSize: "15px", flex: 1 }}>Request Order Cancellation</span>
              <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
                Click to expand
              </span>
            </summary>
            
            <div style={{ 
              padding: "0 24px 24px 24px", 
              borderTop: "1px solid var(--danger-pale, #fee2e2)",
              marginTop: "4px",
              paddingTop: "20px"
            }}>
              <p style={{ 
                fontSize: "13px", 
                color: "var(--text-secondary)", 
                marginBottom: "20px",
                lineHeight: 1.5 
              }}>
                Please note that cancelled orders cannot be restored. If you have already paid, a full refund will be automatically processed to your original payment method within 5-7 business days.
              </p>
              
              <form onSubmit={e => { e.preventDefault(); cancel.mutate(); }}>
                <label style={{ display: "block", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>Cancellation Reason <span style={{color:"var(--danger)"}}>*</span></span>
                  <textarea 
                    required 
                    minLength={10} 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="Briefly explain why you wish to cancel this order..."
                    style={{ 
                      marginTop: "10px", 
                      width: "100%", 
                      minHeight: "100px",
                      padding: "14px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--layer-2)",
                      fontSize: "14px",
                      resize: "vertical",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--danger)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </label>
                
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button 
                    type="submit" 
                    disabled={cancel.isPending || reason.trim().length < 10} 
                    style={{ 
                      padding: "12px 24px",
                      borderRadius: "8px",
                      backgroundColor: cancel.isPending || reason.trim().length < 10 ? "var(--border)" : "var(--danger)",
                      color: cancel.isPending || reason.trim().length < 10 ? "var(--muted)" : "#fff",
                      fontWeight: 700,
                      fontSize: "14px",
                      border: "none",
                      cursor: cancel.isPending || reason.trim().length < 10 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s"
                    }}
                  >
                    {cancel.isPending ? "Submitting..." : "Submit Cancellation Request"}
                  </button>
                </div>
                {cancel.error && (
                  <div style={{ 
                    marginTop: "16px", 
                    padding: "12px 16px", 
                    backgroundColor: "var(--danger-pale, #fee2e2)", 
                    color: "var(--danger)", 
                    borderRadius: "6px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontWeight: 600
                  }}>
                    <AlertCircle size={18} />
                    {cancel.error.message}
                  </div>
                )}
              </form>
            </div>
          </details>
          <style>{`
            details.action-panel-premium summary::-webkit-details-marker {
              display: none;
            }
          `}</style>
        </div>
      )}

      {/* Printable Invoice Component */}
      <Invoice order={order} />
    </section>
  ); 
}
