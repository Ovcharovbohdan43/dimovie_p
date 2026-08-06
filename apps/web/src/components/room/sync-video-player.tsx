"use client";

import { useEffect, useRef, useId, useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SyncStatePayload } from "@dimovie/shared";
import { parseVideoUrl } from "@/lib/video-url";
import {
  clearCssFullscreenFallback,
  isElementFullscreen,
  subscribeFullscreenChange,
  toggleContainerFullscreen,
  toggleVideoFullscreen,
} from "@/lib/fullscreen";
import { useYouTubeApiReady, type YTPlayer } from "@/hooks/use-youtube-api";
import {
  configureYouTubeIframe,
  getYouTubePlaying,
  playYouTubeFromUserGesture,
  playYouTubeMutedForSync,
  readYouTubeCaptionTracks,
  setYouTubeCaptionsEnabled,
  suggestYouTubeQuality,
  unmuteYouTubeFromUserGesture,
  type YtCaptionTrack,
} from "@/lib/youtube-playback";
import { cn } from "@/lib/utils";
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
  voiceDuckFactor?: number;
  canControl?: boolean;
}

const FALLBACK_YT_QUALITIES = [
  "highres",
  "hd1080",
  "hd720",
  "large",
  "medium",
  "small",
  "tiny",
  "default",
] as const;

const QUALITY_LABELS: Record<string, string> = {
  auto: "Auto",
  default: "Auto",
  highres: "4K",
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
  highres: 2160,
  hd1080: 1080,
  hd720: 720,
  large: 480,
  medium: 360,
  small: 240,
  tiny: 144,
  default: 0,
};

function filterQualities(levels: string[], maxVideoQuality: "720p" | "1080p") {
  const cap = maxVideoQuality === "720p" ? 720 : 1080;
  const filtered = levels.filter((q) => {
    if (q === "default" || q === "auto") return true;
    return (QUALITY_RANK[q] ?? 0) <= cap;
  });
  return filtered.length ? filtered : ["default"];
}

function buildQualityOptions(
  levels: string[],
  maxVideoQuality: "720p" | "1080p",
) {
  const merged = levels.length
    ? levels
    : [...FALLBACK_YT_QUALITIES];
  const filtered = filterQualities(merged, maxVideoQuality);
  // Keep Auto first, then highest → lowest.
  const withoutDefault = filtered.filter((q) => q !== "default" && q !== "auto");
  withoutDefault.sort(
    (a, b) => (QUALITY_RANK[b] ?? 0) - (QUALITY_RANK[a] ?? 0),
  );
  return ["default", ...withoutDefault];
}

function applySyncToPlayer(
  syncState: SyncStatePayload,
  provider: ReturnType<typeof parseVideoUrl>["provider"],
  ytPlayer: YTPlayer | null,
  videoEl: HTMLVideoElement | null,
  syncDriftThresholdSec: number,
  mediaUnlocked: boolean,
): "ok" | "needs-unmute" {
  if (provider === "youtube" && ytPlayer) {
    const drift = Math.abs(ytPlayer.getCurrentTime() - syncState.time);
    if (drift > syncDriftThresholdSec) {
      ytPlayer.seekTo(syncState.time, true);
    }
    if (syncState.isPlaying) {
      if (mediaUnlocked) {
        playYouTubeFromUserGesture(ytPlayer);
        return "ok";
      }
      playYouTubeMutedForSync(ytPlayer);
      return "needs-unmute";
    }
    ytPlayer.pauseVideo();
    return "ok";
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
  return "ok";
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
  voiceDuckFactor = 1,
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
  const mediaUnlockedRef = useRef(false);
  const playRetryTimers = useRef<number[]>([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualities, setQualities] = useState<string[]>(() =>
    buildQualityOptions([], maxVideoQuality),
  );
  const [activeQuality, setActiveQuality] = useState("default");
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionTracks, setCaptionTracks] = useState<YtCaptionTrack[]>([]);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [qualityHint, setQualityHint] = useState<string | null>(null);
  const preferredQualityRef = useRef("default");
  const captionsWantedRef = useRef(false);
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
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState(false);
  const hideTimer = useRef<number | null>(null);

  onIntentRef.current = onIntent;
  syncStateRef.current = syncState;

  const clearPlayRetries = useCallback(() => {
    playRetryTimers.current.forEach((id) => window.clearTimeout(id));
    playRetryTimers.current = [];
  }, []);

  const markMediaUnlocked = useCallback(() => {
    mediaUnlockedRef.current = true;
  }, []);

  useEffect(() => {
    if (!broadcastEnded) return;
    ytPlayer.current?.pauseVideo();
    videoRef.current?.pause();
  }, [broadcastEnded]);

  useEffect(
    () => () => {
      clearCssFullscreenFallback(containerRef.current);
    },
    [],
  );

  useEffect(() => () => clearPlayRetries(), [clearPlayRetries]);

  const getTime = useCallback((): number => {
    if (parsed.provider === "youtube" && ytPlayer.current) {
      return ytPlayer.current.getCurrentTime() ?? 0;
    }
    if (parsed.provider === "direct" && videoRef.current) {
      return videoRef.current.currentTime;
    }
    return syncState?.time ?? 0;
  }, [parsed.provider, syncState?.time]);

  const unlockYouTubeSound = useCallback(() => {
    const player = ytPlayer.current;
    if (!player) return;
    markMediaUnlocked();
    setNeedsSoundUnlock(false);
    applyingRemote.current = true;
    const target = syncStateRef.current;
    if (target) {
      const drift = Math.abs(player.getCurrentTime() - target.time);
      if (drift > syncDriftThresholdSec) {
        player.seekTo(target.time, true);
      }
      if (target.isPlaying) {
        playYouTubeFromUserGesture(player);
        setYtPlaying(true);
      } else {
        unmuteYouTubeFromUserGesture(player);
        player.pauseVideo();
        setYtPlaying(false);
      }
    } else {
      unmuteYouTubeFromUserGesture(player);
    }
    window.setTimeout(() => {
      applyingRemote.current = false;
    }, 400);
  }, [markMediaUnlocked, syncDriftThresholdSec]);

  useEffect(() => {
    if (!syncState || syncState.version <= localVersion.current) return;

    const canApply =
      (parsed.provider === "youtube" && playerReady && ytPlayer.current) ||
      (parsed.provider === "direct" && videoRef.current) ||
      parsed.provider === "vimeo";

    if (!canApply) return;

    localVersion.current = syncState.version;
    applyingRemote.current = true;

    const result = applySyncToPlayer(
      syncState,
      parsed.provider,
      ytPlayer.current,
      videoRef.current,
      syncDriftThresholdSec,
      mediaUnlockedRef.current,
    );

    if (parsed.provider === "youtube") {
      setYtTime(syncState.time);
      setYtPlaying(syncState.isPlaying);
      if (result === "needs-unmute" && syncState.isPlaying) {
        setNeedsSoundUnlock(true);
      } else if (!syncState.isPlaying) {
        setNeedsSoundUnlock(false);
      }
    }

    setTimeout(() => {
      applyingRemote.current = false;
    }, 400);
  }, [syncState, parsed.provider, playerReady, syncDriftThresholdSec]);

  useEffect(() => {
    if (parsed.provider !== "youtube" || !parsed.videoId || !ytReady) return;

    setPlayerReady(false);
    setNeedsSoundUnlock(false);
    mediaUnlockedRef.current = false;
    clearPlayRetries();
    const containerId = `yt-${playerId}`;

    const refreshQualityOptions = (target: YTPlayer) => {
      try {
        const levels = target.getAvailableQualityLevels?.() ?? [];
        setQualities(buildQualityOptions(levels, maxVideoQuality));
        const current = target.getPlaybackQuality?.();
        if (current) setActiveQuality(current);
      } catch {
        setQualities(buildQualityOptions([], maxVideoQuality));
      }
    };

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
        cc_lang_pref: "en",
        fs: 0,
        playsinline: 1,
        iv_load_policy: 3,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          ytPlayer.current = event.target;
          configureYouTubeIframe(event.target);
          setPlayerReady(true);
          setQualities(buildQualityOptions([], maxVideoQuality));

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

          refreshQualityOptions(event.target);

          if (syncStateRef.current && syncStateRef.current.version > localVersion.current) {
            const state = syncStateRef.current;
            localVersion.current = state.version;
            applyingRemote.current = true;
            const result = applySyncToPlayer(
              state,
              "youtube",
              event.target,
              null,
              syncDriftThresholdSec,
              mediaUnlockedRef.current,
            );
            setYtTime(state.time);
            setYtPlaying(state.isPlaying);
            if (result === "needs-unmute" && state.isPlaying) {
              setNeedsSoundUnlock(true);
            }
            setTimeout(() => {
              applyingRemote.current = false;
            }, 400);
          }
        },
        onApiChange: () => {
          const current = ytPlayer.current;
          if (!current) return;
          try {
            const tracks = readYouTubeCaptionTracks(current);
            setCaptionTracks(tracks);
            if (captionsWantedRef.current) {
              const on = setYouTubeCaptionsEnabled(current, true);
              setCaptionsOn(on);
            }
          } catch {
            /* captions module still warming up */
          }
        },
        onPlaybackQualityChange: (event: { data: string }) => {
          if (event?.data) {
            setActiveQuality(event.data);
          }
        },
        onStateChange: (event: { data: number }) => {
          const YT = window.YT!;
          if (
            event.data === YT.PlayerState.PLAYING ||
            event.data === YT.PlayerState.BUFFERING
          ) {
            if (ytPlayer.current) {
              refreshQualityOptions(ytPlayer.current);
              if (preferredQualityRef.current !== "default") {
                suggestYouTubeQuality(
                  ytPlayer.current,
                  preferredQualityRef.current,
                );
              }
              if (captionsWantedRef.current) {
                setYouTubeCaptionsEnabled(ytPlayer.current, true);
              }
            }
          }
          if (event.data === YT.PlayerState.PLAYING) {
            setYtPlaying(true);
            try {
              if (ytPlayer.current?.isMuted() && !mediaUnlockedRef.current) {
                setNeedsSoundUnlock(true);
              }
            } catch {
              /* ignore */
            }
          } else if (
            event.data === YT.PlayerState.PAUSED ||
            event.data === YT.PlayerState.ENDED
          ) {
            setYtPlaying(false);
          }

          if (applyingRemote.current || !canControl) return;
          const now = Date.now();
          if (now - lastLocalAction.current < 500) return;

          const time = ytPlayer.current?.getCurrentTime() ?? 0;

          if (event.data === YT.PlayerState.PLAYING) {
            lastLocalAction.current = now;
            onIntentRef.current("PLAY", time);
          } else if (event.data === YT.PlayerState.PAUSED) {
            lastLocalAction.current = now;
            onIntentRef.current("PAUSE", time);
          }
        },
        onError: () => {
          setVideoError("YouTube couldn’t play this video. Try another link.");
        },
      },
    });

    return () => {
      clearPlayRetries();
      player.destroy();
      ytPlayer.current = null;
      setPlayerReady(false);
      setYtTime(0);
      setYtDuration(0);
      setNeedsSoundUnlock(false);
      setCaptionsOn(false);
      setCaptionTracks([]);
      setQualityMenuOpen(false);
      captionsWantedRef.current = false;
      preferredQualityRef.current = "default";
    };
  }, [
    parsed.provider,
    parsed.videoId,
    ytReady,
    playerId,
    maxVideoQuality,
    syncDriftThresholdSec,
    canControl,
    clearPlayRetries,
  ]);

  const isYoutube = parsed.provider === "youtube";
  const isDirect = parsed.provider === "direct";
  const duckFactor = Math.min(1, Math.max(0, voiceDuckFactor));

  useEffect(() => {
    const syncFs = () => {
      const container = containerRef.current;
      const video = isDirect ? videoRef.current : null;
      const cssOn = container?.classList.contains("dimovie-fs-fallback") ?? false;
      setIsFullscreen(isElementFullscreen(container, video) || cssOn);
    };
    // Bind after playerReady so iOS video webkit* listeners attach to the node.
    return subscribeFullscreenChange(syncFs, isDirect ? videoRef.current : null);
  }, [url, isDirect, playerReady]);

  const applyOutputVolume = useCallback(() => {
    const base = muted ? 0 : volume;
    const effective = Math.min(1, Math.max(0, base * duckFactor));

    if (isDirect && videoRef.current) {
      videoRef.current.volume = effective;
      videoRef.current.muted = muted || effective <= 0;
    }

    if (isYoutube && ytPlayer.current && playerReady) {
      try {
        if (needsSoundUnlock) return;
        if (muted || effective <= 0.001) {
          ytPlayer.current.mute();
        } else {
          ytPlayer.current.unMute();
          ytPlayer.current.setVolume(Math.round(effective * 100));
        }
      } catch {
        /* volume APIs optional */
      }
    }
  }, [
    muted,
    volume,
    duckFactor,
    isDirect,
    isYoutube,
    playerReady,
    needsSoundUnlock,
  ]);

  useEffect(() => {
    applyOutputVolume();
  }, [applyOutputVolume]);

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
    clearPlayRetries();

    if (parsed.provider === "youtube" && ytPlayer.current) {
      markMediaUnlocked();
      setNeedsSoundUnlock(false);
      const actuallyPlaying = getYouTubePlaying(ytPlayer.current);
      if (actuallyPlaying) {
        ytPlayer.current.pauseVideo();
        setYtPlaying(false);
        onIntentRef.current("PAUSE", time);
      } else {
        playYouTubeFromUserGesture(ytPlayer.current);
        setYtPlaying(true);
        onIntentRef.current("PLAY", time);

        // Verify playback started; recover from Chrome's silent first-call drop.
        const retryId = window.setTimeout(() => {
          const player = ytPlayer.current;
          if (!player || !canControl) return;
          if (!getYouTubePlaying(player)) {
            playYouTubeFromUserGesture(player);
          }
        }, 220);
        playRetryTimers.current.push(retryId);
      }
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
  }, [
    getTime,
    syncState?.isPlaying,
    parsed.provider,
    canControl,
    clearPlayRetries,
    markMediaUnlocked,
  ]);

  const handleStagePointerDown = useCallback(() => {
    markMediaUnlocked();
  }, [markMediaUnlocked]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      const on = await toggleContainerFullscreen(el);
      setIsFullscreen(on);
    } catch {
      /* gesture / policy */
    }
  }, []);

  const setQuality = useCallback(
    (quality: string) => {
      if (!ytPlayer.current) return;
      preferredQualityRef.current = quality;
      setActiveQuality(quality);
      setQualityMenuOpen(false);
      suggestYouTubeQuality(ytPlayer.current, quality, parsed.videoId);

      window.setTimeout(() => {
        const player = ytPlayer.current;
        if (!player) return;
        suggestYouTubeQuality(player, quality);
        try {
          const actual = player.getPlaybackQuality?.();
          if (actual) setActiveQuality(actual);
          if (
            quality !== "default" &&
            quality !== "auto" &&
            actual &&
            actual !== quality &&
            actual !== "unknown"
          ) {
            setQualityHint("YouTube may keep Auto on embeds");
            window.setTimeout(() => setQualityHint(null), 3200);
          } else {
            setQualityHint(null);
          }
        } catch {
          /* ignore */
        }
      }, 700);
    },
    [parsed.videoId],
  );

  const toggleCaptions = useCallback(() => {
    if (!ytPlayer.current) return;
    const next = !captionsWantedRef.current;
    captionsWantedRef.current = next;
    const on = setYouTubeCaptionsEnabled(ytPlayer.current, next);
    setCaptionsOn(on);
    if (next && !on) {
      // Module may not be ready yet — onApiChange / PLAYING will retry via ref.
      setCaptionsOn(true);
    }
    if (next) {
      const tracks = readYouTubeCaptionTracks(ytPlayer.current);
      setCaptionTracks(tracks);
    }
  }, []);

  const toggleDirectFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      const on = await toggleVideoFullscreen(container, videoRef.current);
      setIsFullscreen(on);
    } catch {
      /* gesture / policy */
    }
  }, []);

  const showQuality = isYoutube;
  const showCaptions = isYoutube;
  const locallyPlaying = isDirect ? directPlaying : isYoutube ? ytPlaying : false;
  const progressMax = isDirect ? directDuration : isYoutube ? ytDuration : 0;
  const progressValue = Math.min(
    seekValue ?? (isDirect ? directTime : isYoutube ? ytTime : 0),
    progressMax || 0,
  );
  const uiTime = seekValue ?? (isDirect ? directTime : isYoutube ? ytTime : (syncState?.time ?? 0));
  const showProgress = (isDirect || isYoutube) && progressMax > 0;
  const controlsVisible =
    controlsPinned ||
    scrubbing ||
    seekValue !== null ||
    !locallyPlaying ||
    needsSoundUnlock ||
    qualityMenuOpen;

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
    if (scrubbing || seekValue !== null || needsSoundUnlock || qualityMenuOpen) {
      return;
    }
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
    needsSoundUnlock,
    qualityMenuOpen,
    isDirect,
    isYoutube,
    directPlaying,
    syncState?.isPlaying,
    ytPlaying,
  ]);

  // Attach reveal/schedule into stage click after they exist
  const handleStageClickStable = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (broadcastEnded) return;
      if ((e.target as HTMLElement).closest("[data-player-chrome]")) return;

      if (isYoutube && needsSoundUnlock) {
        unlockYouTubeSound();
        revealControls();
        scheduleHideControls();
        return;
      }

      if (!canControl || (!isYoutube && !isDirect)) return;
      if (!playerReady) return;

      revealControls();
      togglePlay();
      scheduleHideControls();
    },
    [
      broadcastEnded,
      isYoutube,
      isDirect,
      needsSoundUnlock,
      unlockYouTubeSound,
      canControl,
      playerReady,
      togglePlay,
      revealControls,
      scheduleHideControls,
    ],
  );

  useEffect(() => {
    if (!qualityMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQualityMenuOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-quality-menu]")) return;
      setQualityMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [qualityMenuOpen]);

  useEffect(() => {
    if (!locallyPlaying || scrubbing || seekValue !== null || needsSoundUnlock || qualityMenuOpen) {
      setControlsPinned(true);
      clearHideTimer();
      return;
    }
    scheduleHideControls();
    return clearHideTimer;
  }, [
    locallyPlaying,
    scrubbing,
    seekValue,
    needsSoundUnlock,
    qualityMenuOpen,
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
        markMediaUnlocked();
        if (isYoutube && needsSoundUnlock) {
          unlockYouTubeSound();
          revealControls();
          scheduleHideControls();
          return;
        }
        revealControls();
        togglePlay();
        scheduleHideControls();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void (isYoutube ? toggleFullscreen() : toggleDirectFullscreen());
      } else if (e.key === "m" || e.key === "M") {
        if (isYoutube && ytPlayer.current) {
          e.preventDefault();
          markMediaUnlocked();
          try {
            if (ytPlayer.current.isMuted()) {
              unmuteYouTubeFromUserGesture(ytPlayer.current);
              setNeedsSoundUnlock(false);
              setMuted(false);
            } else {
              ytPlayer.current.mute();
              setMuted(true);
            }
          } catch {
            /* ignore */
          }
          return;
        }
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
    markMediaUnlocked,
    needsSoundUnlock,
    unlockYouTubeSound,
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

  const showCenterPlay =
    (isYoutube || isDirect) &&
    playerReady &&
    !broadcastEnded &&
    !locallyPlaying &&
    canControl &&
    !needsSoundUnlock;
  const showUnlockCue = isYoutube && playerReady && !broadcastEnded && needsSoundUnlock;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "group/player relative aspect-video w-full select-none overflow-hidden bg-black outline-none ring-1 ring-white/[0.06] focus-visible:ring-[#e50914]/50",
        locallyPlaying && !controlsVisible && !needsSoundUnlock && "cursor-none",
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
        <div
          id={`yt-${playerId}`}
          className="pointer-events-none absolute inset-0 h-full w-full [&>iframe]:pointer-events-none [&>iframe]:h-full [&>iframe]:w-full"
        />
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

      {/* Unified stage hit-target — owns play/pause & sound unlock without fighting YT iframe */}
      {(isYoutube || isDirect) && playerReady && !broadcastEnded && (
        <div
          className={cn(
            "absolute inset-0 z-[15]",
            canControl || needsSoundUnlock ? "cursor-pointer" : "cursor-default",
          )}
          onPointerDown={handleStagePointerDown}
          onClick={handleStageClickStable}
          role="presentation"
        >
          {showCenterPlay && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="grid size-14 place-items-center rounded-full bg-[#e50914] text-white shadow-[0_12px_40px_rgba(229,9,20,0.35)] transition duration-200 group-hover/player:scale-[1.04] sm:size-16">
                <PlayMark className="ml-0.5 size-6 sm:size-7" />
              </span>
            </div>
          )}

          {showUnlockCue && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/15 bg-[#0e0e14]/92 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_48px_rgba(0,0,0,0.45)] transition hover:border-white/25 hover:bg-[#14141c]"
                onClick={(e) => {
                  e.stopPropagation();
                  unlockYouTubeSound();
                  revealControls();
                  scheduleHideControls();
                }}
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#e50914]">
                  <VolumeMark className="size-5" />
                </span>
                Tap to enable sound
              </button>
            </div>
          )}
        </div>
      )}

      {isDirect && videoLoading && !videoError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <LoadingSpinner size="lg" className="border-white/20 border-t-[#e50914]" />
        </div>
      )}

      {videoError && (
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
                className="mt-6 h-10 rounded-full bg-[#e50914] px-5 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#f40612]"
                onClick={onLeave}
              >
                Go home
              </button>
            )}
          </div>
        </div>
      )}

      <div
        data-player-chrome
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-200 ease-out",
          controlsVisible && !broadcastEnded
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onMouseEnter={revealControls}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
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

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              className="player-ctrl"
              onClick={(e) => {
                e.stopPropagation();
                markMediaUnlocked();
                if (isYoutube && needsSoundUnlock) {
                  unlockYouTubeSound();
                  return;
                }
                revealControls();
                togglePlay();
                scheduleHideControls();
              }}
              disabled={!canControl && !(isYoutube && needsSoundUnlock)}
              title={
                needsSoundUnlock
                  ? "Enable sound"
                  : canControl
                    ? locallyPlaying
                      ? "Pause"
                      : "Play"
                    : "Only the host can control playback"
              }
            >
              {locallyPlaying ? (
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

            {(isDirect || isYoutube) && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="player-ctrl"
                  title={muted || volume === 0 ? "Unmute" : "Mute"}
                  onClick={(e) => {
                    e.stopPropagation();
                    markMediaUnlocked();
                    if (isYoutube && ytPlayer.current) {
                      try {
                        if (ytPlayer.current.isMuted() || muted) {
                          unmuteYouTubeFromUserGesture(ytPlayer.current);
                          setNeedsSoundUnlock(false);
                          setMuted(false);
                          if (volume === 0) setVolume(0.8);
                        } else {
                          ytPlayer.current.mute();
                          setMuted(true);
                        }
                      } catch {
                        /* ignore */
                      }
                      return;
                    }
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
                  {muted || volume === 0 || needsSoundUnlock ? (
                    <VolumeMuteMark className="size-4" />
                  ) : (
                    <VolumeMark className="size-4" />
                  )}
                </button>
                {isDirect && (
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
                )}
              </div>
            )}

            {showCaptions && (
              <button
                type="button"
                className="player-ctrl"
                data-active={captionsOn ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  revealControls();
                  toggleCaptions();
                  scheduleHideControls();
                }}
                title={
                  captionsOn
                    ? "Hide subtitles"
                    : captionTracks.length
                      ? "Show subtitles"
                      : "Subtitles (if available)"
                }
              >
                <CaptionsMark className="size-4" />
              </button>
            )}

            {showQuality && (
              <div className="relative" data-quality-menu>
                <button
                  type="button"
                  title="Quality"
                  className="player-ctrl player-ctrl--label font-mono text-[10px] font-semibold tracking-[0.08em] text-white/70 hover:text-white"
                  data-active={qualityMenuOpen ? "true" : undefined}
                  aria-expanded={qualityMenuOpen}
                  aria-haspopup="listbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    revealControls();
                    setQualityMenuOpen((open) => !open);
                  }}
                >
                  {QUALITY_LABELS[activeQuality] ??
                    QUALITY_LABELS[preferredQualityRef.current] ??
                    "Auto"}
                </button>
                {qualityMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Video quality"
                    className="absolute bottom-[calc(100%+0.5rem)] right-0 z-40 min-w-[8.5rem] overflow-hidden rounded-xl border border-white/10 bg-[#0c0c10]/96 p-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {qualities.map((q) => {
                      const selected =
                        preferredQualityRef.current === q ||
                        activeQuality === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition",
                            selected
                              ? "bg-white/[0.06] text-[#e50914]"
                              : "text-white/75 hover:bg-white/[0.05] hover:text-white",
                          )}
                          onClick={() => setQuality(q)}
                        >
                          <span>{QUALITY_LABELS[q] ?? q}</span>
                          {selected && (
                            <span className="text-[10px] tracking-wide text-white/35">
                              ON
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {qualityHint && (
                      <p className="border-t border-white/8 px-2.5 py-2 text-[10px] leading-snug text-white/40">
                        {qualityHint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="player-ctrl"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                revealControls();
                if (isYoutube) {
                  void toggleFullscreen();
                } else {
                  void toggleDirectFullscreen();
                }
                scheduleHideControls();
              }}
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
