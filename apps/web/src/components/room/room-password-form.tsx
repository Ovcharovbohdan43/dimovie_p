"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CinematicShell } from "@/components/layout/cinematic-shell";

interface RoomPasswordFormProps {
  roomCode: string;
  onSubmit: (password: string) => void;
  isPending?: boolean;
  error?: string | null;
}

export function RoomPasswordForm({
  roomCode,
  onSubmit,
  isPending,
  error,
}: RoomPasswordFormProps) {
  const [password, setPassword] = useState("");

  return (
    <CinematicShell
      imageSrc="https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=2400&q=80"
      imageAlt="Cinema screen in a dark hall"
      panelClassName="max-w-sm"
    >
      <div className="space-y-6">
        <div className="text-center">
          <p className="font-display text-3xl font-bold tracking-[-0.04em] text-[#e50914]">
            DiMovie
          </p>
          <h1 className="mt-3 font-display text-xl font-semibold tracking-[-0.02em] text-white">
            Password required
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            Enter the password to join room {roomCode.toUpperCase()}
          </p>
        </div>

        <div>
          <Label htmlFor="room-password">Room password</Label>
          <Input
            id="room-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="mt-1 h-11 border-white/10 bg-white/[0.04]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && password.trim()) {
                onSubmit(password);
              }
            }}
          />
        </div>

        {error && <p className="text-sm text-[#e50914]">{error}</p>}

        <Button
          className="h-11 w-full bg-[#e50914] font-semibold hover:bg-[#f40612]"
          disabled={!password.trim() || isPending}
          onClick={() => onSubmit(password)}
        >
          {isPending ? "Joining..." : "Join room"}
        </Button>
      </div>
    </CinematicShell>
  );
}
