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
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const handleShare = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/join/${code}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const videoTitle =
    room.branding?.displayTitle ??
    (room.videoSource?.metadata as { title?: string })?.title ??
    `Room ${code}`;

  const accent = room.branding?.accentColor ?? "#e50914";
  const live = connected && !reconnecting && hasJoined;
  const statusLabel = reconnecting || !hasJoined
    ? "…"
    : connected
      ? "Live"
      : "Off";

  return (
    <>
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#08080c]/90 backdrop-blur-xl">
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
              <h1 className="min-w-0 truncate font-display text-sm font-semibold tracking-[-0.02em] text-white/90">
                {videoTitle}
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
              aria-label="Participants"
              className="inline-flex h-8 items-center gap-1.5 border border-white/10 bg-white/[0.04] px-2 text-[11px] font-medium tabular-nums text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <PeopleMark className="size-3.5 opacity-70" />
              {participantCount}
              <span className="hidden text-white/35 sm:inline">/{room.maxUsers}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share room"
              className="inline-flex h-8 items-center gap-1.5 border border-white/10 bg-white/[0.04] px-2 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <ShareMark className="size-3.5 opacity-70" />
              <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
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
