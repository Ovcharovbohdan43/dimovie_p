import { toUserMessage } from "@/lib/user-message";

function normalizeApiUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace("://localhost", "://127.0.0.1").replace(/\/+$/, "");
}

const SERVER_API_URL = normalizeApiUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
);

/**
 * Browser normally uses same-origin `/backend` rewrite.
 * Long catalog (Playwright) calls go direct to the API — Next's proxy
 * resets with ECONNRESET while Chromium is still working.
 */
export function getApiUrl(mode: "proxy" | "direct" = "proxy"): string {
  if (typeof window !== "undefined") {
    if (mode === "direct") return SERVER_API_URL;
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
    this.name = "ApiError";
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

type FetchApiOptions = RequestInit & {
  /** Hit Railway API directly (skip Next rewrite). */
  direct?: boolean;
  /**
   * Hit this Next.js app (no `/backend` prefix).
   * Used for `/api/catalog/*` long proxies and runtime config.
   */
  sameOrigin?: boolean;
};

async function fetchApi(
  path: string,
  options: FetchApiOptions = {},
): Promise<Response> {
  const { direct, sameOrigin, ...init } = options;
  const useSameOrigin = sameOrigin || path.startsWith("/api/");
  const url = useSameOrigin
    ? path
    : `${getApiUrl(direct ? "direct" : "proxy")}${path}`;
  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        credentials: "include",
      });
    } catch (err) {
      const canRetry = method === "GET" && attempt < maxAttempts - 1;
      if (canRetry) {
        await sleep(1200);
        continue;
      }
      throw new ApiError(
        toUserMessage(err instanceof Error ? err.message : null, 0),
        0,
      );
    }

    if (res.ok) return res;

    const canRetry =
      method === "GET" && res.status >= 500 && attempt < maxAttempts - 1;

    if (canRetry) {
      await sleep(1200);
      continue;
    }

    return res;
  }

  throw new ApiError(toUserMessage(null, 503), 503);
}

async function readErrorPayload(res: Response): Promise<{
  message?: string | string[];
}> {
  return res.json().catch(() => ({}));
}

function throwApiError(res: Response, body: { message?: string | string[] }): never {
  throw new ApiError(toUserMessage(body.message ?? res.statusText, res.status), res.status);
}

export async function api<T>(
  path: string,
  options: FetchApiOptions = {},
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
    throwApiError(res, await readErrorPayload(res));
  }

  return res.json() as Promise<T>;
}

export async function publicApi<T>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const res = await fetchApi(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    throwApiError(res, await readErrorPayload(res));
  }

  return res.json() as Promise<T>;
}

/** Direct backend URL — OAuth redirects, WebSocket */
export const API_URL = SERVER_API_URL.replace("://localhost", "://127.0.0.1");

/** Socket.IO endpoint; falls back to API URL when unset. */
export const WS_URL = normalizeApiUrl(
  process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000",
).replace("://localhost", "://127.0.0.1");
