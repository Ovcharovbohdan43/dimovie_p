"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import type { RoomSummary } from "@dimovie/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isoToDatetimeLocal,
  datetimeLocalToIso,
} from "@/lib/datetime-local";

interface RoomScheduleFormProps {
  room: RoomSummary;
  onUpdated: (room: RoomSummary) => void;
}

export function RoomScheduleForm({ room, onUpdated }: RoomScheduleFormProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(
    isoToDatetimeLocal(room.scheduledStartsAt),
  );

  const save = useMutation({
    mutationFn: (scheduledStartsAt: string | null) =>
      api<RoomSummary>(`/rooms/${room.id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledStartsAt }),
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setLocalValue(isoToDatetimeLocal(updated.scheduledStartsAt));
      setOpen(false);
    },
  });

  const scheduledLabel = room.scheduledStartsAt
    ? new Date(room.scheduledStartsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-4 md:px-6 lg:px-8">
      <div className="rounded-lg border border-white/[0.06] bg-[#141414]/80">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/80 hover:text-white"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-[#e50914]" />
            <span className="truncate">
              {scheduledLabel
                ? `Starts ${scheduledLabel}`
                : "Schedule start time"}
            </span>
          </span>
          <span className="shrink-0 text-xs text-white/40">
            {open ? "Hide" : "Edit"}
          </span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
            <div>
              <Label className="text-xs text-white/50">
                When does the party start?
              </Label>
              <Input
                type="datetime-local"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                className="mt-1 border-white/10 bg-white/[0.04] [color-scheme:dark]"
              />
              <p className="mt-1.5 text-xs text-white/35">
                Public rooms with a future start show up in Starting soon.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-9 bg-[#e50914] font-semibold hover:bg-[#f40612]"
                disabled={!localValue || save.isPending}
                onClick={() => {
                  const iso = datetimeLocalToIso(localValue);
                  if (!iso) return;
                  save.mutate(iso);
                }}
              >
                {save.isPending ? "Saving…" : "Save schedule"}
              </Button>
              {room.scheduledStartsAt && (
                <Button
                  variant="ghost"
                  className="h-9 text-white/60 hover:bg-white/5 hover:text-white"
                  disabled={save.isPending}
                  onClick={() => save.mutate(null)}
                >
                  Clear
                </Button>
              )}
            </div>
            {save.isError && (
              <p className="text-xs text-[#ff6b73]">
                {(save.error as Error)?.message ?? "Could not save schedule"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
