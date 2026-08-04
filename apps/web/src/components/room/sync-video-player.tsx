"use client";

import { useEffect, useRef, useId, useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SyncStatePayload } from "@dimovie/shared";
import { parseVideoUrl } from "@/lib/video-url";
import { useYouTubeApiReady, type YTPlayer } from "@/hooks/use-youtube-api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CaptionsMark,
  CollapseMark,
  ExpandMark,
  PauseMark,
  PlayMark,
  SignalMark,
  VolumeMark,
  VolumeMuteMark,
} from "@/components/home/marks";

interface SyncVideoPlayerProps {
  url: string;
  syncState: SyncStatePayload | null;
  onIntent: (event: "PLAY" | "PAUSE" | "SEEK", time: number) => void;
  className?: string;
  overlay?: React.ReactNode;
  broadcastEnded?: boolean;
  endedMessage?: string;
  onLeave?: () => void;
  maxVideoQuality?: "720p" | "1080p";
  syncDriftThresholdMs?: number;
  canControl?: boolean;
}

const QUALITY_LABELS: Record<string, string> = {
  auto: "Auto",
  default: "Auto",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUALITY_RANK: Record<string, number> = {
  hd1080: 1080,
  hd720: 720,
  large: 480,
  medium: 360,
  small: 240,
  tiny: 144,
};

const MAX_QUALITY_YT_KEY: Record<"720p" | "1080p", string> = {
  "720p": "hd720",
  "1080p": "hd1080",
};

function filterQualities(levels: string[], maxVideoQuality: "720p" | "1080p") {
  const cap = maxVideoQuality === "720p" ? 720 : 1080;
  return levels.filter((q) => (QUALITY_RANK[q] ?? 0) <= cap);
}

function applySyncToPlayer(
  syncState: SyncStatePayload,
  provider: ReturnType<typeof parseVideoUrl>["provider"],
  ytPlayer: YTPlayer | null,
  videoEl: HTMLVideoElement | null,
  syncDriftThresholdSec: number,
) {
  if (provider === "youtube" && ytPlayer) {
    const drift = Math.abs(ytPlayer.getCurrentTime() - syncState.time);
    if (drift > syncDriftThresholdSec) {
      ytPlayer.seekTo(syncState.time, true);
    }
    if (syncState.isPlaying) {
      ytPlayer.playVideo();
    } else {
      ytPlayer.pauseVideo();
    }
    return;
  }

  if (provider === "direct" && videoEl) {
    if (Math.abs(videoEl.currentTime - syncState.time) > syncDriftThresholdSec / 2) {
      videoEl.currentTime = syncState.time;
    }
    if (syncState.isPlaying) {
      void videoEl.play().catch(() => undefined);
    } else {
      videoEl.pause();
    }
  }
}

export function SyncVideoPlayer({
  url,
  syncState,
  onIntent,
  className,
  overlay,
  broadcastEnded = false,
  endedMessage = "The host ended the stream",
  onLeave,
  maxVideoQuality = "1080p",
  syncDriftThresholdMs = 1500,
  canControl = false,
}: SyncVideoPlayerProps) {
  const syncDriftThresholdSec = syncDriftThresholdMs / 1000;
  const parsed = parseVideoUrl(url);
  const ytReady = useYouTubeApiReady();
  const playerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const ytPlayer = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVersion = useRef(0);
  const applyingRemote = useRef(false);
  const lastLocalAction = useRef(0);
  const onIntentRef = useRef(onIntent);
  const syncStateRef = useRef(syncState);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualities, setQualities] = useState<string[]>([]);
  const [activeQuality, setActiveQuality] = useState("auto");
  const [captionsOn, setCaptionsOn] = useState(false);
  const [directPlaying, setDirectPlaying] = useState(false);
  const [directTime, setDirectTime] = useState(0);
  const [directDuration, setDirectDuration] = useState(0);
  const [ytTime, setYtTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [controlsPinned, setControlsPinned] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const hideTimer = useRef<number | null>(null);

  onIntentRef.current = onIntent;
  syncStateRef.current = syncState;

  useEffect(() => {
    if (!broadcastEnded) return;
    ytPlayer.current?.pauseVideo();
    videoRef.current?.pause();
  }, [broadcastEnded]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const getTime = useCallback((): number => {
    if (parsed.provider === "youtube" && ytPlayer.current) {
      return ytPlayer.current.getCurrentTime() ?? 0;
    }
    if (parsed.provider === "direct" && videoRef.current) {
      return videoRef.current.currentTime;
    }
    return syncState?.time ?? 0;
  }, [parsed.provider, syncState?.time]);

  useEffect(() => {
    if (!syncState || syncState.version <= localVersion.current) return;

    const canApply =
      (parsed.provider === "youtube" && playerReady && ytPlayer.current) ||
      (parsed.provider === "direct" && videoRef.current) ||
      parsed.provider === "vimeo";

    if (!canApply) return;

    localVersion.current = syncState.version;
    applyingRemote.current = true;

    applySyncToPlayer(
      syncState,
      parsed.provider,
      ytPlayer.current,
      videoRef.current,
      syncDriftThresholdSec,
    );

    if (parsed.provider === "youtube") {
      setYtTime(syncState.time);
      setYtPlaying(syncState.isPlaying);
    }

    setTimeout(() => {
      applyingRemote.current = false;
    }, 400);
  }, [syncState, parsed.provider, playerReady, syncDriftThresholdSec]);

  useEffect(() => {
    if (parsed.provider !== "youtube" || !parsed.videoId || !ytReady) return;

    setPlayerReady(false);
    const containerId = `yt-${playerId}`;

    const player = new window.YT!.Player(containerId, {
      videoId: parsed.videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        cc_load_policy: 1,
        fs: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          ytPlayer.current = event.target;
          setPlayerReady(true);

          try {
            const duration = event.target.getDuration();
            if (Number.isFinite(duration) && duration > 0) {
              setYtDuration(duration);
            }
          } catch {
            /* duration optional until metadata loads */
          }

          try {
            event.target.loadModule("captions");
          } catch {
            /* captions module optional */
          }

          try {
            const levels = filterQualities(
              event.target.getAvailableQualityLevels() ?? [],
              maxVideoQuality,
            );
            if (levels.length) {
              setQualities(levels);
              const capKey = MAX_QUALITY_YT_KEY[maxVideoQuality];
              if (levels.includes(capKey)) {
                event.target.setPlaybackQuality(capKey);
                setActiveQuality(capKey);
              }
            } else {
              setActiveQuality(event.target.getPlaybackQuality() ?? "auto");
            }
          } catch {
            /* quality API optional */
          }

          if (syncStateRef.current && syncStateRef.current.version > localVersion.current) {
            const state = syncStateRef.current;
            localVersion.current = state.version;
            applyingRemote.current = true;
            applySyncToPlayer(state, "youtube", event.target, null, syncDriftThresholdSec);
            setTimeout(() => {
              applyingRemote.current = false;
            }, 400);
          }
        },
        onStateChange: (event: { data: number }) => {
          if (applyingRemote.current || !canControl) return;
          const now = Date.now();
          if (now - lastLocalAction.current < 500) return;

          const YT = window.YT!;
          const time = ytPlayer.current?.getCurrentTime() ?? 0;

          if (event.data === YT.PlayerState.PLAYING) {
            setYtPlaying(true);
            lastLocalAction.current = now;
            onIntentRef.current("PLAY", time);
          } else if (event.data === YT.PlayerState.PAUSED) {
            setYtPlaying(false);
            lastLocalAction.current = now;
            onIntentRef.current("PAUSE", time);
          } else if (event.data === YT.PlayerState.ENDED) {
            setYtPlaying(false);
          }
        },
      },
    });

    return () => {
      player.destroy();
      ytPlayer.current = null;
      setPlayerReady(false);
      setYtTime(0);
      setYtDuration(0);
    };
  }, [parsed.provider, parsed.videoId, ytReady, playerId, maxVideoQuality, syncDriftThresholdSec, canControl]);

  const isYoutube = parsed.provider === "youtube";
  const isDirect = parsed.provider === "direct";

  useEffect(() => {
    if (!isYoutube || !playerReady || !ytPlayer.current) return;

    const tick = () => {
      const player = ytPlayer.current;
      if (!player) return;
      try {
        const duration = player.getDuration();
        if (Number.isFinite(duration) && duration > 0) {
          setYtDuration(duration);
        }
        if (scrubbing || seekValue !== null) return;
        const time = player.getCurrentTime();
        if (Number.isFinite(time)) setYtTime(time);
      } catch {
        /* ignore */
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isYoutube, playerReady, scrubbing, seekValue]);

  useEffect(() => {
    if (parsed.provider === "direct") {
      setPlayerReady(false);
      setVideoError(null);
      setVideoLoading(true);
      setDirectPlaying(false);
      setDirectTime(0);
      setDirectDuration(0);
      setSeekValue(null);
    }
  }, [parsed.provider, url]);

  const commitSeek = useCallback(
    (time: number) => {
      if (!canControl || !Number.isFinite(time)) return;

      lastLocalAction.current = Date.now();
      applyingRemote.current = true;

      if (parsed.provider === "youtube" && ytPlayer.current) {
        ytPlayer.current.seekTo(time, true);
        setYtTime(time);
        onIntentRef.current("SEEK", time);
      } else if (videoRef.current) {
        videoRef.current.currentTime = time;
        setDirectTime(time);
        onIntentRef.current("SEEK", time);
      }

      setTimeout(() => {
        applyingRemote.current = false;
      }, 400);
    },
    [parsed.provider, canControl],
  );

  const togglePlay = useCallback(() => {
    if (!canControl) return;
    const time = getTime();
    lastLocalAction.current = Date.now();
    applyingRemote.current = true;

    if (parsed.provider === "youtube" && ytPlayer.current) {
      const isPlaying = syncState?.isPlaying ?? ytPlaying;
      if (isPlaying) {
        ytPlayer.current.pauseVideo();
        setYtPlaying(false);
      } else {
        ytPlayer.current.playVideo();
        setYtPlaying(true);
      }
      onIntentRef.current(isPlaying ? "PAUSE" : "PLAY", time);
    } else if (parsed.provider === "direct" && videoRef.current) {
      const el = videoRef.current;
      if (!el.paused) {
        el.pause();
        onIntentRef.current("PAUSE", el.currentTime);
      } else {
        void el
          .play()
          .then(() => {
            onIntentRef.current("PLAY", el.currentTime);
          })
          .catch(() => {
            setVideoError("Couldn’t start the video. Try again.");
          });
      }
    } else {
      const isPlaying = syncState?.isPlaying ?? false;
      onIntentRef.current(isPlaying ? "PAUSE" : "PLAY", time);
    }

    setTimeout(() => {
      applyingRemote.current = false;
    }, 400);
  }, [getTime, syncState?.isPlaying, parsed.provider, canControl, ytPlaying]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  const setQuality = useCallback((quality: string) => {
    if (!ytPlayer.current) return;
    try {
      ytPlayer.current.setPlaybackQuality(quality);
      setActiveQuality(quality);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!ytPlayer.current) return;
    try {
      if (captionsOn) {
        ytPlayer.current.setOption("captions", "track", {});
        setCaptionsOn(false);
      } else {
        ytPlayer.current.setOption("captions", "track", {
          languageCode: "en",
        });
        setCaptionsOn(true);
      }
    } catch {
      /* ignore */
    }
  }, [captionsOn]);

  const toggleDirectFullscreen = useCallback(async () => {
    const el = parsed.provider === "direct" ? videoRef.current : containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, [parsed.provider]);

  const showQuality = isYoutube && qualities.length > 0;
  const showCaptions = isYoutube;
  const uiPlaying = isDirect
    ? directPlaying
    : isYoutube
      ? (syncState?.isPlaying ?? ytPlaying)
      : (syncState?.isPlaying ?? false);
  const progressMax = isDirect ? directDuration : isYoutube ? ytDuration : 0;
  const progressValue = Math.min(
    seekValue ?? (isDirect ? directTime : isYoutube ? ytTime : 0),
    progressMax || 0,
  );
  const uiTime = seekValue ?? (isDirect ? directTime : isYoutube ? ytTime : (syncState?.time ?? 0));
  const showProgress = (isDirect || isYoutube) && progressMax > 0;
  const controlsVisible =
    controlsPinned || scrubbing || seekValue !== null || !uiPlaying;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    setControlsPinned(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    if (scrubbing || seekValue !== null) return;
    const playing = isDirect
      ? directPlaying
      : isYoutube
        ? (syncState?.isPlaying ?? ytPlaying)
        : (syncState?.isPlaying ?? false);
    if (!playing) return;
    hideTimer.current = window.setTimeout(() => {
      setControlsPinned(false);
    }, 2400);
  }, [
    clearHideTimer,
    scrubbing,
    seekValue,
    isDirect,
    isYoutube,
    directPlaying,
    syncState?.isPlaying,
    ytPlaying,
  ]);

  useEffect(() => {
    if (!uiPlaying || scrubbing || seekValue !== null) {
      setControlsPinned(true);
      clearHideTimer();
      return;
    }
    scheduleHideControls();
    return clearHideTimer;
  }, [
    uiPlaying,
    scrubbing,
    seekValue,
    scheduleHideControls,
    clearHideTimer,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        revealControls();
        togglePlay();
        scheduleHideControls();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void (isYoutube ? toggleFullscreen() : toggleDirectFullscreen());
      } else if (e.key === "m" || e.key === "M") {
        if (!isDirect || !videoRef.current) return;
        e.preventDefault();
        const next = !videoRef.current.muted;
        videoRef.current.muted = next;
        setMuted(next);
      } else if (
        canControl &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        (isYoutube || isDirect)
      ) {
        e.preventDefault();
        const delta = e.key === "ArrowLeft" ? -5 : 5;
        const raw = getTime() + delta;
        const next =
          progressMax > 0
            ? Math.min(progressMax, Math.max(0, raw))
            : Math.max(0, raw);
        revealControls();
        commitSeek(next);
        scheduleHideControls();
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [
    revealControls,
    scheduleHideControls,
    togglePlay,
    isYoutube,
    isDirect,
    toggleFullscreen,
    toggleDirectFullscreen,
    canControl,
    progressMax,
    getTime,
    commitSeek,
  ]);

  const handleContainerMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (scrubbing) return;
      const related = e.relatedTarget;
      if (related instanceof Node && containerRef.current?.contains(related)) {
        return;
      }
      scheduleHideControls();
    },
    [scrubbing, scheduleHideControls],
  );

  const progressPct =
    progressMax > 0 ? Math.min(100, (progressValue / progressMax) * 100) : 0;

  if (parsed.provider === "unknown") {
    return (
      <div className={cn("flex items-center justify-center bg-black text-white/60", className)}>
        <AlertCircle className="mr-2 size-5 text-[#e50914]" />
        Unsupported video URL
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "group/player relative aspect-video w-full select-none overflow-hidden bg-black outline-none ring-1 ring-white/[0.06] focus-visible:ring-[#e50914]/50",
        uiPlaying && !controlsVisible && "cursor-none",
        className,
      )}
      onMouseMove={() => {
        revealControls();
        scheduleHideControls();
      }}
      onMouseLeave={handleContainerMouseLeave}
      onTouchStart={() => {
        revealControls();
        scheduleHideControls();
      }}
    >
      {parsed.provider === "youtube" && (
        <div id={`yt-${playerId}`} className="absolute inset-0 h-full w-full" />
      )}

      {(isYoutube || isDirect) && playerReady && !broadcastEnded && (
        <button
          type="button"
          className={cn(
            "absolute inset-0 z-[15] flex items-center justify-center bg-transparent",
            !canControl && "cursor-default",
          )}
          aria-label={uiPlaying ? "Pause" : "Play"}
          disabled={!canControl}
          onClick={() => {
            if (!canControl) return;
            revealControls();
            togglePlay();
            scheduleHideControls();
          }}
        >
          {!uiPlaying && canControl && (
            <span className="pointer-events-none grid size-14 place-items-center bg-[#e50914] text-white transition duration-200 group-hover/player:scale-[1.03] sm:size-16">
              <PlayMark className="ml-0.5 size-6 sm:size-7" />
            </span>
          )}
        </button>
      )}

      {parsed.provider === "direct" && (
        <video
          key={url}
          ref={videoRef}
          src={parsed.embedUrl}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          preload="auto"
          onDurationChange={() => {
            if (
              videoRef.current &&
              Number.isFinite(videoRef.current.duration) &&
              videoRef.current.duration > 0
            ) {
              setDirectDuration(videoRef.current.duration);
            }
          }}
          onLoadedMetadata={() => {
            if (
              videoRef.current &&
              Number.isFinite(videoRef.current.duration) &&
              videoRef.current.duration > 0
            ) {
              setDirectDuration(videoRef.current.duration);
            }
          }}
          onLoadedData={() => {
            setVideoLoading(false);
            setPlayerReady(true);
          }}
          onCanPlay={() => setVideoLoading(false)}
          onWaiting={() => setVideoLoading(true)}
          onPlaying={() => {
            setVideoLoading(false);
            setDirectPlaying(true);
          }}
          onTimeUpdate={() => {
            if (videoRef.current) setDirectTime(videoRef.current.currentTime);
          }}
          onError={() => {
            setVideoLoading(false);
            setVideoError(
              "The video didn’t load. Refresh the page or try another link.",
            );
          }}
          onPlay={() => {
            setDirectPlaying(true);
            if (!applyingRemote.current && canControl) {
              onIntentRef.current("PLAY", videoRef.current?.currentTime ?? 0);
            }
          }}
          onPause={() => {
            setDirectPlaying(false);
            if (!applyingRemote.current && canControl) {
              onIntentRef.current("PAUSE", videoRef.current?.currentTime ?? 0);
            }
          }}
          onSeeked={() => {
            if (!applyingRemote.current && canControl) {
              onIntentRef.current("SEEK", videoRef.current?.currentTime ?? 0);
            }
          }}
        />
      )}

      {isDirect && videoLoading && !videoError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <LoadingSpinner size="lg" className="border-white/20 border-t-[#e50914]" />
        </div>
      )}

      {isDirect && videoError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
          <AlertCircle className="size-8 text-[#e50914]" />
          <p className="text-sm text-white/70">{videoError}</p>
        </div>
      )}

      {parsed.provider === "vimeo" && parsed.videoId && (
        <iframe
          src={`https://player.vimeo.com/video/${parsed.videoId}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}

      {overlay}

      {broadcastEnded && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#08080c]/88 px-6">
          <div className="flex max-w-sm flex-col items-center text-center">
            <SignalMark className="mb-4 size-6 text-white/35" />
            <h3 className="font-display text-xl font-bold tracking-[-0.03em] text-white">
              Stream ended
            </h3>
            <p className="mt-2 text-sm text-white/50">{endedMessage}</p>
            {onLeave && (
              <button
                type="button"
                className="mt-6 h-10 bg-[#e50914] px-5 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f40612]"
                onClick={onLeave}
              >
                Go home
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200 ease-out",
          controlsVisible && !broadcastEnded
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onMouseEnter={revealControls}
      >
        <div className="player-controls-fade px-3 pb-2.5 pt-16 sm:px-4 sm:pb-3">
          {showProgress && (
            <div className="mb-2.5">
              <input
                type="range"
                min={0}
                max={progressMax}
                step={0.25}
                value={progressValue}
                aria-label="Playback position"
                data-active={scrubbing || seekValue !== null ? "true" : undefined}
                style={
                  {
                    "--progress": `${progressPct}%`,
                  } as React.CSSProperties
                }
                className={cn(
                  "player-scrub block w-full",
                  !canControl && "pointer-events-none opacity-60",
                )}
                disabled={!canControl}
                onPointerDown={() => {
                  if (!canControl) return;
                  setScrubbing(true);
                  revealControls();
                }}
                onChange={(e) => canControl && setSeekValue(Number(e.target.value))}
                onPointerUp={(e) => {
                  if (!canControl) return;
                  const time = Number(e.currentTarget.value);
                  commitSeek(time);
                  setSeekValue(null);
                  setScrubbing(false);
                  e.currentTarget.blur();
                  scheduleHideControls();
                }}
                onPointerCancel={() => {
                  setSeekValue(null);
                  setScrubbing(false);
                }}
                onKeyUp={(e) => {
                  if (!canControl || e.key !== "Enter") return;
                  const time = Number(e.currentTarget.value);
                  commitSeek(time);
                  setSeekValue(null);
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              className="player-ctrl"
              onClick={(e) => {
                e.stopPropagation();
                revealControls();
                togglePlay();
                scheduleHideControls();
              }}
              disabled={!canControl}
              title={
                canControl
                  ? uiPlaying
                    ? "Pause"
                    : "Play"
                  : "Only the host can control playback"
              }
            >
              {uiPlaying ? (
                <PauseMark className="size-4" />
              ) : (
                <PlayMark className="ml-0.5 size-4" />
              )}
            </button>

            <div className="min-w-0 flex-1 px-1.5 font-mono text-[11px] tabular-nums tracking-wide text-white/70 sm:px-2 sm:text-xs">
              <span className="text-white/90">{formatTime(uiTime)}</span>
              {showProgress && (
                <span className="text-white/35">
                  {" "}
                  / {formatTime(progressMax)}
                </span>
              )}
            </div>

            {isDirect && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="player-ctrl"
                  title={muted || volume === 0 ? "Unmute" : "Mute"}
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = videoRef.current;
                    if (!el) return;
                    if (muted || volume === 0) {
                      el.muted = false;
                      el.volume = volume > 0 ? volume : 0.8;
                      setMuted(false);
                      if (volume === 0) setVolume(0.8);
                    } else {
                      el.muted = true;
                      setMuted(true);
                    }
                  }}
                >
                  {muted || volume === 0 ? (
                    <VolumeMuteMark className="size-4" />
                  ) : (
                    <VolumeMark className="size-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  aria-label="Volume"
                  className="player-scrub hidden w-14 sm:block sm:w-16"
                  style={
                    {
                      "--progress": `${(muted ? 0 : volume) * 100}%`,
                    } as React.CSSProperties
                  }
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setVolume(next);
                    setMuted(next === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = next;
                      videoRef.current.muted = next === 0;
                    }
                  }}
                />
              </div>
            )}

            {showCaptions && (
              <button
                type="button"
                className="player-ctrl"
                data-active={captionsOn ? "true" : undefined}
                onClick={toggleCaptions}
                title="Subtitles"
              >
                <CaptionsMark className="size-4" />
              </button>
            )}

            {showQuality && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      title="Quality"
                      className="player-ctrl player-ctrl--label font-mono text-[10px] font-semibold tracking-[0.08em] text-white/70 hover:text-white"
                    >
                      {QUALITY_LABELS[activeQuality] ?? "Auto"}
                    </button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="min-w-[7rem] rounded-none border-white/10 bg-[#0c0c10] p-1"
                >
                  {qualities.map((q) => (
                    <DropdownMenuItem
                      key={q}
                      onClick={() => setQuality(q)}
                      className={cn(
                        "rounded-none font-mono text-xs",
                        activeQuality === q && "bg-white/[0.04] text-[#e50914]",
                      )}
                    >
                      {QUALITY_LABELS[q] ?? q}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button
              type="button"
              className="player-ctrl"
              onClick={isYoutube ? toggleFullscreen : toggleDirectFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <CollapseMark className="size-4" />
              ) : (
                <ExpandMark className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {parsed.provider === "youtube" && !ytReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <LoadingSpinner size="lg" className="border-white/20 border-t-[#e50914]" />
        </div>
      )}
    </div>
  );
}
