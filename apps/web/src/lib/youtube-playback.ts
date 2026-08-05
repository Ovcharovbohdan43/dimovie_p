import type { YTPlayer } from "@/hooks/use-youtube-api";

const YT_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";

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
