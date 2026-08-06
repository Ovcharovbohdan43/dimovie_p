"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import type { RoomSummary, WatchHistoryItem } from "@dimovie/shared";
import { getPlanCapabilities } from "@dimovie/shared";
import { api, publicApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
import { PlayMark, PlusMark } from "@/components/home/marks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { formSelectClassName } from "@/lib/select-field";

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { me } = useAuth();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [privacy, setPrivacy] = useState<"PUBLIC" | "PRIVATE" | "PASSWORD">("PUBLIC");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");

  useEffect(() => {
    if (me.isError) router.push("/login");
  }, [me.isError, router]);

  // Soft-nav from header "Start party" keeps this page mounted — sync dialog to ?create=
  useEffect(() => {
    if (params.get("create") !== "true") return;
    setOpen(true);
    router.replace("/dashboard", { scroll: false });
  }, [params, router]);

  const rooms = useQuery({
    queryKey: ["rooms", "mine"],
    queryFn: () => api<RoomSummary[]>("/rooms/mine"),
    enabled: !!me.data,
  });

  const publicRooms = useQuery({
    queryKey: ["rooms", "public"],
    queryFn: () => publicApi<RoomSummary[]>("/rooms/public"),
    enabled: !!me.data,
    refetchInterval: 20000,
  });

  const planCaps = me.data ? getPlanCapabilities(me.data.subscription) : null;
  const mineEmpty = !rooms.isLoading && (rooms.data?.length ?? 0) === 0;
  const discover = publicRooms.data ?? [];
  // Hide rooms the user already owns from the social discover rails
  const mineIds = new Set(rooms.data?.map((r) => r.id) ?? []);
  const discoverOthers = discover.filter((r) => !mineIds.has(r.id));

  const history = useQuery({
    queryKey: ["history"],
    queryFn: () => api<WatchHistoryItem[]>("/profiles/me/history"),
    enabled: !!me.data && (planCaps?.watchHistory ?? false),
  });

  const createRoom = useMutation({
    mutationFn: () =>
      api<RoomSummary>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          privacy,
          ...(privacy === "PASSWORD" && { password }),
          ...(description.trim() && { description: description.trim() }),
          ...(privacy === "PUBLIC" && rules.trim() && { rules: rules.trim() }),
        }),
      }),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
      router.push(`/room/${room.roomCode}`);
    },
  });

  const [resumingId, setResumingId] = useState<string | null>(null);

  const resumeWatching = useMutation({
    mutationFn: async (item: WatchHistoryItem) => {
      if (item.roomCode) {
        return item.roomCode;
      }

      const room = await api<RoomSummary>("/rooms", {
        method: "POST",
        body: JSON.stringify({ privacy: "PRIVATE" }),
      });

      if (item.videoUrl) {
        await api(`/rooms/${room.id}/video`, {
          method: "POST",
          body: JSON.stringify({
            type: "EMBED",
            url: item.videoUrl,
            metadata: {
              title: item.title,
              ...(item.thumbnail ? { thumbnail: item.thumbnail } : {}),
            },
          }),
        });
      }

      return room.roomCode;
    },
    onMutate: (item) => {
      setResumingId(item.id);
    },
    onSuccess: (roomCode) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      router.push(`/room/${roomCode}`);
    },
    onSettled: () => {
      setResumingId(null);
    },
  });

  if (me.isLoading) {
    return (
      <LoadingScreen
        message="Loading your parties..."
        className="min-h-screen bg-[#08080c] pt-16"
      />
    );
  }

  return (
    <div className="dm-app relative min-h-screen overflow-hidden pb-20 pt-16">
      <div className="relative mx-auto max-w-[1920px] px-4 sm:px-6 md:px-10 lg:px-14">
        <motion.div
          className="mb-8 flex flex-col gap-5 border-b border-white/[0.06] pb-7 pt-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-8 sm:pt-8 md:pt-10"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="min-w-0 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
              Your stage
            </p>
            <h1 className="mt-2 break-words font-sans text-[clamp(1.55rem,5.5vw,2.85rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
              Welcome back, {me.data?.displayName}
            </h1>
            <p className="mt-2 text-sm text-white/55 md:text-base">
              Active parties, continue watching, one tap to start the night.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="h-11 w-full bg-[#e50914] px-5 text-[0.95rem] font-semibold hover:bg-[#f40612] sm:w-auto">
                  <PlusMark className="mr-2 size-4" />
                  New party
                </Button>
              }
            />
            <DialogContent className="dm-glass max-w-lg rounded-[20px] border-white/10">
              <DialogHeader>
                <DialogTitle className="font-sans text-xl font-semibold tracking-[-0.02em]">
                  Create watch party
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div
                  className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    // File upload wires in-room; party is created first.
                  }}
                >
                  <p className="text-sm font-semibold text-white/85">
                    Drop a video later in the room
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    YouTube / Vimeo links, catalog picks, or local files after you start
                  </p>
                </div>
                <div>
                  <Label>Privacy</Label>
                  <select
                    value={privacy}
                    onChange={(e) =>
                      setPrivacy(e.target.value as typeof privacy)
                    }
                    className={formSelectClassName}
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private (link only)</option>
                    <option value="PASSWORD">Password protected</option>
                  </select>
                </div>
                {privacy === "PASSWORD" && (
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 border-white/10 bg-white/[0.04]"
                    />
                  </div>
                )}
                <div>
                  <Label>Description</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this watch party about?"
                    maxLength={500}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#e50914]"
                  />
                </div>
                {privacy === "PUBLIC" && (
                  <div>
                    <Label>House rules (optional)</Label>
                    <textarea
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      placeholder="Be respectful, no spoilers in chat..."
                      maxLength={1000}
                      rows={3}
                      className="mt-1 w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#e50914]"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Shown to everyone browsing public rooms
                    </p>
                  </div>
                )}
                <Button
                  className="h-11 w-full bg-[#e50914] font-semibold hover:bg-[#f40612]"
                  onClick={() => createRoom.mutate()}
                  disabled={
                    createRoom.isPending ||
                    (privacy === "PASSWORD" && password.length < 4)
                  }
                >
                  <PlayMark className="mr-2 size-4" />
                  {createRoom.isPending ? "Creating..." : "Create room"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        <div className="space-y-12">
          {!mineEmpty && (
            <ContentRow title="Active watch parties">
              {rooms.isLoading ? (
                <>
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                </>
              ) : (
                rooms.data!.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))
              )}
            </ContentRow>
          )}

          {(mineEmpty || discoverOthers.length > 0) && (
            <ContentRow
              title={mineEmpty ? "Join a public party" : "Discover public parties"}
            >
              {publicRooms.isLoading || rooms.isLoading ? (
                <>
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                  <Skeleton className="aspect-video h-auto w-[72vw] max-w-[300px] flex-shrink-0 snap-start rounded-none sm:w-[260px]" />
                </>
              ) : discoverOthers.length ? (
                discoverOthers.map((room) => (
                  <RoomCard key={`pub-${room.id}`} room={room} />
                ))
              ) : (
                <div className="flex w-full max-w-md flex-col gap-3 py-6">
                  <p className="text-sm text-white/45">
                    No public parties yet — open the night with one tap.
                  </p>
                  <Button
                    className="h-10 w-fit bg-white px-4 font-semibold text-black hover:bg-white/90"
                    onClick={() => setOpen(true)}
                  >
                    <PlayMark className="mr-2 size-3.5" />
                    Start a party
                  </Button>
                </div>
              )}
            </ContentRow>
          )}

          {!(planCaps?.watchHistory ?? false) ? (
            <ContentRow title="Continue watching">
              <p className="py-4 text-sm text-white/40">
                Watch history unlocks on Pro and Enterprise.{" "}
                <a href="/pricing" className="text-[#e50914] hover:underline">
                  Upgrade
                </a>
              </p>
            </ContentRow>
          ) : (
            history.data &&
            history.data.length > 0 && (
              <ContentRow title="Continue watching">
                {history.data.map((item) => {
                  const canResume = Boolean(item.roomCode || item.videoUrl);
                  const busy = resumingId === item.id;

                  return (
                    <motion.div
                      key={item.id}
                      className="w-[72vw] max-w-[280px] flex-shrink-0 snap-start sm:w-[240px]"
                      whileHover={canResume ? { y: -3 } : undefined}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    >
                      <button
                        type="button"
                        disabled={!canResume || busy || resumeWatching.isPending}
                        onClick={() => {
                          if (!canResume || busy) return;
                          resumeWatching.mutate(item);
                        }}
                        className="group relative block w-full overflow-hidden bg-[#121218] text-left outline-none ring-offset-2 ring-offset-[#08080c] transition focus-visible:ring-2 focus-visible:ring-[#e50914] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={
                          item.roomCode
                            ? `Rejoin ${item.title}`
                            : `Continue watching ${item.title}`
                        }
                      >
                        <div className="media-frame-ltr relative aspect-video">
                          {item.thumbnail ? (
                            <Image
                              src={item.thumbnail}
                              alt=""
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 72vw, 240px"
                              className="object-cover transition duration-500 group-hover:scale-[1.04]"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(229,9,20,0.2),transparent_55%),linear-gradient(160deg,#1c1c24,#0e0e14)]" />
                          )}
                          <div className="media-edge-wash absolute inset-0" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                            <span className="grid size-11 place-items-center bg-[#e50914] text-white shadow-lg">
                              <PlayMark className="size-4" />
                            </span>
                          </div>
                          {busy && (
                            <div className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-medium text-white">
                              Opening…
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 p-3.5">
                            <p className="truncate font-display text-sm font-semibold tracking-[-0.01em] text-white">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                              {item.roomCode
                                ? `Room ${item.roomCode} · ${new Date(item.watchedAt).toLocaleDateString()}`
                                : new Date(item.watchedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </ContentRow>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen
          message="Loading..."
          className="min-h-screen bg-[#08080c]"
        />
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
