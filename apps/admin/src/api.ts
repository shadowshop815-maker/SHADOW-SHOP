/// <reference types="vite/client" />
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
export const token = () => localStorage.getItem("shadow_admin_token");

export class ApiError extends Error {
  constructor(message: string, public code: string, public status?: number, public fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const value = token();
  if (value) headers.set("authorization", `Bearer ${value}`);

  // Bounded timeout to prevent hanging admin operations
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const payload = await response.json().catch(() => ({
      success: false,
      message: "Invalid server response."
    }));

    if (!response.ok || !payload.success) {
      throw new ApiError(
        payload.message || "Request failed.",
        payload.error?.code || "REQUEST_FAILED",
        response.status,
        payload.error?.fields
      );
    }
    return payload.data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err.name === "AbortError" ? "Request timed out." : (err.message || "Network error occurred."),
      err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      0
    );
  }
}

export const money = (value: number | string) =>
  "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

export const resolveImageUrl = (url?: string, fallback = "/assets/product-fallback.svg") => {
  if (!url) return fallback;
  if (url.includes("localhost:5000/uploads/")) {
    url = "/uploads/" + url.split("/uploads/")[1];
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API.replace(/\/api\/v\d+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};
