import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { RequestTable, StatusBadge, Pagination } from "../../components/ui";

export type ReturnReq = { id: string; returnNumber: string; reason: string; description: string; status: string; resolution: string | null; upiId: string | null; createdAt: string; order: { orderNumber: string; customer?: { name: string; email: string } | null }; items: Array<{ id: string; quantity: number; orderItem: { productNameSnapshot: string } }> };

const returnNext: Record<string, string[]> = {
  RETURN_REQUESTED: ["RETURN_APPROVED", "RETURN_REJECTED"],
  RETURN_APPROVED: ["PICKUP_SCHEDULED", "RETURN_CANCELLED"],
  PICKUP_SCHEDULED: ["PICKED_UP"],
  PICKED_UP: ["RETURN_RECEIVED"],
  RETURN_RECEIVED: ["INSPECTION_IN_PROGRESS"],
  INSPECTION_IN_PROGRESS: ["INSPECTION_COMPLETED", "RETURN_REJECTED", "MANUAL_REVIEW"],
  INSPECTION_COMPLETED: ["REFUND_INITIATED"],
  REFUND_INITIATED: ["REFUND_COMPLETED", "REFUND_FAILED"]
};

export function Returns() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["returns", page],
    queryFn: () => api<{ items: ReturnReq[]; pagination: Pagination }>(`/admin/returns?page=${page}`)
  });
  
  const update = useMutation({
    mutationFn: ({ id, status, restoreStock }: { id: string; status: string; restoreStock: boolean }) => api(`/admin/returns/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, restoreStock, adminResponse: "Updated by SHADOW SHOP support" }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["returns"] })
  });
  
  const changeSafe = async (item: ReturnReq, status: string) => {
    if (!await confirm(`Move ${item.returnNumber} from ${item.status} to ${status}?`, "Update return")) return;
    const restore = status === "RETURN_RECEIVED" ? await confirm("Are the received items sellable and safe to restore to inventory?", "Restore returned stock") : false;
    update.mutate({ id: item.id, status, restoreStock: restore });
  };
  
  return (
    <RequestTable title="Returns" eyebrow="SALES" description="Control approval, pickup, receipt, and refund progression." loading={isLoading} error={error} empty={!data?.items.length} pager={data?.pagination} onPage={setPage}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>
              <th style={{ padding: "16px", fontWeight: "600" }}>Return ID</th>
              <th style={{ padding: "16px", fontWeight: "600" }}>Order Details</th>
              <th style={{ padding: "16px", fontWeight: "600" }}>Return Items</th>
              <th style={{ padding: "16px", fontWeight: "600" }}>Reason & Pref</th>
              <th style={{ padding: "16px", fontWeight: "600" }}>Current Status</th>
              <th style={{ padding: "16px", fontWeight: "600" }}>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map(i => (
              <tr key={i.id} style={{ borderBottom: "1px solid var(--border)", transition: "background-color 0.2s", backgroundColor: "transparent" }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: "600", color: "var(--text)", letterSpacing: "0.5px" }}>{i.returnNumber}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    {new Date(i.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: "500", color: "var(--text)" }}>#{i.order.orderNumber}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    {i.order.customer?.name || "Guest Customer"}
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {i.items.map(v => (
                      <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "4px", backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "600", color: "var(--text)" }}>
                          {v.quantity}x
                        </div>
                        <span style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {v.orderItem.productNameSnapshot}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: "600", color: "var(--text)", fontSize: "0.85rem" }}>{i.reason}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", maxWidth: "220px", lineHeight: "1.4" }}>
                    "{i.description}"
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {i.resolution && (
                      <span style={{ fontSize: "0.7rem", fontWeight: "600", padding: "4px 8px", backgroundColor: "rgba(212, 175, 55, 0.1)", color: "var(--gold)", borderRadius: "100px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                        {i.resolution}
                      </span>
                    )}
                    {i.upiId && (
                      <span style={{ fontSize: "0.7rem", fontWeight: "600", padding: "4px 8px", backgroundColor: "rgba(48, 209, 88, 0.1)", color: "#30D158", borderRadius: "100px", border: "1px solid rgba(48, 209, 88, 0.2)" }}>
                        UPI: {i.upiId}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  <StatusBadge value={i.status} />
                </td>
                <td style={{ padding: "16px", verticalAlign: "top" }}>
                  {returnNext[i.status]?.length > 0 ? (
                    <div style={{ position: "relative" }}>
                      <select 
                        value="" 
                        onChange={e => {
                          if (e.target.value) changeSafe(i, e.target.value);
                        }}
                        disabled={update.isPending}
                        style={{
                          width: "100%",
                          padding: "8px 32px 8px 12px",
                          appearance: "none",
                          backgroundColor: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          color: "var(--text)",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                          cursor: "pointer",
                          outline: "none",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                          transition: "all 0.2s"
                        }}
                      >
                        <option value="" disabled hidden>Take Action...</option>
                        {returnNext[i.status]?.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <svg style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No further actions
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RequestTable>
  );
}

