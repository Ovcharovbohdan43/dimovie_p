"use client";

import { useQuery } from "@tanstack/react-query";
import type { RoomSummary } from "@dimovie/shared";
import { HeroBanner } from "@/components/home/hero-banner";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
import { ExperienceStory } from "@/components/home/experience-story";
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

  return (
    <>
      <HeroBanner isAuthenticated={!!me.data} />

      <div className="relative z-[1] -mt-10 space-y-10 pb-8 sm:-mt-14 sm:space-y-14 md:space-y-16">
        {me.data && (
          <ContentRow title="Live public parties">
            {publicRooms.isLoading ? (
              <>
                <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
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

        <ExperienceStory />
        <SyncStrip />
        <FinalCta isAuthenticated={!!me.data} />
      </div>
    </>
  );
}
