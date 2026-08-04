import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Static allow-list from CORS_ORIGIN (trimmed). */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

function isTrustedHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.up.railway.app') ||
    hostname.endsWith('.railway.app') ||
    hostname.endsWith('.vercel.app')
  );
}

/** Reflect browser Origin when it is allow-listed or a known deploy host. */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = getCorsOrigins();
  if (allowed.includes('*') || allowed.includes(normalized)) return true;

  const frontend = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');
  if (frontend && normalized === frontend) return true;

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
