import type { YTPlayer } from "@/hooks/use-youtube-api";

const YT_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";

export type YtCaptionTrack = {
  languageCode: string;
  languageName?: string;
  displayName?: string;
  kind?: string;
  name?: string;
};

export function configureYouTubeIframe(player: YTPlayer) {
  try {
    const iframe = player.getIframe?.();
    if (!iframe) return;
    iframe.setAttribute("allow", YT_IFRAME_ALLOW);
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("title", "YouTube video player");
    // Custom chrome owns all pointer input — avoids YT's invisible hit targets fighting ours.
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";
  } catch {
    /* iframe may not exist yet */
  }
}

export function getYouTubePlaying(player: YTPlayer | null): boolean {
  if (!player || !window.YT?.PlayerState) return false;
  try {
    const state = player.getPlayerState();
    const { PLAYING, BUFFERING } = window.YT.PlayerState;
    return state === PLAYING || state === BUFFERING;
  } catch {
    return false;
  }
}

export function getYouTubePausedOrCued(player: YTPlayer | null): boolean {
  if (!player || !window.YT?.PlayerState) return true;
  try {
    const state = player.getPlayerState();
    const { PAUSED, CUED, UNSTARTED, ENDED } = window.YT.PlayerState;
    return (
      state === PAUSED ||
      state === CUED ||
      state === UNSTARTED ||
      state === ENDED
    );
  } catch {
    return true;
  }
}

/**
 * Start unmuted playback inside an active user-gesture stack.
 * Retries cover Chrome's common first-call no-op with the IFrame API.
 */
export function playYouTubeFromUserGesture(player: YTPlayer) {
  try {
    player.unMute();
    const volume = player.getVolume?.() ?? 100;
    if (volume <= 0) player.setVolume?.(80);
  } catch {
    /* volume APIs optional */
  }

  player.playVideo();

  queueMicrotask(() => {
    try {
      if (getYouTubePausedOrCued(player)) player.playVideo();
    } catch {
      /* ignore */
    }
  });

  window.setTimeout(() => {
    try {
      if (getYouTubePausedOrCued(player)) {
        player.unMute();
        player.playVideo();
      }
    } catch {
      /* ignore */
    }
  }, 150);
}

/** Remote/sync play without a gesture — mute so Chrome allows autoplay. */
export function playYouTubeMutedForSync(player: YTPlayer) {
  try {
    player.mute();
  } catch {
    /* ignore */
  }
  player.playVideo();
}

export function unmuteYouTubeFromUserGesture(player: YTPlayer) {
  try {
    player.unMute();
    const volume = player.getVolume?.() ?? 100;
    if (volume <= 0) player.setVolume?.(80);
  } catch {
    /* ignore */
  }
  if (getYouTubePausedOrCued(player)) {
    playYouTubeFromUserGesture(player);
  }
}

function preferCaptionTrack(
  tracks: YtCaptionTrack[],
  preferredLangs: string[] = ["en", "ru", "uk", "es", "de", "fr"],
): YtCaptionTrack | null {
  if (!tracks.length) return null;
  for (const lang of preferredLangs) {
    const match = tracks.find((t) =>
      (t.languageCode ?? "").toLowerCase().startsWith(lang),
    );
    if (match) return match;
  }
  return tracks[0] ?? null;
}

export function readYouTubeCaptionTracks(player: YTPlayer): YtCaptionTrack[] {
  try {
    player.loadModule("captions");
  } catch {
    try {
      player.loadModule("cc");
    } catch {
      /* optional */
    }
  }

  const fromCaptions = player.getOption?.("captions", "tracklist");
  if (Array.isArray(fromCaptions) && fromCaptions.length) {
    return fromCaptions as YtCaptionTrack[];
  }

  const fromCc = player.getOption?.("cc", "tracklist");
  if (Array.isArray(fromCc) && fromCc.length) {
    return fromCc as YtCaptionTrack[];
  }

  return [];
}

/** Enable or disable captions. Returns whether captions are on after the call. */
export function setYouTubeCaptionsEnabled(
  player: YTPlayer,
  enabled: boolean,
  preferredLangs?: string[],
): boolean {
  try {
    player.loadModule("captions");
  } catch {
    /* continue — module may already be loaded via onApiChange */
  }

  if (!enabled) {
    try {
      player.setOption("captions", "track", {});
    } catch {
      /* ignore */
    }
    try {
      player.setOption("cc", "track", {});
    } catch {
      /* ignore */
    }
    return false;
  }

  const tracks = readYouTubeCaptionTracks(player);
  const track =
    preferCaptionTrack(tracks, preferredLangs) ??
    ({ languageCode: preferredLangs?.[0] ?? "en" } satisfies YtCaptionTrack);

  try {
    player.setOption("captions", "track", track);
    player.setOption("captions", "reload", true);
    return true;
  } catch {
    try {
      player.setOption("cc", "track", track);
      return true;
    } catch {
      return false;
    }
  }
}

export function suggestYouTubeQuality(
  player: YTPlayer,
  quality: string,
  videoId?: string,
) {
  try {
    if (quality === "auto" || quality === "default") {
      const levels = player.getAvailableQualityLevels?.() ?? [];
      if (levels.length >= 2 && player.setPlaybackQualityRange) {
        player.setPlaybackQualityRange(levels[levels.length - 1]!, levels[0]!);
      }
      player.setPlaybackQuality("default");
      return;
    }

    player.setPlaybackQuality(quality);
    if (typeof player.setPlaybackQualityRange === "function") {
      player.setPlaybackQualityRange(quality, quality);
    }

    // Stronger nudge: reload at the current timestamp with a suggested quality.
    // Modern YouTube may still ignore it, but it remains the only remaining lever.
    if (videoId && typeof player.loadVideoById === "function") {
      const time = player.getCurrentTime?.() ?? 0;
      const playing = getYouTubePlaying(player);
      player.loadVideoById({
        videoId,
        startSeconds: Math.max(0, time),
        suggestedQuality: quality,
      });
      if (playing) player.playVideo();
    }
  } catch {
    /* quality APIs may be no-ops on modern YouTube embeds */
  }
}
