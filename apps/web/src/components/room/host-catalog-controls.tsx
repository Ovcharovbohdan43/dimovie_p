"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { CatalogInfo, CatalogStreamResult, RoomSummary } from "@dimovie/shared";
import { normalizeCatalogInfo } from "@dimovie/shared";
import { api } from "@/lib/api";
import { blurSelectOnChange } from "@/lib/select-field";
import { cn } from "@/lib/utils";
import { ChevronMark } from "@/components/home/marks";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface HostCatalogControlsProps {
  room: RoomSummary;
  onUpdated: (room: RoomSummary) => void;
  className?: string;
}

const selectClass =
  "h-9 w-full cursor-pointer select-none border border-white/10 bg-[#0c0c10] px-2.5 text-sm text-white/90 outline-none transition hover:border-white/20 focus-visible:border-[#e50914]/50 [color-scheme:dark]";

export function HostCatalogControls({
  room,
  onUpdated,
  className,
}: HostCatalogControlsProps) {
  const meta = room.videoSource?.metadata as Record<string, unknown> | undefined;
  const catalogUrl = (meta?.catalogUrl as string) ?? room.videoSource?.url ?? "";

  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogInfo | null>(null);
  const [seasonId, setSeasonId] = useState((meta?.seasonId as string) ?? "");
  const [episodeId, setEpisodeId] = useState((meta?.episodeId as string) ?? "");
  const [translationId, setTranslationId] = useState(
    (meta?.translationId as string) ?? "",
  );

  const loadCatalog = useMutation({
    mutationFn: () =>
      api<CatalogInfo>("/api/catalog/rezka/parse", {
        method: "POST",
        body: JSON.stringify({ url: catalogUrl }),
      }),
    onSuccess: (data) => {
      const normalized = normalizeCatalogInfo(data);
      setCatalog(normalized);
      if (!translationId) {
        setTranslationId(normalized.translations[0]?.id ?? "");
      }
      const nextSeason =
        seasonId || normalized.seasons?.[0]?.id || "";
      if (nextSeason && nextSeason !== seasonId) {
        setSeasonId(nextSeason);
      }
      if (normalized.kind === "series") {
        const eps = normalized.episodesBySeason?.[nextSeason] ?? [];
        if (!episodeId || !eps.some((e) => e.episodeId === episodeId)) {
          setEpisodeId(eps[0]?.episodeId ?? "");
        }
      }
    },
  });

  useEffect(() => {
    if (open && !catalog && !loadCatalog.isPending) {
      loadCatalog.mutate();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const episodes = useMemo(() => {
    if (!catalog || !seasonId) return [];
    return catalog.episodesBySeason?.[seasonId] ?? [];
  }, [catalog, seasonId]);

  useEffect(() => {
    if (!catalog || catalog.kind !== "series" || !seasonId) return;
    if (!episodes.some((e) => e.episodeId === episodeId)) {
      setEpisodeId(episodes[0]?.episodeId ?? "");
    }
  }, [catalog, seasonId, episodes, episodeId]);

  const summary = useMemo(() => {
    const seasonNum = meta?.seasonNumber as number | undefined;
    const episodeNum = meta?.episodeNumber as number | undefined;
    const track = (meta?.translationName as string | undefined) ?? "";
    const parts: string[] = [];
    if (seasonNum != null && episodeNum != null) {
      parts.push(`S${seasonNum}·E${episodeNum}`);
    }
    if (track) parts.push(track);
    return parts.join("  ·  ") || "Episode & audio";
  }, [meta?.seasonNumber, meta?.episodeNumber, meta?.translationName]);

  const applySelection = useMutation({
    mutationFn: async () => {
      if (!catalog) throw new Error("Catalog not loaded");

      const stream = await api<CatalogStreamResult>("/api/catalog/rezka/stream", {
        method: "POST",
        body: JSON.stringify({
          catalogUrl: catalog.catalogUrl,
          translationId,
          postId: catalog.postId,
          kind: catalog.kind,
          title: catalog.title,
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

      return api<RoomSummary>(`/rooms/${room.id}/video`, {
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
    onSuccess: (updated) => {
      onUpdated(updated);
      setOpen(false);
    },
  });

  if (meta?.provider !== "rezka") return null;

  return (
    <div className={cn("border-t border-white/[0.06] bg-[#0a0a0e]", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer select-none items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03] sm:px-4"
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-white/55 sm:text-xs">
          {summary}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          {open ? "Close" : "Change"}
          <ChevronMark
            className={cn(
              "size-3.5 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-white/[0.06] px-3 py-3 sm:px-4">
            {loadCatalog.isPending && (
              <div className="flex items-center gap-2 text-xs text-white/45">
                <LoadingSpinner size="sm" className="border-white/15 border-t-white/60" />
                Loading catalog…
              </div>
            )}

            {loadCatalog.isError && (
              <p className="text-xs text-[#e50914]">
                Couldn’t load catalog. Try again.
              </p>
            )}

            {catalog && (
              <>
                <div
                  className={cn(
                    "grid gap-2",
                    catalog.kind === "series"
                      ? "sm:grid-cols-[1fr_1fr_1.2fr_auto]"
                      : "sm:grid-cols-[1fr_auto]",
                  )}
                >
                  {catalog.kind === "series" && (
                    <>
                      <label className="block min-w-0">
                        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                          Season
                        </span>
                        <select
                          value={seasonId}
                          onChange={blurSelectOnChange((e) =>
                            setSeasonId(e.target.value),
                          )}
                          className={selectClass}
                        >
                          {catalog.seasons?.map((s, index) => (
                            <option key={`season-${s.id}-${index}`} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                          Episode
                        </span>
                        <select
                          value={episodeId}
                          onChange={blurSelectOnChange((e) =>
                            setEpisodeId(e.target.value),
                          )}
                          className={selectClass}
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
                      </label>
                    </>
                  )}

                  <label className="block min-w-0">
                    <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                      Audio
                    </span>
                    <select
                      value={translationId}
                      onChange={blurSelectOnChange((e) =>
                        setTranslationId(e.target.value),
                      )}
                      className={selectClass}
                    >
                      {catalog.translations.map((t, index) => (
                        <option key={`tr-${t.id}-${index}`} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="sm:pt-5">
                    <button
                      type="button"
                      onClick={() => applySelection.mutate()}
                      disabled={
                        applySelection.isPending ||
                        !translationId ||
                        (catalog.kind === "series" && !episodeId)
                      }
                      className="inline-flex h-9 w-full items-center justify-center bg-[#e50914] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#f40612] disabled:opacity-40 sm:w-auto"
                    >
                      {applySelection.isPending ? "…" : "Apply"}
                    </button>
                  </div>
                </div>

                {applySelection.isError && (
                  <p className="text-xs text-[#e50914]">
                    {(applySelection.error as Error)?.message ||
                      "Couldn’t update the stream."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
