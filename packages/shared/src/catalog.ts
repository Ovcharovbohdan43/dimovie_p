export const REZKA_HOST_PATTERN =
  /^(?:www\.)?(?:[\w-]+\.)?(?:hdrezka\.[\w.]+|rezka[\w-]*\.[\w.]+)$/i;

export interface CatalogTranslation {
  id: string;
  title: string;
}

export interface CatalogSeason {
  id: string;
  title: string;
  number: number;
}

export interface CatalogEpisode {
  id: string;
  episodeId: string;
  title: string;
  number: number;
}

export interface CatalogInfo {
  provider: "rezka";
  catalogUrl: string;
  origin: string;
  postId: string;
  title: string;
  originalTitle?: string;
  description?: string;
  thumbnail?: string;
  kind: "movie" | "series";
  translations: CatalogTranslation[];
  seasons?: CatalogSeason[];
  episodesBySeason?: Record<string, CatalogEpisode[]>;
  defaults?: {
    seasonId?: string;
    seasonNumber?: number;
    episodeId?: string;
    episodeNumber?: number;
  };
}

export interface CatalogStreamRequest {
  catalogUrl: string;
  translationId: string;
  season?: string;
  episode?: string;
  /** From parse — lets stream skip a second full page scrape. */
  postId?: string;
  kind?: "movie" | "series";
  title?: string;
}

export interface CatalogStreamResult {
  streamUrl: string;
  quality: string;
  qualities: Record<string, string>;
  title: string;
  season?: string;
  episode?: string;
  translationId: string;
}

export function normalizeCatalogTranslations(
  translations: CatalogTranslation[],
): CatalogTranslation[] {
  const seen = new Set<string>();
  const result: CatalogTranslation[] = [];

  for (const item of translations) {
    const id = item.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, title: item.title.trim() });
  }

  return result;
}

export function normalizeCatalogInfo(info: CatalogInfo): CatalogInfo {
  const translations = normalizeCatalogTranslations(info.translations);

  let seasons = info.seasons;
  let episodesBySeason = info.episodesBySeason;

  if (seasons?.length) {
    const seenSeasons = new Set<string>();
    seasons = seasons.filter((s) => {
      const id = s.id?.trim();
      if (!id || seenSeasons.has(id)) return false;
      seenSeasons.add(id);
      return true;
    });

    if (episodesBySeason) {
      const normalized: Record<string, CatalogEpisode[]> = {};
      for (const season of seasons) {
        const seenEpisodes = new Set<string>();
        const episodes = (episodesBySeason[season.id] ?? []).filter((ep) => {
          const episodeId = ep.episodeId?.trim();
          if (!episodeId || seenEpisodes.has(episodeId)) return false;
          seenEpisodes.add(episodeId);
          return true;
        });
        if (episodes.length) normalized[season.id] = episodes;
      }
      episodesBySeason = normalized;
    }
  }

  return {
    ...info,
    translations,
    seasons,
    episodesBySeason,
  };
}

export function isRezkaHost(hostname: string): boolean {
  return REZKA_HOST_PATTERN.test(hostname.replace(/^www\./, ""));
}

export function parseEpisodeFromRezkaUrl(url: string): {
  seasonNumber?: number;
  episodeNumber?: number;
} {
  const match = url.match(/(\d+)-season\/(\d+)-episode\.html/i);
  if (!match) return {};
  return {
    seasonNumber: Number.parseInt(match[1]!, 10),
    episodeNumber: Number.parseInt(match[2]!, 10),
  };
}
