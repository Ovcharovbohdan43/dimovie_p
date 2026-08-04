import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse as parseHtml } from 'node-html-parser';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import {
  normalizeCatalogInfo,
  type CatalogEpisode,
  type CatalogInfo,
  type CatalogSeason,
  type CatalogStreamResult,
  type CatalogTranslation,
} from '@dimovie/shared';
import { parseEpisodeFromRezkaUrl } from './catalog.util';

type QualityMap = Record<string, string>;

@Injectable()
export class RezkaService implements OnModuleDestroy {
  private readonly logger = new Logger(RezkaService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  /** Serialize Playwright work — concurrent Chromium contexts OOM small Railway boxes. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy() {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
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
    const singleProcess =
      this.config.get<string>('PLAYWRIGHT_SINGLE_PROCESS', 'true') !== 'false';

    return [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--mute-audio',
      '--no-first-run',
      '--js-flags=--max-old-space-size=192',
      ...(singleProcess ? ['--single-process', '--no-zygote'] : []),
    ];
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (this.launching) return this.launching;

    this.launching = chromium
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
        });
        this.logger.log('Playwright Chromium ready');
        return browser;
      })
      .catch((err: unknown) => {
        this.browser = null;
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.error(`Playwright launch failed: ${detail}`);
        throw new ServiceUnavailableException(
          'Catalog loader is starting up. Wait about a minute and try again — if it keeps failing, contact support.',
        );
      })
      .finally(() => {
        this.launching = null;
      });

    return this.launching;
  }

  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      let browser: Browser;
      try {
        browser = await this.getBrowser();
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        throw new ServiceUnavailableException(
          'Catalog loader is starting up. Wait about a minute and try again — if it keeps failing, contact support.',
        );
      }

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'ru-RU',
        viewport: { width: 1280, height: 720 },
        javaScriptEnabled: true,
      });

      const page = await context.newPage();
      try {
        return await fn(page);
      } finally {
        await context.close().catch(() => undefined);
      }
    });
  }

  private async withCatalogContext<T>(
    catalogUrl: string,
    fn: (args: { page: Page; html: string; origin: string }) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.withPage(async (page) => {
        await page.goto(catalogUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45_000,
        });
        await page
          .waitForSelector('#user-favorites-holder', { timeout: 20_000 })
          .catch(() => undefined);

        const html = await page.content();
        const origin = new URL(catalogUrl).origin;
        return fn({ page, html, origin });
      });
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Catalog fetch failed for ${catalogUrl}: ${detail}`);
      throw new ServiceUnavailableException(
        'Could not load this catalog page right now. Check the link and try again in a moment.',
      );
    }
  }

  private decodeStreamUrls(raw: string): QualityMap {
    const trash =
      '$$#!@$%^&*()_+|~=`{}[]:;<>?,./№'.split('').concat(['\\', '"', "'"]);
    let cleaned = raw.trim().replace('#h', '').split('//_//').join('');
    for (const t of trash) cleaned = cleaned.split(t).join('');
    const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
    const map: QualityMap = {};
    for (const part of decoded.split(',')) {
      const match = part.match(/\[([^\]]+)](.+)/);
      if (!match) continue;
      const quality = match[1]!.trim();
      const urls = match[2]!.split(' or ').map((u) => u.trim());
      const mp4 = urls.find((u) => u.includes('.mp4')) ?? urls[0];
      if (mp4) map[quality] = mp4;
    }
    return map;
  }

  private pickBestQuality(map: QualityMap): {
    quality: string;
    url: string;
  } | null {
    const preferred = ['1080p', '720p', '480p', '360p', '240p'];
    for (const q of preferred) {
      if (map[q]) return { quality: q, url: map[q]! };
    }
    const first = Object.entries(map)[0];
    return first ? { quality: first[0], url: first[1] } : null;
  }

  private parseTranslations(root: ReturnType<typeof parseHtml>): CatalogTranslation[] {
    const list = root.querySelector('#translators-list');
    if (!list) return [];
    return list.querySelectorAll('[data-translator_id]').map((el) => ({
      id: el.getAttribute('data-translator_id') ?? '',
      title: el.text.trim() || 'Default',
      premium: el.getAttribute('data-premium') === '1',
    }));
  }

  private normalizeUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new NotFoundException('Invalid catalog URL');
    }

    const host = parsed.hostname.replace(/^www\./, '');
    const allowed = (this.config.get<string>('REZKA_ALLOWED_HOSTS') ?? '')
      .split(',')
      .map((h) => h.trim().replace(/^www\./, ''))
      .filter(Boolean);

    if (allowed.length && !allowed.includes(host)) {
      throw new NotFoundException('Catalog host is not allowed');
    }
    if (!allowed.length && !host.includes('rezka') && !host.includes('hdrezka')) {
      throw new NotFoundException('Only Rezka catalog links are supported');
    }

    if (parsed.protocol !== 'https:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  }

  async parseCatalog(url: string): Promise<CatalogInfo> {
    const catalogUrl = this.normalizeUrl(url);
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

  async resolveStream(input: {
    catalogUrl: string;
    translationId: string;
    season?: string;
    episode?: string;
  }): Promise<CatalogStreamResult> {
    const catalogUrl = this.normalizeUrl(input.catalogUrl);

    return this.withCatalogContext(catalogUrl, async ({ page, html, origin }) => {
      const info = this.parseCatalogHtml(catalogUrl, origin, html);
      const translation = info.translations.find(
        (t) => t.id === input.translationId,
      );
      if (!translation) throw new NotFoundException('Voice track not found');

      let seasonId = input.season;
      let episodeId = input.episode;
      let seasonNumber: number | undefined;
      let episodeNumber: number | undefined;

      if (info.kind === 'series') {
        const season =
          info.seasons?.find((s) => s.id === seasonId) ??
          info.seasons?.find((s) => s.id === info.defaults?.seasonId) ??
          info.seasons?.[0];
        if (!season) throw new NotFoundException('Season not found');
        seasonId = season.id;
        seasonNumber = season.number;

        const episodes = info.episodesBySeason?.[season.id] ?? [];
        const episode =
          episodes.find((e) => e.episodeId === episodeId) ??
          episodes.find((e) => e.episodeId === info.defaults?.episodeId) ??
          episodes[0];
        if (!episode) throw new NotFoundException('Episode not found');
        episodeId = episode.episodeId;
        episodeNumber = episode.number;
      }

      const soft = this.config.get<string>('REZKA_SOFT_TOKEN', 'soft');
      const body: Record<string, string> = {
        id: info.postId,
        translator_id: translation.id,
        action: info.kind === 'series' ? 'get_stream' : 'get_movie',
      };
      if (info.kind === 'series' && seasonId && episodeId) {
        body.season = seasonId;
        body.episode = episodeId;
      }

      const ajaxUrl = `${origin}/ajax/get_cdn_series/?t=${Date.now()}`;
      const result = await page.evaluate(
        async ({ ajaxUrl: url, softToken, payload }) => {
          const form = new URLSearchParams(payload);
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: location.href,
            },
            body: `${softToken}=1&${form.toString()}`,
            credentials: 'include',
          });
          return res.json();
        },
        { ajaxUrl, softToken: soft, payload: body },
      );

      if (!result?.success || !result?.url) {
        throw new NotFoundException('Stream unavailable for this selection');
      }

      const qualities = this.decodeStreamUrls(String(result.url));
      const best = this.pickBestQuality(qualities);
      if (!best) throw new NotFoundException('No playable qualities found');

      const proxyBase = this.config.get<string>('PUBLIC_API_URL');
      const proxiedUrl = proxyBase
        ? `${proxyBase.replace(/\/$/, '')}/catalog/proxy?url=${encodeURIComponent(best.url)}`
        : best.url;

      return {
        provider: 'rezka' as const,
        title: info.title,
        thumbnail: info.thumbnail,
        streamUrl: proxiedUrl,
        quality: best.quality,
        qualities,
        translationId: translation.id,
        translationTitle: translation.title,
        seasonId,
        episodeId,
        seasonNumber,
        episodeNumber,
        kind: info.kind,
      };
    });
  }
}
