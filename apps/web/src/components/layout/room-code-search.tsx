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
        >
          <Search className="size-5" />
        </button>
        {open && (
          <form
            onSubmit={handleSubmit}
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/10 bg-[#181818] p-3 shadow-xl"
          >
            <Input
              value={code}
              onChange={(e) => {
                setCode(normalizeRoomCode(e.target.value));
                setError(null);
              }}
              placeholder="Room code"
              className="h-9 border-white/10 bg-white/5 uppercase tracking-widest"
              autoFocus
              maxLength={ROOM_CODE_LENGTH}
            />
            {error && (
              <p className="mt-2 text-xs text-[#e50914]">{error}</p>
            )}
          </form>
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
