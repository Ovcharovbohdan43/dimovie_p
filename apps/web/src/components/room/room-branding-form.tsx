"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import type { RoomSummary } from "@dimovie/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RoomBrandingFormProps {
  room: RoomSummary;
  onUpdated: (room: RoomSummary) => void;
}

export function RoomBrandingForm({ room, onUpdated }: RoomBrandingFormProps) {
  const [open, setOpen] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(room.branding?.displayTitle ?? "");
  const [accentColor, setAccentColor] = useState(room.branding?.accentColor ?? "#e50914");
  const [logoUrl, setLogoUrl] = useState(room.branding?.logoUrl ?? "");

  const save = useMutation({
    mutationFn: () =>
      api<RoomSummary>(`/rooms/${room.id}/branding`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(displayTitle.trim() && { displayTitle: displayTitle.trim() }),
          ...(accentColor && { accentColor }),
          ...(logoUrl.trim() && { logoUrl: logoUrl.trim() }),
        }),
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      setOpen(false);
    },
  });

  if (!room.planFeatures?.customBranding) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-4 md:px-6 lg:px-8">
      <div className="rounded-lg border border-white/[0.06] bg-[#141414]/80">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/80 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Palette className="size-4 text-[#e50914]" />
            Custom branding
          </span>
          <span className="text-xs text-white/40">{open ? "Hide" : "Show"}</span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
            <div>
              <Label className="text-xs text-white/50">Display title</Label>
              <Input
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                placeholder="Acme Corp Movie Night"
                className="mt-1 border-white/10 bg-white/[0.04]"
              />
            </div>
            <div>
              <Label className="text-xs text-white/50">Accent color</Label>
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#e50914"
                className="mt-1 border-white/10 bg-white/[0.04]"
              />
            </div>
            <div>
              <Label className="text-xs text-white/50">Logo URL</Label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 border-white/10 bg-white/[0.04]"
              />
            </div>
            <Button
              className="bg-[#e50914] hover:bg-[#f40612]"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save branding"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
