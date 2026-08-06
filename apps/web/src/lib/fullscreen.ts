/** Cross-browser fullscreen helpers (iOS Safari needs video.webkitEnterFullscreen). */

type VideoFs = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsFullscreen?: boolean;
  webkitSetPresentationMode?: (mode: "fullscreen" | "inline" | "picture-in-picture") => void;
  webkitPresentationMode?: "fullscreen" | "inline" | "picture-in-picture";
};

type DocFs = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type ElFs = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export function getFullscreenElement(): Element | null {
  const doc = document as DocFs;
  return (
    document.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

export function isVideoNativeFullscreen(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const v = video as VideoFs;
  if (v.webkitDisplayingFullscreen) return true;
  if (v.webkitPresentationMode === "fullscreen") return true;
  return getFullscreenElement() === video;
}

export function isElementFullscreen(
  el: HTMLElement | null,
  video?: HTMLVideoElement | null,
): boolean {
  if (!el && !video) return false;
  if (video && isVideoNativeFullscreen(video)) return true;
  const fs = getFullscreenElement();
  if (!fs || !el) return false;
  return fs === el || el.contains(fs);
}

async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const node = el as ElFs;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (node.webkitRequestFullscreen) {
      await node.webkitRequestFullscreen();
      return true;
    }
    if (node.mozRequestFullScreen) {
      await node.mozRequestFullScreen();
      return true;
    }
    if (node.msRequestFullscreen) {
      await node.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as DocFs;
  try {
    if (getFullscreenElement()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }
      if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return;
      }
      if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        return;
      }
      if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    }
  } catch {
    /* ignore */
  }
}

function enterVideoNativeFullscreen(video: HTMLVideoElement): boolean {
  const v = video as VideoFs;
  try {
    if (typeof v.webkitSetPresentationMode === "function") {
      v.webkitSetPresentationMode("fullscreen");
      return true;
    }
    if (typeof v.webkitEnterFullscreen === "function") {
      // iOS: only works from a user gesture; throws if not allowed.
      v.webkitEnterFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function exitVideoNativeFullscreen(video: HTMLVideoElement): boolean {
  const v = video as VideoFs;
  try {
    if (
      typeof v.webkitSetPresentationMode === "function" &&
      v.webkitPresentationMode === "fullscreen"
    ) {
      v.webkitSetPresentationMode("inline");
      return true;
    }
    if (v.webkitDisplayingFullscreen && typeof v.webkitExitFullscreen === "function") {
      v.webkitExitFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

const FALLBACK_CLASS = "dimovie-fs-fallback";

function setCssFallback(el: HTMLElement, on: boolean): void {
  if (on) {
    el.classList.add(FALLBACK_CLASS);
    document.documentElement.classList.add("dimovie-fs-active");
    document.body.classList.add("dimovie-fs-active");
  } else {
    el.classList.remove(FALLBACK_CLASS);
    document.documentElement.classList.remove("dimovie-fs-active");
    document.body.classList.remove("dimovie-fs-active");
  }
}

export function clearCssFullscreenFallback(el: HTMLElement | null): void {
  if (el) setCssFallback(el, false);
}

/**
 * Enter fullscreen for a direct/HLS `<video>` (Rezka etc.).
 * Prefers iOS native video fullscreen, then element API, then CSS fallback.
 */
export async function enterVideoFullscreen(
  container: HTMLElement,
  video: HTMLVideoElement | null,
): Promise<void> {
  if (video && enterVideoNativeFullscreen(video)) return;
  if (video && (await requestElementFullscreen(video))) return;
  if (await requestElementFullscreen(container)) return;
  setCssFallback(container, true);
}

export async function exitVideoFullscreen(
  container: HTMLElement,
  video: HTMLVideoElement | null,
): Promise<void> {
  if (video && exitVideoNativeFullscreen(video)) {
    setCssFallback(container, false);
    return;
  }
  await exitDocumentFullscreen();
  setCssFallback(container, false);
}

export async function toggleVideoFullscreen(
  container: HTMLElement,
  video: HTMLVideoElement | null,
): Promise<boolean> {
  const active =
    isElementFullscreen(container, video) ||
    container.classList.contains(FALLBACK_CLASS);
  if (active) {
    await exitVideoFullscreen(container, video);
    return false;
  }
  await enterVideoFullscreen(container, video);
  return (
    isElementFullscreen(container, video) ||
    container.classList.contains(FALLBACK_CLASS)
  );
}

/** YouTube / container-only fullscreen (no `<video>`). */
export async function toggleContainerFullscreen(
  container: HTMLElement,
): Promise<boolean> {
  const active =
    isElementFullscreen(container) ||
    container.classList.contains(FALLBACK_CLASS);
  if (active) {
    await exitDocumentFullscreen();
    setCssFallback(container, false);
    return false;
  }
  if (await requestElementFullscreen(container)) return true;
  setCssFallback(container, true);
  return true;
}

export function subscribeFullscreenChange(
  handler: () => void,
  video?: HTMLVideoElement | null,
): () => void {
  const events = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange",
  ] as const;
  for (const ev of events) {
    document.addEventListener(ev, handler);
  }

  const onWebkitBegin = () => handler();
  const onWebkitEnd = () => handler();
  const onPresentation = () => handler();

  if (video) {
    video.addEventListener("webkitbeginfullscreen", onWebkitBegin);
    video.addEventListener("webkitendfullscreen", onWebkitEnd);
    video.addEventListener("webkitpresentationmodechanged", onPresentation);
  }

  return () => {
    for (const ev of events) {
      document.removeEventListener(ev, handler);
    }
    if (video) {
      video.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      video.removeEventListener("webkitendfullscreen", onWebkitEnd);
      video.removeEventListener("webkitpresentationmodechanged", onPresentation);
    }
  };
}
