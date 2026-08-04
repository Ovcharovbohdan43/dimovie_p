import { NextResponse } from "next/server";

function normalizeApiUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace("://localhost", "://127.0.0.1").replace(/\/+$/, "");
}

/**
 * Runtime API/WS URL for the browser.
 * Reads Railway env at request time so sockets still work even if the
 * NEXT_PUBLIC_* value was missing/wrong at Docker build.
 */
export async function GET() {
  // Public URL only — browsers cannot reach Railway private networking.
  const apiUrl = normalizeApiUrl(
    process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "",
  );

  return NextResponse.json(
    {
      apiUrl,
      wsUrl: normalizeApiUrl(
        process.env.NEXT_PUBLIC_WS_URL || apiUrl,
      ),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
