import { Link, useLocation, useParams } from "react-router-dom";
import { Check, Truck, ArrowRight, Package, ShieldCheck } from "lucide-react";
import type { Order } from "../../types";
import { money } from "../../api";
import { Reveal } from "../../components/motion/Motion";

export function Confirmation() { 
  const { number } = useParams(); 
  const location = useLocation(); 
  const order = location.state?.order as Order | undefined; 
  
  return (
    <section className="section page" style={{ maxWidth: "780px", margin: "0 auto", textAlign: "center", paddingBottom: "100px" }}>
      {/* Animated Checkmark Badge */}
      <Reveal direction="down" duration={500}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div 
            style={{ 
              width: 72, 
              height: 72, 
              borderRadius: "50%", 
              background: "var(--gold-pale)", 
              border: "2px solid var(--gold)", 
              display: "grid", 
              placeItems: "center",
              boxShadow: "var(--shadow-gold)"
            }}
          >
            <Check size={36} color="var(--gold)" strokeWidth={2.5} />
          </div>
        </div>
      </Reveal>

      {/* Order Heading */}
      <Reveal direction="up" delay={150}>
        <span className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
          ORDER CONFIRMED
        </span>
        <h1 style={{ 
          fontFamily: "'Inter', system-ui, sans-serif", 
          margin: "8px 0 12px 0", 
          fontSize: "clamp(24px, 3.5vw, 34px)", 
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text)"
        }}>
          Order <span style={{ fontFamily: "monospace", color: "var(--gold)" }}>#{number}</span>
        </h1>
        <p style={{ maxWidth: 460, margin: "0 auto 28px", color: "var(--muted)", fontSize: "15px", lineHeight: 1.6 }}>
          Thank you for your order. We have received it and will notify you when your package is dispatched.
        </p>
      </Reveal>
      
      {order && (
        <Reveal direction="up" delay={250}>
          <div 
            className="panel" 
            style={{ 
              textAlign: "left", 
              width: "100%", 
              maxWidth: 580, 
              margin: "0 auto 32px", 
              padding: "32px", 
              border: "1px solid var(--border)", 
              background: "var(--card)",
              borderRadius: "24px",
              boxShadow: "var(--shadow-md)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "14px", borderBottom: "1px solid var(--border)", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Package size={17} color="var(--gold)" />
                <h2 style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                  Order Summary
                </h2>
              </div>
              <span style={{ 
                fontSize: "11px", 
                fontWeight: 800, 
                textTransform: "uppercase", 
                letterSpacing: "0.06em",
                background: "rgba(5, 150, 105, 0.12)",
                color: "var(--success)",
                border: "1px solid rgba(5, 150, 105, 0.3)",
                padding: "3px 10px",
                borderRadius: "99px"
              }}>
                Confirmed · COD
              </span>
            </div>

            {/* Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
              {order.items.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", alignItems: "center" }}>
                  <span style={{ color: "var(--text)" }}>
                    <strong>{i.productNameSnapshot}</strong>
                    {i.selectedColor ? ` · ${i.selectedColor}` : ""} 
                    {i.selectedSize ? ` · ${i.selectedSize}` : ""} 
                    <span style={{ color: "var(--muted)" }}> × {i.quantity}</span>
                  </span>
                  <strong style={{ color: "var(--text)" }}>{money(Number(i.unitPriceSnapshot) * i.quantity)}</strong>
                </div>
              ))}
            </div>

            <hr style={{ border: 0, borderBottom: "1px solid var(--border)", margin: "14px 0" }}/>
            
            {/* Price breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", color: "var(--muted)", fontSize: "13.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span style={{ color: "var(--text)" }}>{money(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
                  <span>Offer Discount</span>
                  <b>-{money(order.discount)}</b>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Delivery</span>
                <span style={{ color: Number(order.shippingCharge) === 0 ? "var(--success)" : "var(--text)", fontWeight: Number(order.shippingCharge) === 0 ? 700 : 400 }}>
                  {Number(order.shippingCharge) === 0 ? "FREE" : money(order.shippingCharge)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>GST & Taxes (Included)</span>
                <span>{money(order.tax)}</span>
              </div>
            </div>
            
            <hr style={{ border: 0, borderBottom: "1px solid var(--border)", margin: "14px 0" }}/>
            
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", alignItems: "center", color: "var(--text)" }}>
              <strong style={{ fontWeight: 800 }}>Total Amount Due</strong>
              <strong style={{ color: "var(--gold)", fontSize: "22px" }}>{money(order.grandTotal)}</strong>
            </div>

            {/* Address */}
            <div style={{ marginTop: "20px", background: "var(--layer-2)", padding: "16px 18px", borderRadius: "16px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", letterSpacing: "0.08em", margin: "0 0 8px 0", color: "var(--gold)", textTransform: "uppercase", fontWeight: 800 }}>
                <Truck size={14} />
                <span>Delivery Destination</span>
              </div>
              <address style={{ fontStyle: "normal", fontSize: "13px", lineHeight: 1.5, color: "var(--text)" }}>
                <strong>{order.shippingAddressSnapshot.fullName}</strong><br />
                {order.shippingAddressSnapshot.line1}{order.shippingAddressSnapshot.town ? `, ${order.shippingAddressSnapshot.town}` : ""}<br />
                {order.shippingAddressSnapshot.city}, {order.shippingAddressSnapshot.state} {order.shippingAddressSnapshot.pinCode}<br />
                {order.shippingAddressSnapshot.country}
              </address>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", color: "var(--muted)", fontSize: "12px" }}>
              <ShieldCheck size={15} color="var(--gold)" />
              <span>Cash on delivery payment will be collected at doorstep.</span>
            </div>
          </div>
        </Reveal>
      )}
      
      {/* Action buttons */}
      <Reveal direction="up" delay={300}>
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
          {order && (
            <Link className="button" to={`/account/orders/${order.id}`} style={{ padding: "14px 28px", minWidth: "180px", fontWeight: 700 }}>
              <span>Track Order Details</span>
              <ArrowRight size={16} />
            </Link>
          )}
          <Link className="button outline-button" to="/products" style={{ padding: "14px 28px", minWidth: "180px", fontWeight: 700 }}>
            Continue Exploring
          </Link>
        </div>
      </Reveal>
    </section>
  ); 
}
