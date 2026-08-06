"use client";

import { useQuery } from "@tanstack/react-query";
import {
  partitionDiscoverFeed,
  type RoomSummary,
} from "@dimovie/shared";
import { HeroBanner } from "@/components/home/hero-banner";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
import { ProductProof } from "@/components/home/product-proof";
import { SyncStrip } from "@/components/home/sync-strip";
import { FinalCta } from "@/components/home/final-cta";
import { useAuth } from "@/hooks/use-auth";
import { publicApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

function RoomSkeletons() {
  return (
    <>
      <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
      <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
      <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-[18px] sm:w-[260px]" />
    </>
  );
}

export default function HomePage() {
  const { me } = useAuth();

  const publicRooms = useQuery({
    queryKey: ["rooms", "public"],
    queryFn: () => publicApi<RoomSummary[]>("/rooms/public"),
    refetchInterval: 15000,
  });

  const rooms = publicRooms.data ?? [];
  const { live, starting, fresh } = partitionDiscoverFeed(rooms);
  // Server already ranks by hybrid score + owner diversity — keep that order
  const trending = rooms.slice(0, 12);

  return (
    <div className="dm-app">
      <HeroBanner isAuthenticated={!!me.data} />

      <div className="relative z-[1] -mt-10 space-y-12 pb-16 sm:-mt-14 sm:space-y-16 md:space-y-20">
        <ContentRow title="Discover parties">
          {publicRooms.isLoading ? (
            <RoomSkeletons />
          ) : trending.length ? (
            trending.map((room) => <RoomCard key={room.id} room={room} />)
          ) : (
            <p className="py-8 text-sm text-white/40">
              No public parties right now — be the first to start one
            </p>
          )}
        </ContentRow>

        {live.length > 0 && (
          <ContentRow title="Live now">
            {live.map((room) => (
              <RoomCard key={`live-${room.id}`} room={room} />
            ))}
          </ContentRow>
        )}

        {starting.length > 0 && (
          <ContentRow title="Starting soon">
            {starting.map((room) => (
              <RoomCard key={`start-${room.id}`} room={room} />
            ))}
          </ContentRow>
        )}

        {fresh.length > 0 && trending.length >= 8 && (
          <ContentRow title="More to explore">
            {fresh.slice(0, 12).map((room) => (
              <RoomCard key={`fresh-${room.id}`} room={room} />
            ))}
          </ContentRow>
        )}

        <ProductProof />
        <SyncStrip />
        <FinalCta isAuthenticated={!!me.data} />
      </div>
    </div>
  );
}
