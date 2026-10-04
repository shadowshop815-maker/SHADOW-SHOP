import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Printer, Phone } from "lucide-react";
import { api, money } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Toolbar, Loading, ErrorState, Empty, StatusBadge, Pager, Modal, Pagination } from "../../components/ui";
import { DeliveryMap } from "./DeliveryMap";
import { Invoice } from "../../components/ui/Invoice";

export type Order = { id: string; orderNumber: string; createdAt: string; orderStatus: string; paymentStatus: string; paymentMethod: string; subtotal: string; discount: string; shippingCharge: string; tax?: string | number; grandTotal: string; trackingNumber: string | null; courierName: string | null; adminNote: string | null; shippingAddressSnapshot?: string; deliverySnapshot?: string; customer?: { id: string; name: string; email: string; phone: string } | null; guestName?: string; guestEmail?: string; items: Array<{ id: string; productNameSnapshot: string; quantity: number; unitPriceSnapshot: string; selectedSize?: string; selectedColor?: string; size?: string; color?: string; productImageSnapshot?: string }>; cancellation?: { id: string; reason: string; status: string } | null; returns?: unknown[]; refunds?: unknown[]; offerRedemptions?: any[] };

const orderTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["RETURN_REQUESTED", "REFUNDED"],
  CANCEL_REQUESTED: ["CANCELLED", "CONFIRMED", "PROCESSING"],
  RETURN_REQUESTED: ["REFUNDED", "DELIVERED"]
};

export function Orders() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", page, search, status],
    queryFn: () => api<{ items: Order[]; pagination: Pagination }>(`/admin/orders?page=${page}&search=${encodeURIComponent(search)}&status=${status}`),
    refetchInterval: 30_000
  });
  
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["orders"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setSelected(null);
    }
  });
  
  const tracking = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api(`/admin/orders/${id}/tracking`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["orders"] });
      setSelected(null);
    }
  });
  
  const payment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api(`/admin/orders/${id}/payment`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["orders"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setSelected(null);
    }
  });

  const change = async (order: Order, next: string) => {
    if (next === "CANCELLED" && !await confirm(`Cancel ${order.orderNumber}? Reserved stock will be restored exactly once.`, "Cancel order")) return;
    update.mutate({ id: order.id, body: { status: next } });
  };
  
  return (
    <>
      <PageHead eyebrow="SALES" title="Orders" description="Live order queue and controlled fulfillment transitions." />
      <Toolbar search={search} onSearch={v => { setSearch(v); setPage(1); }}>
        <select 
          value={status} 
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCEL_REQUESTED", "CANCELLED", "RETURN_REQUESTED", "REFUNDED"].map(s => <option key={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </Toolbar>
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.items.length ? <Empty /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Next action</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(o => (
                    <tr key={o.id}>
                      <td>
                        <b>{o.orderNumber}</b>
                        <small>{new Date(o.createdAt).toLocaleString()}</small>
                      </td>
                      <td>
                        {o.customer?.name || o.guestName || "Guest"}
                        <small>{o.customer?.email || o.guestEmail}</small>
                      </td>
                      <td>{money(Number(o.grandTotal))}</td>
                      <td>
                        <select
                          value={o.paymentStatus}
                          disabled={payment.isPending}
                          onChange={e => {
                            if (window.confirm(`Change payment status to ${e.target.value}?`)) {
                              payment.mutate({ id: o.id, body: { paymentStatus: e.target.value } });
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "var(--panel)",
                            color: "var(--ink)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "auto",
                            minHeight: "0"
                          }}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PAID">PAID</option>
                          <option value="FAILED">FAILED</option>
                          <option value="REFUNDED">REFUNDED</option>
                        </select>
                      </td>
                      <td><StatusBadge value={o.orderStatus} /></td>
                      <td>
                        <select 
                          aria-label="Update status" 
                          value="" 
                          disabled={!orderTransitions[o.orderStatus]?.length || update.isPending} 
                          onChange={e => void change(o, e.target.value)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            background: "var(--panel)",
                            color: "var(--ink)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "auto",
                            minHeight: "0"
                          }}
                        >
                          <option value="">Choose…</option>
                          {orderTransitions[o.orderStatus]?.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <button 
                          className="secondary"
                          onClick={() => setSelected(o)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager value={data.pagination} onChange={setPage} />
          </>
        )}
      </section>
      
      {selected && (
        <Modal title={`ORDER #${selected.orderNumber}`} onClose={() => setSelected(null)}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <button className="button" onClick={() => window.print()} style={{ padding: "10px 16px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Printer size={16} /> Download Invoice
            </button>
          </div>
          <div className="order-inspector" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            <Invoice order={selected} />
            
            {(() => {
              const delivery = typeof selected.deliverySnapshot === "string" ? JSON.parse(selected.deliverySnapshot || "{}") : (selected.deliverySnapshot || {});
              let expectedDate: Date | null = null;
              if (delivery?.deliveryDays) {
                const d = new Date(selected.createdAt);
                d.setDate(d.getDate() + delivery.deliveryDays);
                expectedDate = d;
              }
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", padding: "0 4px" }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Booking Date</span>
                    <b style={{ fontSize: "14px", color: "var(--ink)" }}>{new Date(selected.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                  {delivery?.name && (
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Delivery Method</span>
                      <b style={{ fontSize: "14px", color: "var(--ink)" }}>{delivery.name}</b>
                    </div>
                  )}
                  {expectedDate && (
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Expected Delivery</span>
                      <b style={{ fontSize: "14px", color: "var(--gold)" }}>{expectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Top Order Status & Summary Card */}
            <div className="card" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "24px"
            }}>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Status</span>
                <StatusBadge value={selected.orderStatus} />
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Payment</span>
                <StatusBadge value={selected.paymentStatus} />
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>{selected.paymentMethod}</div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Subtotal</span>
                <b style={{ fontSize: "15px", color: "var(--ink)" }}>{money(Number(selected.subtotal))}</b>
              </div>
              {selected.offerRedemptions && selected.offerRedemptions.length > 0 && (
                <>
                  {selected.offerRedemptions.map((offer: any, idx: number) => (
                    <div key={idx}>
                      <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Offer: {offer.offerCode}</span>
                      <b style={{ fontSize: "15px", color: "var(--green)" }}>-{money(offer.actualDiscountAmount)}</b>
                    </div>
                  ))}
                </>
              )}
              {Math.max(0, Number(selected.discount) - ((selected.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0)) > 0 && (
                <div>
                  <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Discount</span>
                  <b style={{ fontSize: "15px", color: "var(--green)" }}>-{money(Math.max(0, Number(selected.discount) - ((selected.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0)))}</b>
                </div>
              )}
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Shipping</span>
                <b style={{ fontSize: "15px", color: "var(--ink)" }}>{Number(selected.shippingCharge) === 0 ? "Free" : money(Number(selected.shippingCharge))}</b>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Tax</span>
                <b style={{ fontSize: "15px", color: "var(--ink)" }}>{money(Number(selected.tax || 0))}</b>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, display: "block", marginBottom: "6px" }}>Grand Total</span>
                <b style={{ fontSize: "18px", color: "var(--gold)", fontWeight: 800 }}>{money(Number(selected.grandTotal))}</b>
              </div>
            </div>

            {/* Shipping & Delivery Address with Live GPS Tracking */}
            {selected.shippingAddressSnapshot && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", letterSpacing: "1px", color: "var(--gold)", textTransform: "uppercase", fontWeight: 800 }}>
                    Shipping Destination
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Verified Dispatch Address</span>
                </div>

                {(() => {
                  try {
                    const addr = typeof selected.shippingAddressSnapshot === 'string' 
                      ? JSON.parse(selected.shippingAddressSnapshot) 
                      : selected.shippingAddressSnapshot;
                    return (
                      <div style={{ padding: "16px", background: "var(--layer)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
                            {addr.fullName}
                          </div>
                          <div style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.5 }}>
                            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}<br />
                            {addr.town ? `${addr.town}, ` : ""}{addr.city}, {addr.state} {addr.pinCode}<br />
                            {addr.country}
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "10px" }}>
                          <a 
                            href={`tel:${addr.phone}`} 
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              background: "var(--gold)",
                              color: "black",
                              textDecoration: "none",
                              borderRadius: "8px",
                              padding: "12px",
                              fontSize: "14px",
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                              transition: "all 0.2s"
                            }}
                          >
                            <Phone size={18} />
                            Call ({addr.phone})
                          </a>
                          
                          <a 
                            href={addr.latitude && addr.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addr.line1} ${addr.town || ''} ${addr.city} ${addr.pinCode}`)}`} 
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              background: "var(--layer)",
                              border: "1px solid var(--border)",
                              color: "var(--ink)",
                              textDecoration: "none",
                              borderRadius: "8px",
                              padding: "12px",
                              fontSize: "14px",
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                              transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--ink)"; }}
                          >
                            <MapPin size={18} />
                            Route Map
                          </a>
                        </div>
                      </div>
                    );
                  } catch(e) {
                    return <div style={{ color: "var(--muted)" }}>{String(selected.shippingAddressSnapshot)}</div>;
                  }
                })()}
              </div>
            )}

            {/* Order Items */}
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: "14px", letterSpacing: "1px", color: "var(--gold)", textTransform: "uppercase", fontWeight: 800 }}>
                Order Items ({selected.items.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {selected.items.map(i => (
                  <div className="line-item" key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--panel2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {i.productImageSnapshot && <img src={i.productImageSnapshot} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: "8px" }} />}
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "13px" }}>{i.productNameSnapshot}</div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          {[i.selectedSize || i.size, i.selectedColor || i.color].filter(Boolean).join(" · ")} · Qty {i.quantity}
                        </div>
                      </div>
                    </div>
                    <b style={{ color: "var(--gold)", fontSize: "14px" }}>{money(Number(i.unitPriceSnapshot) * i.quantity)}</b>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: "14px", letterSpacing: "1px", color: "var(--gold)", textTransform: "uppercase", fontWeight: 800 }}>
                Order Summary
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Subtotal</span>
                  <b style={{ color: "var(--ink)" }}>{money(selected.subtotal)}</b>
                </div>
                
                {(selected as any).offerRedemptions?.length > 0 && (
                  <>
                    {(selected as any).offerRedemptions.map((offer: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
                        <span>Offer: {offer.offerCode}</span>
                        <b style={{ fontWeight: 700 }}>-{money(offer.actualDiscountAmount)}</b>
                      </div>
                    ))}
                  </>
                )}

                {Math.max(0, Number(selected.discount) - ((selected.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0)) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
                    <span>Discount</span>
                    <b style={{ fontWeight: 700 }}>-{money(Math.max(0, Number(selected.discount) - ((selected.offerRedemptions as any[])?.reduce((s, o) => s + Number(o.actualDiscountAmount||0), 0) || 0)))}</b>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Shipping Charge</span>
                  <b style={{ color: "var(--ink)" }}>{Number(selected.shippingCharge) === 0 ? "Free" : money(selected.shippingCharge)}</b>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "4px", fontSize: "15px" }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)" }}>Grand Total</span>
                  <b style={{ color: "var(--gold)", fontWeight: 800 }}>{money(selected.grandTotal)}</b>
                </div>
              </div>
            </div>
            
            {/* Logistics, Tracking & Internal Private Notes */}
            <div className="card">
              <h3 style={{ margin: "0 0 14px", fontSize: "14px", letterSpacing: "1px", color: "var(--gold)", textTransform: "uppercase", fontWeight: 800 }}>
                Logistics & Dispatch Notes
              </h3>
              
              {(selected.trackingNumber || selected.adminNote) && (
                <div style={{ marginBottom: "16px", display: "grid", gap: "10px" }}>
                  {selected.trackingNumber && (
                    <div style={{ padding: "12px 14px", background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)" }}>Tracking Number</span>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{selected.trackingNumber}</div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>Courier: {selected.courierName || "Standard Dispatch"}</div>
                      </div>
                      <a href={`https://www.google.com/search?q=${selected.trackingNumber}+tracking`} target="_blank" rel="noreferrer" className="secondary" style={{ fontSize: "11px", padding: "6px 12px" }}>Track Package ↗</a>
                    </div>
                  )}
                  {selected.adminNote && (
                    <div style={{ padding: "12px 14px", background: "var(--panel)", borderLeft: "3px solid var(--amber)", borderRadius: "0 8px 8px 0" }}>
                      <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--amber)", fontWeight: 700, display: "block", marginBottom: "2px" }}>Internal Staff Note</span>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)" }}>{selected.adminNote}</p>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={e => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                tracking.mutate({ id: selected.id, body: { trackingNumber: form.get("trackingNumber"), courierName: form.get("courierName"), adminNote: form.get("adminNote") } });
              }} style={{ marginTop: "20px" }}>
                <div className="form-grid" style={{ marginBottom: "16px" }}>
                  <label>
                    <span>Update Tracking #</span>
                    <input type="text" name="trackingNumber" defaultValue={selected.trackingNumber || ""} placeholder="e.g. AW123456789" />
                  </label>
                  <label>
                    <span>Update Courier</span>
                    <input type="text" name="courierName" defaultValue={selected.courierName || ""} placeholder="e.g. FedEx, BlueDart, Rapido" />
                  </label>
                  <label className="wide">
                    <span>Update Internal Note</span>
                    <textarea name="adminNote" defaultValue={selected.adminNote || ""} placeholder="Add a private operational note..." rows={3} />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="primary" disabled={tracking.isPending}>{tracking.isPending ? "Saving..." : "Save details"}</button>
                </div>
              </form>
            </div>

          </div>
        </Modal>
      )}
    </>
  );
}
