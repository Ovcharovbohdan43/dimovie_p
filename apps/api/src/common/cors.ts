import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Product / known deploy hosts always accepted (custom domains + PaaS). */
const TRUSTED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'dimovie.pro',
  'www.dimovie.pro',
  'dimovie.app',
  'www.dimovie.app',
]);

const TRUSTED_HOST_SUFFIXES = [
  '.up.railway.app',
  '.railway.app',
  '.vercel.app',
];

/** Static allow-list from CORS_ORIGIN (trimmed). */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

function expandOriginVariants(origin: string): string[] {
  const normalized = origin.trim().replace(/\/+$/, '');
  if (!normalized) return [];
  const out = new Set([normalized]);
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    const altHost = host.startsWith('www.')
      ? host.slice(4)
      : `www.${host}`;
    out.add(`${u.protocol}//${altHost}`);
  } catch {
    // ignore invalid entries from env
  }
  return [...out];
}

function collectAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  for (const o of getCorsOrigins()) {
    for (const v of expandOriginVariants(o)) allowed.add(v);
  }
  const frontend = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');
  if (frontend) {
    for (const v of expandOriginVariants(frontend)) allowed.add(v);
  }
  // Explicit product URLs so login works even if Railway env still points at *.railway.app
  for (const base of ['https://dimovie.pro', 'https://dimovie.app']) {
    for (const v of expandOriginVariants(base)) allowed.add(v);
  }
  return allowed;
}

function isTrustedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (TRUSTED_HOSTS.has(host)) return true;
  return TRUSTED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Reflect browser Origin when it is allow-listed or a known deploy host. */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = collectAllowedOrigins();
  if (allowed.has('*') || allowed.has(normalized)) return true;

  try {
    return isTrustedHost(new URL(normalized).hostname);
  } catch {
    return false;
  }
}

export function getCorsOptions(): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isCorsOriginAllowed(origin));
    },
    credentials: true,
  };
}
