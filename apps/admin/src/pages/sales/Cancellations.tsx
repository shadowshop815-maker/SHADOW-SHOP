import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { RequestTable, StatusBadge, Pagination } from "../../components/ui";

export type Cancellation = { id: string; reason: string; status: string; adminResponse?: string; createdAt: string; order: { id: string; orderNumber: string; orderStatus: string; customer?: { name: string; email: string } | null; items: unknown[] } };

export function Cancellations() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["cancellations", page],
    queryFn: () => api<{ items: Cancellation[]; pagination: Pagination }>(`/admin/cancellations?page=${page}`)
  });
  
  const decision = useMutation({
    mutationFn: ({ id, status, response }: { id: string; status: string; response: string }) => api(`/admin/cancellations/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminResponse: response }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["cancellations"] })
  });
  
  const decide = async (item: Cancellation, status: string) => {
    const response = prompt("Response visible to customer (optional)") || "";
    if (await confirm(`${status === "APPROVED" ? "Approve" : "Reject"} cancellation for ${item.order.orderNumber}?`, "Cancellation decision")) {
      decision.mutate({ id: item.id, status, response });
    }
  };
  
  return (
    <RequestTable title="Cancellations" eyebrow="SALES" description="Review customer requests; approved cancellations restore stock once." loading={isLoading} error={error} empty={!data?.items.length} pager={data?.pagination} onPage={setPage}>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Reason</th>
            <th>Requested</th>
            <th>Status</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map(i => (
            <tr key={i.id}>
              <td><b>{i.order.orderNumber}</b></td>
              <td>
                {i.order.customer?.name || "Guest"}
                <small>{i.order.customer?.email}</small>
              </td>
              <td>{i.reason}</td>
              <td>{new Date(i.createdAt).toLocaleDateString()}</td>
              <td><StatusBadge value={i.status} /></td>
              <td className="row-actions">
                {i.status === "REQUESTED" ? (
                  <>
                    <button className="approve" onClick={() => void decide(i, "APPROVED")}>Approve</button>
                    <button onClick={() => void decide(i, "REJECTED")}>Reject</button>
                  </>
                ) : "Complete"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </RequestTable>
  );
}
