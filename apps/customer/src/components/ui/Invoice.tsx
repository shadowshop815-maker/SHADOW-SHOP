import { createPortal } from "react-dom";
import { money } from "../../api";
import type { Order } from "../../types";

export function Invoice({ order }: { order: Order }) {
  if (!order) return null;
  const address = order.shippingAddressSnapshot ? (typeof order.shippingAddressSnapshot === "string" ? JSON.parse(order.shippingAddressSnapshot) : order.shippingAddressSnapshot) : {};
  
  return createPortal(
    <div className="print-invoice" style={{ fontFamily: "'Inter', sans-serif", color: "#111", padding: "40px", maxWidth: "800px", margin: "0 auto", backgroundColor: "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #111", paddingBottom: "24px", marginBottom: "32px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 900, letterSpacing: "-0.02em", color: "#000" }}>SHADOW SHOP</h1>
          <p style={{ margin: "8px 0 0", color: "#555", fontSize: "12px", lineHeight: 1.5 }}>
            123 Shadow Avenue, Fashion District<br/>
            Kolkata, WB 700001, India<br/>
            support@shadowshop.com<br/>
            Contact: 9876543210
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ margin: 0, fontSize: "40px", color: "#000", fontWeight: 200, letterSpacing: "4px" }}>INVOICE</h2>
          <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: "#f8f8f8", borderLeft: "4px solid #d4af37", display: "inline-block", textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#666", textTransform: "uppercase", fontWeight: 600 }}>Invoice Number</p>
            <p style={{ margin: "2px 0 8px", fontSize: "16px", fontWeight: 700, color: "#111" }}>#{order.orderNumber}</p>
            <p style={{ margin: 0, fontSize: "11px", color: "#666", textTransform: "uppercase", fontWeight: 600 }}>Date of Issue</p>
            <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 600, color: "#111" }}>{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
      
      {/* Billing & Shipping Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginBottom: "40px" }}>
        <div>
          <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#888", borderBottom: "1px solid #eee", paddingBottom: "8px", marginBottom: "12px" }}>Billed To / Shipping Address</h3>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#000" }}>{address.fullName}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#444" }}>{address.line1}</p>
          {address.line2 && <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#444" }}>{address.line2}</p>}
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#444" }}>{address.city}, {address.state} {address.pinCode}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#444" }}>{address.country}</p>
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#222" }}><strong>Phone:</strong> {address.phone}</p>
        </div>
        <div>
          <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#888", borderBottom: "1px solid #eee", paddingBottom: "8px", marginBottom: "12px" }}>Payment & Delivery Details</h3>
          <table style={{ width: "100%", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 0", color: "#666" }}>Payment Method:</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{order.paymentMethod?.replace(/_/g, " ")}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#666" }}>Payment Status:</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{order.paymentStatus}</td>
              </tr>
              {(() => {
                const delivery = typeof (order as any).deliverySnapshot === "string" ? JSON.parse((order as any).deliverySnapshot || "{}") : ((order as any).deliverySnapshot || {});
                return delivery?.name ? (
                  <tr>
                    <td style={{ padding: "4px 0", color: "#666" }}>Delivery Method:</td>
                    <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{delivery.name}</td>
                  </tr>
                ) : null;
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Description</th>
            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Qty</th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Unit Price</th>
            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #eaeaea", backgroundColor: index % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td style={{ padding: "16px", fontSize: "13px" }}>
                <strong style={{ display: "block", color: "#111", marginBottom: "4px" }}>{item.productNameSnapshot}</strong>
                <span style={{ color: "#777", fontSize: "11px" }}>
                  {[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: 500 }}>{item.quantity}</td>
              <td style={{ padding: "16px", textAlign: "right", fontSize: "13px", color: "#444" }}>{money(item.unitPriceSnapshot)}</td>
              <td style={{ padding: "16px", textAlign: "right", fontSize: "13px", fontWeight: 600, color: "#000" }}>{money(Number(item.unitPriceSnapshot) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Calculation */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "320px", border: "1px solid #eaeaea", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Subtotal</span>
              <span style={{ fontWeight: 500 }}>{money(order.subtotal)}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                <span style={{ color: "#666" }}>Discount</span>
                <span style={{ color: "#d93025", fontWeight: 500 }}>-{money(order.discount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Shipping</span>
              <span style={{ fontWeight: 500 }}>{Number(order.shippingCharge) === 0 ? "Free" : money(order.shippingCharge)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Taxes (Included)</span>
              <span style={{ fontWeight: 500 }}>{money(order.tax)}</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px", fontSize: "18px", fontWeight: 800, backgroundColor: "#111", color: "#fff" }}>
            <span>Grand Total</span>
            <span>{money(order.grandTotal)}</span>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div style={{ marginTop: "60px", textAlign: "center", color: "#888", fontSize: "11px", borderTop: "2px solid #eee", paddingTop: "24px" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#111", fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>Thank you for your business!</p>
        <p style={{ margin: "8px 0 0" }}>This is a computer generated invoice and requires no physical signature.</p>
        <p style={{ margin: "4px 0 0", color: "#aaa" }}>Shadow Shop &copy; {new Date().getFullYear()}</p>
      </div>
    </div>,
    document.body
  );
}
