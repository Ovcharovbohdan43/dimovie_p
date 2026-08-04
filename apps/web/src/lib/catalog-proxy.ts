function normalizeApiUrl(raw: string): string {
  let url = raw.trim();
  if (!url) {
    throw new Error("API URL is not configured on the web service");
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace("://localhost", "://127.0.0.1").replace(/\/+$/, "");
}

function resolveBackendUrl(): string {
  return normalizeApiUrl(
    process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      "",
  );
}

/**
 * Same-origin proxy for long Rezka/Playwright calls.
 * Avoids browser CORS and Next rewrite hang-ups (ECONNRESET).
 */
export async function proxyCatalogRequest(
  req: Request,
  backendPath: string,
): Promise<Response> {
  const backend = resolveBackendUrl();
  const auth = req.headers.get("authorization");
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${backend}${backendPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body,
      signal: AbortSignal.timeout(280_000),
    });
  } catch (err) {
    const message =
      err instanceof Error && /aborted|timeout/i.test(err.message)
        ? "Catalog request timed out. The API may be out of memory — try again."
        : err instanceof Error
          ? err.message
          : "Catalog proxy failed";
    return Response.json({ message }, { status: 503 });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
