import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import { PageHead, Toolbar, RequestTable, Pagination } from "../../components/ui";

type Audit = { id: string; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown>; timestamp: string; admin: { name: string; email: string } };

export function AuditLog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", page, search],
    queryFn: () => api<{ items: Audit[]; pagination: Pagination }>(`/admin/audit?page=${page}&search=${encodeURIComponent(search)}`)
  });
  
  return (
    <>
      <PageHead eyebrow="SYSTEM" title="Audit logs" description="Immutable operational history without passwords, OTPs, or secrets." />
      <Toolbar search={search} onSearch={setSearch} />
      <RequestTable title="" eyebrow="" description="" loading={isLoading} error={error} empty={!data?.items.length} pager={data?.pagination} onPage={setPage}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Administrator</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map(i => (
              <tr key={i.id}>
                <td>{new Date(i.timestamp).toLocaleString()}</td>
                <td>
                  {i.admin.name}
                  <small>{i.admin.email}</small>
                </td>
                <td><b>{i.action.replaceAll("_", " ")}</b></td>
                <td>
                  {i.entityType}
                  <small>{i.entityId}</small>
                </td>
                <td><code>{JSON.stringify(i.metadata)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </RequestTable>
    </>
  );
}
