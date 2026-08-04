"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MicMark } from "@/components/home/marks";

interface VoiceControlsProps {
  connected: boolean;
  muted: boolean;
  peerCount: number;
  error?: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  className?: string;
  compact?: boolean;
}

export function VoiceControls({
  connected,
  muted,
  peerCount,
  error,
  onJoin,
  onLeave,
  onToggleMute,
  className,
  compact = false,
}: VoiceControlsProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {connected ? (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? "Unmute" : "Mute"}
              className={cn(
                "grid size-8 place-items-center border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/10 hover:text-white",
                muted && "text-[#e50914]",
              )}
            >
              <MicMark className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onLeave}
              title="Leave voice"
              className="hidden h-8 px-2 text-[11px] font-medium text-[#e50914] hover:bg-[#e50914]/10 sm:inline-flex sm:items-center"
            >
              Leave
            </button>
            {peerCount > 0 && (
              <span className="hidden text-[11px] tabular-nums text-white/40 md:inline">
                {peerCount}
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onJoin}
            title="Join voice"
            className="inline-flex h-8 items-center gap-1.5 border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <MicMark className="size-3.5" />
            <span className="hidden sm:inline">Voice</span>
          </button>
        )}
        {error && (
          <span className="max-w-[8rem] truncate text-[10px] text-[#e50914] sm:max-w-[12rem]">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {connected ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleMute}
            className="h-8 border-white/10 bg-white/[0.04] text-xs"
          >
            <MicMark className={cn("mr-1.5 size-3.5", muted && "text-[#e50914]")} />
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onLeave}
            className="h-8 border-[#e50914]/30 bg-[#e50914]/10 text-xs text-[#e50914]"
          >
            Leave voice
          </Button>
          <span className="text-xs text-white/40">{peerCount} in voice</span>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onJoin}
          className="h-8 border-white/10 bg-white/[0.04] text-xs"
        >
          <MicMark className="mr-1.5 size-3.5" />
          Join voice
        </Button>
      )}
      {error && (
        <span className="max-w-[12rem] truncate text-xs text-[#e50914]">
          {error}
        </span>
      )}
    </div>
  );
}
