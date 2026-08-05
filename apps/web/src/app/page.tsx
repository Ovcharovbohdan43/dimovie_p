"use client";

import { useQuery } from "@tanstack/react-query";
import type { RoomSummary } from "@dimovie/shared";
import { HeroBanner } from "@/components/home/hero-banner";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
import { ProductProof } from "@/components/home/product-proof";
import { SyncStrip } from "@/components/home/sync-strip";
import { FinalCta } from "@/components/home/final-cta";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { me } = useAuth();

  const publicRooms = useQuery({
    queryKey: ["rooms", "public"],
    queryFn: () => api<RoomSummary[]>("/rooms/public"),
    enabled: !!me.data,
    refetchInterval: 15000,
  });

  const popular =
    publicRooms.data
      ?.slice()
      .sort((a, b) => b.participantCount - a.participantCount)
      .slice(0, 8) ?? [];

  const liveNow =
    publicRooms.data?.filter(
      (room) => room.participantCount > 0 && !!room.videoSource?.url,
    ) ?? [];

  return (
    <div className="dm-app">
      <HeroBanner isAuthenticated={!!me.data} />

      <div className="relative z-[1] -mt-10 space-y-12 pb-16 sm:-mt-14 sm:space-y-16 md:space-y-20">
        {me.data && (
          <>
            <ContentRow title="Popular now">
              {publicRooms.isLoading ? (
                <>
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
                </>
              ) : popular.length ? (
                popular.map((room) => <RoomCard key={room.id} room={room} />)
              ) : (
                <p className="py-8 text-sm text-white/40">
                  No public parties right now — start one from your dashboard
                </p>
              )}
            </ContentRow>

            {liveNow.length > 0 && (
              <ContentRow title="Live public parties">
                {liveNow.map((room) => (
                  <RoomCard key={`live-${room.id}`} room={room} />
                ))}
              </ContentRow>
            )}
          </>
        )}

        <ProductProof />
        <SyncStrip />
        <FinalCta isAuthenticated={!!me.data} />
      </div>
    </div>
  );
}
