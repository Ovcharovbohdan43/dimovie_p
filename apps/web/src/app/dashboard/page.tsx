"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import type { RoomSummary, WatchHistoryItem } from "@dimovie/shared";
import { getPlanCapabilities } from "@dimovie/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { ContentRow } from "@/components/home/content-row";
import { RoomCard } from "@/components/home/room-card";
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

function DashboardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { me } = useAuth();
  const [open, setOpen] = useState(params.get("create") === "true");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "PRIVATE" | "PASSWORD">("PUBLIC");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");

  useEffect(() => {
    if (me.isError) router.push("/login");
  }, [me.isError, router]);

  const rooms = useQuery({
    queryKey: ["rooms", "mine"],
    queryFn: () => api<RoomSummary[]>("/rooms/mine"),
    enabled: !!me.data,
  });

  const planCaps = me.data ? getPlanCapabilities(me.data.subscription) : null;

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

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-16">
        <Loader2 className="size-8 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="mx-auto max-w-[1920px] px-4 md:px-8 lg:px-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">
              Welcome back, {me.data?.displayName}
            </h1>
            <p className="mt-1 text-white/50">
              Your watch parties and history
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#e50914] hover:bg-[#f40612]">
                  <Plus className="mr-2 size-4" />
                  New Party
                </Button>
              }
            />
            <DialogContent className="border-white/10 bg-[#181818]">
              <DialogHeader>
                <DialogTitle>Create Watch Party</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Privacy</Label>
                  <select
                    value={privacy}
                    onChange={(e) =>
                      setPrivacy(e.target.value as typeof privacy)
                    }
                    className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
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
                      className="mt-1 border-white/10 bg-white/5"
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
                    className="mt-1 w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#e50914]"
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
                      className="mt-1 w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#e50914]"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Shown to everyone browsing public rooms
                    </p>
                  </div>
                )}
                <Button
                  className="w-full bg-[#e50914] hover:bg-[#f40612]"
                  onClick={() => createRoom.mutate()}
                  disabled={
                    createRoom.isPending ||
                    (privacy === "PASSWORD" && password.length < 4)
                  }
                >
                  {createRoom.isPending ? "Creating..." : "Create Room"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ContentRow title="Active Watch Parties">
          {rooms.isLoading ? (
            <>
              <Skeleton className="h-[320px] w-[300px] flex-shrink-0" />
              <Skeleton className="h-[320px] w-[300px] flex-shrink-0" />
            </>
          ) : rooms.data?.length ? (
            rooms.data.map((room) => <RoomCard key={room.id} room={room} />)
          ) : (
            <p className="py-8 text-white/40">No active rooms — create one!</p>
          )}
        </ContentRow>

        {!(planCaps?.watchHistory ?? false) ? (
          <ContentRow title="Continue Watching" className="mt-8">
            <p className="py-4 text-sm text-white/40">
              Watch history is available on Pro and Enterprise plans.{" "}
              <a href="/pricing" className="text-[#e50914] hover:underline">
                Upgrade
              </a>
            </p>
          </ContentRow>
        ) : (
          history.data &&
          history.data.length > 0 && (
            <ContentRow title="Continue Watching" className="mt-8">
              {history.data.map((item) => (
                <div
                  key={item.id}
                  className="card-hover-glow w-[280px] flex-shrink-0 overflow-hidden rounded-md bg-[#181818]"
                >
                  <div className="aspect-video bg-gradient-to-br from-[#2f2f2f] to-[#181818] p-4">
                    <p className="truncate font-bold">{item.title}</p>
                    <p className="mt-2 text-xs text-white/40">
                      {new Date(item.watchedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </ContentRow>
          )
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#e50914]" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
