import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { RequestTable, StatusBadge, Pagination } from "../../components/ui";

type Subscriber = { id: string; email: string; active: boolean; subscribedAt: string };

export function Newsletter() {
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["newsletter", page],
    queryFn: () => api<{ items: Subscriber[]; pagination: Pagination }>(`/admin/newsletter?page=${page}`)
  });
  
  return (
    <RequestTable title="Newsletter" eyebrow="CONTENT" description="Real subscription records. Sending campaigns requires a configured email provider." loading={isLoading} error={error} empty={!data?.items.length} pager={data?.pagination} onPage={setPage}>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Subscribed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map(i => (
            <tr key={i.id}>
              <td><b>{i.email}</b></td>
              <td>{new Date(i.subscribedAt).toLocaleString()}</td>
              <td><StatusBadge value={i.active ? "ACTIVE" : "INACTIVE"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </RequestTable>
  );
}
