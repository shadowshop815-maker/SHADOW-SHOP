import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Calendar, Package, Settings, CheckCircle2, Sparkles, Save, Loader2, Truck, Clock, Globe, Info, Check } from "lucide-react";
import { api, money } from "../../api";
import { PageHead, Loading } from "../../components/ui";

function ShippingSettingsTab() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["delivery-settings"], queryFn: () => api<any>("/admin/delivery/settings") });
  const [form, setForm] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const saveMutation = useMutation({
    mutationFn: (body: any) => api("/admin/delivery/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (res: any) => { 
      client.invalidateQueries({ queryKey: ["delivery-settings"] }); 
      client.invalidateQueries({ queryKey: ["delivery-options"] });
      setForm(res.data || res); 
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => alert(err.message || "Failed to save settings.")
  });

  if (isLoading) return <Loading />;
  const s = form || data;
  if (!s) return null;

  const currentBaseFee = Number(s.baseShippingFee ?? 0);
  const currentThreshold = Number(s.freeShippingThreshold ?? 500);
  const isFreeEnabled = Boolean(s.freeShippingEnabled);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* BASE SHIPPING FEE CARD */}
      <div className="card" style={{ padding: "28px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "color-mix(in srgb, var(--gold) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
              <Package size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>Standard Base Shipping Fee</h2>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>Applied to all standard orders before free shipping waiver</span>
            </div>
          </div>
          <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", background: "var(--panel3)", color: "var(--ink-secondary)", border: "1px solid var(--line)" }}>
            CURRENT: {money(currentBaseFee)}
          </span>
        </div>

        <p style={{ color: "var(--muted)", fontSize: "13.5px", lineHeight: "1.5", margin: "0 0 20px" }}>
          This fee serves as the store baseline shipping charge. Fast delivery speed surcharges (e.g. 3-day or 1-day express) are added on top of this.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "flex-start" }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Base Shipping Fee (₹)</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: "14px", color: "var(--muted)", fontWeight: 600, fontSize: "14px", pointerEvents: "none" }}>₹</span>
              <input 
                type="number" 
                min="0" 
                value={s.baseShippingFee ?? 0} 
                onChange={e => setForm({ ...s, baseShippingFee: e.target.value })} 
                style={{ paddingLeft: "32px", fontSize: "15px", fontWeight: 600 }}
                placeholder="50"
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Quick Presets:</span>
              {[0, 40, 50, 70, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm({ ...s, baseShippingFee: val })}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: currentBaseFee === val ? "var(--gold)" : "var(--panel2)",
                    color: currentBaseFee === val ? "#fff" : "var(--ink)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {val === 0 ? "Free (₹0)" : `₹${val}`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px 20px", background: "var(--panel3)", borderRadius: "10px", border: "1px solid var(--line)", fontSize: "13px" }}>
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Info size={15} style={{ color: "var(--gold)" }} />
              <span>How it works:</span>
            </div>
            <span style={{ color: "var(--muted)", lineHeight: "1.5", display: "block" }}>
              If set to <strong>₹50</strong>, a customer ordering under the threshold will pay ₹50 for 7-day standard delivery. If set to <strong>₹0</strong>, standard delivery will always be free.
            </span>
          </div>
        </div>
      </div>

      {/* FREE SHIPPING RULE CARD */}
      <div className="card" style={{ padding: "28px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: isFreeEnabled ? "rgba(47, 158, 68, 0.12)" : "var(--panel3)", display: "flex", alignItems: "center", justifyContent: "center", color: isFreeEnabled ? "var(--green)" : "var(--muted)" }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>Free Shipping Rule</h2>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>Automatically waive the base fee when customer orders meet the threshold</span>
            </div>
          </div>
          <span style={{
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 700,
            background: isFreeEnabled ? "rgba(47, 158, 68, 0.12)" : "rgba(224, 49, 49, 0.1)",
            color: isFreeEnabled ? "var(--green)" : "var(--red)",
            border: `1px solid ${isFreeEnabled ? "rgba(47, 158, 68, 0.25)" : "rgba(224, 49, 49, 0.25)"}`
          }}>
            {isFreeEnabled ? "RULE ACTIVE" : "RULE DISABLED"}
          </span>
        </div>

        <p style={{ color: "var(--muted)", fontSize: "13.5px", lineHeight: "1.5", margin: "0 0 20px" }}>
          When enabled, orders reaching the minimum threshold receive a complete waiver on the base shipping fee. Any speed upgrade surcharge (e.g. 1-day or 3-day express) remains applicable.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Enable Free Shipping</label>
            <select 
              value={s.freeShippingEnabled ? "true" : "false"} 
              onChange={e => setForm({ ...s, freeShippingEnabled: e.target.value === "true" })}
              style={{ fontWeight: 600 }}
            >
              <option value="true">✓ Enabled (Threshold active)</option>
              <option value="false">✕ Disabled (Charge base fee on all)</option>
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Minimum Order Value (₹)</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: "14px", color: "var(--muted)", fontWeight: 600, fontSize: "14px", pointerEvents: "none" }}>₹</span>
              <input 
                type="number" 
                min="0" 
                value={s.freeShippingThreshold ?? 500} 
                onChange={e => setForm({ ...s, freeShippingThreshold: e.target.value })} 
                style={{ paddingLeft: "32px", fontSize: "15px", fontWeight: 600 }}
                placeholder="500"
              />
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Presets:</span>
              {[499, 500, 999, 1499].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm({ ...s, freeShippingThreshold: val })}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: currentThreshold === val ? "var(--gold)" : "var(--panel2)",
                    color: currentThreshold === val ? "#fff" : "var(--ink)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  ₹{val}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Calculation Basis</label>
            <select 
              value={s.freeShippingBasis ?? "AFTER_DISCOUNT"} 
              onChange={e => setForm({ ...s, freeShippingBasis: e.target.value })}
              style={{ fontWeight: 500 }}
            >
              <option value="AFTER_DISCOUNT">After offer discount (Standard)</option>
              <option value="BEFORE_DISCOUNT">Before offer discount</option>
            </select>
            <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", display: "block" }}>
              Evaluates cart subtotal {s.freeShippingBasis === "BEFORE_DISCOUNT" ? "prior to" : "after subtracting"} promotional coupon discounts.
            </span>
          </div>
        </div>

        {/* LIVE REAL-TIME RULE SIMULATION */}
        <div style={{
          marginTop: "20px",
          padding: "18px 22px",
          borderRadius: "10px",
          background: isFreeEnabled ? "rgba(47, 158, 68, 0.05)" : "var(--panel3)",
          border: `1px solid ${isFreeEnabled ? "rgba(47, 158, 68, 0.22)" : "var(--line)"}`,
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13.5px", color: isFreeEnabled ? "var(--green)" : "var(--muted)" }}>
              <CheckCircle2 size={16} />
              <span>
                {isFreeEnabled
                  ? `Active Rule: Orders ≥ ₹${currentThreshold} (${s.freeShippingBasis === "BEFORE_DISCOUNT" ? "before" : "after"} discount) get standard shipping FREE`
                  : "Rule is disabled: Base shipping fee is charged on all order values"
                }
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Live Real-Time Preview</span>
          </div>

          {isFreeEnabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", paddingTop: "10px", borderTop: "1px dashed rgba(47, 158, 68, 0.2)", fontSize: "12.5px" }}>
              <div style={{ padding: "12px 16px", background: "var(--panel)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span style={{ color: "var(--muted)", display: "block", marginBottom: "4px" }}>Cart Under Threshold (e.g. ₹349):</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>Standard Delivery:</span>
                  <strong style={{ color: currentBaseFee > 0 ? "var(--ink)" : "var(--green)", fontSize: "14px" }}>
                    {currentBaseFee > 0 ? money(currentBaseFee) : "FREE"}
                  </strong>
                </div>
              </div>

              <div style={{ padding: "12px 16px", background: "var(--panel)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <span style={{ color: "var(--muted)", display: "block", marginBottom: "4px" }}>Cart At/Over Threshold (e.g. ₹600):</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>Standard Delivery:</span>
                  <strong style={{ color: "var(--green)", fontSize: "14px" }}>
                    FREE (Saved {money(currentBaseFee)})
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OPERATIONS CARD */}
      <div className="card" style={{ padding: "28px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--panel3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
            <Clock size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>Fulfillment & Operations</h2>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>Cut-off schedules and delivery selection policies</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
          <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
            <div
              onClick={() => setForm({ ...s, enableSelection: !s.enableSelection })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderRadius: "10px",
                border: `2px solid ${s.enableSelection ? "var(--green, #2f9e44)" : "var(--line)"}`,
                background: s.enableSelection ? "rgba(47,158,68,0.06)" : "var(--panel2)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Truck size={20} style={{ color: s.enableSelection ? "var(--green, #2f9e44)" : "var(--muted)" }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>
                    Customer Delivery Speed Selection
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                    {s.enableSelection
                      ? "ON — Customers can choose their delivery speed (7-day, 3-day, express)"
                      : "OFF — Only flat-rate base shipping is charged, no speed selection shown"}
                  </div>
                </div>
              </div>
              <div style={{
                width: "48px", height: "26px", borderRadius: "13px",
                background: s.enableSelection ? "var(--green, #2f9e44)" : "var(--line)",
                position: "relative", transition: "background 0.2s ease", flexShrink: 0
              }}>
                <div style={{
                  position: "absolute", top: "3px",
                  left: s.enableSelection ? "25px" : "3px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
                }} />
              </div>
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Daily Order Cut-off Time</label>
            <input 
              type="time" 
              value={s.orderCutoffTime ?? "14:00"} 
              onChange={e => setForm({ ...s, orderCutoffTime: e.target.value })} 
              style={{ fontWeight: 600 }}
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px", display: "block" }}>Operating Timezone</label>
            <input 
              type="text" 
              value={s.timezone ?? "Asia/Kolkata"} 
              onChange={e => setForm({ ...s, timezone: e.target.value })} 
              style={{ fontWeight: 500 }}
            />
          </div>
        </div>
      </div>

      {/* LUXURY FLOATING / STICKY ACTION BAR */}
      <div style={{
        marginTop: "16px",
        padding: "18px 28px",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "var(--muted)" }}>
          <Sparkles size={16} style={{ color: "var(--gold)", flexShrink: 0 }} />
          <span>All shipping rules update dynamically in real-time across customer cart and checkout pages.</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {successMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 18px",
              background: "rgba(47, 158, 68, 0.1)",
              border: "1px solid rgba(47, 158, 68, 0.35)",
              color: "var(--green)",
              borderRadius: "100px",
              fontSize: "13.5px",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(47, 158, 68, 0.15)",
              animation: "fadeIn 0.25s ease"
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <button 
            type="button"
            className="primary" 
            disabled={saveMutation.isPending} 
            onClick={() => saveMutation.mutate({
              baseShippingFee: Number(s.baseShippingFee ?? 0),
              freeShippingEnabled: Boolean(s.freeShippingEnabled),
              freeShippingThreshold: Number(s.freeShippingThreshold ?? 500),
              freeShippingBasis: s.freeShippingBasis,
              enableSelection: Boolean(s.enableSelection),
              orderCutoffTime: s.orderCutoffTime,
              timezone: s.timezone
            })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "13px 28px",
              fontSize: "14px",
              fontWeight: 700,
              minWidth: "220px",
              justifyContent: "center",
              borderRadius: "10px",
              boxShadow: "0 4px 14px rgba(186, 150, 83, 0.3)"
            }}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Shipping Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

function DeliveryOptionsTab() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["delivery-options"], queryFn: () => api<any[]>("/admin/delivery/options") });
  const { data: shippingSettings } = useQuery({ queryKey: ["delivery-settings"], queryFn: () => api<any>("/admin/delivery/settings") });
  const [editing, setEditing] = useState<any | null>(null);

  const saveMutation = useMutation({
    mutationFn: (body: any) => editing?.id
      ? api(`/admin/delivery/options/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api("/admin/delivery/options", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { 
      client.invalidateQueries({ queryKey: ["delivery-options"] }); 
      setEditing(null); 
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/delivery/options/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["delivery-options"] })
  });

  if (isLoading) return <Loading />;

  const baseFee = Number(shippingSettings?.baseShippingFee ?? 0);
  const freeEnabled = Boolean(shippingSettings?.freeShippingEnabled);
  const threshold = Number(shippingSettings?.freeShippingThreshold ?? 500);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* FORMULA HIGHLIGHT */}
      <div style={{ 
        padding: "18px 22px", 
        background: "color-mix(in srgb, var(--gold) 8%, var(--panel))", 
        border: "1px solid color-mix(in srgb, var(--gold) 25%, transparent)", 
        borderRadius: "12px", 
        fontSize: "13.5px" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
          <Truck size={17} style={{ color: "var(--gold)" }} />
          <span>Active Pricing Formula:</span>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 600, color: "var(--gold)", margin: "4px 0" }}>
          Base Fee ({money(baseFee)}) {freeEnabled ? `− Free Waiver (Orders ≥ ${money(threshold)})` : ""} + Speed Surcharge = Final Shipping
        </div>
        <span style={{ color: "var(--muted)", fontSize: "12.5px", display: "inline-block", marginTop: "4px" }}>
          The Speed Surcharge is the only additional surcharge added for faster delivery options. It is added on top of any active base shipping fee.
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Configured Delivery Speeds</h3>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Options available for selection during checkout</span>
        </div>
        <button 
          type="button" 
          className="primary" 
          onClick={() => setEditing({})}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", fontWeight: 600 }}
        >
          <Plus size={16} /> Add Delivery Option
        </button>
      </div>

      {editing && (
        <form className="card" onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const body: any = Object.fromEntries(fd.entries());
          saveMutation.mutate({ 
            ...body, 
            speedSurcharge: Number(body.speedSurcharge ?? 0),
            isDefault: body.isDefault === "true"
          });
        }} style={{ padding: "28px", borderRadius: "14px", border: "1.5px solid var(--line-gold)", animation: "fadeIn 0.25s ease" }}>
          <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>{editing.id ? "Edit Delivery Option" : "Create New Delivery Option"}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div className="field">
              <label>Customer Label</label>
              <input name="name" defaultValue={editing.name} required placeholder="e.g. 3-Day Delivery" />
            </div>
            <div className="field">
              <label>Internal Name</label>
              <input name="internalName" defaultValue={editing.internalName} required placeholder="e.g. FAST_3_DAY" />
            </div>
            <div className="field">
              <label>Description</label>
              <input name="description" defaultValue={editing.description} placeholder="Customer-facing description" />
            </div>
            <div className="field">
              <label>Delivery Type</label>
              <select name="deliveryType" defaultValue={editing.deliveryType || "Standard"}>
                <option value="Standard">Standard</option>
                <option value="Express">Express</option>
                <option value="Same Day">Same Day</option>
              </select>
            </div>
            <div className="field">
              <label>Delivery Days</label>
              <input type="number" name="deliveryDays" defaultValue={editing.deliveryDays ?? 7} required min="1" />
            </div>
            <div className="field">
              <label>Day Calculation</label>
              <select name="dayCalculationType" defaultValue={editing.dayCalculationType || "BUSINESS_DAYS"}>
                <option value="BUSINESS_DAYS">Business Days</option>
                <option value="CALENDAR_DAYS">Calendar Days</option>
              </select>
            </div>
            <div className="field">
              <label>⚡ Speed Surcharge (₹)</label>
              <input type="number" name="speedSurcharge" defaultValue={Number(editing.speedSurcharge || editing.price || 0)} min="0" />
              <span className="helper-text">Additional speed surcharge charged on top of the base shipping fee</span>
            </div>
            <div className="field">
              <label>Status</label>
              <select name="status" defaultValue={editing.status || "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="field">
              <label>Max Distance (km, optional)</label>
              <input type="number" name="maxDistanceKm" defaultValue={editing.maxDistanceKm ?? ""} placeholder="Leave blank for all zones" />
            </div>
            <div className="field">
              <label>Set as Default</label>
              <select name="isDefault" defaultValue={String(editing.isDefault || false)}>
                <option value="false">No (Optional speed upgrade)</option>
                <option value="true">Yes (Standard store default)</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: "16px", paddingTop: "20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Option"}
            </button>
          </div>
        </form>
      )}

      {/* OPTIONS TABLE */}
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Delivery Option</th>
                <th>Type</th>
                <th>Delivery Window</th>
                <th>Speed Surcharge</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No delivery options configured.</td></tr>
              )}
              {data?.map(opt => (
                <tr key={opt.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{opt.name}</strong>
                      {opt.isDefault && (
                        <span style={{ 
                          fontSize: "10px", 
                          padding: "2px 8px", 
                          background: "var(--gold)", 
                          color: "#000", 
                          borderRadius: "4px", 
                          fontWeight: 800,
                          letterSpacing: "0.5px"
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {opt.description && <span style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginTop: "2px" }}>{opt.description}</span>}
                  </td>
                  <td>
                    <span style={{ padding: "4px 10px", background: "var(--panel3)", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                      {opt.deliveryType}
                    </span>
                  </td>
                  <td style={{ fontSize: "13px", fontWeight: 500 }}>
                    {opt.deliveryDays} {opt.deliveryDays === 1 ? "day" : "days"} ({opt.dayCalculationType === "CALENDAR_DAYS" ? "Calendar" : "Business"})
                  </td>
                  <td>
                    {Number(opt.speedSurcharge || opt.price || 0) === 0
                      ? <span style={{ color: "var(--green)", fontWeight: 600, fontSize: "13px" }}>₹0 (standard)</span>
                      : <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: "13.5px" }}>+₹{Number(opt.speedSurcharge || opt.price || 0)}</span>
                    }
                  </td>
                  <td>
                    <span style={{ 
                      padding: "4px 10px", 
                      borderRadius: "100px", 
                      fontSize: "11px", 
                      fontWeight: 700, 
                      letterSpacing: "0.5px",
                      background: opt.status === "ACTIVE" ? "rgba(46, 204, 113, 0.12)" : "rgba(231, 76, 60, 0.12)", 
                      color: opt.status === "ACTIVE" ? "var(--green)" : "var(--red)" 
                    }}>
                      {opt.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" onClick={() => setEditing(opt)} className="ghost" style={{ padding: "8px", marginRight: "4px" }} title="Edit"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => { if (confirm("Delete this option?")) deleteMutation.mutate(opt.id) }} className="ghost" style={{ padding: "8px", color: "var(--red)" }} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HolidaysTab() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["delivery-holidays"], queryFn: () => api<any[]>("/admin/delivery/holidays") });

  const saveMutation = useMutation({
    mutationFn: (body: any) => api("/admin/delivery/holidays", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["delivery-holidays"] }); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/delivery/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["delivery-holidays"] })
  });

  if (isLoading) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Operating Holidays</h3>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Dates when business day delivery estimates pause</span>
        </div>
      </div>

      <form className="card" onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        saveMutation.mutate(Object.fromEntries(fd.entries()));
        e.currentTarget.reset();
      }} style={{ padding: "24px", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Add Store Holiday</h2>
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" name="date" required />
          </div>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label>Holiday Name</label>
            <input type="text" name="name" placeholder="e.g. Diwali" required />
          </div>
          <button type="submit" className="primary" disabled={saveMutation.isPending} style={{ height: "44px", padding: "0 24px" }}>
            {saveMutation.isPending ? "Adding..." : "Add Holiday"}
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: "14px", border: "1px solid var(--line)" }}>
        <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.length === 0 && (<tr><td colSpan={3} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No holidays configured.</td></tr>)}
              {data?.map(hol => (
                <tr key={hol.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 500 }}>
                      <Calendar size={16} color="var(--gold)" />
                      {new Date(hol.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  </td>
                  <td><strong>{hol.name}</strong></td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" onClick={() => { if (confirm("Delete this holiday?")) deleteMutation.mutate(hol.id) }} className="ghost" style={{ padding: "8px", color: "var(--red)" }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DeliveryConfig() {
  const [tab, setTab] = useState<"settings" | "options" | "holidays">("settings");

  return (
    <div style={{ marginTop: 24 }}>
      <div className="tabs" style={{ marginBottom: "24px" }}>
        {(["settings", "options", "holidays"] as const).map(v => (
          <button 
            className={tab === v ? "active" : ""} 
            onClick={() => setTab(v)} 
            key={v} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: tab === v ? 700 : 500
            }}
          >
            {v === "settings" && <Settings size={15} />}
            {v === "options" && <Package size={15} />}
            {v === "holidays" && <Calendar size={15} />}
            {v === "settings" ? "Shipping Settings" : v === "options" ? "Delivery Options" : "Holidays"}
          </button>
        ))}
      </div>

      {tab === "settings" && <ShippingSettingsTab />}
      {tab === "options" && <DeliveryOptionsTab />}
      {tab === "holidays" && <HolidaysTab />}
    </div>
  );
}
