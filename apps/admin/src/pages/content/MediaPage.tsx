import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive } from "lucide-react";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState, Empty, StatusBadge } from "../../components/ui";
import { ContentEditor } from "./ContentEditor";

export type Media = { id: string; title: string; description: string; type: string; url: string; thumbnail: string; status: string; createdAt: string };

export function MediaPage() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [editor, setEditor] = useState<Media | "new" | null>(null);
  
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["media-admin"],
    queryFn: () => api<Media[]>("/admin/media")
  });
  
  const archive = useMutation({
    mutationFn: (id: string) => api(`/admin/media/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["media-admin"] })
  });
  
  return (
    <>
      <PageHead eyebrow="CONTENT" title="Media" description="Publish images, videos, and documents." action={<button className="primary" onClick={() => setEditor("new")}><Plus />New media</button>} />
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data.length ? <Empty /> : (
          <div className="content-grid">
            {data.map(i => (
              <article className="content-card" key={i.id}>
                {i.thumbnail || i.type === "IMAGE" ? <img src={i.thumbnail || i.url} alt="" /> : <div className="content-art">{i.type}</div>}
                <div>
                  <StatusBadge value={i.status} />
                  <h3>{i.title}</h3>
                  <p>{i.description}</p>
                  <div className="row-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button className="secondary" onClick={() => setEditor(i)}>Edit</button>
                    <button className="ghost" style={{ color: 'var(--amber)' }} onClick={async () => await confirm(`Archive “${i.title}”?`, "Archive media") && archive.mutate(i.id)}>Archive</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      
      {editor && <ContentEditor type="media" item={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} />}
    </>
  );
}
