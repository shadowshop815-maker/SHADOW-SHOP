import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../api";
import { PageHead, Loading, ErrorState, Empty, StatusBadge } from "../components/ui";

type DashboardData = {
  totalSales: number; todaySales: number; totalOrders: number;
  pendingOrders: number; processingOrders: number; deliveredOrders: number;
  cancelledOrders: number; returnRequests: number; refunds: number;
  customers: number; products: number; lowStock: number; outOfStock: number;
  recentOrders: Array<{ id: string; orderNumber: string; grandTotal: string; orderStatus: string; createdAt: string; customer?: { name: string } | null; guestName?: string; items: unknown[] }>;
};

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api<DashboardData>("/admin/dashboard")
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const cards = [
    ["Total sales", money(data!.totalSales), "gold"],
    ["Today's sales", money(data!.todaySales), ""],
    ["Total orders", data!.totalOrders, ""],
    ["Pending", data!.pendingOrders, "warn"],
    ["In progress", data!.processingOrders, ""],
    ["Delivered", data!.deliveredOrders, "good"],
    ["Returns", data!.returnRequests, "warn"],
    ["Customers", data!.customers, ""]
  ];

  return (
    <>
      <PageHead eyebrow="EXECUTIVE TELEMETRY" title="Command Center" description="Real-time operational metrics and system telemetry." />
      <div className="metric-grid">
        {cards.map(([label, value, tone]) => (
          <article className={`metric ${tone}`} key={label as string}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="split">
        <section className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-head" style={{ padding: '24px 24px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>
            <h2 style={{ margin: 0 }}>Recent Transactions</h2>
            <Link to="/orders">View all</Link>
          </div>
          {data!.recentOrders.length ? (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentOrders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <b>{o.orderNumber}</b>
                        <small>{new Date(o.createdAt).toLocaleDateString()}</small>
                      </td>
                      <td>{o.customer?.name || o.guestName || "Guest"}</td>
                      <td>{o.items.length}</td>
                      <td>{money(Number(o.grandTotal))}</td>
                      <td><StatusBadge value={o.orderStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div style={{ padding: 24 }}><Empty label="No orders yet" /></div>}
        </section>
        <aside className="card stock-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>Inventory Health</h2>
          <div>
            <span>Low stock</span>
            <b className="attention">{data!.lowStock}</b>
          </div>
          <div>
            <span>Out of stock</span>
            <b className="attention">{data!.outOfStock}</b>
          </div>
          <div style={{ borderBottom: 'none' }}>
            <span>Active products</span>
            <b>{data!.products}</b>
          </div>
          <Link className="button secondary" to="/inventory" style={{ marginTop: 'auto' }}>Manage stock</Link>
        </aside>
      </div>
    </>
  );
}
