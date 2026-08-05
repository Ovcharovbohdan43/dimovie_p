import { Logger } from '@nestjs/common';
import { ProxyAgent, fetch as undiciFetch, type RequestInit } from 'undici';

const logger = new Logger('RezkaProxy');

export type RezkaProxyConfig = {
  /** e.g. http://p.webshare.io:80 */
  server: string;
  username?: string;
  password?: string;
};

/**
 * Parse REZKA_HTTP_PROXY / HTTP(S)_PROXY style URLs:
 *   http://user:pass@host:port
 *   http://host:port
 * Or split env:
 *   REZKA_PROXY_SERVER + REZKA_PROXY_USERNAME + REZKA_PROXY_PASSWORD
 */
export function loadRezkaProxyConfig(): RezkaProxyConfig | null {
  const fromUrl =
    process.env.REZKA_HTTP_PROXY?.trim() ||
    process.env.REZKA_PROXY_URL?.trim() ||
    '';
  if (fromUrl) {
    try {
      const parsed = new URL(fromUrl);
      const port =
        parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
      // Keep explicit port — Playwright/undici are picky about omitted :80.
      const server = `${parsed.protocol}//${parsed.hostname}:${port}`;
      const username = decodeURIComponent(parsed.username || '');
      const password = decodeURIComponent(parsed.password || '');
      return {
        server,
        username: username || undefined,
        password: password || undefined,
      };
    } catch {
      logger.warn(`Invalid REZKA_HTTP_PROXY URL: ${fromUrl}`);
    }
  }

  const server = process.env.REZKA_PROXY_SERVER?.trim();
  if (!server) return null;
  const withProto = server.includes('://') ? server : `http://${server}`;
  try {
    const parsed = new URL(withProto);
    const port =
      parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return {
      server: `${parsed.protocol}//${parsed.hostname}:${port}`,
      username: process.env.REZKA_PROXY_USERNAME?.trim() || undefined,
      password: process.env.REZKA_PROXY_PASSWORD?.trim() || undefined,
    };
  } catch {
    return {
      server: withProto,
      username: process.env.REZKA_PROXY_USERNAME?.trim() || undefined,
      password: process.env.REZKA_PROXY_PASSWORD?.trim() || undefined,
    };
  }
}

/** Append -rotate (or keep sticky session id) for Webshare backbone usernames. */
export function withRotatedUsername(
  username: string | undefined,
  rotate: boolean,
): string | undefined {
  if (!username) return username;
  if (!rotate) return username;
  if (/(?:^|-)rotate$/i.test(username)) return username;
  // Replace trailing sticky numeric slot: user-1 → user-rotate
  if (/-\d+$/.test(username)) {
    return username.replace(/-\d+$/, '-rotate');
  }
  return `${username}-rotate`;
}

export class RezkaProxyPool {
  private readonly base: RezkaProxyConfig | null;
  private readonly rotate: boolean;
  private agent: ProxyAgent | null = null;
  private agentKey = '';
  /** After tunnel failures, skip proxy until process restart (direct Anubis still works). */
  private bypass = false;

  constructor(config: RezkaProxyConfig | null = loadRezkaProxyConfig()) {
    this.base = config;
    this.rotate =
      (process.env.REZKA_PROXY_ROTATE ?? 'true').toLowerCase() !== 'false';
    if (this.base) {
      const user = withRotatedUsername(this.base.username, this.rotate);
      logger.log(
        `Rezka outbound proxy enabled server=${this.base.server} user=${user ? `${user.slice(0, 4)}…` : '(none)'} rotate=${this.rotate}`,
      );
    }
  }

  get enabled(): boolean {
    return !!this.base && !this.bypass;
  }

  markBroken(reason: string): void {
    if (!this.base || this.bypass) return;
    this.bypass = true;
    logger.warn(
      `Rezka proxy disabled for this process (${reason}); falling back to direct`,
    );
    void this.agent?.close().catch(() => undefined);
    this.agent = null;
  }

  /** Playwright / Chromium proxy option (undefined when bypassed). */
  playwrightProxy():
    | { server: string; username?: string; password?: string }
    | undefined {
    if (!this.enabled || !this.base) return undefined;
    return {
      server: this.base.server,
      username: withRotatedUsername(this.base.username, this.rotate),
      password: this.base.password,
    };
  }

  private getAgent(): ProxyAgent | undefined {
    if (!this.enabled || !this.base) return undefined;
    const username = withRotatedUsername(this.base.username, this.rotate);
    const key = `${this.base.server}|${username ?? ''}|${this.base.password ?? ''}`;
    if (!this.agent || this.agentKey !== key) {
      void this.agent?.close().catch(() => undefined);
      const uri =
        username && this.base.password
          ? `${this.base.server.replace(/\/$/, '')}`.replace(
              '://',
              `://${encodeURIComponent(username)}:${encodeURIComponent(this.base.password)}@`,
            )
          : this.base.server;
      this.agent = new ProxyAgent(uri);
      this.agentKey = key;
    }
    return this.agent;
  }

  async fetch(url: string, init: RequestInit = {}) {
    const dispatcher = this.getAgent();
    if (!dispatcher) {
      return undiciFetch(url, init);
    }
    try {
      return await undiciFetch(url, { ...init, dispatcher });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.markBroken(message);
      return undiciFetch(url, init);
    }
  }
}
