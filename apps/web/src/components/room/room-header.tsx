"use client";

import { useState, type ReactNode } from "react";
import type { RoomParticipant, RoomSummary } from "@dimovie/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomParticipantsMenu } from "@/components/room/room-participants-menu";
import { BackMark, LiveDot } from "@/components/home/marks";

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
    `Watch Party · ${code}`;

  const accent = room.branding?.accentColor ?? "#e50914";
  const live = connected && !reconnecting && hasJoined;

  return (
    <>
      <header className="relative z-20 shrink-0 border-b border-white/[0.06] bg-[#08080c]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between gap-3 px-4 sm:gap-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <BackMark className="size-5" />
            </Button>

            <div className="min-w-0">
              {room.branding?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={room.branding.logoUrl}
                  alt=""
                  className="mb-1 h-5 w-auto object-contain"
                />
              )}
              <p
                className="truncate text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                DiMovie Watch Party
              </p>
              <h1 className="truncate font-display text-sm font-semibold tracking-[-0.02em] text-white md:text-base">
                {videoTitle}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            {voiceSlot}

            <div
              className={cn(
                "hidden items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] sm:flex",
                live
                  ? "bg-[#e50914]/15 text-[#ff6b73]"
                  : "bg-white/[0.06] text-white/55",
              )}
            >
              <LiveDot className={live ? "text-[#e50914]" : "text-white/35"} />
              {reconnecting || !hasJoined
                ? "Connecting"
                : connected
                  ? "Live"
                  : "Offline"}
            </div>

            {isOwner && onCloseRoom && hasJoined && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCloseRoom}
                disabled={isClosingRoom}
                className="h-8 border-[#e50914]/30 bg-[#e50914]/10 text-xs text-[#e50914] hover:bg-[#e50914]/20"
              >
                {isClosingRoom ? "Closing..." : "Close room"}
              </Button>
            )}

            <button
              type="button"
              onClick={() => setParticipantsOpen(true)}
              className="flex cursor-pointer select-none items-center gap-1.5 bg-white/[0.06] px-2.5 py-1 text-xs text-white/70 ring-1 ring-white/[0.06] transition hover:bg-white/10 hover:text-white"
              aria-label="Open participants list"
            >
              <span className="font-medium tabular-nums">
                {participantCount}/{room.maxUsers}
              </span>
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-8 border-white/10 bg-white/[0.04] text-xs hover:bg-white/10"
            >
              {copied ? "Copied" : "Share"}
            </Button>
          </div>
        </div>
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
