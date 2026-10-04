import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { Modal, Loading, ErrorState } from "../../components/ui";

export function OfferAnalytics({ offerId, onClose }: { offerId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["offerAnalytics", offerId], queryFn: () => api<any>(`/admin/offers/${offerId}/analytics`) });
  const metrics = data;

  return (
    <Modal title="Offer Analytics" onClose={onClose}>
      {isLoading ? <Loading /> : error ? <ErrorState error={error as Error} /> : (
        <div className="analytics-dashboard">
          <div className="metric-grid" style={{ marginBottom: '24px' }}>
             <div className="card">
                <span className="hint">Total Redemptions</span>
                <h2>{metrics.totalRedemptions}</h2>
             </div>
             <div className="card">
                <span className="hint">Total Discount Given</span>
                <h2>₹{metrics.totalDiscount.toFixed(2)}</h2>
             </div>
             <div className="card">
                <span className="hint">Revenue Generated</span>
                <h2>₹{metrics.totalRevenue.toFixed(2)}</h2>
             </div>
             <div className="card">
                <span className="hint">Average Order Value</span>
                <h2>₹{metrics.avgOrderValue.toFixed(2)}</h2>
             </div>
             <div className="card">
                <span className="hint">Average Distance</span>
                <h2>{metrics.avgDistance ? `${metrics.avgDistance.toFixed(2)} KM` : "N/A"}</h2>
             </div>
          </div>
          
          <h3>Recent Redemptions</h3>
          {metrics.recentRedemptions?.length === 0 ? (
            <p>No recent redemptions.</p>
          ) : (
             <table>
               <thead>
                 <tr>
                   <th>Date</th>
                   <th>Order Value</th>
                   <th>Discount</th>
                   <th>Distance</th>
                 </tr>
               </thead>
               <tbody>
                 {metrics.recentRedemptions.map((r: any) => (
                   <tr key={r.id}>
                     <td>{new Date(r.createdAt).toLocaleString()}</td>
                     <td>₹{Number(r.order.grandTotal).toFixed(2)}</td>
                     <td>₹{Number(r.actualDiscountAmount).toFixed(2)}</td>
                     <td>{r.actualDistanceKm ? `${Number(r.actualDistanceKm).toFixed(2)} KM` : "-"}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          )}
        </div>
      )}
    </Modal>
  );
}
