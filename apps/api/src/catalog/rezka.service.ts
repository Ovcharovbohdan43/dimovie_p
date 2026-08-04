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
    html.length < 10000
  );
}

@Injectable()
export class RezkaCatalogService implements OnModuleDestroy {
  private readonly logger = new Logger(RezkaCatalogService.name);
  private browser: Browser | null = null;
  private browserInit: Promise<Browser> | null = null;
  /** Serialize Playwright — concurrent Chromium contexts OOM small Railway boxes. */
  private chain: Promise<unknown> = Promise.resolve();

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
      this.browserInit = null;
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private launchArgs(): string[] {
    const singleProcess = process.env.PLAYWRIGHT_SINGLE_PROCESS !== 'false';
    return [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--mute-audio',
      '--no-first-run',
      '--js-flags=--max-old-space-size=192',
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

  private async withCatalogContext<T>(
    catalogUrl: string,
    fn: (ctx: {
      html: string;
      context: BrowserContext;
      origin: string;
    }) => Promise<T>,
  ): Promise<T> {
    return this.enqueue(async () => {
      const origin = this.resolveOrigin(catalogUrl);
      let browser: Browser;
      try {
        browser = await this.getBrowser();
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        throw new ServiceUnavailableException(
          'Catalog parsing is temporarily unavailable. Try again in a moment, or paste a YouTube / Vimeo link instead.',
        );
      }

      const context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: 'ru-RU',
        viewport: { width: 1280, height: 720 },
      });

      try {
        const page = await context.newPage();
        await page.goto(catalogUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        try {
          await page.waitForSelector('#user-favorites-holder, .b-post__title', {
            state: 'attached',
            timeout: 45000,
          });
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
        return await fn({ html, context, origin });
      } catch (err) {
        if (
          err instanceof NotFoundException ||
          err instanceof BadRequestException ||
          err instanceof ServiceUnavailableException
        ) {
          throw err;
        }
        this.logger.error(
          `Catalog fetch failed for ${catalogUrl}: ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(
          'Could not load this catalog page right now. Check the link and try again in a moment.',
        );
      } finally {
        await context.close().catch(() => undefined);
      }
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
    const parsed = new URL(url.trim());
    if (!parsed.pathname.endsWith('.html')) {
      throw new BadRequestException('Link must point to an .html page');
    }
    return parsed.toString();
  }

  async parseCatalog(url: string): Promise<CatalogInfo> {
    const catalogUrl = this.normalizeUrl(url);
    this.logger.log(`parseCatalog start: ${catalogUrl}`);
    return this.withCatalogContext(catalogUrl, ({ html, origin }) =>
      Promise.resolve(this.parseCatalogHtml(catalogUrl, origin, html)),
    );
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
  ): Promise<CatalogStreamResult> {
    const normalized = this.normalizeUrl(catalogUrl);

    return this.withCatalogContext(normalized, async ({ html, context, origin }) => {
      const info = this.parseCatalogHtml(normalized, origin, html);

      const payload: Record<string, string> = {
        id: info.postId,
        translator_id: translationId,
      };

      if (info.kind === 'series') {
        if (!season || !episode) {
          throw new BadRequestException('Season and episode required for series');
        }
        payload.season = season;
        payload.episode = episode;
        payload.action = 'get_stream';
      } else {
        payload.action = 'get_movie';
      }

      const response = await context.request.post(
        `${origin}/ajax/get_cdn_series/`,
        {
          form: payload,
          headers: {
            Referer: normalized,
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 20000,
        },
      );

      if (!response.ok()) {
        throw new NotFoundException('Stream not available for this selection');
      }

      const data = (await response.json()) as { url?: string };
      const encoded = data?.url;
      if (!encoded) {
        throw new NotFoundException('Stream not available for this selection');
      }

      const qualities = parseQualities(encoded);
      const best = pickBestQuality(qualities);

      const proxiedUrl = `/backend/catalog/proxy?url=${encodeURIComponent(best.url)}&origin=${encodeURIComponent(origin)}`;

      return {
        streamUrl: proxiedUrl,
        quality: best.quality,
        qualities,
        title: info.title,
        season,
        episode,
        translationId,
      };
    });
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
