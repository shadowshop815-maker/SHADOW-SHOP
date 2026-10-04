import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Play, Pause, BarChart2 } from "lucide-react";
import { api } from "../../api";
import { PageHead, Loading, ErrorState, Empty, StatusBadge } from "../../components/ui";
import { OfferForm } from "./OfferForm";
import { OfferAnalytics } from "./OfferAnalytics";
import { useConfirm } from "../../features/confirm/ConfirmContext";

export function Offers() {
  const [editing, setEditing] = useState<any>(null);
  const [viewingAnalytics, setViewingAnalytics] = useState<string | null>(null);
  
  const qc = useQueryClient();
  const confirm = useConfirm();
  
  const { data, isLoading, error } = useQuery({ queryKey: ["adminOffers"], queryFn: () => api<any>("/admin/offers") });
  const offers = Array.isArray(data) ? data : [];

  const activate = useMutation({
    mutationFn: (id: string) => api(`/admin/offers/${id}/activate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminOffers"] })
  });
  
  const pause = useMutation({
    mutationFn: (id: string) => api(`/admin/offers/${id}/pause`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminOffers"] })
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error as Error} />;

  return (
    <>
      <PageHead
        eyebrow="Marketing"
        title="Offers & Promotions"
        description="Manage location-based offers, coupons, and automatic discounts."
        action={<button className="btn primary" onClick={() => setEditing({})}><Plus size={16} /> Create Offer</button>}
      />

      {offers.length === 0 ? <Empty label="No offers created yet." /> : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Offer Name</th>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Location Rule</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer: any) => (
                  <tr key={offer.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ color: 'var(--gold)', letterSpacing: '0.5px' }}>{offer.name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{offer.type.replaceAll("_", " ")}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ background: 'var(--panel2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600, letterSpacing: '1px' }}>
                        {offer.code}
                      </code>
                    </td>
                    <td>
                      {offer.discountType === "PERCENTAGE" ? `${offer.discountValue}%` : 
                       offer.discountType === "FREE_DELIVERY" ? "Free Delivery" :
                       `₹${offer.discountValue}`}
                    </td>
                    <td>
                      {offer.locationRules?.length > 0 ? `Within ${offer.locationRules[0].radiusKm} KM` : "None"}
                    </td>
                    <td>
                      {offer._count?.redemptions || 0} / {offer.usageLimit || "∞"}
                    </td>
                    <td><StatusBadge value={offer.status} /></td>
                    <td>
                      <div className="row" style={{ gap: '8px' }}>
                        <button className="secondary" title="Edit" onClick={() => setEditing(offer)} style={{ padding: "6px" }}><Edit2 size={14} /></button>
                        <button className="secondary" title="Analytics" onClick={() => setViewingAnalytics(offer.id)} style={{ padding: "6px" }}><BarChart2 size={14} /></button>
                        {offer.status === "ACTIVE" ? (
                          <button className="secondary" title="Pause" onClick={async () => { if (await confirm("Pause this offer?")) pause.mutate(offer.id); }} style={{ padding: "6px", color: 'var(--amber)', borderColor: "var(--amber)", background: "rgba(255, 159, 10, 0.1)" }}><Pause size={14} /></button>
                        ) : (
                          <button className="secondary" title="Activate" onClick={async () => { if (await confirm("Activate this offer?")) activate.mutate(offer.id); }} style={{ padding: "6px", color: 'var(--green)', borderColor: "var(--green)", background: "rgba(48, 209, 88, 0.1)" }}><Play size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && <OfferForm offer={editing} onClose={() => setEditing(null)} />}
      {viewingAnalytics && <OfferAnalytics offerId={viewingAnalytics} onClose={() => setViewingAnalytics(null)} />}
    </>
  );
}
