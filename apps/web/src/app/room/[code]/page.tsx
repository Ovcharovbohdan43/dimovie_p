"use client";
import { use, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import type {
  RoomSummary,
  RoomPreview,
  GuestWatchRoom,
  SyncStatePayload,
  ChatMessagePayload,
  RoomParticipant,
} from "@dimovie/shared";
import { api, getToken, publicApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { LoadingScreen, LoadingSpinner } from "@/components/ui/loading-spinner";
import { SyncVideoPlayer } from "@/components/room/sync-video-player";
import { ChatPanel } from "@/components/room/chat-panel";
import { RoomHeader } from "@/components/room/room-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseVideoUrl, getPlayableStreamUrl } from "@/lib/video-url";
import {
  CHAT_MAX_LENGTH,
  getVideoPreview,
  canControlPlayback,
} from "@dimovie/shared";
import { RoomPasswordForm } from "@/components/room/room-password-form";
import { RoomCatalogSetup } from "@/components/room/room-catalog-setup";
import { HostCatalogControls } from "@/components/room/host-catalog-controls";
import { RoomBrandingForm } from "@/components/room/room-branding-form";
import { RoomScheduleForm } from "@/components/room/room-schedule-form";
import { VoiceDock } from "@/components/room/voice-dock";
import { RoomMetaBar } from "@/components/room/room-meta-bar";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import {
  PlayerLiveOverlay,
  type LiveComment,
  type LiveReaction,
} from "@/components/room/player-live-overlay";
import { RoomGuestAuthModal } from "@/components/room/room-guest-auth-modal";
import { RoomPreviewTheater } from "@/components/room/room-preview-theater";
import { DiMovieLogo, DiMovieMark } from "@/components/brand/dimovie-logo";
import {
  createSystemChatNotice,
  describeSyncEvent,
} from "@/lib/system-chat";
import {
  mergeChatOnReconnect,
  markPendingChatFailed,
  upsertIncomingChat,
} from "@/lib/chat-state";
import { toUserMessage } from "@/lib/user-message";
function applyRoomVideo(
  room: RoomSummary | undefined,
  setVideoUrl: (url: string) => void,
  setShowSetup: (v: boolean) => void,
  isOwner: boolean,
) {
  if (room?.videoSource?.url) {
    setVideoUrl(getPlayableStreamUrl(room));
    setShowSetup(false);
  } else if (room && isOwner) {
    setShowSetup(true);
  }
}
export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const { me, authReady, hasToken, isAuthenticated } = useAuth();
  const [syncState, setSyncState] = useState<SyncStatePayload | null>(null);
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [playerComments, setPlayerComments] = useState<LiveComment[]>([]);
  const reactionLaneRef = useRef(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const seenChatCountRef = useRef(0);
  const [broadcastEnded, setBroadcastEnded] = useState(false);
  const [endedMessage, setEndedMessage] = useState("The host ended the stream");
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const prevParticipantsRef = useRef<Map<string, string>>(new Map());
  const prevSyncRef = useRef<SyncStatePayload | null>(null);
  const typingClearRef = useRef<Map<string, number>>(new Map());
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [guestPassword, setGuestPassword] = useState<string | undefined>();
  const [guestUnlocked, setGuestUnlocked] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<
    "chat" | "voice" | "interact"
  >("interact");
  const token = typeof window !== "undefined" ? getToken() ?? "" : "";
  const queryClient = useQueryClient();
  const showSessionCheck =
    authReady && hasToken && !me.data && (me.isPending || me.isFetching);
  const isGuestSession = authReady && !isAuthenticated && !showSessionCheck;

  const preview = useQuery({
    queryKey: ["room", code, "preview"],
    queryFn: () => publicApi<RoomPreview>(`/rooms/${code}/preview`),
    staleTime: 30_000,
  });

  const guestNeedsPassword = Boolean(preview.data?.requiresPassword);
  const guestWatchEnabled =
    isGuestSession &&
    Boolean(preview.data) &&
    (!guestNeedsPassword || guestUnlocked);

  const guestWatch = useQuery({
    queryKey: ["room", code, "watch", guestPassword ?? ""],
    queryFn: async () => {
      if (guestPassword) {
        return publicApi<GuestWatchRoom>(`/rooms/${code}/watch`, {
          method: "POST",
          body: JSON.stringify({ password: guestPassword }),
        });
      }
      return publicApi<GuestWatchRoom>(`/rooms/${code}/watch`);
    },
    enabled: guestWatchEnabled,
    staleTime: 15_000,
    retry: false,
  });

  const room = useQuery({
    queryKey: ["room", code],
    queryFn: () => api<RoomSummary>(`/rooms/${code}`),
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      const catalog =
        (data?.videoSource?.metadata as { provider?: string } | undefined)
          ?.provider === "rezka";
      if (!videoUrl) return 5000;
      if (catalog) return 8000;
      return false;
    },
  });

  const activeRoom: RoomSummary | undefined =
    room.data ?? guestWatch.data?.room;
  const joinRoom = useMutation({
    mutationFn: (password?: string) =>
      api<RoomSummary>(`/rooms/${code}/join`, {
        method: "POST",
        body: JSON.stringify(password ? { password } : {}),
      }),
    onSuccess: (data) => {
      setHasJoined(true);
      setJoinError(null);
      applyRoomVideo(data, setVideoUrl, setShowSetup, me.data?.id === data.owner.id);
    },
    onError: (err: Error) => {
      setJoinError(toUserMessage(err.message));
    },
  });
  const closeRoom = useMutation({
    mutationFn: () =>
      api<{ success: boolean }>(`/rooms/${room.data!.id}/close`, {
        method: "POST",
      }),
    onSuccess: () => {
      router.push("/dashboard");
    },
  });
  const setVideo = useMutation({
    mutationFn: (url: string) => {
      const parsed = parseVideoUrl(url);
      if (parsed.provider === "rezka") {
        throw new Error(
          "For these links, use the \"Your resource link\" section below",
        );
      }
      const videoPreview = getVideoPreview(url);
      return api<RoomSummary>(`/rooms/${room.data!.id}/video`, {
        method: "POST",
        body: JSON.stringify({
          type: "EMBED",
          url: parsed.originalUrl,
          metadata: {
            title: "Watch Party",
            provider: parsed.provider,
            embedUrl: parsed.embedUrl,
            videoId: parsed.videoId,
            thumbnail: videoPreview.thumbnailUrl,
          },
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["room", code], data);
      setVideoUrl(getPlayableStreamUrl(data));
      setShowSetup(false);
    },
  });
  const handleCatalogUpdated = useCallback(
    (data: RoomSummary) => {
      queryClient.setQueryData(["room", code], data);
      setVideoUrl(getPlayableStreamUrl(data));
    },
    [queryClient, code],
  );
  const handleAuthenticated = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    await queryClient.invalidateQueries({ queryKey: ["room", code] });
  }, [queryClient, code]);
  useEffect(() => {
    if (!isAuthenticated || !room.data || hasJoined || joinRoom.isPending) return;
    const isOwner = me.data!.id === room.data.owner.id;
    if (room.data.privacy === "PASSWORD" && !isOwner) return;
    joinRoom.mutate(undefined);
  }, [isAuthenticated, me.data, room.data, hasJoined]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (room.data && me.data) {
      applyRoomVideo(
        room.data,
        setVideoUrl,
        setShowSetup,
        me.data.id === room.data.owner.id,
      );
    }
  }, [room.data, me.data]);

  useEffect(() => {
    if (!guestWatch.data?.room || isAuthenticated) return;
    applyRoomVideo(guestWatch.data.room, setVideoUrl, setShowSetup, false);
    if (guestWatch.data.syncState) {
      setSyncState({
        ...guestWatch.data.syncState,
        by: guestWatch.data.syncState.by ?? null,
      });
    }
    setHasJoined(true);
  }, [guestWatch.data, isAuthenticated]);
  useEffect(() => {
    if (!room.data?.videoSource) return;
    const next = getPlayableStreamUrl(room.data);
    if (next && next !== videoUrl) {
      setVideoUrl(next);
    }
  }, [room.data, videoUrl]);
  const pushSystemNotice = useCallback(
    (content: string) => {
      const roomId = room.data?.id ?? code;
      setMessages((prev) => [
        ...prev,
        createSystemChatNotice(roomId, content),
      ]);
    },
    [room.data?.id, code],
  );

  const handleSyncState = useCallback(
    (state: SyncStatePayload) => {
      const prev = prevSyncRef.current;
      prevSyncRef.current = state;
      setSyncState(state);

      if (!prev || !state.by || state.by === me.data?.id) return;
      const actor =
        participants.find((p) => p.userId === state.by)?.displayName ??
        "Someone";

      if (prev.isPlaying !== state.isPlaying) {
        pushSystemNotice(
          describeSyncEvent(state.isPlaying ? "PLAY" : "PAUSE", actor),
        );
        return;
      }
      if (Math.abs(prev.time - state.time) > 2.5) {
        pushSystemNotice(describeSyncEvent("SEEK", actor));
      }
    },
    [me.data?.id, participants, pushSystemNotice],
  );

  const handleChat = useCallback((msg: ChatMessagePayload) => {
    const isOptimistic = msg.id.startsWith("opt-");
    setMessages((prev) => upsertIncomingChat(prev, msg));
    if (msg.kind === "system") return;

    const overlayId = `comment-${msg.id}`;
    setPlayerComments((prev) => {
      if (
        !isOptimistic &&
        prev.some(
          (c) =>
            c.displayName === msg.displayName && c.content === msg.content,
        )
      ) {
        return prev;
      }
      const preview =
        msg.content.length > 80
          ? `${msg.content.slice(0, 80)}…`
          : msg.content;
      return [
        ...prev,
        {
          id: overlayId,
          displayName: msg.displayName,
          content: preview,
        },
      ].slice(-4);
    });
    setTimeout(() => {
      setPlayerComments((prev) => prev.filter((c) => c.id !== overlayId));
    }, 5500);
  }, []);

  const handleChatDelete = useCallback(
    (payload: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      setPlayerComments((prev) =>
        prev.filter((c) => c.id !== `comment-${payload.messageId}`),
      );
    },
    [],
  );

  const failPendingChat = useCallback(
    (notice?: string) => {
      setMessages((prev) => markPendingChatFailed(prev, me.data?.id));
      if (notice) {
        setChatNotice(toUserMessage(notice));
        window.setTimeout(() => setChatNotice(null), 4000);
      }
    },
    [me.data?.id],
  );

  const handleParticipants = useCallback(
    (p: RoomParticipant[]) => {
      const prev = prevParticipantsRef.current;
      const next = new Map(p.map((x) => [x.userId, x.displayName]));
      if (prev.size > 0) {
        for (const person of p) {
          if (!prev.has(person.userId) && person.userId !== me.data?.id) {
            pushSystemNotice(`${person.displayName} joined the room`);
          }
        }
        for (const [id, name] of prev) {
          if (!next.has(id) && id !== me.data?.id) {
            pushSystemNotice(`${name} left the room`);
          }
        }
      }
      prevParticipantsRef.current = next;
      setParticipants(p);
    },
    [me.data?.id, pushSystemNotice],
  );

  const handleTyping = useCallback(
    (data: { userId: string; displayName: string }) => {
      if (data.userId === me.data?.id) return;
      setTypingNames((prev) =>
        prev.includes(data.displayName) ? prev : [...prev, data.displayName],
      );
      const existing = typingClearRef.current.get(data.userId);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => {
        setTypingNames((prev) => prev.filter((n) => n !== data.displayName));
        typingClearRef.current.delete(data.userId);
      }, 2200);
      typingClearRef.current.set(data.userId, timer);
    },
    [me.data?.id],
  );
  const handleReaction = useCallback(
    (data: { displayName: string; emoji: string }) => {
      const id = Math.random().toString(36);
      const lane = reactionLaneRef.current % 3;
      reactionLaneRef.current += 1;
      setReactions((prev) => [...prev, { id, lane, ...data }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2800);
    },
    [],
  );
  const handleJoined = useCallback(
    (payload: { recentChat: ChatMessagePayload[] }) => {
      setMessages((prev) =>
        mergeChatOnReconnect(prev, payload.recentChat ?? []),
      );
    },
    [],
  );
  const handleRemoved = useCallback(
    (payload: { action: "kicked" | "banned"; message: string }) => {
      setHasJoined(false);
      alert(payload.message);
      router.push("/dashboard");
    },
    [router],
  );
  const handleRoomClosed = useCallback((payload: { message: string }) => {
    setBroadcastEnded(true);
    setEndedMessage(payload.message || "The host ended the stream");
    setHasJoined(false);
  }, []);
  const handleCloseRoom = useCallback(() => {
    if (
      !window.confirm(
        "Close the room? All viewers will see that the stream has ended.",
      )
    ) {
      return;
    }
    closeRoom.mutate();
  }, [closeRoom]);
  const {
    connected,
    reconnecting,
    sendSyncIntent,
    sendChat,
    sendReaction,
    sendTyping,
    deleteChat,
    chatCooldown,
  } = useRoomSocket({
    roomCode: code,
    token,
    allowGuest: isGuestSession,
    guestPassword,
    enabled:
      hasJoined &&
      ((!!token && isAuthenticated) || isGuestSession),
    onSyncState: handleSyncState,
    onChatMessage: handleChat,
    onChatDelete: handleChatDelete,
    onParticipants: handleParticipants,
    onReaction: handleReaction,
    onJoined: handleJoined,
    onRemoved: handleRemoved,
    onRoomClosed: handleRoomClosed,
    onTyping: handleTyping,
    onChatCooldown: () => failPendingChat(),
    onChatError: (message) => failPendingChat(message),
  });

  useEffect(() => {
    if (!hasJoined || typeof window === "undefined") return;
    const key = `dimovie_session_started:${code.toUpperCase()}`;
    let startedAt = Number(sessionStorage.getItem(key));
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      startedAt = Date.now();
      sessionStorage.setItem(key, String(startedAt));
    }
    const tick = () => {
      setWatchSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [hasJoined, code]);
  const handleSendChat = useCallback(
    (content: string) => {
      const user = me.data;
      if (!user) return;
      const text = content.trim().slice(0, CHAT_MAX_LENGTH);
      if (!text) return;

      // Drop a previous failed optimistic with the same text before retry.
      setMessages((prev) =>
        prev.filter(
          (m) =>
            !(
              m.id.startsWith("opt-") &&
              m.userId === user.id &&
              m.content === text &&
              m.status === "failed"
            ),
        ),
      );

      const optimistic: ChatMessagePayload = {
        id: `opt-${crypto.randomUUID()}`,
        roomId: room.data?.id ?? code,
        userId: user.id,
        displayName: user.displayName,
        content: text,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      handleChat(optimistic);
      const sent = sendChat(text);
      if (!sent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...m, status: "failed" } : m,
          ),
        );
        setPlayerComments((prev) =>
          prev.filter((c) => c.id !== `comment-${optimistic.id}`),
        );
      }
    },
    [me.data, room.data?.id, code, handleChat, sendChat],
  );

  const handleRetryChat = useCallback(
    (content: string) => {
      handleSendChat(content);
    },
    [handleSendChat],
  );

  const handleDeleteChat = useCallback(
    (messageId: string) => {
      deleteChat(messageId);
      handleChatDelete({ messageId });
    },
    [deleteChat, handleChatDelete],
  );

  const avatarByUserId = Object.fromEntries(
    participants.map((p) => [p.userId, p.avatarUrl]),
  );
  const handleIntent = useCallback(
    (event: "PLAY" | "PAUSE" | "SEEK", time: number) => {
      sendSyncIntent({ event, time });
    },
    [sendSyncIntent],
  );
  const planFeatures = activeRoom?.planFeatures;
  const voice = useVoiceChat({
    roomCode: code,
    token,
    currentUserId: me.data?.id ?? "",
    enabled: hasJoined && !!token && isAuthenticated,
    enhancedAudio: planFeatures?.enhancedVoice ?? false,
  });
  const isOwner = me.data?.id === activeRoom?.owner.id;
  useEffect(() => {
    if (chatOpen) {
      seenChatCountRef.current = messages.length;
      setUnreadChatCount(0);
      return;
    }
    if (messages.length <= seenChatCountRef.current) {
      seenChatCountRef.current = messages.length;
      return;
    }
    const fresh = messages.slice(seenChatCountRef.current);
    seenChatCountRef.current = messages.length;
    const fromOthers = fresh.filter(
      (msg) =>
        msg.kind !== "system" &&
        msg.userId !== me.data?.id &&
        msg.status !== "pending" &&
        msg.status !== "failed",
    ).length;
    if (fromOthers > 0) {
      setUnreadChatCount((count) => count + fromOthers);
    }
  }, [messages, chatOpen, me.data?.id]);
  const myRole = participants.find((p) => p.userId === me.data?.id)?.role;
  // Owner always; any joined member once role arrives; allow briefly after join
  // before the participants list syncs (otherwise play stays disabled while Offline).
  const canControlVideo =
    Boolean(isOwner) ||
    (isAuthenticated &&
      (myRole ? canControlPlayback(myRole) : hasJoined));
  const isCatalogRoom =
    (activeRoom?.videoSource?.metadata as { provider?: string } | undefined)
      ?.provider === "rezka";
  const needsPassword =
    isAuthenticated &&
    room.data?.privacy === "PASSWORD" &&
    !isOwner &&
    !hasJoined;
  const needsGuestPassword =
    isGuestSession && guestNeedsPassword && !guestUnlocked;
  const showRoomLoading =
    (isAuthenticated &&
      !room.data &&
      (room.isLoading || room.isFetching) &&
      !room.isError) ||
    (isGuestSession &&
      !needsGuestPassword &&
      guestWatchEnabled &&
      guestWatch.isLoading);
  if (preview.isLoading) {
    return (
      <LoadingScreen
        message="Loading room..."
        className="h-screen bg-[#08080c]"
      />
    );
  }
  if (preview.isError || !preview.data) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[#08080c] px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(229,9,20,0.12),transparent_55%)]"
        />
        <DiMovieLogo
          className="relative justify-center"
          markClassName="size-8"
          wordmarkClassName="text-2xl"
        />
        <p className="relative text-[#e50914]">
          This room doesn’t exist or the link is no longer valid.
        </p>
        <Button
          className="relative bg-white font-semibold text-black hover:bg-white/90"
          onClick={() => router.push("/")}
        >
          Go home
        </Button>
      </div>
    );
  }
  if (showSessionCheck) {
    return (
      <div className="relative h-screen overflow-hidden">
        <RoomPreviewTheater preview={preview.data} blurred className="blur-[6px]" />
        <div className="pointer-events-none absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="md" label="Checking session" />
          <p className="text-sm text-white/60">Checking session...</p>
        </div>
      </div>
    );
  }
  if (needsGuestPassword) {
    return (
      <RoomPasswordForm
        roomCode={code}
        isPending={guestWatch.isFetching}
        error={
          guestWatch.isError
            ? toUserMessage(
                guestWatch.error instanceof Error
                  ? guestWatch.error.message
                  : null,
              )
            : joinError
        }
        onSubmit={(password) => {
          setJoinError(null);
          setGuestPassword(password);
          setGuestUnlocked(true);
        }}
      />
    );
  }
  if (showRoomLoading) {
    return (
      <LoadingScreen
        message="Joining room..."
        className="h-screen bg-[#08080c]"
      />
    );
  }
  if (needsPassword) {
    return (
      <RoomPasswordForm
        roomCode={code}
        isPending={joinRoom.isPending}
        error={joinError}
        onSubmit={(password) => {
          setJoinError(null);
          joinRoom.mutate(password);
        }}
      />
    );
  }
  if (joinRoom.isError && !hasJoined) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[#08080c] px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(229,9,20,0.12),transparent_55%)]"
        />
        <DiMovieLogo
          className="relative justify-center"
          markClassName="size-8"
          wordmarkClassName="text-2xl"
        />
        <p className="relative text-[#e50914]">
          {joinError ?? "Couldn’t join the room. Check the code and try again."}
        </p>
        <Button
          className="relative bg-white font-semibold text-black hover:bg-white/90"
          onClick={() => router.push("/dashboard")}
        >
          Go Home
        </Button>
      </div>
    );
  }
  if (isAuthenticated && (room.isLoading || joinRoom.isPending) && !hasJoined) {
    return (
      <LoadingScreen
        message="Entering watch party..."
        className="h-screen bg-[#08080c]"
      />
    );
  }
  if (!activeRoom) {
    return (
      <LoadingScreen
        message="Loading room..."
        className="h-screen bg-[#08080c]"
      />
    );
  }
  return (
    <div className="dm-app flex h-screen flex-col overflow-hidden overflow-x-hidden">
      <RoomHeader
        room={activeRoom}
        code={code}
        isOwner={!!isOwner}
        onBack={() => router.push(isGuestSession ? "/" : "/dashboard")}
        onCloseRoom={isOwner ? handleCloseRoom : undefined}
        isClosingRoom={closeRoom.isPending}
      />
      {isGuestSession && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-black/40 px-3 py-2 sm:px-4">
          <p className="text-xs text-white/60 sm:text-sm">
            Watching as guest — sign in to chat, voice, or host.
          </p>
          <Button
            size="sm"
            className="h-8 rounded-xl bg-white text-xs font-semibold text-black hover:bg-white/90"
            onClick={() => {
              setAuthPromptReason("interact");
              setAuthPromptOpen(true);
            }}
          >
            Sign in
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {/* Main theater column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto scrollbar-dimovie">
          <div className="relative flex flex-1 flex-col justify-center px-3 py-4 sm:px-4 md:px-6 lg:px-8">
            {showSetup && isOwner && activeRoom ? (
              <div className="relative mx-auto w-full max-w-xl space-y-6">
                <div className="dm-glass overflow-hidden rounded-[20px]">
                  <div className="border-b border-white/[0.06] px-6 py-5">
                    <h2 className="font-sans text-xl font-semibold tracking-[-0.02em]">
                      Set up your watch party
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                      Paste a link, pick from catalog, or drop a file next
                    </p>
                  </div>
                  <div className="space-y-4 p-6">
                    <div>
                      <Label className="text-white/70">Video URL</Label>
                      <Input
                        value={setupUrl}
                        onChange={(e) => setSetupUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="mt-2 h-11 rounded-2xl border-white/10 bg-white/[0.04] focus-visible:ring-white/25"
                      />
                    </div>
                    {setVideo.isError && (
                      <p className="text-sm text-[#ff6b73]">
                        {toUserMessage((setVideo.error as Error).message)}
                      </p>
                    )}
                    <Button
                      className="h-11 w-full rounded-2xl bg-[#e50914] text-sm font-semibold hover:bg-[#f40612]"
                      onClick={() => setVideo.mutate(setupUrl)}
                      disabled={!setupUrl || setVideo.isPending}
                    >
                      {setVideo.isPending ? "Loading..." : "Start Watching"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-white/30">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or your own resource</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <RoomCatalogSetup
                  roomId={activeRoom.id}
                  onSuccess={(data) => {
                    handleCatalogUpdated(data);
                    setShowSetup(false);
                  }}
                />
                <RoomScheduleForm
                  room={activeRoom}
                  onUpdated={handleCatalogUpdated}
                />
              </div>
            ) : videoUrl && activeRoom ? (
              <div className="relative mx-auto w-full max-w-[1400px]">
                <RoomMetaBar
                  room={activeRoom}
                  participants={participants}
                  participantCount={participants.length || 1}
                  watchSeconds={watchSeconds}
                  showAnalytics={
                    !!isOwner && !!planFeatures?.roomAnalytics
                  }
                  isOwner={!!isOwner}
                  currentUserId={me.data?.id}
                />
                <div className="overflow-hidden rounded-[16px] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.08] sm:rounded-[20px]">
                  <SyncVideoPlayer
                    url={videoUrl}
                    syncState={syncState}
                    onIntent={handleIntent}
                    broadcastEnded={broadcastEnded}
                    endedMessage={endedMessage}
                    onLeave={() =>
                      router.push(isGuestSession ? "/" : "/dashboard")
                    }
                    maxVideoQuality={planFeatures?.maxVideoQuality ?? "1080p"}
                    syncDriftThresholdMs={planFeatures?.syncDriftThresholdMs ?? 1500}
                    canControl={canControlVideo}
                    voiceDuckFactor={
                      voice.activeSpeakerCount >= 2
                        ? 0.4
                        : voice.activeSpeakerCount === 1
                          ? 0.7
                          : 1
                    }
                    className="ring-0"
                    overlay={
                      <PlayerLiveOverlay
                        reactions={reactions}
                        comments={playerComments}
                      />
                    }
                  />
                </div>
                {isOwner && isCatalogRoom && !showSetup && (
                  <HostCatalogControls
                    room={activeRoom}
                    onUpdated={handleCatalogUpdated}
                  />
                )}
                {hasJoined && isAuthenticated ? (
                  <VoiceDock
                    connected={voice.connected}
                    muted={voice.muted}
                    selfName={me.data?.displayName}
                    selfId={me.data?.id}
                    selfSpeaking={Boolean(
                      me.data?.id && voice.speakingById?.[me.data.id],
                    )}
                    peers={(voice.voicePeers ?? []).map((p) => ({
                      userId: p.userId,
                      displayName:
                        participants.find((x) => x.userId === p.userId)
                          ?.displayName ?? "Guest",
                      speaking: Boolean(voice.speakingById?.[p.userId]),
                      deafened: Boolean(voice.deafenedById?.[p.userId]),
                    }))}
                    error={voice.error}
                    needsAudioUnlock={voice.needsAudioUnlock}
                    onJoin={voice.joinVoice}
                    onLeave={voice.leaveVoice}
                    onToggleMute={voice.toggleMute}
                    onTogglePeerMute={voice.togglePeerMute}
                    onUnlockAudio={voice.unlockRemoteAudio}
                  />
                ) : hasJoined && isGuestSession ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                    <p className="text-sm text-white/60">
                      Voice chat needs an account
                    </p>
                    <Button
                      size="sm"
                      className="rounded-xl bg-[#e50914] text-xs font-semibold hover:bg-[#f40612]"
                      onClick={() => {
                        setAuthPromptReason("voice");
                        setAuthPromptOpen(true);
                      }}
                    >
                      Sign in
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center gap-4 py-20 text-center">
                <DiMovieMark className="size-12 text-[#e50914]/80" />
                <div>
                  <p className="font-display text-base font-semibold tracking-[-0.01em] text-white/70">
                    Waiting for the host to pick a video
                  </p>
                  <p className="mt-1 text-sm text-white/35">
                    You&apos;ll see it here when they&apos;re ready
                  </p>
                </div>
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>
          {isOwner && activeRoom && !showSetup && (
            <>
              <RoomScheduleForm
                room={activeRoom}
                onUpdated={handleCatalogUpdated}
              />
              <RoomBrandingForm
                room={activeRoom}
                onUpdated={handleCatalogUpdated}
              />
            </>
          )}
        </div>
        {/* Chat sidebar — desktop */}
        <aside className="hidden min-w-0 shrink-0 overflow-x-hidden border-l border-white/[0.06] lg:flex lg:w-[340px] xl:w-[380px]">
          {isGuestSession ? (
            <div className="flex w-full flex-col items-center justify-center gap-3 bg-[#0a0a0f] px-6 text-center">
              <p className="text-sm text-white/55">
                Sign in to send messages and reactions
              </p>
              <Button
                className="rounded-xl bg-[#e50914] font-semibold hover:bg-[#f40612]"
                onClick={() => {
                  setAuthPromptReason("chat");
                  setAuthPromptOpen(true);
                }}
              >
                Sign in to chat
              </Button>
            </div>
          ) : (
            <ChatPanel
              messages={messages}
              onSend={handleSendChat}
              onReaction={sendReaction}
              onTyping={sendTyping}
              onRetry={handleRetryChat}
              onDelete={isOwner ? handleDeleteChat : undefined}
              canModerate={isOwner}
              typingNames={typingNames}
              currentUserId={me.data?.id}
              avatarByUserId={avatarByUserId}
              participantCount={participants.length || 1}
              chatCooldown={chatCooldown}
              className="w-full"
            />
          )}
        </aside>
      </div>
      {/* Mobile chat sheet */}
      {!isGuestSession && (
        <ChatPanel
          messages={messages}
          onSend={handleSendChat}
          onReaction={sendReaction}
          onTyping={sendTyping}
          onRetry={handleRetryChat}
          onDelete={isOwner ? handleDeleteChat : undefined}
          canModerate={isOwner}
          typingNames={typingNames}
          currentUserId={me.data?.id}
          avatarByUserId={avatarByUserId}
          participantCount={participants.length || 1}
          chatCooldown={chatCooldown}
          mobileOpen={chatOpen}
          onMobileClose={() => setChatOpen(false)}
        />
      )}
      {chatNotice && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[min(90vw,22rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0e0e14]/95 px-4 py-2.5 text-center text-sm text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md lg:bottom-8"
        >
          {chatNotice}
        </div>
      )}
      {!chatOpen && hasJoined && !isGuestSession && (
        <Button
          onClick={() => {
            setChatOpen(true);
            setUnreadChatCount(0);
            seenChatCountRef.current = messages.length;
          }}
          aria-label={
            unreadChatCount > 0
              ? `Open chat, ${unreadChatCount} unread`
              : "Open chat"
          }
          className="fixed bottom-5 right-5 z-40 size-14 rounded-2xl bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,0.45)] hover:bg-white/90 lg:hidden"
          size="icon"
        >
          <MessageCircle className="size-6" />
          {unreadChatCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[#e50914] text-[10px] font-bold text-white">
              {unreadChatCount > 9 ? "9+" : unreadChatCount}
            </span>
          )}
        </Button>
      )}
      {isGuestSession && (
        <RoomGuestAuthModal
          optional
          open={authPromptOpen}
          onOpenChange={setAuthPromptOpen}
          roomCode={code}
          hostName={activeRoom.owner.displayName}
          onAuthenticated={async () => {
            setAuthPromptOpen(false);
            await handleAuthenticated();
          }}
          title={
            authPromptReason === "chat"
              ? "Sign in to chat"
              : authPromptReason === "voice"
                ? "Sign in for voice"
                : "Sign in to interact"
          }
          description="Watching stays free — an account unlocks chat, voice, and hosting."
        />
      )}
    </div>
  );
}
