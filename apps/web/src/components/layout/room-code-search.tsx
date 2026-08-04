"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROOM_CODE_LENGTH = 6;

function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

interface RoomCodeSearchProps {
  className?: string;
  compact?: boolean;
}

export function RoomCodeSearch({ className, compact = false }: RoomCodeSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== ROOM_CODE_LENGTH) {
      setError(`Enter a ${ROOM_CODE_LENGTH}-character room code`);
      return;
    }
    setError(null);
    router.push(`/room/${normalized}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  if (compact) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Search by room code"
          aria-expanded={open}
        >
          <Search className="size-5" />
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close search"
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            />
            <form
              onSubmit={handleSubmit}
              className="fixed left-3 right-3 top-[3.75rem] z-50 rounded-lg border border-white/10 bg-[#181818] p-3 shadow-xl sm:left-auto sm:right-4 sm:w-72"
            >
              <Input
                value={code}
                onChange={(e) => {
                  setCode(normalizeRoomCode(e.target.value));
                  setError(null);
                }}
                placeholder="Room code"
                className="h-10 w-full border-white/10 bg-white/5 uppercase tracking-widest"
                autoFocus
                maxLength={ROOM_CODE_LENGTH}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              {error && (
                <p className="mt-2 text-xs text-[#e50914]">{error}</p>
              )}
            </form>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("relative flex items-center", className)}
    >
      <Search className="pointer-events-none absolute left-3 size-4 text-white/40" />
      <Input
        value={code}
        onChange={(e) => {
          setCode(normalizeRoomCode(e.target.value));
          setError(null);
        }}
        placeholder="Search by room code..."
        className="h-9 w-44 border-white/10 bg-white/5 pl-9 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal lg:w-52"
        maxLength={ROOM_CODE_LENGTH}
        aria-label="Search by room code"
      />
      {error && (
        <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-[#e50914]">
          {error}
        </p>
      )}
    </form>
  );
}
