import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, ShieldAlert } from "lucide-react";
import { api, money } from "../api";
import { useConfirm } from "../features/confirm/ConfirmContext";
import { PageHead, Toolbar, Loading, ErrorState, Empty, StatusBadge, Pager, Modal, Pagination } from "../components/ui";

export type Customer = { id: string; name: string; email: string; phone: string | null; createdAt: string; emailVerifiedAt: string | null; phoneVerifiedAt: string | null; lastLoginAt: string | null; customerProfile: { status: string; banReason: string | null; banExpires: string | null; adminNotes: string | null }; _count: { orders: number }; totalSpending: number };

export function Customers() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["customers", page, search, status],
    queryFn: () => api<{ items: Customer[]; pagination: Pagination }>(`/admin/customers?page=${page}&search=${encodeURIComponent(search)}&status=${status}`)
  });
  
  const moderate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api(`/admin/customers/${id}/moderation`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["customers"] });
      setSelected(null);
    }
  });
  
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    const next = String(f.get("status"));
    if (next === "PERMANENTLY_BANNED" && !await confirm(`Permanently restrict ${selected.name}? This blocks login and protected API actions.`, "Permanent customer restriction")) return;
    moderate.mutate({ id: selected.id, body: { status: next, reason: f.get("reason"), note: f.get("note"), expiresAt: f.get("expiresAt") || undefined } });
  };
  
  return (
    <>
      <PageHead eyebrow="CUSTOMERS" title="Customer accounts" description="Search, review spending, and enforce account restrictions on the backend." />
      <Toolbar search={search} onSearch={v => { setSearch(v); setPage(1); }}>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>ACTIVE</option>
          <option>SUSPENDED</option>
          <option>TEMPORARILY_BANNED</option>
          <option>PERMANENTLY_BANNED</option>
        </select>
      </Toolbar>
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.items.length ? <Empty /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Joined</th>
                    <th>Verified</th>
                    <th>Orders</th>
                    <th>Spend</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(c => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.name}</b>
                        <small>{c.email} · {c.phone || "No phone"}</small>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        {c.emailVerifiedAt ? "Email ✓" : "Unverified"}
                        {c.phoneVerifiedAt && <small>Phone ✓</small>}
                      </td>
                      <td>{c._count.orders}</td>
                      <td>{money(c.totalSpending)}</td>
                      <td><StatusBadge value={c.customerProfile.status} /></td>
                      <td>
                        <button 
                          className="secondary"
                          onClick={() => setSelected(c)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {c.customerProfile.status === "ACTIVE" ? <Ban size={14} /> : <ShieldAlert size={14} />}
                            {c.customerProfile.status === "ACTIVE" ? "Suspend / Ban" : "Moderate"}
                          </div>
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
        <Modal title={`Moderate ${selected.name}`} onClose={() => setSelected(null)}>
          <div className="notice">
            <b>Current status: {selected.customerProfile.status}</b>
            {selected.customerProfile.banReason && <p>{selected.customerProfile.banReason}</p>}
          </div>
          <form className="card" onSubmit={submit}>
            <div className="field">
              <label>New account status</label>
              <select name="status" required>
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
                <option>TEMPORARILY_BANNED</option>
                <option>PERMANENTLY_BANNED</option>
              </select>
            </div>
            <div className="field">
              <label>Reason</label>
              <select name="reason">
                <option>Fraud suspicion</option>
                <option>Fake orders</option>
                <option>Repeated COD abuse</option>
                <option>Payment abuse</option>
                <option>Cancellation abuse</option>
                <option>Return abuse</option>
                <option>Spam</option>
                <option>Harassment</option>
                <option>Disturbing behavior</option>
                <option>Multiple suspicious accounts</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Temporary-ban expiry (required for temporary ban)</label>
              <input name="expiresAt" type="datetime-local" />
            </div>
            <div className="field">
              <label>Private admin note</label>
              <textarea name="note" />
            </div>
            <button className="primary" style={{ width: "100%" }}>Apply status</button>
          </form>
        </Modal>
      )}
    </>
  );
}
