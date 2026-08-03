"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-5 rounded-lg border border-white/10 bg-[#181818] p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#e50914]/20">
            <Lock className="size-6 text-[#e50914]" />
          </div>
          <h1 className="text-lg font-bold">Password required</h1>
          <p className="text-sm text-white/50">
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
            className="mt-1 border-white/10 bg-white/5"
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
          className="w-full bg-[#e50914] hover:bg-[#f40612]"
          disabled={!password.trim() || isPending}
          onClick={() => onSubmit(password)}
        >
          {isPending ? "Joining..." : "Join room"}
        </Button>
      </div>
    </div>
  );
}
