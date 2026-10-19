const PROD_API_URL = "https://shadow-shop-5719.onrender.com/api/v1";
let activeBaseUrl = import.meta.env.VITE_API_URL || PROD_API_URL;

export const getToken = () => localStorage.getItem("shadow_token");

export const getCartKey = () => {
  let key = localStorage.getItem("shadow_cart_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("shadow_cart_key", key);
  }
  return key;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public fields?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// In-flight GET request deduplication map to eliminate duplicate concurrent requests
const inFlightRequests = new Map<string, Promise<any>>();

// Server status notification for Render Free cold starts
let isServerWaking = false;
function notifyServerWaking(waking: boolean) {
  if (isServerWaking !== waking) {
    isServerWaking = waking;
    window.dispatchEvent(new CustomEvent("shadow_server_waking", { detail: { waking } }));
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";

  // Request deduplication for GET calls with identical headers/path
  const dedupeKey = isGet ? `${path}:${getToken() || ""}:${getCartKey()}` : null;
  if (dedupeKey && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey)! as Promise<T>;
  }

  const promise = (async () => {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    headers.set("x-cart-key", getCartKey());
    const token = getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);

    // Bounded timeout: 15s for GET, 30s for mutations
    const timeoutMs = isGet ? 15000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // If options already has a signal, bridge them
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await fetch(`${activeBaseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      notifyServerWaking(false);

      const payload = await response.json().catch(() => ({
        success: false,
        message: "The server returned an invalid response."
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

      // If local dev server is not running, seamlessly fallback to live cloud Render backend
      if (err instanceof TypeError && err.message.includes("fetch") && activeBaseUrl.includes("localhost:5000")) {
        activeBaseUrl = PROD_API_URL;
        return api<T>(path, options);
      }

      // Detect cold-start network timeout or failure
      if (err.name === "AbortError" || (err instanceof TypeError && err.message.includes("fetch"))) {
        notifyServerWaking(true);
        // Fire background wake-up ping to /readiness (non-blocking)
        fetch(`${activeBaseUrl.replace(/\/api\/v\d+$/, "")}/readiness`).catch(() => {});
      }

      if (err instanceof ApiError) throw err;
      throw new ApiError(
        err.name === "AbortError" ? "Request timed out. Server may be starting." : (err.message || "Network error occurred."),
        err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        0
      );
    } finally {
      if (dedupeKey) {
        inFlightRequests.delete(dedupeKey);
      }
    }
  })();

  if (dedupeKey) {
    inFlightRequests.set(dedupeKey, promise);
  }

  return promise;
}

export const money = (value: number | string) =>
  "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

const STUDIO_PHOTO_MAP: Record<string, string> = {
  "noir-overshirt": "https://images.unsplash.com/photo-1620012253295-c15c429f66bf?auto=format&fit=crop&w=800&q=80",
  "heavy-tee": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80",
  "product-fallback": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
  "eclipse-cap": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80",
  "shadow-runner": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  "orbit-bag": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
  "mono-slide": "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=800&q=80"
};

const DEFAULT_STUDIO_FALLBACK = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80";

export const resolveImageUrl = (url?: string | null, fallback = DEFAULT_STUDIO_FALLBACK) => {
  if (!url || String(url).trim() === "") return fallback;


  // Intercept demo vector SVGs and map to studio photography
  if (url.includes(".svg")) {
    for (const [key, photo] of Object.entries(STUDIO_PHOTO_MAP)) {
      if (url.includes(key)) return photo;
    }
    return fallback;
  }

  if (url.includes("localhost:5000/uploads/")) {
    url = "/uploads/" + url.split("/uploads/")[1];
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) {
    const base = activeBaseUrl.replace(/\/api\/v1\/?$/, "");
    return `${base}${url}`;
  }
  return url;
};

