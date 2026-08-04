import { API_URL, WS_URL } from "@/lib/api";

export type RuntimeConfig = {
  apiUrl: string;
  wsUrl: string;
};

let cached: RuntimeConfig | null = null;
let inflight: Promise<RuntimeConfig> | null = null;

function fallbackConfig(): RuntimeConfig {
  return {
    apiUrl: API_URL,
    wsUrl: WS_URL || API_URL,
  };
}

/** Resolve public API/WS URLs (runtime env first, then build-time fallback). */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (typeof window === "undefined") return fallbackConfig();
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = fetch("/api/runtime-config", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return fallbackConfig();
      const data = (await res.json()) as Partial<RuntimeConfig>;
      const apiUrl = (data.apiUrl || API_URL).trim();
      const wsUrl = (data.wsUrl || data.apiUrl || WS_URL || API_URL).trim();
      // Ignore useless localhost baked into a production page
      const onLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(
        window.location.hostname,
      );
      if (
        !onLocalHost &&
        /localhost|127\.0\.0\.1/i.test(apiUrl)
      ) {
        return fallbackConfig();
      }
      cached = {
        apiUrl: apiUrl || API_URL,
        wsUrl: wsUrl || apiUrl || API_URL,
      };
      return cached;
    })
    .catch(() => fallbackConfig())
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
