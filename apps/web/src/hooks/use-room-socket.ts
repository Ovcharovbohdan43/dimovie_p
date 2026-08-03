"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { WS_ROOM_EVENTS, CHAT_MIN_INTERVAL_MS } from "@dimovie/shared";
import type {
  SyncStatePayload,
  SyncIntentPayload,
  ChatMessagePayload,
  RoomParticipant,
} from "@dimovie/shared";
import { API_URL } from "@/lib/api";

interface Participant extends RoomParticipant {}

interface JoinedPayload {
  roomCode: string;
  syncState: SyncStatePayload | null;
  recentChat: ChatMessagePayload[];
  participants: Participant[];
}

interface RemovedPayload {
  action: "kicked" | "banned";
  message: string;
}

interface UseRoomSocketOptions {
  roomCode: string;
  token: string;
  enabled?: boolean;
  onSyncState?: (state: SyncStatePayload) => void;
  onChatMessage?: (msg: ChatMessagePayload) => void;
  onParticipants?: (participants: Participant[]) => void;
  onReaction?: (data: { userId: string; displayName: string; emoji: string }) => void;
  onJoined?: (payload: JoinedPayload) => void;
  onRemoved?: (payload: RemovedPayload) => void;
  onRoomClosed?: (payload: { message: string }) => void;
  onChatCooldown?: (waitSeconds: number) => void;
}

function getSocketUrl(): string {
  if (typeof window === "undefined") return API_URL;
  return API_URL;
}

export function useRoomSocket({
  roomCode,
  token,
  enabled = true,
  onSyncState,
  onChatMessage,
  onParticipants,
  onReaction,
  onJoined,
  onRemoved,
  onRoomClosed,
  onChatCooldown,
}: UseRoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [roomJoined, setRoomJoined] = useState(false);
  const [chatCooldown, setChatCooldown] = useState(0);
  const chatCooldownRef = useRef(0);

  useEffect(() => {
    chatCooldownRef.current = chatCooldown;
  }, [chatCooldown]);

  useEffect(() => {
    if (chatCooldown <= 0) return;
    const timer = setInterval(() => {
      setChatCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [chatCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyChatCooldown = useCallback((waitSeconds: number) => {
    setChatCooldown((current) => Math.max(current, waitSeconds));
  }, []);

  const emitJoin = useCallback(
    (socket: Socket) => {
      socket.emit(WS_ROOM_EVENTS.JOIN, { roomCode: roomCode.toUpperCase() });
    },
    [roomCode],
  );

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      setRoomJoined(false);
      return;
    }

    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      emitJoin(socket);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setRoomJoined(false);
      setReconnecting(true);
    });

    socket.io.on("reconnect", () => {
      setReconnecting(false);
      emitJoin(socket);
    });

    socket.on(WS_ROOM_EVENTS.JOINED, (payload: JoinedPayload) => {
      setRoomJoined(true);
      setReconnecting(false);
      if (payload.syncState) onSyncState?.(payload.syncState);
      if (payload.participants) onParticipants?.(payload.participants);
      onJoined?.(payload);
    });

    socket.on(WS_ROOM_EVENTS.SYNC_STATE, (state: SyncStatePayload) => {
      onSyncState?.(state);
    });

    socket.on(WS_ROOM_EVENTS.CHAT_MESSAGE, (msg: ChatMessagePayload) => {
      onChatMessage?.(msg);
    });

    socket.on(WS_ROOM_EVENTS.CHAT_COOLDOWN, (payload: { waitSeconds: number }) => {
      applyChatCooldown(payload.waitSeconds);
      onChatCooldown?.(payload.waitSeconds);
    });

    socket.on(WS_ROOM_EVENTS.PARTICIPANTS, (participants: Participant[]) => {
      onParticipants?.(participants);
    });

    socket.on(WS_ROOM_EVENTS.REACTION, (data: {
      userId: string;
      displayName: string;
      emoji: string;
    }) => {
      onReaction?.(data);
    });

    socket.on(WS_ROOM_EVENTS.REMOVED, (payload: RemovedPayload) => {
      onRemoved?.(payload);
    });

    socket.on(WS_ROOM_EVENTS.CLOSED, (payload: { message: string }) => {
      onRoomClosed?.(payload);
    });

    socket.on(WS_ROOM_EVENTS.ERROR, (payload?: { message?: string; scope?: string }) => {
      const message = payload?.message ?? "";
      const isChatError =
        payload?.scope === "chat" ||
        /wait.*seconds|rate limit|Empty message|Chat error/i.test(message);
      if (isChatError) {
        return;
      }

      setRoomJoined(false);
      const blocked =
        /blocked|banned|Not a participant/i.test(message);
      if (blocked) {
        onRemoved?.({
          action: /banned|blocked/i.test(message) ? "banned" : "kicked",
          message:
            message === "You are blocked by the host"
              ? "You are blocked by this host"
              : message === "You are banned from this room"
                ? "You are banned from this room"
                : message || "Room access denied",
        });
        return;
      }
      setTimeout(() => emitJoin(socket), 1000);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoomJoined(false);
    };
  }, [
    enabled,
    token,
    roomCode,
    emitJoin,
    onSyncState,
    onChatMessage,
    onParticipants,
    onReaction,
    onJoined,
    onRemoved,
    onRoomClosed,
    onChatCooldown,
    applyChatCooldown,
  ]);

  const sendSyncIntent = useCallback((intent: Omit<SyncIntentPayload, "clientTs">) => {
    socketRef.current?.emit(WS_ROOM_EVENTS.SYNC_INTENT, {
      ...intent,
      clientTs: Date.now(),
    });
  }, []);

  const sendChat = useCallback((content: string) => {
    if (chatCooldownRef.current > 0) return;
    socketRef.current?.emit(WS_ROOM_EVENTS.CHAT_MESSAGE, { content });
    applyChatCooldown(Math.ceil(CHAT_MIN_INTERVAL_MS / 1000));
  }, [applyChatCooldown]);

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit(WS_ROOM_EVENTS.REACTION, { emoji });
  }, []);

  return {
    connected: connected && roomJoined,
    reconnecting,
    sendSyncIntent,
    sendChat,
    sendReaction,
    chatCooldown,
  };
}
