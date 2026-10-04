import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, money } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState, Empty, StatusBadge, Pager, Modal, Pagination } from "../../components/ui";

export type Refund = { id: string; amount: string; status: string; reference?: string; notes?: string; createdAt: string; order: { orderNumber: string }; returnRequest?: { returnNumber: string } | null };

export function Refunds() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [newRefund, setNewRefund] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["refunds", page],
    queryFn: () => api<{ items: Refund[]; pagination: Pagination }>(`/admin/refunds?page=${page}`)
  });
  
  const create = useMutation({
    mutationFn: (body: object) => api("/admin/refunds", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setNewRefund(false);
      client.invalidateQueries({ queryKey: ["refunds"] });
    }
  });
  
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/admin/refunds/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["refunds"] })
  });
  
  const change = async (item: Refund, status: string) => {
    if ((status !== "COMPLETED" || await confirm("Only mark this refund completed after the customer has actually been paid. Continue?", "Complete refund"))) {
      update.mutate({ id: item.id, status });
    }
  };
  
  return (
    <>
      <PageHead eyebrow="SALES" title="Refunds" description="Records reflect manual/COD refund work; no bank payment is claimed automatically." action={<button className="primary" onClick={() => setNewRefund(true)}><Plus />New refund record</button>} />
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.items.length ? <Empty /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Return</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(i => (
                    <tr key={i.id}>
                      <td>{i.order.orderNumber}</td>
                      <td>{i.returnRequest?.returnNumber || "—"}</td>
                      <td>{money(Number(i.amount))}</td>
                      <td><StatusBadge value={i.status} /></td>
                      <td>{i.reference || "—"}</td>
                      <td>
                        <select value="" onChange={e => void change(i, e.target.value)}>
                          <option value="">Choose…</option>
                          {["APPROVED", "REJECTED", "PENDING", "COMPLETED"].map(s => <option key={s}>{s}</option>)}
                        </select>
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
      
      {newRefund && (
        <Modal title="Create refund record" onClose={() => setNewRefund(false)}>
          <form className="editor" onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({ orderId: f.get("orderId"), returnRequestId: f.get("returnRequestId") || undefined, amount: Number(f.get("amount")), notes: f.get("notes") });
          }}>
            <label>
              <span>Order ID</span>
              <input name="orderId" required />
            </label>
            <label>
              <span>Return request ID (optional)</span>
              <input name="returnRequestId" />
            </label>
            <label>
              <span>Amount</span>
              <input name="amount" required type="number" min="0.01" step="0.01" />
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" />
            </label>
            {create.error && <p className="form-error">{create.error.message}</p>}
            <button className="primary">Create record</button>
          </form>
        </Modal>
      )}
    </>
  );
}
