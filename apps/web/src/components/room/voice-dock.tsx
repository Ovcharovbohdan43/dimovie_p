"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MicMark,
  VolumeMark,
  VolumeMuteMark,
} from "@/components/home/marks";

export interface VoiceDockPeer {
  userId: string;
  displayName: string;
  muted?: boolean;
  speaking?: boolean;
  deafened?: boolean;
}

interface VoiceDockProps {
  connected: boolean;
  muted: boolean;
  selfName?: string;
  selfId?: string;
  selfSpeaking?: boolean;
  peers: VoiceDockPeer[];
  error?: string | null;
  needsAudioUnlock?: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onTogglePeerMute?: (userId: string) => void;
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
  selfSpeaking = false,
  peers,
  error,
  needsAudioUnlock,
  onJoin,
  onLeave,
  onToggleMute,
  onTogglePeerMute,
  onUnlockAudio,
  className,
}: VoiceDockProps) {
  const selfUserId = selfId ?? "self";
  const people: VoiceDockPeer[] = connected
    ? [
        {
          userId: selfUserId,
          displayName: selfName,
          muted,
          speaking: selfSpeaking && !muted,
        },
        ...peers.filter((p) => p.userId !== selfUserId),
      ]
    : [];

  return (
    <div
      className={cn(
        "dm-glass mt-3 rounded-[18px] px-3 py-3 sm:mt-4 sm:px-4 sm:py-4",
        className,
      )}
    >
      <div className="mb-3 flex flex-col gap-3 sm:mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
            Voice
          </h3>
          <p className="text-xs text-white/40">
            {connected
              ? `${people.length} connected`
              : "Talk while you watch"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {connected ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                className={cn(
                  "dm-btn-neutral inline-flex h-9 min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
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
                  className="inline-flex h-9 min-h-9 items-center rounded-full border border-[#e50914]/35 bg-[#e50914]/10 px-3 text-xs font-semibold text-[#ff6b73]"
                >
                  Tap to hear
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLeave}
                className="dm-btn-neutral inline-flex h-9 min-h-9 items-center rounded-full px-3 text-xs font-semibold"
              >
                Leave
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onJoin}
              className="dm-btn-neutral inline-flex h-9 min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
            >
              <MicMark className="size-3.5" />
              Join voice
            </button>
          )}
        </div>
      </div>

      {connected && people.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
          {people.map((peer) => {
            const isSelf = peer.userId === selfUserId;
            const speaking = isSelf
              ? selfSpeaking && !muted
              : Boolean(peer.speaking) && !peer.muted;
            const deafened = Boolean(peer.deafened);

            return (
              <div
                key={peer.userId}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 sm:w-[72px]"
              >
                <div className="relative">
                  <Avatar
                    className={cn(
                      "size-10 rounded-2xl sm:size-11",
                      speaking && "dm-speaking",
                      (peer.muted || deafened) && "opacity-55",
                    )}
                  >
                    <AvatarFallback className="rounded-2xl bg-white/10 text-xs font-semibold text-white">
                      {initials(peer.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  {!isSelf && onTogglePeerMute ? (
                    <button
                      type="button"
                      aria-label={
                        deafened
                          ? `Unmute ${peer.displayName}`
                          : `Mute ${peer.displayName}`
                      }
                      title={deafened ? "Unmute participant" : "Mute participant"}
                      onClick={() => onTogglePeerMute(peer.userId)}
                      className={cn(
                        "absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border border-white/15 bg-[#12121a] text-white/70 shadow-md transition hover:text-white",
                        deafened &&
                          "border-[#e50914]/40 bg-[#e50914]/15 text-[#ff6b73]",
                      )}
                    >
                      {deafened ? (
                        <VolumeMuteMark className="size-3" />
                      ) : (
                        <VolumeMark className="size-3" />
                      )}
                    </button>
                  ) : null}
                </div>
                <p className="w-full truncate text-center text-[11px] font-semibold text-white/80">
                  {isSelf ? "You" : peer.displayName}
                </p>
                <p className="text-[10px] text-white/35">
                  {isSelf
                    ? muted
                      ? "Muted"
                      : speaking
                        ? "Speaking"
                        : "Live"
                    : deafened
                      ? "Muted"
                      : speaking
                        ? "Speaking"
                        : "Live"}
                </p>
              </div>
            );
          })}
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
