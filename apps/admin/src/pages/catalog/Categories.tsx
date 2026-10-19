import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Loading, ErrorState, StatusBadge, Field, TextField } from "../../components/ui";
import type { Category } from "./Products";

export function Categories() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/admin/categories")
  });
  
  const [form, setForm] = useState({ id: "", name: "", slug: "", description: "", active: true });
  
  const mutation = useMutation({
    mutationFn: () => api(`/admin/categories${form.id ? `/${form.id}` : ""}`, {
      method: form.id ? "PATCH" : "POST",
      body: JSON.stringify(form)
    }),
    onSuccess: () => {
      setForm({ id: "", name: "", slug: "", description: "", active: true });
      client.invalidateQueries({ queryKey: ["admin-categories"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setForm({ id: "", name: "", slug: "", description: "", active: true });
      client.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (err: any) => alert(err.message || "Failed to delete category.")
  });
  
  return (
    <>
      <PageHead eyebrow="CATALOG" title="Categories" description="Organize the product collection." />
      <div className="split">
        <section className="card">
          {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : (
            <div className="category-list">
              {data.length === 0 ? (
                <p style={{ color: "var(--muted)", padding: "20px", textAlign: "center" }}>No categories created yet.</p>
              ) : (
                data.map(c => (
                  <button 
                    key={c.id} 
                    type="button"
                    className={`category-item ${form.id === c.id ? "active-category" : ""}`}
                    onClick={() => setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description, active: c.active })}
                  >
                    <div className="category-info">
                      <b className="category-name">{c.name}</b>
                      <small className="category-slug">/{c.slug}</small>
                    </div>
                    <span className="category-count">{c._count?.products || 0} products</span>
                    <StatusBadge value={c.active ? "ACTIVE" : "INACTIVE"} />
                  </button>
                ))
              )}
            </div>
          )}
        </section>
        
        <form className="card" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }}>{form.id ? "Edit category" : "New category"}</h2>
            {form.id && (
              <button 
                type="button" 
                className="ghost" 
                onClick={() => setForm({ id: "", name: "", slug: "", description: "", active: true })}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                + New category
              </button>
            )}
          </div>
          <Field label="Name" value={form.name} required onChange={v => setForm({ ...form, name: v, slug: form.id ? form.slug : v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} />
          <Field label="Slug" value={form.slug} required onChange={v => setForm({ ...form, slug: v })} />
          <TextField label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} />
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button type="submit" className="primary" disabled={mutation.isPending} style={{ flex: 1 }}>
              {mutation.isPending ? "Saving…" : form.id ? "Save category" : "Create category"}
            </button>
            {form.id && (
              <button 
                type="button" 
                className="ghost" 
                style={{ color: "var(--red)", border: "1px solid rgba(255, 80, 80, 0.3)", display: "flex", alignItems: "center", gap: 6 }}
                disabled={deleteMutation.isPending}
                onClick={async () => {
                  const ok = await confirm(`Delete category "${form.name}"? Only categories with 0 products can be deleted.`, "Delete Category");
                  if (ok) deleteMutation.mutate(form.id);
                }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
