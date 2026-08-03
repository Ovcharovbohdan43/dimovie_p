"use client";

import { useQuery } from "@tanstack/react-query";
import type { RoomSummary } from "@dimovie/shared";
import { HeroBanner } from "@/components/home/hero-banner";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const features = [
  "Ultra-low latency video sync (<500ms)",
  "SFU voice chat for crystal-clear audio",
  "Democratic playback — anyone can control",
  "Private rooms with password protection",
  "Real-time reactions and live chat",
];

export default function HomePage() {
  const { me } = useAuth();

  const publicRooms = useQuery({
    queryKey: ["rooms", "public"],
    queryFn: () => api<RoomSummary[]>("/rooms/public"),
    enabled: !!me.data,
    refetchInterval: 15000,
  });

  return (
    <>
      <HeroBanner isAuthenticated={!!me.data} />

      <section className="relative -mt-16 space-y-12 pb-24">
        {me.data && (
          <ContentRow title="Live Public Watch Parties">
            {publicRooms.isLoading ? (
              <>
                <Skeleton className="h-[320px] w-[300px] flex-shrink-0" />
                <Skeleton className="h-[320px] w-[300px] flex-shrink-0" />
              </>
            ) : publicRooms.data?.length ? (
              publicRooms.data.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))
            ) : (
              <p className="py-8 text-sm text-white/40">
                No public parties right now — start one from your dashboard
              </p>
            )}
          </ContentRow>
        )}

        <ContentRow title="Why DiMovie">
          <div className="flex gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex w-[320px] flex-shrink-0 items-start gap-3 rounded-lg border border-white/5 bg-[#181818] p-5"
              >
                <Check className="mt-0.5 size-5 shrink-0 text-[#e50914]" />
                <p className="text-sm text-white/80">{feature}</p>
              </div>
            ))}
          </div>
        </ContentRow>

        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <h2 className="text-2xl font-bold md:text-3xl">
            Ready to watch together?
          </h2>
          <p className="mt-3 text-white/60">
            Join thousands streaming in sync — Netflix-quality experience,
            built for friends.
          </p>
        </div>
      </section>
    </>
  );
}
