const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

function formatError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const detail = d.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg?: string }).msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
    if (typeof d.message === "string") return d.message;
  }
  return `请求失败 (HTTP ${status})`;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("网络错误，请确认服务已启动（http://localhost:8080）");
  }

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("未登录");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text.slice(0, 200) || `请求失败 (HTTP ${res.status})`);
      return text as T;
    }
  }

  if (!res.ok) {
    throw new Error(formatError(data, res.status));
  }
  return data as T;
}
