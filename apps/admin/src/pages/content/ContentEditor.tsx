import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { api } from "../../api";
import { Modal, Field, TextField } from "../../components/ui";

type ContentEditorProps = {
  type: "update" | "media";
  item?: any;
  onClose: () => void;
};

export function ContentEditor({ type, item, onClose }: ContentEditorProps) {
  const client = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>(item || (type === "update" 
    ? { title: "", slug: "", category: "News", coverImage: "", description: "", status: "DRAFT" }
    : { title: "", type: "IMAGE", url: "", thumbnail: "", description: "", status: "DRAFT" }
  ));
  const [busy, setBusy] = useState(false);

  const value = (key: string) => form[key] || "";
  const set = (key: string, v: string) => setForm(prev => ({ ...prev, [key]: v }));

  const mutation = useMutation({
    mutationFn: () => api(`/admin/${type === "update" ? "updates" : "media"}${item ? `/${item.id}` : ""}`, {
      method: item ? "PATCH" : "POST",
      body: JSON.stringify(form)
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [type === "update" ? "updates-admin" : "media-admin"] });
      onClose();
    }
  });

  const upload = async (file: File, key: string) => {
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await api<{ url: string }>("/admin/uploads", { method: "POST", body: data });
      set(key, result.url);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={item ? `Edit ${type}` : `New ${type}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} style={{ padding: "0 10px 20px" }}>
        <Field label="Title" value={value("title")} required onChange={v => { set("title", v); if (!item && type === "update") set("slug", v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} />
        {type === "update" ? (
          <>
            <Field label="Slug" value={value("slug")} required onChange={v => set("slug", v)} />
            <Field label="Category" value={value("category")} onChange={v => set("category", v)} />
            <Field label="Cover image URL" value={value("coverImage")} onChange={v => set("coverImage", v)} />
            <label className="upload-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', background: 'var(--panel2)', border: '1px dashed var(--line)', borderRadius: '6px', marginBottom: '16px' }}>
              <Upload size={16} />{busy ? "Uploading…" : "Upload cover"}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && void upload(e.target.files[0], "coverImage")} />
            </label>
          </>
        ) : (
          <>
            <div className="field">
              <label>Media type</label>
              <select value={value("type")} onChange={e => set("type", e.target.value)}>
                <option>IMAGE</option>
                <option>VIDEO</option>
                <option>DOCUMENT</option>
              </select>
            </div>
            <Field label="Media URL" value={value("url")} required onChange={v => set("url", v)} />
            <label className="upload-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', background: 'var(--panel2)', border: '1px dashed var(--line)', borderRadius: '6px', marginBottom: '16px' }}>
              <Upload size={16} />{busy ? "Uploading…" : "Upload media"}
              <input type="file" accept="image/*,video/mp4,application/pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && void upload(e.target.files[0], "url")} />
            </label>
            <Field label="Thumbnail URL" value={value("thumbnail")} onChange={v => set("thumbnail", v)} />
          </>
        )}
        <TextField label="Description" value={value("description")} required onChange={v => set("description", v)} />
        <div className="field">
          <label>Status</label>
          <select value={value("status")} onChange={e => set("status", e.target.value)}>
            <option>DRAFT</option>
            <option>PUBLISHED</option>
            <option>ARCHIVED</option>
          </select>
        </div>
        {mutation.error && <p className="form-error" style={{ background: 'rgba(250, 82, 82, 0.1)', color: 'var(--red)', padding: '12px', fontSize: '13px', borderRadius: '6px' }}>{mutation.error.message}</p>}
        <button className="primary" disabled={mutation.isPending} style={{ marginTop: '16px', width: '100%' }}>
          {mutation.isPending ? "Saving…" : `Save ${type}`}
        </button>
      </form>
    </Modal>
  );
}
