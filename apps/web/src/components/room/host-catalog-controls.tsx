"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Settings2 } from "lucide-react";
import type { CatalogInfo, CatalogStreamResult, RoomSummary } from "@dimovie/shared";
import { normalizeCatalogInfo } from "@dimovie/shared";
import { api } from "@/lib/api";
import { blurSelectOnChange, catalogSelectClassName } from "@/lib/select-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface HostCatalogControlsProps {
  room: RoomSummary;
  onUpdated: (room: RoomSummary) => void;
}

export function HostCatalogControls({ room, onUpdated }: HostCatalogControlsProps) {
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
      api<CatalogInfo>("/catalog/rezka/parse", {
        method: "POST",
        body: JSON.stringify({ url: catalogUrl }),
      }),
    onSuccess: (data) => {
      const normalized = normalizeCatalogInfo(data);
      setCatalog(normalized);
      if (!translationId) {
        setTranslationId(normalized.translations[0]?.id ?? "");
      }
      if (!seasonId && normalized.seasons?.[0]) {
        setSeasonId(normalized.seasons[0].id);
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

  const applySelection = useMutation({
    mutationFn: async () => {
      if (!catalog) throw new Error("Catalog not loaded");

      const stream = await api<CatalogStreamResult>("/catalog/rezka/stream", {
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
    <div className="mx-auto max-w-5xl px-4 pb-4 md:px-6 lg:px-8">
      <div className="rounded-lg border border-white/[0.06] bg-[#141414]/80">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/80 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="size-4 text-[#00a8e1]" />
            Host settings — season, episode, audio track
          </span>
          <span className="text-xs text-white/40">
            {open ? "Hide" : "Show"}
          </span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
            {loadCatalog.isPending && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </div>
            )}

            {catalog && (
              <>
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

                {catalog.kind === "series" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-white/50">Season</Label>
                      <select
                        value={seasonId}
                        onChange={blurSelectOnChange((e) =>
                          setSeasonId(e.target.value),
                        )}
                        className={catalogSelectClassName}
                      >
                        {catalog.seasons?.map((s, index) => (
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
                  </div>
                )}

                <Button
                  className="bg-[#e50914] hover:bg-[#f40612]"
                  onClick={() => applySelection.mutate()}
                  disabled={applySelection.isPending}
                >
                  {applySelection.isPending ? "Updating..." : "Apply for everyone"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
