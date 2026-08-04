"use client";

import { useState, type ReactNode } from "react";
import type { RoomParticipant, RoomSummary } from "@dimovie/shared";
import { cn } from "@/lib/utils";
import { RoomParticipantsMenu } from "@/components/room/room-participants-menu";
import {
  BackMark,
  LiveDot,
  PeopleMark,
  ShareMark,
} from "@/components/home/marks";

interface RoomHeaderProps {
  room: RoomSummary;
  code: string;
  connected: boolean;
  reconnecting: boolean;
  hasJoined: boolean;
  participantCount: number;
  participants: RoomParticipant[];
  isOwner: boolean;
  currentUserId?: string;
  onBack: () => void;
  onCloseRoom?: () => void;
  isClosingRoom?: boolean;
  voiceSlot?: ReactNode;
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
  connected,
  reconnecting,
  hasJoined,
  participantCount,
  participants,
  isOwner,
  currentUserId,
  onBack,
  onCloseRoom,
  isClosingRoom,
  voiceSlot,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${code}`;
    setShareError(false);

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "DiMovie party",
          text: `Join my DiMovie room ${code}`,
          url,
        });
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (err) {
      // User dismissed the share sheet — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

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
  const live = connected && !reconnecting && hasJoined;
  const statusLabel = reconnecting || !hasJoined
    ? "…"
    : connected
      ? "Live"
      : "Off";

  const shareLabel = shareError ? "Failed" : copied ? "Copied" : "Share";

  return (
    <>
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-[1920px] items-center gap-2 px-3 sm:h-12 sm:gap-3 sm:px-4 md:px-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid size-8 shrink-0 place-items-center text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <BackMark className="size-4" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span
                className="shrink-0 font-display text-sm font-bold tracking-[-0.04em]"
                style={{ color: accent }}
              >
                DiMovie
              </span>
              <span className="hidden text-white/20 sm:inline">/</span>
              <h1 className="min-w-0 truncate font-sans text-sm font-semibold tracking-[-0.02em] text-white/55">
                {code}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                live ? "text-[#ff6b73]" : "text-white/40",
              )}
              title={
                reconnecting || !hasJoined
                  ? "Connecting"
                  : connected
                    ? "Live"
                    : "Offline"
              }
            >
              <LiveDot className={live ? "text-[#e50914]" : "text-white/30"} />
              <span className="hidden xs:inline sm:inline">{statusLabel}</span>
            </span>

            {voiceSlot}

            {isOwner && onCloseRoom && hasJoined && (
              <button
                type="button"
                onClick={onCloseRoom}
                disabled={isClosingRoom}
                className="hidden h-8 items-center px-2 text-[11px] font-medium text-[#e50914] transition hover:bg-[#e50914]/10 disabled:opacity-50 md:inline-flex"
              >
                {isClosingRoom ? "Closing…" : "Close"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setParticipantsOpen(true)}
              aria-label={`${participantCount} participants`}
              title={`${participantCount}/${room.maxUsers}`}
              className="inline-flex h-8 items-center gap-1.5 px-1.5 text-[12px] font-semibold tabular-nums text-white/75 transition hover:text-white"
            >
              <PeopleMark className="size-3.5 opacity-70" />
              {participantCount}
            </button>

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
              <span className="hidden sm:inline">{shareLabel}</span>
            </button>
          </div>
        </div>

        {isOwner && onCloseRoom && hasJoined && (
          <div className="flex justify-end border-t border-white/[0.04] px-3 py-1 md:hidden">
            <button
              type="button"
              onClick={onCloseRoom}
              disabled={isClosingRoom}
              className="text-[11px] font-medium text-[#e50914] disabled:opacity-50"
            >
              {isClosingRoom ? "Closing room…" : "Close room"}
            </button>
          </div>
        )}
      </header>

      <RoomParticipantsMenu
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        roomId={room.id}
        participants={participants}
        maxUsers={room.maxUsers}
        isOwner={isOwner}
        currentUserId={currentUserId}
      />
    </>
  );
}
