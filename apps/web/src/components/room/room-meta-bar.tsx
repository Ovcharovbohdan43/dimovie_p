"use client";

import { useState } from "react";
import { Check, Clock3, Copy, Users } from "lucide-react";
import type { RoomParticipant, RoomSummary } from "@dimovie/shared";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { RoomAnalyticsPanel } from "@/components/room/room-analytics-panel";
import { RoomParticipantsMenu } from "@/components/room/room-participants-menu";
import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/home/marks";

interface RoomMetaBarProps {
  room: RoomSummary;
  participants: RoomParticipant[];
  participantCount: number;
  watchSeconds?: number;
  showAnalytics?: boolean;
  isOwner?: boolean;
  currentUserId?: string;
  className?: string;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

export function RoomMetaBar({
  room,
  participants,
  participantCount,
  watchSeconds = 0,
  showAnalytics = false,
  isOwner = false,
  currentUserId,
  className,
}: RoomMetaBarProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const meta = room.videoSource?.metadata as { title?: string } | undefined;
  const title =
    room.branding?.displayTitle ?? meta?.title ?? `Room ${room.roomCode}`;
  const isLive = room.status === "ACTIVE" && !!room.videoSource?.url;
  const privacy =
    room.privacy === "PUBLIC"
      ? "Public"
      : room.privacy === "PASSWORD"
        ? "Locked"
        : "Private";

  const handleCopyCode = async () => {
    const ok = await copyText(room.roomCode);
    if (!ok) return;
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  const visible = participants.slice(0, 4);
  const overflow = participants.length - visible.length;

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-[#ff6b73]">
                <LiveDot className="text-[#e50914]" />
                Live
              </span>
            ) : (
              <span>Lobby</span>
            )}
            <span className="text-white/25">·</span>
            <span>{privacy}</span>
            <span className="text-white/25">·</span>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              title={copiedCode ? "Copied" : "Copy room code"}
              aria-label={copiedCode ? "Room code copied" : "Copy room code"}
              className="inline-flex items-center gap-1.5 font-mono tracking-widest text-white/55 transition hover:text-white"
            >
              {room.roomCode}
              {copiedCode ? (
                <Check className="size-3.5 text-emerald-300" />
              ) : (
                <Copy className="size-3.5 opacity-70" />
              )}
            </button>
          </div>

          <h2 className="line-clamp-2 font-sans text-lg font-semibold tracking-[-0.03em] text-white sm:text-xl md:text-2xl">
            {title}
          </h2>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/50">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0 rounded-full">
                <AvatarFallback className="bg-white/10 text-[9px] font-semibold text-white">
                  {initials(room.owner.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                <span className="text-white/35">Host </span>
                <span className="font-semibold text-white/80">
                  {room.owner.displayName}
                </span>
              </span>
            </span>

            <span
              title={`${participantCount} viewers`}
              className="inline-flex items-center gap-1.5 tabular-nums text-white/75"
            >
              <Users className="size-3.5 text-white/40" />
              {participantCount}
            </span>

            <span
              title="Session time"
              className="inline-flex items-center gap-1.5 tabular-nums text-white/75"
            >
              <Clock3 className="size-3.5 text-white/40" />
              {formatDuration(watchSeconds)}
            </span>

            {room.scheduledStartsAt &&
            new Date(room.scheduledStartsAt).getTime() > Date.now() ? (
              <span className="inline-flex items-center gap-1.5 text-[#9ec9ea]">
                Starts{" "}
                {new Date(room.scheduledStartsAt).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>

          {room.description ? (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-white/45">
              {room.description}
            </p>
          ) : null}

          {showAnalytics ? (
            <div className="mt-3">
              <RoomAnalyticsPanel roomId={room.id} />
            </div>
          ) : null}
        </div>

        {participants.length > 0 ? (
          <button
            type="button"
            onClick={() => setParticipantsOpen(true)}
            aria-label="Open participants"
            className="shrink-0 pt-1 transition hover:opacity-90"
          >
            <AvatarGroup className="-space-x-3 *:data-[slot=avatar]:ring-[#050508]">
              {visible.map((p, index) => (
                <Avatar
                  key={p.userId}
                  className="size-8 rounded-full sm:size-9"
                  style={{ zIndex: visible.length - index }}
                  title={p.displayName}
                >
                  <AvatarFallback className="bg-white/10 text-[10px] font-semibold text-white">
                    {initials(p.displayName)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflow > 0 ? (
                <AvatarGroupCount className="size-8 bg-white/10 text-[10px] font-semibold text-white/70 ring-[#050508] sm:size-9">
                  +{overflow}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          </button>
        ) : null}
      </div>

      <RoomParticipantsMenu
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        roomId={room.id}
        participants={participants}
        maxUsers={room.maxUsers}
        isOwner={isOwner}
        currentUserId={currentUserId}
      />
    </div>
  );
}
