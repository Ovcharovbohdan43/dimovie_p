"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { CatalogInfo, CatalogStreamResult, RoomSummary } from "@dimovie/shared";
import { normalizeCatalogInfo } from "@dimovie/shared";
import { api } from "@/lib/api";
import { toUserMessage } from "@/lib/user-message";
import { parseVideoUrl } from "@/lib/video-url";
import { blurSelectOnChange, catalogSelectClassName } from "@/lib/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PlayMark } from "@/components/home/marks";

interface RoomCatalogSetupProps {
  roomId: string;
  onSuccess: (room: RoomSummary) => void;
}

export function RoomCatalogSetup({ roomId, onSuccess }: RoomCatalogSetupProps) {
  const [url, setUrl] = useState("");
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [translationId, setTranslationId] = useState("");

  const parseCatalog = useMutation({
    mutationFn: (catalogUrl: string) =>
      api<CatalogInfo>("/api/catalog/rezka/parse", {
        method: "POST",
        body: JSON.stringify({ url: catalogUrl }),
      }),
    onSuccess: (data) => {
      setLoadError(null);
      const normalized = normalizeCatalogInfo(data);
      setCatalog(normalized);
      setTranslationId(normalized.translations[0]?.id ?? "");
      if (normalized.kind === "series" && normalized.seasons?.length) {
        const season =
          normalized.seasons.find((s) => s.id === normalized.defaults?.seasonId) ??
          normalized.seasons[0]!;
        setSeasonId(season.id);
        const episodes = normalized.episodesBySeason?.[season.id] ?? [];
        const episode =
          episodes.find((e) => e.episodeId === normalized.defaults?.episodeId) ??
          episodes[0];
        setEpisodeId(episode?.episodeId ?? "");
      }
    },
  });

  const episodes = useMemo(() => {
    if (!catalog || !seasonId) return [];
    return catalog.episodesBySeason?.[seasonId] ?? [];
  }, [catalog, seasonId]);

  useEffect(() => {
    if (episodes.length && !episodes.some((e) => e.episodeId === episodeId)) {
      setEpisodeId(episodes[0]?.episodeId ?? "");
    }
  }, [episodes, episodeId]);

  const startWatching = useMutation({
    mutationFn: async () => {
      if (!catalog) throw new Error("Catalog not loaded");

      const stream = await api<CatalogStreamResult>("/api/catalog/rezka/stream", {
        method: "POST",
        body: JSON.stringify({
          catalogUrl: catalog.catalogUrl,
          translationId,
          ...(catalog.kind === "series"
            ? { season: seasonId, episode: episodeId }
            : {}),
        }),
      });

      const translation = catalog.translations.find((t) => t.id === translationId);
      const season = catalog.seasons?.find((s) => s.id === seasonId);
      const episode = episodes.find((e) => e.episodeId === episodeId);

      const titleParts = [catalog.title];
      if (season && episode) {
        titleParts.push(`S${season.number}E${episode.number}`);
      }
      if (translation) titleParts.push(translation.title);

      return api<RoomSummary>(`/rooms/${roomId}/video`, {
        method: "POST",
        body: JSON.stringify({
          type: "EMBED",
          url: catalog.catalogUrl,
          metadata: {
            provider: "rezka",
            catalogUrl: catalog.catalogUrl,
            kind: catalog.kind,
            title: titleParts.join(" · "),
            thumbnail: catalog.thumbnail,
            translationId,
            translationName: translation?.title,
            seasonId: catalog.kind === "series" ? seasonId : undefined,
            seasonNumber: season?.number,
            episodeId: catalog.kind === "series" ? episodeId : undefined,
            episodeNumber: episode?.number,
            streamUrl: stream.streamUrl,
            quality: stream.quality,
          },
        }),
      });
    },
    onSuccess: onSuccess,
  });

  const handleLoad = () => {
    const parsed = parseVideoUrl(url);
    if (parsed.provider !== "rezka") {
      setLoadError("Enter a link to a supported movie or series resource");
      return;
    }
    setLoadError(null);
    parseCatalog.mutate(parsed.originalUrl);
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#181818] shadow-2xl">
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-[#00a8e1]/10 to-transparent px-6 py-4">
          <h2 className="text-lg font-bold">Your resource link</h2>
          <p className="mt-1 text-sm text-white/50">
            Enter a link to your own movie or series resource
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <Label className="text-white/70">Link</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/film/..."
                className="h-11 border-white/10 bg-white/[0.04]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url && !parseCatalog.isPending) {
                    handleLoad();
                  }
                }}
              />
              <Button
                type="button"
                className="h-11 shrink-0 bg-[#00a8e1] px-5 font-semibold text-white hover:bg-[#00a8e1]/90"
                onClick={handleLoad}
                disabled={!url || parseCatalog.isPending}
              >
                {parseCatalog.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2 border-white/25 border-t-white" />
                    Loading…
                  </>
                ) : (
                  "Load title"
                )}
              </Button>
            </div>
          </div>

          {parseCatalog.isPending && (
            <p className="text-xs text-white/40">
              Opening the page can take 10–15 seconds — please wait
            </p>
          )}

          {parseCatalog.isError && (
            <p className="text-sm text-[#e50914]">
              {toUserMessage((parseCatalog.error as Error).message)}
            </p>
          )}

          {loadError && (
            <p className="text-sm text-[#e50914]">{loadError}</p>
          )}

          {catalog && (
            <div className="space-y-3 rounded-lg border border-white/[0.06] bg-black/20 p-4">
              <div>
                <p className="font-semibold text-white">{catalog.title}</p>
                {catalog.originalTitle && (
                  <p className="text-xs text-white/40">{catalog.originalTitle}</p>
                )}
              </div>

              <div>
                <Label className="text-xs text-white/50">Audio track</Label>
                <select
                  value={translationId}
                  onChange={blurSelectOnChange((e) =>
                    setTranslationId(e.target.value),
                  )}
                  className={catalogSelectClassName}
                >
                  {catalog.translations.map((t, index) => (
                    <option key={`tr-${t.id}-${index}`} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {catalog.kind === "series" && catalog.seasons && (
                <>
                  <div>
                    <Label className="text-xs text-white/50">Season</Label>
                    <select
                      value={seasonId}
                      onChange={blurSelectOnChange((e) =>
                        setSeasonId(e.target.value),
                      )}
                      className={catalogSelectClassName}
                    >
                      {catalog.seasons.map((s, index) => (
                        <option key={`season-${s.id}-${index}`} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-white/50">Episode</Label>
                    <select
                      value={episodeId}
                      onChange={blurSelectOnChange((e) =>
                        setEpisodeId(e.target.value),
                      )}
                      className={catalogSelectClassName}
                    >
                      {episodes.map((ep, index) => (
                        <option
                          key={`ep-${ep.episodeId}-${index}`}
                          value={ep.episodeId}
                        >
                          {ep.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <Button
                className="h-11 w-full bg-[#e50914] hover:bg-[#f40612]"
                onClick={() => startWatching.mutate()}
                disabled={startWatching.isPending || !translationId}
              >
                {startWatching.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Loading stream...
                  </>
                ) : (
                  <>
                    <PlayMark className="mr-2 size-4" />
                    Start Watching
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
