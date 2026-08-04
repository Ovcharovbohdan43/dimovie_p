"use client";

import { useEffect, useRef, useId, useCallback, useState } from "react";
import {
  AlertCircle,
  Maximize,
  Minimize,
  Settings2,
  Subtitles,
  Radio,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SyncStatePayload } from "@dimovie/shared";
import { parseVideoUrl } from "@/lib/video-url";
import { useYouTubeApiReady, type YTPlayer } from "@/hooks/use-youtube-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PauseMark, PlayMark } from "@/components/home/marks";

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
  const [controlsHovered, setControlsHovered] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

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
  const controlsVisible =
    controlsHovered || scrubbing || seekValue !== null || !uiPlaying;
  const showProgress = (isDirect || isYoutube) && progressMax > 0;

  const handleContainerMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (scrubbing) return;
      const related = e.relatedTarget;
      if (related instanceof Node && containerRef.current?.contains(related)) {
        return;
      }
      setControlsHovered(false);
    },
    [scrubbing],
  );

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
      className={cn(
        "group/player relative aspect-video w-full select-none overflow-hidden rounded-lg bg-black shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06]",
        className,
      )}
      onMouseEnter={() => setControlsHovered(true)}
      onMouseLeave={handleContainerMouseLeave}
      onTouchStart={() => setControlsHovered(true)}
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
          onMouseEnter={() => setControlsHovered(true)}
          onTouchStart={() => setControlsHovered(true)}
          onClick={() => {
            if (!canControl) return;
            setControlsHovered(true);
            togglePlay();
          }}
        >
          {!uiPlaying && canControl && (
            <span className="pointer-events-none grid size-16 place-items-center bg-[#e50914] text-white shadow-[0_16px_48px_rgba(0,0,0,0.45)] transition group-hover/player:scale-105 sm:size-[4.5rem]">
              <PlayMark className="ml-0.5 size-7 sm:size-8" />
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
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
          <div className="flex max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
              <Radio className="size-7 text-white/50" />
            </div>
            <h3 className="text-lg font-bold text-white">Stream ended</h3>
            <p className="mt-2 text-sm text-white/60">{endedMessage}</p>
            {onLeave && (
              <Button
                className="mt-6 bg-[#e50914] hover:bg-[#f40612]"
                onClick={onLeave}
              >
                Go home
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Control bar — on hover, pause, or scrub */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200 ease-out",
          controlsVisible && !broadcastEnded
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onMouseEnter={() => setControlsHovered(true)}
      >
        <div className="player-controls-fade px-3 pb-3 pt-12 sm:px-4 sm:pb-4">
          {showProgress && (
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={progressMax}
                step={0.25}
                value={progressValue}
                aria-label="Playback position"
                className={cn(
                  "player-progress block w-full",
                  !canControl && "pointer-events-none opacity-70",
                )}
                disabled={!canControl}
                onPointerDown={() => canControl && setScrubbing(true)}
                onChange={(e) => canControl && setSeekValue(Number(e.target.value))}
                onPointerUp={(e) => {
                  if (!canControl) return;
                  const time = Number(e.currentTarget.value);
                  commitSeek(time);
                  setSeekValue(null);
                  setScrubbing(false);
                  e.currentTarget.blur();
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

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              disabled={!canControl}
              title={
                canControl
                  ? uiPlaying
                    ? "Pause"
                    : "Play"
                  : "Join the room to control playback"
              }
              className="size-9 shrink-0 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 disabled:opacity-40 sm:size-10"
            >
              {uiPlaying ? (
                <PauseMark className="size-4 sm:size-5" />
              ) : (
                <PlayMark className="ml-0.5 size-4 sm:size-5" />
              )}
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium tabular-nums text-white/80">
              <span>
                {formatTime(uiTime)}
                {showProgress && (
                  <span className="text-white/40"> / {formatTime(progressMax)}</span>
                )}
              </span>
              <span className="hidden text-white/30 sm:inline">·</span>
              <span
                className={cn(
                  "hidden sm:inline",
                  uiPlaying ? "text-emerald-400" : "text-white/50",
                )}
              >
                {uiPlaying ? "Playing" : "Paused"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {showCaptions && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleCaptions}
                  title="Subtitles"
                  className={cn(
                    "size-8 text-white/70 hover:bg-white/10 hover:text-white sm:size-9",
                    captionsOn && "bg-white/15 text-[#00a8e1]",
                  )}
                >
                  <Subtitles className="size-4" />
                </Button>
              )}

              {showQuality && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Quality"
                        className="size-8 text-white/70 hover:bg-white/10 hover:text-white sm:size-9"
                      >
                        <Settings2 className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[120px] border-white/10 bg-[#181818]"
                  >
                    {qualities.map((q) => (
                      <DropdownMenuItem
                        key={q}
                        onClick={() => setQuality(q)}
                        className={cn(
                          activeQuality === q && "text-[#e50914]",
                        )}
                      >
                        {QUALITY_LABELS[q] ?? q}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={isYoutube ? toggleFullscreen : toggleDirectFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="size-8 text-white/70 hover:bg-white/10 hover:text-white sm:size-9"
              >
                {isFullscreen ? (
                  <Minimize className="size-4" />
                ) : (
                  <Maximize className="size-4" />
                )}
              </Button>
            </div>
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
