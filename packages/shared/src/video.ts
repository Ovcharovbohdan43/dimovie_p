import { isRezkaHost } from "./catalog.js";

export type VideoProvider =
  | "youtube"
  | "vimeo"
  | "direct"
  | "rezka"
  | "unknown";

export interface VideoPreview {
  provider: VideoProvider;
  videoId?: string;
  thumbnailUrl?: string;
  title?: string;
}

export function getVideoPreview(url: string): VideoPreview {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);

    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname.endsWith("youtube.com") ||
      parsed.hostname.endsWith("youtube-nocookie.com")
    ) {
      let videoId: string | null = null;

      if (parsed.hostname === "youtu.be") {
        videoId = parsed.pathname.slice(1).split("/")[0] ?? null;
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] ?? null;
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] ?? null;
      } else {
        videoId = parsed.searchParams.get("v");
      }

      if (videoId) {
        return {
          provider: "youtube",
          videoId,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }

    if (parsed.hostname.endsWith("vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return {
          provider: "vimeo",
          videoId: id,
          thumbnailUrl: `https://vumbnail.com/${id}.jpg`,
        };
      }
    }

    if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(parsed.pathname)) {
      return { provider: "direct" };
    }

    if (isRezkaHost(parsed.hostname)) {
      return { provider: "rezka" };
    }

    return { provider: "unknown" };
  } catch {
    return { provider: "unknown" };
  }
}
