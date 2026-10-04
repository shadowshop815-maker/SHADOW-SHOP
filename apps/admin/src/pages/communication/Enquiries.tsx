import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api";
import { PageHead, StatusBadge, RequestTable, Modal, Pagination } from "../../components/ui";

type Enquiry = { id: string; name: string; email: string; phone?: string; subject: string; message: string; status: string; internalNote?: string; createdAt: string };

export function Enquiries() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Enquiry | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["enquiries", page, status],
    queryFn: () => api<{ items: Enquiry[]; pagination: Pagination }>(`/admin/enquiries?page=${page}&status=${status}`)
  });
  
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api(`/admin/enquiries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["enquiries"] });
      setSelected(null);
    }
  });
  
  return (
    <>
      <PageHead eyebrow="COMMUNICATION" title="Enquiries" description="Every customer message is stored and trackable." />
      <div className="toolbar">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All enquiries</option>
          <option>UNREAD</option>
          <option>READ</option>
          <option>RESOLVED</option>
          <option>ARCHIVED</option>
        </select>
      </div>
      <RequestTable title="" eyebrow="" description="" loading={isLoading} error={error} empty={!data?.items.length} pager={data?.pagination} onPage={setPage}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Subject</th>
              <th>Message</th>
              <th>Received</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map(i => (
              <tr key={i.id}>
                <td>
                  <b>{i.name}</b>
                  <small>{i.email} · {i.phone}</small>
                </td>
                <td>{i.subject}</td>
                <td className="truncate">{i.message}</td>
                <td>{new Date(i.createdAt).toLocaleString()}</td>
                <td><StatusBadge value={i.status} /></td>
                <td><button className="link-button" onClick={() => setSelected(i)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </RequestTable>
      
      {selected && (
        <Modal title={selected.subject} onClose={() => setSelected(null)}>
          <div className="message">
            <span>From {selected.name} · {selected.email}</span>
            <p>{selected.message}</p>
          </div>
          <form className="editor" onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update.mutate({ id: selected.id, body: { status: f.get("status"), internalNote: f.get("internalNote") } });
          }}>
            <label>
              <span>Status</span>
              <select name="status" defaultValue={selected.status}>
                <option>UNREAD</option>
                <option>READ</option>
                <option>RESOLVED</option>
                <option>ARCHIVED</option>
              </select>
            </label>
            <label>
              <span>Internal note</span>
              <textarea name="internalNote" defaultValue={selected.internalNote} />
            </label>
            <button className="primary" disabled={update.isPending}>{update.isPending ? "Saving..." : "Save enquiry"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
