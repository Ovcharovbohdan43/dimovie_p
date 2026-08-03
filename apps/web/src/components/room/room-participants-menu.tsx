"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Ban,
  Crown,
  Loader2,
  Shield,
  ShieldOff,
  UserMinus,
  Users,
} from "lucide-react";
import type { RoomParticipant } from "@dimovie/shared";
import { ParticipantRole } from "@dimovie/shared";
import { api } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RoomParticipantsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  participants: RoomParticipant[];
  maxUsers: number;
  isOwner: boolean;
  currentUserId?: string;
}

const ROLE_ORDER: Record<string, number> = {
  [ParticipantRole.OWNER]: 0,
  [ParticipantRole.ADMIN]: 1,
  [ParticipantRole.MEMBER]: 2,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function roleLabel(role: string) {
  if (role === ParticipantRole.OWNER) return "Host";
  if (role === ParticipantRole.ADMIN) return "Admin";
  return "Viewer";
}

export function RoomParticipantsMenu({
  open,
  onOpenChange,
  roomId,
  participants,
  maxUsers,
  isOwner,
  currentUserId,
}: RoomParticipantsMenuProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const kick = useMutation({
    mutationFn: (userId: string) =>
      api(`/rooms/${roomId}/moderation/kick`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onMutate: (userId) => {
      setPendingUserId(userId);
      setActionError(null);
    },
    onSettled: () => setPendingUserId(null),
    onError: (err: Error) => setActionError(err.message),
  });

  const ban = useMutation({
    mutationFn: (userId: string) =>
      api(`/rooms/${roomId}/moderation/ban`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onMutate: (userId) => {
      setPendingUserId(userId);
      setActionError(null);
    },
    onSettled: () => setPendingUserId(null),
    onError: (err: Error) => setActionError(err.message),
  });

  const setRole = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "ADMIN" | "MEMBER";
    }) =>
      api(`/rooms/${roomId}/moderation/role`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      }),
    onMutate: ({ userId }) => {
      setPendingUserId(userId);
      setActionError(null);
    },
    onSettled: () => setPendingUserId(null),
    onError: (err: Error) => setActionError(err.message),
  });

  const handleKick = (userId: string, displayName: string) => {
    if (
      !window.confirm(
        `Remove ${displayName} from the room? They can rejoin using the link.`,
      )
    ) {
      return;
    }
    kick.mutate(userId);
  };

  const handleBan = (userId: string, displayName: string) => {
    if (
      !window.confirm(
        `Block ${displayName}? This user will no longer be able to join your rooms.`,
      )
    ) {
      return;
    }
    ban.mutate(userId);
  };

  const handlePromote = (userId: string, displayName: string) => {
    if (
      !window.confirm(
        `Make ${displayName} an admin? They will be able to play, pause, and seek.`,
      )
    ) {
      return;
    }
    setRole.mutate({ userId, role: "ADMIN" });
  };

  const handleDemote = (userId: string, displayName: string) => {
    if (
      !window.confirm(
        `Remove admin rights from ${displayName}? They will only be able to watch.`,
      )
    ) {
      return;
    }
    setRole.mutate({ userId, role: "MEMBER" });
  };

  const sorted = [...participants].sort((a, b) => {
    const roleDiff =
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (roleDiff !== 0) return roleDiff;
    return a.displayName.localeCompare(b.displayName, "en");
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80vh,560px)] max-w-md overflow-hidden border-white/10 bg-[#181818] p-0 text-white sm:max-w-md">
        <DialogHeader className="border-b border-white/[0.06] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-[#e50914]" />
            Participants
          </DialogTitle>
          <DialogDescription className="text-white/50">
            {participants.length}/{maxUsers} in room
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 py-3 scrollbar-dimovie">
          {sorted.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-white/40">
              No one here yet
            </p>
          ) : (
            <ul className="space-y-1">
              {sorted.map((participant) => {
                const isSelf = participant.userId === currentUserId;
                const isHost = participant.role === ParticipantRole.OWNER;
                const isAdmin = participant.role === ParticipantRole.ADMIN;
                const canModerate = isOwner && !isSelf && !isHost;
                const canSetRole =
                  isOwner &&
                  !isSelf &&
                  !isHost &&
                  (participant.role === ParticipantRole.MEMBER ||
                    participant.role === ParticipantRole.ADMIN);
                const busy = pendingUserId === participant.userId;

                return (
                  <li
                    key={participant.userId}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.04]"
                  >
                    <Avatar size="sm" className="ring-1 ring-white/10">
                      <AvatarFallback className="bg-white/10 text-xs text-white">
                        {initials(participant.displayName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {participant.displayName}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-white/40">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/40">
                        {roleLabel(participant.role)}
                      </p>
                    </div>

                    {isHost && (
                      <Crown className="size-4 shrink-0 text-amber-400/80" />
                    )}
                    {isAdmin && (
                      <Shield className="size-4 shrink-0 text-sky-400/80" />
                    )}

                    {(canSetRole || canModerate) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {canSetRole &&
                          (participant.role === ParticipantRole.MEMBER ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-white/60 hover:bg-sky-500/15 hover:text-sky-300"
                              disabled={busy}
                              title="Make admin"
                              onClick={() =>
                                handlePromote(
                                  participant.userId,
                                  participant.displayName,
                                )
                              }
                            >
                              {busy && setRole.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Shield className="size-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-white/60 hover:bg-white/10 hover:text-white"
                              disabled={busy}
                              title="Remove admin"
                              onClick={() =>
                                handleDemote(
                                  participant.userId,
                                  participant.displayName,
                                )
                              }
                            >
                              {busy && setRole.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <ShieldOff className="size-4" />
                              )}
                            </Button>
                          ))}

                        {canModerate && (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-white/60 hover:bg-white/10 hover:text-white"
                              disabled={busy}
                              title="Remove from room"
                              onClick={() =>
                                handleKick(
                                  participant.userId,
                                  participant.displayName,
                                )
                              }
                            >
                              {busy && kick.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <UserMinus className="size-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className={cn(
                                "text-white/60 hover:bg-[#e50914]/15 hover:text-[#e50914]",
                              )}
                              disabled={busy}
                              title="Block from host's rooms"
                              onClick={() =>
                                handleBan(
                                  participant.userId,
                                  participant.displayName,
                                )
                              }
                            >
                              {busy && ban.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Ban className="size-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {actionError && (
          <p className="border-t border-white/[0.06] px-5 py-3 text-center text-sm text-[#e50914]">
            {actionError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
