import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Archive, Upload } from "lucide-react";
import { api, money, resolveImageUrl } from "../../api";
import { useConfirm } from "../../features/confirm/ConfirmContext";
import { PageHead, Toolbar, Loading, ErrorState, Empty, StatusBadge, Pager, Modal, Field, TextField, Pagination } from "../../components/ui";

export type Category = { id: string; name: string; slug: string; description: string; active: boolean; _count?: { products: number } };
export type Product = { id: string; name: string; slug: string; shortDescription: string; description: string; categories: Category[]; brand: string; sku: string; price: string; salePrice: string | null; costPrice: string | null; stock: number; lowStockThreshold: number; status: string; featured: boolean; thumbnail: string; images: { url: string }[]; sizes: string[]; colors: string[]; tags: string[]; weight: number | null; shippingInfo: string; returnPolicy: string; hsnCode: string | null; taxProfileId: string | null; taxMode: string; taxProfile?: { id: string; name: string; code: string; rate: number } | null };

const emptyProduct = { name: "", slug: "", shortDescription: "", description: "", categories: "", brand: "SHADOW SHOP", sku: "", price: "", salePrice: "", costPrice: "", stock: "0", lowStockThreshold: "5", status: "DRAFT", featured: false, thumbnail: "", images: "", sizes: "", colors: "", tags: "", weight: "", shippingInfo: "", returnPolicy: "", hsnCode: "", taxProfileId: "", taxMode: "INCLUSIVE" };
type ProductForm = typeof emptyProduct;

function ProductEditor({ product, categories, onClose }: { product?: Product; categories: Category[]; onClose: () => void }) {
  const client = useQueryClient();
  const [fileBusy, setFileBusy] = useState(false);
  const [form, setForm] = useState<ProductForm>(product ? { ...product, price: String(product.price), salePrice: product.salePrice || "", costPrice: product.costPrice || "", stock: String(product.stock), lowStockThreshold: String(product.lowStockThreshold), categories: product.categories.map(c => c.name).join(", "), images: product.images.map(i => i.url).join("\n"), sizes: product.sizes.join(", "), colors: product.colors.join(", "), tags: product.tags.join(", "), weight: product.weight == null ? "" : String(product.weight), hsnCode: product.hsnCode || "", taxProfileId: product.taxProfileId || "", taxMode: product.taxMode || "INCLUSIVE" } : emptyProduct);

  const set = (key: keyof ProductForm, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => api(`/admin/products${product ? `/${product.id}` : ""}`, {
      method: product ? "PATCH" : "POST",
      body: JSON.stringify({ ...form, price: Number(form.price), salePrice: form.salePrice ? Number(form.salePrice) : null, costPrice: form.costPrice ? Number(form.costPrice) : null, stock: Number(form.stock), lowStockThreshold: Number(form.lowStockThreshold), weight: form.weight ? Number(form.weight) : null, hsnCode: form.hsnCode || null, taxProfileId: form.taxProfileId || null, taxMode: form.taxMode || "INCLUSIVE", categories: form.categories.split(",").map(s => s.trim()).filter(Boolean), images: form.images.split("\n").map(s => s.trim()).filter(Boolean), sizes: form.sizes.split(",").map(s => s.trim()).filter(Boolean), colors: form.colors.split(",").map(s => s.trim()).filter(Boolean), tags: form.tags.split(",").map(s => s.trim()).filter(Boolean) })
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-products"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
      onClose();
    }
  });

  const upload = async (files: FileList | File[], target: "thumbnail" | "gallery") => {
    setFileBusy(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const data = new FormData();
        data.append("file", file);
        const result = await api<{ url: string }>("/admin/uploads", { method: "POST", body: data });
        urls.push(result.url);
      }
      if (target === "thumbnail") {
        set("thumbnail", urls[0]);
      } else {
        const current = form.images.trim();
        set("images", current ? current + "\n" + urls.join("\n") : urls.join("\n"));
      }
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setFileBusy(false);
    }
  };

  return (
    <Modal title={product ? "Edit product" : "Create product"} onClose={onClose}>
      <form className="editor" onSubmit={e => { e.preventDefault(); mutation.mutate() }}>
        <div className="form-grid">
          <Field label="Product name" value={form.name} onChange={v => { set("name", v); if (!product) set("slug", v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} required />
          <Field label="Slug" value={form.slug} onChange={v => set("slug", v)} required />
          <Field label="SKU" value={form.sku} onChange={v => set("sku", v)} required />
          <Field label="Categories (comma separated)" value={form.categories} onChange={v => set("categories", v)} required />
          <Field label="Brand" value={form.brand} onChange={v => set("brand", v)} />
          <label>
            <span>Status</span>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>OUT_OF_STOCK</option>
              <option>ARCHIVED</option>
            </select>
          </label>
          <Field label="Regular price" type="number" value={form.price} onChange={v => set("price", v)} required />
          <Field label="Sale price" type="number" value={form.salePrice} onChange={v => set("salePrice", v)} />
          <Field label="Cost price (private)" type="number" value={form.costPrice} onChange={v => set("costPrice", v)} />
          <Field label="Stock" type="number" value={form.stock} onChange={v => set("stock", v)} required />
          <Field label="Low-stock threshold" type="number" value={form.lowStockThreshold} onChange={v => set("lowStockThreshold", v)} />
          <Field label="Weight" type="number" value={form.weight} onChange={v => set("weight", v)} />
        </div>
        <Field label="Short description" value={form.shortDescription} onChange={v => set("shortDescription", v)} />
        <TextField label="Full description" value={form.description} onChange={v => set("description", v)} required />
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Thumbnail Image</label>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {form.thumbnail ? (
                <div style={{ position: "relative", width: 100, height: 100, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <img src={resolveImageUrl(form.thumbnail)} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <button type="button" onClick={() => set("thumbnail", "")} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <label style={{ width: 100, height: 100, border: "2px dashed var(--gold)", color: "var(--gold)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(212, 175, 55, 0.05)", transition: "0.2s" }}>
                  <Upload size={20} />{fileBusy ? "..." : "Upload"}
                  <input type="file" accept="image/*" onChange={e => e.target.files?.length && void upload(e.target.files, "thumbnail")} style={{ display: "none" }} disabled={fileBusy} />
                </label>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 300 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gallery Images</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {form.images.split("\n").map(s => s.trim()).filter(Boolean).map((url, i) => (
                <div key={i} style={{ position: "relative", width: 100, height: 100, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <img src={resolveImageUrl(url)} alt={`Gallery ${i}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <button type="button" onClick={() => {
                    const arr = form.images.split("\n").map(s => s.trim()).filter(Boolean);
                    arr.splice(i, 1);
                    set("images", arr.join("\n"));
                  }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <label style={{ width: 100, height: 100, border: "2px dashed var(--gold)", color: "var(--gold)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(212, 175, 55, 0.05)", transition: "0.2s", flexShrink: 0 }}>
                <Upload size={20} /> {fileBusy ? "..." : "Add Photo"}
                <input type="file" accept="image/*" multiple onChange={e => e.target.files?.length && void upload(e.target.files, "gallery")} style={{ display: "none" }} disabled={fileBusy} />
              </label>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Sizes (comma separated)" value={form.sizes} onChange={v => set("sizes", v)} />
          <Field label="Colors (comma separated)" value={form.colors} onChange={v => set("colors", v)} />
          <Field label="Tags (comma separated)" value={form.tags} onChange={v => set("tags", v)} />
        </div>
        <TextField label="Shipping information" value={form.shippingInfo} onChange={v => set("shippingInfo", v)} />
        <TextField label="Return policy" value={form.returnPolicy} onChange={v => set("returnPolicy", v)} />
        
        <div className="card" style={{ marginTop: "24px", marginBottom: "24px", padding: "24px", background: "var(--panel2)" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--ink-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>🧾 GST / Tax Configuration</h2>
          <div className="form-grid">
            <div className="field">
              <label>HSN Code</label>
              <input value={form.hsnCode} onChange={e => set("hsnCode", e.target.value)} />
            </div>
            <div className="field">
              <label>Tax Mode</label>
              <select value={form.taxMode} onChange={e => set("taxMode", e.target.value)}>
                <option value="INCLUSIVE">Tax Inclusive (price includes GST)</option>
                <option value="EXCLUSIVE">Tax Exclusive (GST added on top)</option>
              </select>
            </div>
            <div className="field">
              <label>Tax Profile ID (from Tax Settings)</label>
              <input value={form.taxProfileId} onChange={e => set("taxProfileId", e.target.value)} />
            </div>
          </div>
        </div>
        
        <label className="check" style={{ marginBottom: "24px" }}>
          <input type="checkbox" checked={form.featured} onChange={e => set("featured", e.target.checked)} />
          Feature this product
        </label>
        {mutation.error && (
          <div className="form-error" style={{ marginBottom: "24px", padding: "16px", background: "rgba(250, 82, 82, 0.1)", color: "var(--red)", borderRadius: "8px" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{mutation.error.message}</p>
            {((mutation.error as any).fields) && (
              <ul style={{ margin: "10px 0 0 20px", fontSize: "0.9em" }}>
                {Object.entries((mutation.error as any).fields).map(([field, errors]) => (
                  <li key={field}><b>{field}:</b> {(errors as string[]).join(", ")}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={mutation.isPending} style={{ minWidth: 160, justifyContent: "center" }}>
            {mutation.isPending ? (
              <>
                <svg className="spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Saving...
              </>
            ) : "Save product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Products() {
  const client = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<Product | "new" | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-products", page, search, status],
    queryFn: () => api<{ items: Product[]; pagination: Pagination }>(`/admin/products?page=${page}&search=${encodeURIComponent(search)}&status=${status}`)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api<Category[]>("/admin/categories")
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-products"] });
      client.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  });

  return (
    <>
      <PageHead eyebrow="CATALOG" title="Products" description="Create and maintain the live customer catalog." action={<button className="primary" onClick={() => setEditor("new")}><Plus />New product</button>} />
      <Toolbar search={search} onSearch={v => { setSearch(v); setPage(1); }}>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>ACTIVE</option>
          <option>DRAFT</option>
          <option value="LOW_STOCK">LOW/OUT OF STOCK</option>
          <option>OUT_OF_STOCK</option>
          <option>ARCHIVED</option>
        </select>
      </Toolbar>
      <section className="card">
        {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : !data?.items.length ? <Empty /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="product-cell">
                          <img src={resolveImageUrl(p.thumbnail || "/assets/product-fallback.svg")} alt="" />
                          <b>{p.name}</b>
                        </div>
                      </td>
                      <td>{p.sku}</td>
                      <td>{p.categories.map(c => c.name).join(", ")}</td>
                      <td>{money(p.salePrice || p.price)}{p.salePrice && <small><s>{money(p.price)}</s></small>}</td>
                      <td className={p.stock <= p.lowStockThreshold ? "attention" : ""}>{p.stock}</td>
                      <td><StatusBadge value={p.status} /></td>
                      <td className="row-actions">
                        <button onClick={() => setEditor(p)}>Edit</button>
                        <button aria-label="Archive" onClick={async () => await confirm(`Archive ${p.name}? It will disappear from the customer catalog.`, "Archive product") && archive.mutate(p.id)}><Archive /></button>
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
      {editor && <ProductEditor product={editor === "new" ? undefined : editor} categories={categories} onClose={() => setEditor(null)} />}
    </>
  );
}
