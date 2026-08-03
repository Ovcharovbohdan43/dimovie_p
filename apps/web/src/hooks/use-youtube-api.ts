"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: Record<string, unknown>,
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getAvailableQualityLevels: () => string[];
  setPlaybackQuality: (quality: string) => void;
  getPlaybackQuality: () => string;
  loadModule: (module: string) => void;
  setOption: (module: string, option: string, value: unknown) => void;
  getOption: (module: string, option: string) => unknown;
  destroy: () => void;
}

let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
  }

  return ytApiPromise;
}

export type { YTPlayer };

export function useYouTubeApiReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadYouTubeApi().then(() => setReady(true));
  }, []);

  return ready;
}
