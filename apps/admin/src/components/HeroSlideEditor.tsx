import { useState } from "react";
import { X, Plus, GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../api";

export function HeroSlideEditor({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  let initialSlides: any[] = [];
  try { initialSlides = JSON.parse(value || "[]"); } catch {
    if (value && !value.startsWith('[')) {
      initialSlides = [{ id: Date.now().toString(), image: value, link: "" }];
    }
  }
  if (!Array.isArray(initialSlides)) initialSlides = [];
  
  const [slides, setSlides] = useState<any[]>(initialSlides);
  const [busy, setBusy] = useState("");
  
  const { data: productsData } = useQuery({ queryKey: ["admin", "products", "active"], queryFn: () => api<{items: any[]}>("/admin/products?status=ACTIVE") });
  const products = productsData?.items || [];

  const update = (newSlides: any[]) => {
    setSlides(newSlides);
    onChange(JSON.stringify(newSlides));
  };

  const upload = async (file: File, index: number) => {
    setBusy(`upload-${index}`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<{ url: string }>("/admin/uploads", { method: "POST", body: fd });
      const next = [...slides];
      next[index].image = result.url;
      update(next);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="wide" style={{ marginTop: 35, borderTop: "1px solid var(--line)", paddingTop: 25, gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <div>
          <h3 style={{ fontSize: 16, margin: 0 }}>Hero Carousel Banners</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Add multiple banners. Select a product to automatically link the banner to its details page.</p>
        </div>
        <button type="button" className="ghost" style={{ fontSize: 13, padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }} onClick={() => {
          update([...slides, { id: Date.now().toString(), image: "", link: "" }]);
        }}>
          <Plus size={16} /> Add Banner
        </button>
      </div>
      
      <div style={{ display: "grid", gap: 15 }}>
        {slides.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "2px dashed var(--line)", borderRadius: 12, color: "var(--muted)" }}>
            No banners added.
          </div>
        ) : slides.map((slide, i) => {
          const isProductLink = slide.link?.startsWith("/products/") && products.some(p => `/products/${p.slug}` === slide.link);
          
          return (
          <div key={slide.id} style={{ display: "flex", gap: 15, background: "var(--panel2)", border: "1px solid var(--line)", padding: 15, borderRadius: 12, alignItems: "center" }}>
            <div style={{ cursor: "grab", color: "var(--muted)" }}><GripVertical size={20}/></div>
            
            <div style={{ width: 120, height: 80, borderRadius: 8, border: "1px dashed var(--line)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center", background: slide.image ? "transparent" : "var(--panel)" }}>
              {slide.image ? <img src={resolveImageUrl(slide.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 10, color: "var(--muted)" }}>No Image</span>}
              <div style={{ position: "absolute", inset: 0, opacity: busy === `upload-${i}` ? 1 : 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", color: "white", fontSize: 12 }}>...</div>
              <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && upload(e.target.files[0], i)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </div>
            
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <select 
                value={isProductLink ? slide.link : (slide.link === "none" ? "none" : (slide.link === "" ? "" : "custom"))} 
                onChange={e => {
                  const val = e.target.value;
                  const next = [...slides];
                  
                  if (val === "custom") {
                    next[i].link = "/";
                  } else {
                    next[i].link = val;
                    const product = val.startsWith("/products/") ? products.find((p: any) => `/products/${p.slug}` === val) : null;
                    if (product && !next[i].image && product.images) {
                      try {
                        const imgs = JSON.parse(product.images);
                        if (imgs && imgs[0]) next[i].image = imgs[0];
                      } catch {}
                    }
                  }
                  update(next);
                }} 
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", background: "var(--panel)", color: "var(--text)" }}
              >
                <option value="">Default Shop Link</option>
                <option value="none">No link (Not clickable)</option>
                <optgroup label="Products">
                  {products.map(p => (
                    <option key={p.id} value={`/products/${p.slug}`}>{p.name}</option>
                  ))}
                </optgroup>
                <option value="custom">Custom URL...</option>
              </select>
              
              {(!isProductLink && slide.link && slide.link !== "none") ? (
                <input type="text" placeholder="Custom Link URL (e.g. /category/shirts)" value={slide.link || ""} onChange={e => {
                  const next = [...slides];
                  next[i].link = e.target.value;
                  update(next);
                }} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", background: "var(--panel)", color: "var(--text)" }} />
              ) : null}
            </div>
            
            <button type="button" className="ghost" style={{ padding: 8, color: "var(--danger)" }} onClick={() => {
              const next = [...slides];
              next.splice(i, 1);
              update(next);
            }}>
              <X size={18} />
            </button>
          </div>
        )})}
      </div>
    </div>
  );
}
