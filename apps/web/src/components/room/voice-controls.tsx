"use client";

import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  connected: boolean;
  muted: boolean;
  peerCount: number;
  error?: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  className?: string;
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
}: VoiceControlsProps) {
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
            {muted ? (
              <MicOff className="mr-1.5 size-3.5 text-[#e50914]" />
            ) : (
              <Mic className="mr-1.5 size-3.5" />
            )}
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onLeave}
            className="h-8 border-[#e50914]/30 bg-[#e50914]/10 text-xs text-[#e50914]"
          >
            <PhoneOff className="mr-1.5 size-3.5" />
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
          <Phone className="mr-1.5 size-3.5" />
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
