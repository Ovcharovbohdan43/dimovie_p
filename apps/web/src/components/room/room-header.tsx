"use client";

import { useState } from "react";
import type { RoomSummary } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { BackMark, ShareMark } from "@/components/home/marks";
import { DiMovieLogo } from "@/components/brand/dimovie-logo";

interface RoomHeaderProps {
  room: RoomSummary;
  code: string;
  isOwner: boolean;
  onBack: () => void;
  onCloseRoom?: () => void;
  isClosingRoom?: boolean;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}

export function RoomHeader({
  room,
  code,
  isOwner,
  onBack,
  onCloseRoom,
  isClosingRoom,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${code}`;
    setShareError(false);

    // Always copy immediately — navigator.share opens a sheet and skips clipboard.
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setShareError(true);
      window.setTimeout(() => setShareError(false), 2500);
    }
  };

  const accent = room.branding?.accentColor ?? "#e50914";
  const shareLabel = shareError ? "Failed" : copied ? "Copied" : "Share";

  return (
    <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-[1920px] items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-8 shrink-0 place-items-center text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          <BackMark className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <DiMovieLogo
            markClassName="size-6"
            wordmarkClassName="text-sm sm:text-base"
            className="gap-1.5"
            color={accent}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isOwner && onCloseRoom ? (
            <button
              type="button"
              onClick={onCloseRoom}
              disabled={isClosingRoom}
              className="inline-flex h-8 items-center px-2 text-[12px] font-semibold text-[#e50914] transition hover:bg-[#e50914]/10 disabled:opacity-50"
            >
              {isClosingRoom ? "Closing…" : "Close"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label={shareLabel}
            aria-live="polite"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 px-1.5 text-[12px] font-semibold transition",
              shareError
                ? "text-[#ff6b73]"
                : copied
                  ? "text-emerald-300"
                  : "text-white/75 hover:text-white",
            )}
          >
            <ShareMark className="size-3.5 opacity-70" />
            <span>{shareLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
