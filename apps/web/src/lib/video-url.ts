import { isRezkaHost } from "@dimovie/shared";

export type VideoProvider = "youtube" | "vimeo" | "direct" | "rezka" | "unknown";

export interface ParsedVideoUrl {
  provider: VideoProvider;
  originalUrl: string;
  embedUrl: string;
  videoId?: string;
}

export function parseVideoUrl(input: string): ParsedVideoUrl {
  const trimmed = input.trim();

  if (
    trimmed.startsWith("/backend/catalog/proxy") ||
    /\/catalog\/proxy\?/.test(trimmed)
  ) {
    return {
      provider: "direct",
      originalUrl: trimmed,
      embedUrl: trimmed,
    };
  }

  try {
    const url = new URL(trimmed);

    if (
      url.hostname === "youtu.be" ||
      url.hostname.endsWith("youtube.com") ||
      url.hostname.endsWith("youtube-nocookie.com")
    ) {
      let videoId: string | null = null;

      if (url.hostname === "youtu.be") {
        videoId = url.pathname.slice(1).split("/")[0] ?? null;
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/")[2] ?? null;
      } else if (url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/")[2] ?? null;
      } else {
        videoId = url.searchParams.get("v");
      }

      if (videoId) {
        return {
          provider: "youtube",
          originalUrl: trimmed,
          videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`,
        };
      }
    }

    if (url.hostname.endsWith("vimeo.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return {
          provider: "vimeo",
          originalUrl: trimmed,
          videoId: id,
          embedUrl: `https://player.vimeo.com/video/${id}`,
        };
      }
    }

    if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url.pathname)) {
      return {
        provider: "direct",
        originalUrl: trimmed,
        embedUrl: trimmed,
      };
    }

    if (isRezkaHost(url.hostname)) {
      return {
        provider: "rezka",
        originalUrl: trimmed,
        embedUrl: trimmed,
      };
    }

    return {
      provider: "unknown",
      originalUrl: trimmed,
      embedUrl: trimmed,
    };
  } catch {
    return {
      provider: "unknown",
      originalUrl: trimmed,
      embedUrl: trimmed,
    };
  }
}

export function getPlayableStreamUrl(
  room: { videoSource?: { url: string; metadata?: Record<string, unknown> } },
): string {
  const meta = room.videoSource?.metadata;
  if (meta?.streamUrl && typeof meta.streamUrl === "string") {
    return meta.streamUrl;
  }
  return room.videoSource?.url ?? "";
}
