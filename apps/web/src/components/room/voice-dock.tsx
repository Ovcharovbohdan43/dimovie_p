"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MicMark } from "@/components/home/marks";

export interface VoiceDockPeer {
  userId: string;
  displayName: string;
  muted?: boolean;
  speaking?: boolean;
}

interface VoiceDockProps {
  connected: boolean;
  muted: boolean;
  selfName?: string;
  selfId?: string;
  peers: VoiceDockPeer[];
  error?: string | null;
  needsAudioUnlock?: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onUnlockAudio?: () => void;
  className?: string;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function VoiceDock({
  connected,
  muted,
  selfName = "You",
  selfId,
  peers,
  error,
  needsAudioUnlock,
  onJoin,
  onLeave,
  onToggleMute,
  onUnlockAudio,
  className,
}: VoiceDockProps) {
  const people: VoiceDockPeer[] = connected
    ? [
        {
          userId: selfId ?? "self",
          displayName: selfName,
          muted,
          speaking: !muted,
        },
        ...peers.map((p) => ({
          ...p,
          speaking: p.speaking ?? true,
          muted: p.muted ?? false,
        })),
      ]
    : [];

  return (
    <div
      className={cn(
        "dm-glass mt-4 rounded-[18px] px-4 py-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
            Voice
          </h3>
          <p className="text-xs text-white/40">
            {connected
              ? `${people.length} connected`
              : "Talk while you watch"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                className={cn(
                  "dm-btn-neutral inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold",
                  muted && "border-[#e50914]/40 bg-[#e50914]/10 text-[#ff6b73]",
                )}
              >
                <MicMark className="size-3.5" />
                {muted ? "Unmute" : "Mute"}
              </button>
              {needsAudioUnlock && onUnlockAudio ? (
                <button
                  type="button"
                  onClick={onUnlockAudio}
                  className="inline-flex h-9 items-center rounded-xl border border-[#e50914]/35 bg-[#e50914]/10 px-3 text-xs font-semibold text-[#ff6b73]"
                >
                  Tap to hear
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLeave}
                className="dm-btn-neutral inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold"
              >
                Leave
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onJoin}
              className="dm-btn-neutral inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
            >
              <MicMark className="size-3.5" />
              Join voice
            </button>
          )}
        </div>
      </div>

      {connected && people.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {people.map((peer) => (
            <div
              key={peer.userId}
              className="flex w-[72px] flex-col items-center gap-1.5"
            >
              <Avatar
                className={cn(
                  "size-11 rounded-2xl",
                  !peer.muted && peer.speaking && "dm-speaking",
                  peer.muted && "opacity-60",
                )}
              >
                <AvatarFallback className="rounded-2xl bg-white/10 text-xs font-semibold text-white">
                  {initials(peer.displayName)}
                </AvatarFallback>
              </Avatar>
              <p className="w-full truncate text-center text-[11px] font-semibold text-white/80">
                {peer.displayName}
              </p>
              <p className="text-[10px] text-white/35">
                {peer.muted ? "Muted" : "Live"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/35">
          Join voice to hear the party and show up in the dock.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-xs text-[#ff6b73]">{error}</p>
      ) : null}
    </div>
  );
}
