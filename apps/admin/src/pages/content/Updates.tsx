import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive } from "lucide-react";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState, Empty, StatusBadge } from "../../components/ui";
import { ContentEditor } from "./ContentEditor";

export type UpdatePost = { id: string; title: string; slug: string; description: string; coverImage: string; category: string; status: string; publishDate: string | null; createdAt: string };

export function Updates() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [editor, setEditor] = useState<UpdatePost | "new" | null>(null);
  
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["updates-admin"],
    queryFn: () => api<UpdatePost[]>("/admin/updates")
  });
  
  const archive = useMutation({
    mutationFn: (id: string) => api(`/admin/updates/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["updates-admin"] })
  });
  
  return (
    <>
      <PageHead eyebrow="CONTENT" title="Updates" description="Publish news and stories to the customer site." action={<button className="primary" onClick={() => setEditor("new")}><Plus />New update</button>} />
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data.length ? <Empty /> : (
          <div className="content-grid">
            {data.map(i => (
              <article className="content-card" key={i.id}>
                {i.coverImage ? <img src={i.coverImage} alt="" /> : <div className="content-art">SS</div>}
                <div>
                  <StatusBadge value={i.status} />
                  <h3>{i.title}</h3>
                  <p>{i.description}</p>
                  <small>{i.publishDate ? new Date(i.publishDate).toLocaleDateString() : "Not published"}</small>
                  <div className="row-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button className="secondary" onClick={() => setEditor(i)}>Edit</button>
                    <button className="ghost" style={{ color: 'var(--amber)' }} onClick={async () => await confirm(`Archive “${i.title}”?`, "Archive update") && archive.mutate(i.id)}>Archive</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      
      {editor && <ContentEditor type="update" item={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} />}
    </>
  );
}
