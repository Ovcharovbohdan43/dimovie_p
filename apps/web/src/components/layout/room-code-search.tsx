"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ROOM_CODE_LENGTH, ROOM_CODE_MIN_LENGTH } from "@dimovie/shared";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function normalizeRoomCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

interface RoomCodeSearchProps {
  className?: string;
  compact?: boolean;
}

export function RoomCodeSearch({
  className,
  compact = false,
}: RoomCodeSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const normalized = normalizeRoomCode(code);
    if (
      normalized.length < ROOM_CODE_MIN_LENGTH ||
      normalized.length > ROOM_CODE_LENGTH
    ) {
      setError(
        `Enter a ${ROOM_CODE_MIN_LENGTH}–${ROOM_CODE_LENGTH} character room code`,
      );
      return;
    }
    setError(null);
    setOpen(false);
    router.push(`/room/${normalized}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const inputProps = {
    value: code,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(normalizeRoomCode(e.target.value));
      setError(null);
    },
    maxLength: ROOM_CODE_LENGTH,
    inputMode: "text" as const,
    autoCapitalize: "characters" as const,
    autoCorrect: "off" as const,
    spellCheck: false,
  };

  if (compact) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:size-9"
          aria-label="Search by room code"
          aria-expanded={open}
        >
          <Search className="size-4 sm:size-5" />
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
              className="fixed left-3 right-3 top-[3.75rem] z-50 rounded-lg border border-white/10 bg-[#181818] p-3 shadow-xl sm:left-auto sm:right-4 sm:w-80"
            >
              <Input
                {...inputProps}
                placeholder="Room code"
                className="h-11 w-full border-white/10 bg-white/5 text-base uppercase tracking-widest"
                autoFocus
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
        {...inputProps}
        placeholder="Search by room code..."
        className="h-9 w-52 border-white/20 bg-black/55 pl-9 text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md lg:w-60"
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
