import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { MapPin, Tag, Clock, ShoppingCart, Percent, AlertCircle } from "lucide-react";
import { api } from "../../api";
import { Modal } from "../../components/ui";

export function OfferForm({ offer, onClose }: { offer: any; onClose: () => void }) {
  const qc = useQueryClient();
  const isEditing = !!offer.id;
  
  const [formData, setFormData] = useState({
    name: offer.name || "",
    description: offer.description || "",
    code: offer.code || "",
    type: offer.type || "AUTOMATIC",
    discountType: offer.discountType || "FIXED",
    discountValue: offer.discountValue || "",
    minOrderAmount: offer.minOrderAmount || "",
    maxDiscountAmount: offer.maxDiscountAmount || "",
    usageLimit: offer.usageLimit || "",
    perCustomerLimit: offer.perCustomerLimit || "",
    startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString().slice(0, 10) : "",
    endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString().slice(0, 10) : "",
    locationRestricted: offer.locationRules?.length > 0,
    radiusKm: offer.locationRules?.[0]?.radiusKm || 10,
    storeId: offer.locationRules?.[0]?.storeId || "",
    productRules: offer.productRules?.map((pr: any) => pr.productId) || [] as string[],
    categoryRules: offer.categoryRules?.map((cr: any) => cr.categoryId) || [] as string[],
  });

  const [isSuccess, setIsSuccess] = useState(false);
  
  const { data: productsData } = useQuery({
    queryKey: ["admin-products", "ACTIVE"],
    queryFn: () => api<{ items: any[] }>(`/admin/products?status=ACTIVE&page=1&limit=1000`)
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api<any[]>(`/admin/categories?page=1&limit=1000`)
  });
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        discountValue: Number(data.discountValue) || 0,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : null,
        maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
        usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
        perCustomerLimit: data.perCustomerLimit ? Number(data.perCustomerLimit) : null,
        startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
        endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
        locationRules: data.locationRestricted ? [{ radiusKm: Number(data.radiusKm) }] : [],
        productRules: data.productRules.map((pid: string) => ({ productId: pid, isExclusion: false })),
        categoryRules: data.categoryRules.map((cid: string) => ({ categoryId: cid, isExclusion: false }))
      };
      
      if (isEditing) {
        return api("/admin/offers/" + offer.id, { method: "PATCH", body: JSON.stringify(payload) });
      }
      return api("/admin/offers", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminOffers"] });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  });

  const { data: storesData, refetch: refetchStores } = useQuery({
    queryKey: ["adminOfferStores"],
    queryFn: () => api<{ stores: any[]; locationSettings: any }>("/admin/offers/stores"),
    enabled: formData.locationRestricted,
  });

  const syncStoreMutation = useMutation({
    mutationFn: () => api("/admin/offers/stores/sync", { method: "POST" }),
    onSuccess: () => {
      refetchStores();
      qc.invalidateQueries({ queryKey: ["adminOfferStores"] });
    }
  });

  const mainStore = storesData?.stores?.[0];
  const storeHasInvalidCoords = mainStore && mainStore.latitude === 0 && mainStore.longitude === 0;


  const SectionHeader = ({ icon: Icon, title, desc }: any) => (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px", marginTop: "32px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
      <div style={{ background: "var(--panel3)", padding: "8px", borderRadius: "8px", color: "var(--gold)" }}>
        <Icon size={20} />
      </div>
      <div>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{desc}</p>
      </div>
    </div>
  );

  return (
    <Modal title={isEditing ? "Edit Promotion" : "Create New Promotion"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} style={{ padding: "0 10px 20px" }}>
        
        {/* BASIC SETTINGS */}
        <div style={{ marginTop: 0 }}>
          <SectionHeader icon={Tag} title="Basic Information" desc="Internal details and customer-facing code." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div className="field">
              <label>Campaign Name <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="text" required placeholder="e.g. Diwali Mega Sale" value={formData.name} onChange={v => setFormData({...formData, name: v.target.value})} />
            </div>
            <div className="field">
              <label>Promo Code <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="text" required placeholder="e.g. DIWALI50" style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: "1px" }} value={formData.code} onChange={v => setFormData({...formData, code: v.target.value.toUpperCase()})} />
            </div>
          </div>
          <div className="field">
            <label>Customer Description</label>
            <input type="text" placeholder="Short description shown to customers" value={formData.description} onChange={v => setFormData({...formData, description: v.target.value})} />
          </div>
        </div>

        {/* DISCOUNT VALUE */}
        <SectionHeader icon={Percent} title="Discount Configuration" desc="Set how much the customer saves." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="field">
            <label>Discount Type</label>
            <select value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED">Fixed Amount (₹)</option>
              <option value="FREE_DELIVERY">Free Delivery</option>
            </select>
          </div>
          {formData.discountType !== "FREE_DELIVERY" && (
            <div className="field">
              <label>Discount Value <span style={{ color: "var(--red)" }}>*</span></label>
              <div style={{ display: "flex", position: "relative" }}>
                <span style={{ position: "absolute", left: "10px", top: "12px", color: "var(--muted)", pointerEvents: "none" }}>{formData.discountType === "FIXED" ? "₹" : "%"}</span>
                <input type="number" required min="0" step="0.01" placeholder="0.00" value={String(formData.discountValue)} onChange={v => setFormData({...formData, discountValue: v.target.value})} style={{ paddingLeft: "32px", width: "100%" }} />
              </div>
            </div>
          )}
        </div>

        {/* CONDITIONS */}
        <SectionHeader icon={ShoppingCart} title="Cart Conditions" desc="Rules the customer must meet to get the offer." />
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div className="field">
              <label>Minimum Order Value (₹)</label>
              <input type="number" min="0" placeholder="e.g. 500" value={String(formData.minOrderAmount)} onChange={v => setFormData({...formData, minOrderAmount: v.target.value})} />
              <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Customer must spend this much to unlock the offer.</small>
            </div>
            {formData.discountType === "PERCENTAGE" && (
              <div className="field">
                <label>Maximum Discount (₹)</label>
                <input type="number" min="0" placeholder="e.g. 200" value={String(formData.maxDiscountAmount)} onChange={v => setFormData({...formData, maxDiscountAmount: v.target.value})} />
                <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Cap the maximum amount they can save.</small>
              </div>
            )}
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="field">
              <label>Specific Categories (Optional)</label>
              <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--panel2)", maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {!Array.isArray(categoriesData) ? <span style={{ color: "var(--muted)", fontSize: "12px" }}>Loading categories...</span> : (
                  categoriesData.map((c: any) => (
                    <label key={c.id} className="check" style={{ fontSize: "13px" }}>
                      <input 
                        type="checkbox" 
                        checked={formData.categoryRules.includes(c.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            categoryRules: checked 
                              ? [...prev.categoryRules, c.id] 
                              : prev.categoryRules.filter(id => id !== c.id)
                          }));
                        }}
                      />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
              <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Apply to all products in these categories.</small>
            </div>

            <div className="field">
              <label>Specific Products (Optional)</label>
              <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--panel2)", maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {!productsData ? <span style={{ color: "var(--muted)", fontSize: "12px" }}>Loading products...</span> : (
                  productsData.items.map((p: any) => (
                    <label key={p.id} className="check" style={{ fontSize: "13px" }}>
                      <input 
                        type="checkbox" 
                        checked={formData.productRules.includes(p.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            productRules: checked 
                              ? [...prev.productRules, p.id] 
                              : prev.productRules.filter(id => id !== p.id)
                          }));
                        }}
                      />
                      {p.name}
                    </label>
                  ))
                )}
              </div>
              <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>Apply only to selected products.</small>
            </div>
          </div>
          <small style={{ color: "var(--muted)", fontSize: "11.5px", marginTop: "8px", display: "block" }}>If both categories and products are left empty, the offer applies to the entire cart.</small>
        </div>

        {/* LOCATION RESTRICTION */}
        <SectionHeader icon={MapPin} title="Geographic Eligibility" desc="Restrict this offer to specific delivery ranges." />
        <div style={{ border: formData.locationRestricted ? "1px solid var(--gold)" : "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: formData.locationRestricted ? "var(--gold-glow)" : "transparent", transition: "all 0.2s" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}>
            <div style={{ position: "relative", display: "inline-block", width: "40px", height: "24px" }}>
              <input type="checkbox" checked={formData.locationRestricted} onChange={e => setFormData({...formData, locationRestricted: e.target.checked})} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
              <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: formData.locationRestricted ? "var(--gold)" : "var(--muted)", transition: ".4s", borderRadius: "34px" }}>
                <span style={{ position: "absolute", height: "16px", width: "16px", left: formData.locationRestricted ? "20px" : "4px", bottom: "4px", backgroundColor: "white", transition: ".4s", borderRadius: "50%" }} />
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--ink)" }}>Hyper-local Offer (Location Restricted)</strong>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Only allow customers within a certain radius to use this offer.</span>
            </div>
          </label>
          
          {formData.locationRestricted && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px dashed var(--line)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Maximum Delivery Radius</label>
                  <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                    <input type="number" required min="1" placeholder="10" value={String(formData.radiusKm)} onChange={v => setFormData({...formData, radiusKm: v.target.value})} style={{ width: "100%", paddingRight: "40px" }} />
                    <span style={{ position: "absolute", right: "12px", color: "var(--muted)", fontSize: "13px", fontWeight: 600, pointerEvents: "none" }}>KM</span>
                  </div>
                </div>
                <div style={{ flex: 2, padding: "12px", background: "var(--panel2)", borderRadius: "6px", fontSize: "12px", color: "var(--muted)", display: "flex", gap: "8px", alignItems: "center", border: "1px solid var(--line)" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>The delivery address coordinates will be measured against your Store Location. If further than {formData.radiusKm || 0} KM away, it will be rejected.</span>
                </div>
              </div>

              {/* Store Coordinate Health Check */}
              {storeHasInvalidCoords ? (
                <div style={{ padding: "12px 14px", background: "rgba(255, 69, 58, 0.08)", border: "1px solid rgba(255, 69, 58, 0.3)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <AlertCircle size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: "12px", color: "var(--red)" }}>
                    <strong>Store coordinates are (0, 0) — distance checks will fail!</strong>
                    <span style={{ display: "block", marginTop: "2px", color: "var(--muted)" }}>
                      Go to <strong>Settings → Location</strong> and set your store's coordinates on the map, then click Sync below.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncStoreMutation.mutate()}
                    disabled={syncStoreMutation.isPending}
                    className="secondary"
                    style={{ fontSize: "12px", padding: "6px 14px", whiteSpace: "nowrap" }}
                  >
                    {syncStoreMutation.isPending ? "Syncing..." : "Sync Store Coordinates"}
                  </button>
                </div>
              ) : mainStore ? (
                <div style={{ padding: "10px 14px", background: "rgba(48, 209, 88, 0.06)", border: "1px solid rgba(48, 209, 88, 0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    ✓ Store: <strong style={{ color: "var(--ink)" }}>{mainStore.name}</strong>
                    {" — "}<code style={{ fontSize: "11px" }}>{mainStore.latitude.toFixed(4)}, {mainStore.longitude.toFixed(4)}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => syncStoreMutation.mutate()}
                    disabled={syncStoreMutation.isPending}
                    style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "11px", fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    {syncStoreMutation.isPending ? "Syncing..." : "Re-sync"}
                  </button>
                </div>
              ) : null}
            </div>
          )}

        </div>

        {/* VALIDITY & LIMITS */}
        <SectionHeader icon={Clock} title="Validity & Limits" desc="Control when and how many times this can be used." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="field">
            <label>Start Date</label>
            <input type="date" value={formData.startsAt} onChange={v => setFormData({...formData, startsAt: v.target.value})} style={{ colorScheme: "light" }} />
          </div>
          <div className="field">
            <label>End Date</label>
            <input type="date" value={formData.endsAt} onChange={v => setFormData({...formData, endsAt: v.target.value})} style={{ colorScheme: "light" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="field">
            <label>Global Usage Limit</label>
            <input type="number" min="1" placeholder="e.g. 100 total claims" value={String(formData.usageLimit)} onChange={v => setFormData({...formData, usageLimit: v.target.value})} />
          </div>
          <div className="field">
            <label>Per Customer Limit</label>
            <input type="number" min="1" placeholder="e.g. 1 per user" value={String(formData.perCustomerLimit)} onChange={v => setFormData({...formData, perCustomerLimit: v.target.value})} />
          </div>
        </div>

        {(mutation.error as any) && (
          <div style={{ padding: "12px", background: "rgba(250, 82, 82, 0.1)", color: "var(--red)", borderRadius: "6px", marginBottom: "20px", fontSize: "13px" }}>
            {(mutation.error as any).message || "Failed to save offer. Check your inputs."}
          </div>
        )}

        {isSuccess && (
          <div style={{ padding: "12px", background: "rgba(48, 209, 88, 0.1)", color: "var(--green)", borderRadius: "6px", marginBottom: "20px", fontSize: "13px", fontWeight: 600 }}>
            Promotion saved successfully!
          </div>
        )}

        <footer style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: "12px", position: "sticky", bottom: "-20px", background: "var(--panel)", paddingBottom: "20px", zIndex: 10 }}>
          <button type="button" onClick={onClose} className="ghost">
            Close
          </button>
          <button type="submit" disabled={mutation.isPending || isSuccess} className="primary">
            {mutation.isPending ? "Saving..." : isSuccess ? "Saved!" : "Save Promotion"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
