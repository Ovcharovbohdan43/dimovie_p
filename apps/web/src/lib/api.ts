const SERVER_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Browser uses same-origin proxy; server/WS use direct URL */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return "/backend";
  }
  return SERVER_API_URL;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dimovie_token");
}

export function setToken(token: string) {
  localStorage.setItem("dimovie_token", token);
}

export function clearToken() {
  localStorage.removeItem("dimovie_token");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${getApiUrl()}${path}`;
  const method = (options.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
    });

    if (res.ok) return res;

    const canRetry =
      method === "GET" && res.status >= 500 && attempt < maxAttempts - 1;

    if (canRetry) {
      await sleep(1200);
      continue;
    }

    return res;
  }

  throw new Error("fetchApi: unreachable");
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetchApi(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { message?: string | string[] }).message;
    const text = Array.isArray(message) ? message.join(", ") : message;

    if (res.status >= 500 && !text) {
      throw new ApiError(
        "API is temporarily unavailable. Wait a few seconds and refresh the page.",
        res.status,
      );
    }

    throw new ApiError(text ?? res.statusText, res.status);
  }

  return res.json() as Promise<T>;
}

export async function publicApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetchApi(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { message?: string | string[] }).message;
    const text = Array.isArray(message) ? message.join(", ") : message;
    throw new ApiError(text ?? res.statusText, res.status);
  }

  return res.json() as Promise<T>;
}

/** Direct backend URL — OAuth redirects, WebSocket */
export const API_URL = SERVER_API_URL.replace("://localhost", "://127.0.0.1");
