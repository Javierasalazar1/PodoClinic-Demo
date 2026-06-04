import { useAuthStore } from "@/stores/authStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

function getAccessToken(): string | null {
  return sessionStorage.getItem("access_token");
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const isFormData = options.body instanceof FormData;
  
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...options, headers });

  if (res.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" }
        });
        
        if (!refreshRes.ok) throw new Error("Session expired");
        
        const data = await refreshRes.json();
        const { setAuth } = useAuthStore.getState();
        setAuth(data.user, data.accessToken);
        
        isRefreshing = false;
        onRefreshed(data.accessToken);
      } catch (err) {
        isRefreshing = false;
        refreshSubscribers = [];
        const { clearAuth } = useAuthStore.getState();
        clearAuth();
        window.dispatchEvent(new CustomEvent("session-expired"));
        throw { status: 401, error: "Tu sesión ha expirado. Por favor inicia sesión nuevamente.", code: "EXPIRED" };
      }
    }

    return new Promise((resolve, reject) => {
      addRefreshSubscriber(async (newToken: string) => {
        const newHeaders = new Headers(headers);
        newHeaders.set("Authorization", `Bearer ${newToken}`);
        try {
          const retryRes = await fetch(`${API_URL}${path}`, { credentials: "include", ...options, headers: newHeaders });
          if (!retryRes.ok) {
            const errData = await retryRes.json().catch(() => ({}));
            return reject({ status: retryRes.status, error: errData.error, code: errData.code });
          }
          if (retryRes.status === 204 || retryRes.headers.get("content-length") === "0") {
            return resolve(null as unknown as T);
          }
          resolve(retryRes.json());
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      error: errData.error ?? "Error desconocido",
      code: errData.code ?? "UNKNOWN",
    };
  }

  // Handle 204 No Content (DELETE, some PATCHes)
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null as unknown as T;
  }

  return res.json() as Promise<T>;
}
