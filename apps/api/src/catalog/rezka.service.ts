import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'stream';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { parse as parseHtml } from 'node-html-parser';
import type {
  CatalogEpisode,
  CatalogInfo,
  CatalogSeason,
  CatalogStreamResult,
  CatalogTranslation,
} from '@dimovie/shared';
import {
  isRezkaHost,
  normalizeCatalogInfo,
  parseEpisodeFromRezkaUrl,
} from '@dimovie/shared';

const TRASH = ['@', '#', '!', '^', '$'];
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function product(iterables: string[], repeat: number): string[][] {
  const copies: string[][] = [];
  for (let i = 0; i < repeat; i++) {
    copies.push([...iterables]);
  }
  return copies.reduce<string[][]>((acc, value) => {
    const tmp: string[][] = [];
    acc.forEach((a0) => {
      value.forEach((a1) => {
        tmp.push(a0.concat(a1));
      });
    });
    return tmp;
  }, [[]]);
}

function decodeStreamPayload(data: string): string {
  let decoded = data.replace('#h', '').split('//_//').join('');
  for (let i = 2; i < 4; i++) {
    const combos = product(TRASH, i);
    for (const combo of combos) {
      const encoded = Buffer.from(combo.join(''), 'utf8').toString('base64');
      if (decoded.includes(encoded)) {
        decoded = decoded.replaceAll(encoded, '');
      }
    }
  }
  decoded += '==';
  return Buffer.from(decoded, 'base64').toString('utf8');
}

function normalizeQualityLabel(label: string): string {
  const cleaned = label.replace(/<[^>]+>/g, '').trim();
  if (/1080/i.test(cleaned)) return '1080p';
  if (/720/i.test(cleaned)) return '720p';
  if (/480/i.test(cleaned)) return '480p';
  if (/360/i.test(cleaned)) return '360p';
  if (/240/i.test(cleaned)) return '240p';
  return cleaned;
}

function parseStreamUrlField(raw: string): Record<string, string> {
  let text = raw.trim();
  if (!text.includes('http')) {
    text = decodeStreamPayload(text);
  }

  const urls: Record<string, string> = {};
  const parts = text.split(/,(?=\[)/);

  for (const part of parts) {
    const match = part.match(/\[([^\]]+)\](https?:\/\/[^\s,]+)/);
    if (!match) continue;

    const quality = normalizeQualityLabel(match[1]!);
    let url = match[2]!;
    if (url.includes(':hls:')) {
      url = url.split(':hls:')[0]!;
    }
    if (!urls[quality]) {
      urls[quality] = url;
    }
  }

  return urls;
}

function parseQualities(text: string): Record<string, string> {
  if (text.includes('[') && text.includes('http')) {
    return parseStreamUrlField(text);
  }

  const urls: Record<string, string> = {};
  for (const part of text.split(',')) {
    const quality = part.split(']')[0]?.replace('[', '') ?? 'auto';
    const pieces = part.split(' ');
    const url = pieces[pieces.length - 1];
    if (url?.startsWith('http')) urls[normalizeQualityLabel(quality)] = url.trim();
  }
  return urls;
}

function pickBestQuality(qualities: Record<string, string>): {
  quality: string;
  url: string;
} {
  const order = ['1080p', '720p', '480p', '360p', '240p'];
  for (const q of order) {
    if (qualities[q]) return { quality: q, url: qualities[q]! };
  }
  const first = Object.entries(qualities)[0];
  if (!first) throw new BadRequestException('No stream qualities found');
  return { quality: first[0], url: first[1] };
}

function isBotChallengeHtml(html: string): boolean {
  return (
    html.includes('anubis_challenge') ||
    html.includes('╨╜╨╡ ╨▒╨╛╤é') ||
    (html.length < 8000 && !html.includes('user-favorites-holder'))
  );
}

function looksLikeCatalogHtml(html: string): boolean {
  return (
    html.includes('user-favorites-holder') || html.includes('b-post__title')
  );
}

function isBrowserClosedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /has been closed|Target page|browser has been closed|Browser closed|disconnected/i.test(
    message,
  );
}

type CatalogRequestContext = {
  html: string;
  origin: string;
  cookieHeader: string;
  postAjax: (
    path: string,
    form: Record<string, string>,
    referer: string,
  ) => Promise<unknown>;
};

type CatalogSession = {
  origin: string;
  postId: string;
  kind: 'movie' | 'series';
  title: string;
  cookieHeader: string;
  expiresAt: number;
};

const SESSION_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class RezkaCatalogService implements OnModuleDestroy {
  private readonly logger = new Logger(RezkaCatalogService.name);
  private browser: Browser | null = null;
  private browserInit: Promise<Browser> | null = null;
  /** Serialize heavy catalog work — concurrent Chromium contexts OOM small boxes. */
  private chain: Promise<unknown> = Promise.resolve();
  /** Cookies + postId from a recent parse so stream can skip Chromium. */
  private readonly sessions = new Map<string, CatalogSession>();

  async onModuleDestroy() {
    await this.resetBrowser();
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private rememberSession(
    catalogUrl: string,
    session: Omit<CatalogSession, 'expiresAt'>,
  ): void {
    this.sessions.set(catalogUrl, {
      ...session,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  }

  private getSession(catalogUrl: string): CatalogSession | null {
    const cached = this.sessions.get(catalogUrl);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      this.sessions.delete(catalogUrl);
      return null;
    }
    return cached;
  }

  private cookieHeaderFromSetCookie(setCookies: string[]): string {
    return setCookies
      .map((c) => c.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ');
  }

  private async postAjaxFetch(
    origin: string,
    path: string,
    form: Record<string, string>,
    referer: string,
    cookieHeader: string,
  ): Promise<unknown> {
    const response = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: referer,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      throw new NotFoundException('Stream not available for this selection');
    }
    return response.json();
  }

  private buildStreamPayload(
    postId: string,
    translationId: string,
    kind: 'movie' | 'series',
    season?: string,
    episode?: string,
  ): Record<string, string> {
    const payload: Record<string, string> = {
      id: postId,
      translator_id: translationId,
    };
    if (kind === 'series') {
      if (!season || !episode) {
        throw new BadRequestException('Season and episode required for series');
      }
      payload.season = season;
      payload.episode = episode;
      payload.action = 'get_stream';
    } else {
      payload.action = 'get_movie';
    }
    return payload;
  }

  private toStreamResult(
    encoded: string,
    origin: string,
    title: string,
    translationId: string,
    season?: string,
    episode?: string,
  ): CatalogStreamResult {
    const qualities = parseQualities(encoded);
    const best = pickBestQuality(qualities);
    const proxiedUrl = `/backend/catalog/proxy?url=${encodeURIComponent(best.url)}&origin=${encodeURIComponent(origin)}`;
    return {
      streamUrl: proxiedUrl,
      quality: best.quality,
      qualities,
      title,
      season,
      episode,
      translationId,
    };
  }

  private async resetBrowser(): Promise<void> {
    const current = this.browser;
    this.browser = null;
    this.browserInit = null;
    if (current) {
      await current.close().catch(() => undefined);
    }
  }

  private launchArgs(): string[] {
    // --single-process crashes Chromium on Railway under load; opt-in only.
    const singleProcess = process.env.PLAYWRIGHT_SINGLE_PROCESS === 'true';
    const heapMb = Number.parseInt(
      process.env.PLAYWRIGHT_JS_HEAP_MB ?? '256',
      10,
    );
    return [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--mute-audio',
      '--no-first-run',
      `--js-flags=--max-old-space-size=${Number.isFinite(heapMb) ? heapMb : 256}`,
      ...(singleProcess ? ['--single-process', '--no-zygote'] : []),
    ];
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (!this.browserInit) {
      this.browserInit = chromium
        .launch({
          headless: true,
          args: this.launchArgs(),
          chromiumSandbox: false,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        })
        .then((browser) => {
          this.browser = browser;
          browser.on('disconnected', () => {
            this.logger.warn('Playwright browser disconnected');
            this.browser = null;
            this.browserInit = null;
          });
          this.logger.log('Playwright Chromium ready');
          return browser;
        })
        .catch((err) => {
          this.browserInit = null;
          this.logger.error(
            `Playwright launch failed: ${err instanceof Error ? err.message : err}`,
          );
          throw new ServiceUnavailableException(
            'Catalog parsing is temporarily unavailable. Try again in a moment, or paste a YouTube / Vimeo link instead.',
          );
        });
    }
    this.browser = await this.browserInit;
    return this.browser;
  }

  /** Prefer plain HTTP — avoids Chromium OOM on small Railway instances. */
  private async fetchHtmlLight(
    catalogUrl: string,
  ): Promise<{ html: string; cookieHeader: string } | null> {
    try {
      const response = await fetch(catalogUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Light catalog fetch HTTP ${response.status} for ${catalogUrl}`,
        );
        return null;
      }

      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [];
      const cookieHeader = this.cookieHeaderFromSetCookie(cookies);
      const html = await response.text();
      if (isBotChallengeHtml(html) || !looksLikeCatalogHtml(html)) {
        this.logger.log(
          `Light catalog fetch needs browser fallback for ${catalogUrl}`,
        );
        return null;
      }

      this.logger.log(`Light catalog fetch ok for ${catalogUrl}`);
      return { html, cookieHeader };
    } catch (err) {
      this.logger.warn(
        `Light catalog fetch failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Warm cookies even when the HTML is a bot challenge (ajax may still work). */
  private async fetchCookiesLight(catalogUrl: string): Promise<string> {
    try {
      const response = await fetch(catalogUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      const cookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [];
      return this.cookieHeaderFromSetCookie(cookies);
    } catch {
      return '';
    }
  }

  private async withPlaywrightContext<T>(
    catalogUrl: string,
    origin: string,
    fn: (ctx: CatalogRequestContext) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      let context: BrowserContext | null = null;
      try {
        if (attempt > 1) {
          this.logger.warn(
            `Retrying Playwright catalog load (attempt ${attempt})`,
          );
          await this.resetBrowser();
        }

        const browser = await this.getBrowser();
        context = await browser.newContext({
          userAgent: USER_AGENT,
          locale: 'ru-RU',
          viewport: { width: 1024, height: 720 },
        });

        const page = await context.newPage();
        try {
          await page.goto(catalogUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
          });

          try {
            await page.waitForSelector(
              '#user-favorites-holder, .b-post__title',
              {
                state: 'attached',
                timeout: 30000,
              },
            );
          } catch {
            const html = await page.content();
            if (isBotChallengeHtml(html)) {
              throw new NotFoundException(
                'Catalog site blocked automated access. Try again in a moment.',
              );
            }
            throw new NotFoundException('Catalog page not recognized');
          }

          const html = await page.content();
          const cookies = await context.cookies();
          const cookieHeader = cookies
            .map((c) => `${c.name}=${c.value}`)
            .join('; ');
          const requestContext = context;
          return await fn({
            html,
            origin,
            cookieHeader,
            postAjax: async (path, form, referer) => {
              const response = await requestContext.request.post(
                `${origin}${path}`,
                {
                  form,
                  headers: {
                    Referer: referer,
                    'X-Requested-With': 'XMLHttpRequest',
                  },
                  timeout: 20000,
                },
              );
              if (!response.ok()) {
                throw new NotFoundException(
                  'Stream not available for this selection',
                );
              }
              return response.json();
            },
          });
        } finally {
          await page.close().catch(() => undefined);
        }
      } catch (err) {
        lastError = err;
        if (
          err instanceof NotFoundException ||
          err instanceof BadRequestException ||
          err instanceof ServiceUnavailableException
        ) {
          throw err;
        }
        if (isBrowserClosedError(err) && attempt < 2) {
          this.logger.warn(
            `Playwright crashed mid-request, will relaunch: ${err instanceof Error ? err.message : err}`,
          );
          await this.resetBrowser();
          continue;
        }
        this.logger.error(
          `Catalog fetch failed for ${catalogUrl}: ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(
          'Could not load this catalog page right now. Check the link and try again in a moment.',
        );
      } finally {
        if (context) {
          await context.close().catch(() => undefined);
        }
      }
    }

    this.logger.error(
      `Catalog fetch failed for ${catalogUrl}: ${lastError instanceof Error ? lastError.message : lastError}`,
    );
    throw new ServiceUnavailableException(
      'Could not load this catalog page right now. Check the link and try again in a moment.',
    );
  }

  private async withCatalogContext<T>(
    catalogUrl: string,
    fn: (ctx: CatalogRequestContext) => Promise<T>,
  ): Promise<T> {
    return this.enqueue(async () => {
      const origin = this.resolveOrigin(catalogUrl);

      const light = await this.fetchHtmlLight(catalogUrl);
      if (light) {
        try {
          return await fn({
            html: light.html,
            origin,
            cookieHeader: light.cookieHeader,
            postAjax: (path, form, referer) =>
              this.postAjaxFetch(
                origin,
                path,
                form,
                referer,
                light.cookieHeader,
              ),
          });
        } catch (err) {
          if (
            err instanceof NotFoundException ||
            err instanceof BadRequestException ||
            err instanceof ServiceUnavailableException
          ) {
            throw err;
          }
          this.logger.warn(
            `Light catalog path failed, falling back to Playwright: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return this.withPlaywrightContext(catalogUrl, origin, fn);
    });
  }

  private resolveOrigin(url: string): string {
    const parsed = new URL(url);
    if (!isRezkaHost(parsed.hostname)) {
      throw new BadRequestException('This resource is not supported');
    }
    return parsed.origin;
  }

  private normalizeUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new BadRequestException('Invalid catalog URL');
    }
    if (!isRezkaHost(parsed.hostname)) {
      throw new BadRequestException('This resource is not supported');
    }

    const path = parsed.pathname;
    const isHtml = path.endsWith('.html');
    const isTitlePath =
      /^\/(films|series|cartoons|animation|shows)\//i.test(path);

    if (!isHtml && !isTitlePath) {
      throw new BadRequestException(
        'Link must point to a catalog title or episode page',
      );
    }

    return parsed.toString();
  }

  async parseCatalog(url: string): Promise<CatalogInfo> {
    const catalogUrl = this.normalizeUrl(url);
    this.logger.log(`parseCatalog start: ${catalogUrl}`);
    const info = await this.withCatalogContext(
      catalogUrl,
      ({ html, origin, cookieHeader }) => {
        const parsed = this.parseCatalogHtml(catalogUrl, origin, html);
        this.rememberSession(catalogUrl, {
          origin,
          postId: parsed.postId,
          kind: parsed.kind,
          title: parsed.title,
          cookieHeader,
        });
        return Promise.resolve(parsed);
      },
    );
    // Free Chromium RAM so the following stream resolve can stay on fetch/ajax.
    void this.resetBrowser();
    return info;
  }

  private parseCatalogHtml(
    catalogUrl: string,
    origin: string,
    html: string,
  ): CatalogInfo {
    const root = parseHtml(html);
    const postEl = root.getElementById('user-favorites-holder');
    if (!postEl) throw new NotFoundException('Catalog page not recognized');

    const postId = postEl.getAttribute('data-post_id');
    if (!postId) throw new NotFoundException('Catalog post id missing');

    const title =
      root.querySelector('.b-post__title')?.text.trim() ?? 'Watch Party';
    const originalTitle =
      root.querySelector('.b-post__origtitle')?.text.trim() || undefined;
    const description =
      root.querySelector('.b-post__description_text')?.text.trim() || undefined;
    const thumbnail =
      root.querySelector('.b-sidecover img')?.getAttribute('src') || undefined;

    const translations = this.parseTranslations(root);
    if (!translations.length) {
      throw new NotFoundException('No voice tracks found on this page');
    }

    let kind: 'movie' | 'series' = 'movie';
    let seasons: CatalogSeason[] | undefined;
    let episodesBySeason: Record<string, CatalogEpisode[]> | undefined;

    const seasonsRoot = root.getElementById('simple-seasons-tabs');
    if (seasonsRoot) {
      kind = 'series';
      seasons = seasonsRoot.querySelectorAll('a[data-tab_id]').map((a) => {
        const id = a.getAttribute('data-tab_id') ?? '';
        const titleText = a.text.trim();
        const numMatch = titleText.match(/(\d+)/);
        return {
          id,
          title: titleText,
          number: numMatch ? Number.parseInt(numMatch[1]!, 10) : 0,
        };
      });

      episodesBySeason = {};
      for (const season of seasons) {
        const list = root.getElementById(`simple-episodes-list-${season.id}`);
        if (!list) continue;
        episodesBySeason[season.id] = list
          .querySelectorAll('a[data-episode_id]')
          .map((a) => {
            const episodeId = a.getAttribute('data-episode_id') ?? '';
            const id = a.getAttribute('data-id') ?? '';
            const titleText = a.text.trim();
            const numMatch = titleText.match(/(\d+)/);
            return {
              id,
              episodeId,
              title: titleText,
              number: numMatch ? Number.parseInt(numMatch[1]!, 10) : 0,
            };
          });
      }
    }

    const fromUrl = parseEpisodeFromRezkaUrl(catalogUrl);
    let defaults: CatalogInfo['defaults'];

    if (kind === 'series' && seasons?.length) {
      const season =
        seasons.find((s) => s.number === fromUrl.seasonNumber) ?? seasons[0];
      const episodes = season ? episodesBySeason?.[season.id] : undefined;
      const episode =
        episodes?.find((e) => e.number === fromUrl.episodeNumber) ??
        episodes?.[0];

      defaults = {
        seasonId: season?.id,
        seasonNumber: season?.number,
        episodeId: episode?.episodeId,
        episodeNumber: episode?.number,
      };
    }

    return normalizeCatalogInfo({
      provider: 'rezka',
      catalogUrl,
      origin,
      postId,
      title,
      originalTitle,
      description,
      thumbnail,
      kind,
      translations,
      seasons,
      episodesBySeason,
      defaults,
    });
  }

  private parseTranslations(root: ReturnType<typeof parseHtml>): CatalogTranslation[] {
    const list = root.getElementById('translators-list');
    if (!list) return [];

    const seen = new Set<string>();
    const items: CatalogTranslation[] = [];

    for (const anchor of list.querySelectorAll('a[data-translator_id]')) {
      const id = anchor.getAttribute('data-translator_id') ?? '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        title: anchor.getAttribute('title') ?? anchor.text.trim(),
      });
    }

    return items;
  }

  async resolveStream(
    catalogUrl: string,
    translationId: string,
    season?: string,
    episode?: string,
    hints?: {
      postId?: string;
      kind?: 'movie' | 'series';
      title?: string;
    },
  ): Promise<CatalogStreamResult> {
    const normalized = this.normalizeUrl(catalogUrl);
    const origin = this.resolveOrigin(normalized);
    const cached = this.getSession(normalized);

    const postId = hints?.postId?.trim() || cached?.postId;
    const kind = hints?.kind || cached?.kind;
    const title = hints?.title?.trim() || cached?.title || 'Watch Party';

    // Fast path: client already parsed — only hit get_cdn_series (no Chromium).
    if (postId && kind) {
      this.logger.log(
        `resolveStream ajax-only postId=${postId} kind=${kind} tr=${translationId}`,
      );
      return this.enqueue(async () => {
        const payload = this.buildStreamPayload(
          postId,
          translationId,
          kind,
          season,
          episode,
        );

        let cookieHeader = cached?.cookieHeader ?? '';
        if (!cookieHeader) {
          cookieHeader = await this.fetchCookiesLight(normalized);
        }

        const tryAjax = async (cookies: string) => {
          const data = (await this.postAjaxFetch(
            origin,
            '/ajax/get_cdn_series/',
            payload,
            normalized,
            cookies,
          )) as { url?: string; success?: boolean };
          const encoded = data?.url;
          if (!encoded) {
            throw new NotFoundException(
              'Stream not available for this selection',
            );
          }
          this.rememberSession(normalized, {
            origin,
            postId,
            kind,
            title,
            cookieHeader: cookies,
          });
          this.logger.log(`resolveStream ok quality via ajax-only`);
          return this.toStreamResult(
            encoded,
            origin,
            title,
            translationId,
            season,
            episode,
          );
        };

        try {
          return await tryAjax(cookieHeader);
        } catch (err) {
          if (
            err instanceof BadRequestException ||
            err instanceof ServiceUnavailableException
          ) {
            throw err;
          }
          this.logger.warn(
            `Ajax-only stream failed, warming via Playwright: ${err instanceof Error ? err.message : err}`,
          );
        }

        // Last resort: open page once for cookies + ajax (still no re-parse needed).
        return this.withPlaywrightContext(
          normalized,
          origin,
          async ({ cookieHeader: pwCookies, postAjax }) => {
            const data = (await postAjax(
              '/ajax/get_cdn_series/',
              payload,
              normalized,
            )) as { url?: string };
            const encoded = data?.url;
            if (!encoded) {
              throw new NotFoundException(
                'Stream not available for this selection',
              );
            }
            this.rememberSession(normalized, {
              origin,
              postId,
              kind,
              title,
              cookieHeader: pwCookies,
            });
            void this.resetBrowser();
            this.logger.log(`resolveStream ok via Playwright ajax`);
            return this.toStreamResult(
              encoded,
              origin,
              title,
              translationId,
              season,
              episode,
            );
          },
        );
      });
    }

    this.logger.log(`resolveStream full-page fallback (no postId)`);
    return this.withCatalogContext(
      normalized,
      async ({ html, origin: pageOrigin, cookieHeader, postAjax }) => {
        const info = this.parseCatalogHtml(normalized, pageOrigin, html);
        this.rememberSession(normalized, {
          origin: pageOrigin,
          postId: info.postId,
          kind: info.kind,
          title: info.title,
          cookieHeader,
        });

        const payload = this.buildStreamPayload(
          info.postId,
          translationId,
          info.kind,
          season,
          episode,
        );

        const data = (await postAjax(
          '/ajax/get_cdn_series/',
          payload,
          normalized,
        )) as { url?: string };
        const encoded = data?.url;
        if (!encoded) {
          throw new NotFoundException('Stream not available for this selection');
        }

        void this.resetBrowser();
        return this.toStreamResult(
          encoded,
          pageOrigin,
          info.title,
          translationId,
          season,
          episode,
        );
      },
    );
  }

  async proxyStream(
    targetUrl: string,
    origin: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    if (!targetUrl.startsWith('http')) {
      throw new BadRequestException('Invalid stream URL');
    }

    const headers: Record<string, string> = {
      Referer: `${origin}/`,
      'User-Agent': USER_AGENT,
    };
    const range = req.headers.range;
    if (typeof range === 'string') {
      headers['Range'] = range;
    }

    const upstream = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      throw new NotFoundException(`Stream proxy failed (${upstream.status})`);
    }

    res.status(upstream.status);

    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
    ]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    if (!res.getHeader('content-type')) {
      res.setHeader('Content-Type', 'video/mp4');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Accept-Ranges, Content-Length',
    );

    if (!upstream.body) {
      throw new NotFoundException('Empty stream body');
    }

    const stream = Readable.fromWeb(
      upstream.body as import('stream/web').ReadableStream,
    );

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  }
}
