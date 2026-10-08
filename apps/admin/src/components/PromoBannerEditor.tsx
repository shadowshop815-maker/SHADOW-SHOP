import { useState } from "react";
import { X, Plus, GripVertical, Image } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, resolveImageUrl } from "../api";

/**
 * PromoBannerEditor
 * Multi-banner promotional section editor — similar to HeroSlideEditor.
 * Stored as JSON array in branding.promotionalBanner:
 *   [ { id, image, link, title } ]
 */
export function PromoBannerEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  let initial: any[] = [];
  try {
    const parsed = JSON.parse(value || "[]");
    // Backward compat: if stored as a single URL string (old format)
    if (Array.isArray(parsed)) {
      initial = parsed;
    } else if (value && !value.startsWith("[")) {
      initial = [{ id: Date.now().toString(), image: value, link: "/products", title: "" }];
    }
  } catch {
    if (value && !value.startsWith("[")) {
      initial = [{ id: Date.now().toString(), image: value, link: "/products", title: "" }];
    }
  }

  const [banners, setBanners] = useState<any[]>(initial);
  const [busy, setBusy] = useState("");

  const { data: productsData } = useQuery({
    queryKey: ["admin", "products", "active"],
    queryFn: () => api<{ items: any[] }>("/admin/products?status=ACTIVE"),
  });
  const products = productsData?.items || [];

  const update = (next: any[]) => {
    setBanners(next);
    onChange(JSON.stringify(next));
  };

  const upload = async (file: File, index: number) => {
    setBusy(`upload-${index}`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<{ url: string }>("/admin/uploads", { method: "POST", body: fd });
      const next = [...banners];
      next[index] = { ...next[index], image: result.url };
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
          <h3 style={{ fontSize: 16, margin: 0 }}>Promotional Banners</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Add multiple promotional banners. Each can link to a product page or custom URL.
          </p>
        </div>
        <button
          type="button"
          className="ghost"
          style={{ fontSize: 13, padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }}
          onClick={() =>
            update([...banners, { id: Date.now().toString(), image: "", link: "/products", title: "" }])
          }
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>

      <div style={{ display: "grid", gap: 15 }}>
        {banners.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              border: "2px dashed var(--line)",
              borderRadius: 12,
              color: "var(--muted)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Image size={28} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 13 }}>No promotional banners added.</span>
          </div>
        ) : (
          banners.map((banner, i) => {
            const isProductLink =
              banner.link?.startsWith("/products/") &&
              products.some((p: any) => `/products/${p.slug}` === banner.link);

            return (
              <div
                key={banner.id || i}
                style={{
                  display: "flex",
                  gap: 15,
                  background: "var(--panel2)",
                  border: "1px solid var(--line)",
                  padding: 15,
                  borderRadius: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ cursor: "grab", color: "var(--muted)", paddingTop: 4 }}>
                  <GripVertical size={20} />
                </div>

                {/* Image upload */}
                <div
                  style={{
                    width: 140,
                    height: 90,
                    borderRadius: 8,
                    border: "1px dashed var(--line)",
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    background: banner.image ? "transparent" : "var(--panel)",
                    flexShrink: 0,
                  }}
                >
                  {banner.image ? (
                    <img
                      src={resolveImageUrl(banner.image)}
                      alt="Promo"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>No Image</span>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: busy === `upload-${i}` ? 1 : 0,
                      background: "rgba(0,0,0,0.5)",
                      display: "grid",
                      placeItems: "center",
                      color: "white",
                      fontSize: 12,
                    }}
                  >
                    ...
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], i)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                  />
                </div>

                {/* Fields */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Optional title */}
                  <input
                    type="text"
                    placeholder="Title / Label (optional)"
                    value={banner.title || ""}
                    onChange={(e) => {
                      const next = [...banners];
                      next[i] = { ...next[i], title: e.target.value };
                      update(next);
                    }}
                    style={{
                      width: "100%",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "var(--panel)",
                      color: "var(--text)",
                    }}
                  />

                  {/* Link selector */}
                  <select
                    value={
                      isProductLink
                        ? banner.link
                        : banner.link === "none"
                        ? "none"
                        : banner.link === "/products" || banner.link === ""
                        ? "/products"
                        : "custom"
                    }
                    onChange={(e) => {
                      const next = [...banners];
                      const val = e.target.value;
                      const product = val.startsWith("/products/") ? products.find((p: any) => `/products/${p.slug}` === val) : null;
                      
                      next[i] = {
                        ...next[i],
                        link: val === "custom" ? "/" : val,
                      };
                      
                      if (product) {
                        if (!next[i].title) next[i].title = product.name;
                        if (!next[i].image && product.images) {
                          try {
                            const imgs = JSON.parse(product.images);
                            if (imgs && imgs[0]) next[i].image = imgs[0];
                          } catch {}
                        }
                      }
                      
                      update(next);
                    }}
                    style={{
                      width: "100%",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "var(--panel)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="/products">All Products</option>
                    <option value="none">No link (display only)</option>
                    <optgroup label="Products">
                      {products.map((p: any) => (
                        <option key={p.id} value={`/products/${p.slug}`}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <option value="custom">Custom URL...</option>
                  </select>

                  {/* Custom URL input */}
                  {!isProductLink &&
                    banner.link &&
                    banner.link !== "none" &&
                    banner.link !== "/products" && (
                      <input
                        type="text"
                        placeholder="Custom URL (e.g. /products?category=shirts)"
                        value={banner.link || ""}
                        onChange={(e) => {
                          const next = [...banners];
                          next[i] = { ...next[i], link: e.target.value };
                          update(next);
                        }}
                        style={{
                          width: "100%",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          background: "var(--panel)",
                          color: "var(--text)",
                        }}
                      />
                    )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: 8, color: "var(--danger)", flexShrink: 0 }}
                  onClick={() => {
                    const next = [...banners];
                    next.splice(i, 1);
                    update(next);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
