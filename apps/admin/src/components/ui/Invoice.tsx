import { createPortal } from "react-dom";
import { money } from "../../api";
import type { Order } from "../../pages/sales/Orders";

export function Invoice({ order }: { order: Order }) {
  if (!order) return null;
  const address = order.shippingAddressSnapshot ? (typeof order.shippingAddressSnapshot === "string" ? JSON.parse(order.shippingAddressSnapshot) : order.shippingAddressSnapshot) : {};
  
  return createPortal(
    <div className="print-invoice">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #b58a35", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", color: "#050505" }}>SHADOW SHOP</h1>
          <p style={{ margin: "5px 0 0", color: "#666", fontSize: "12px" }}>123 Shadow Avenue, Fashion District<br/>Kolkata, WB 700001, India<br/>support@shadowshop.com<br/>Contact: 9876543210</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ margin: 0, fontSize: "28px", color: "#b58a35", fontWeight: 800, textTransform: "uppercase", letterSpacing: "2px" }}>INVOICE</h2>
          <p style={{ margin: "5px 0 0", fontWeight: 700, color: "#050505" }}>#{order.orderNumber}</p>
          <p style={{ margin: "5px 0 0", color: "#666", fontSize: "12px" }}>Booking Date: {new Date(order.createdAt).toLocaleDateString()}</p>
          {(() => {
            const delivery = typeof (order as any).deliverySnapshot === "string" ? JSON.parse((order as any).deliverySnapshot || "{}") : ((order as any).deliverySnapshot || {});
            let expectedDate: Date | null = null;
            if (delivery?.deliveryDays) {
              const d = new Date(order.createdAt);
              d.setDate(d.getDate() + delivery.deliveryDays);
              expectedDate = d;
            }
            return (
              <>
                {delivery?.name && <p style={{ margin: "5px 0 0", color: "#666", fontSize: "12px" }}>Delivery Method: {delivery.name}</p>}
                {expectedDate && <p style={{ margin: "5px 0 0", color: "#b58a35", fontSize: "12px", fontWeight: 700 }}>Expected Delivery: {expectedDate.toLocaleDateString()}</p>}
              </>
            );
          })()}
        </div>
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
        <div>
          <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>Billed To / Shipping Details:</h3>
          <p style={{ margin: 0, fontWeight: 600 }}>{address.fullName || order.customer?.name || order.guestName}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{address.line1}</p>
          {address.line2 && <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{address.line2}</p>}
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{address.city}, {address.state} {address.pinCode}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{address.country}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>Phone: {address.phone || order.customer?.phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#888", marginBottom: "8px" }}>Payment Method:</h3>
          <p style={{ margin: 0, fontWeight: 600 }}>{order.paymentMethod?.replace(/_/g, " ")}</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>Status: {order.paymentStatus}</p>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px" }}>
        <thead>
          <tr style={{ background: "#fcfcfc", borderTop: "1px solid #b58a35", borderBottom: "1px solid #b58a35" }}>
            <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", color: "#b58a35", fontWeight: 800 }}>Item Description</th>
            <th style={{ padding: "12px", textAlign: "center", fontSize: "12px", textTransform: "uppercase", color: "#b58a35", fontWeight: 800 }}>Qty</th>
            <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", color: "#b58a35", fontWeight: 800 }}>Unit Price</th>
            <th style={{ padding: "12px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", color: "#b58a35", fontWeight: 800 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map(item => (
            <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "12px", fontSize: "13px" }}>
                <strong>{item.productNameSnapshot}</strong>
                <div style={{ color: "#666", fontSize: "11px", marginTop: "4px" }}>
                  {[item.selectedSize || item.size, item.selectedColor || item.color].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td style={{ padding: "12px", textAlign: "center", fontSize: "13px" }}>{item.quantity}</td>
              <td style={{ padding: "12px", textAlign: "right", fontSize: "13px" }}>{money(item.unitPriceSnapshot)}</td>
              <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: 600 }}>{money(Number(item.unitPriceSnapshot) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "300px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
            <span style={{ color: "#666" }}>Subtotal:</span>
            <span>{money(order.subtotal)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
              <span style={{ color: "#666" }}>Discount:</span>
              <span>-{money(order.discount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
            <span style={{ color: "#666" }}>Shipping:</span>
            <span>{Number(order.shippingCharge) === 0 ? "Free" : money(order.shippingCharge)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
            <span style={{ color: "#666" }}>Taxes:</span>
            <span>{money(order.tax || 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: "16px", fontWeight: 800, borderTop: "2px solid #eee", marginTop: "8px" }}>
            <span>Grand Total:</span>
            <span>{money(order.grandTotal)}</span>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: "60px", textAlign: "center", color: "#888", fontSize: "11px", borderTop: "1px solid #eee", paddingTop: "20px" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#050505" }}>Thank you for shopping with SHADOW SHOP!</p>
        <p style={{ margin: "4px 0 0" }}>This is a computer generated invoice and requires no physical signature.</p>
      </div>
    </div>,
    document.body
  );
}
