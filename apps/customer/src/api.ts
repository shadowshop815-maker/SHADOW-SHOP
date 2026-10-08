const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
export const getToken = () => localStorage.getItem("shadow_token");
export const getCartKey = () => { let key = localStorage.getItem("shadow_cart_key"); if (!key) { key = crypto.randomUUID(); localStorage.setItem("shadow_cart_key", key); } return key; };
export class ApiError extends Error { constructor(message: string, public code: string, public fields?: unknown) { super(message); } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); if (!(options.body instanceof FormData)) headers.set("content-type", "application/json"); headers.set("x-cart-key", getCartKey()); const token = getToken(); if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers }); const payload = await response.json().catch(() => ({ success: false, message: "The server returned an invalid response." })); if (!response.ok || !payload.success) throw new ApiError(payload.message || "Request failed.", payload.error?.code || "REQUEST_FAILED", payload.error?.fields); return payload.data as T;
}
export const money = (value: number | string) => "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

export const resolveImageUrl = (url?: string | null, fallback = "/assets/product-fallback.svg") => {
  if (!url) return fallback;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) {
    const base = API_URL.replace(/\/api\/v1\/?$/, "");
    return `${base}${url}`;
  }
  return url;
};
