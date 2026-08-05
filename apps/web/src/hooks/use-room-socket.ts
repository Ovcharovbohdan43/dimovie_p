"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  WS_ROOM_EVENTS,
  CHAT_MAX_LENGTH,
  CHAT_MIN_INTERVAL_MS,
} from "@dimovie/shared";
import type {
  SyncStatePayload,
  SyncIntentPayload,
  ChatMessagePayload,
  ChatDeletePayload,
  RoomParticipant,
} from "@dimovie/shared";
import { getRuntimeConfig } from "@/lib/runtime-config";

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
  onChatDelete?: (payload: ChatDeletePayload) => void;
  onParticipants?: (participants: Participant[]) => void;
  onReaction?: (data: { userId: string; displayName: string; emoji: string }) => void;
  onJoined?: (payload: JoinedPayload) => void;
  onRemoved?: (payload: RemovedPayload) => void;
  onRoomClosed?: (payload: { message: string }) => void;
  onChatCooldown?: (waitSeconds: number) => void;
  onChatError?: (message: string) => void;
  onTyping?: (data: { userId: string; displayName: string }) => void;
}

export function useRoomSocket({
  roomCode,
  token,
  enabled = true,
  onSyncState,
  onChatMessage,
  onChatDelete,
  onParticipants,
  onReaction,
  onJoined,
  onRemoved,
  onRoomClosed,
  onChatCooldown,
  onChatError,
  onTyping,
}: UseRoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const roomJoinedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [roomJoined, setRoomJoined] = useState(false);
  const [chatCooldown, setChatCooldown] = useState(0);
  const chatCooldownRef = useRef(0);

  const onSyncStateRef = useRef(onSyncState);
  const onChatMessageRef = useRef(onChatMessage);
  const onChatDeleteRef = useRef(onChatDelete);
  const onParticipantsRef = useRef(onParticipants);
  const onReactionRef = useRef(onReaction);
  const onJoinedRef = useRef(onJoined);
  const onRemovedRef = useRef(onRemoved);
  const onRoomClosedRef = useRef(onRoomClosed);
  const onChatCooldownRef = useRef(onChatCooldown);
  const onChatErrorRef = useRef(onChatError);
  const onTypingRef = useRef(onTyping);

  useEffect(() => {
    onSyncStateRef.current = onSyncState;
    onChatMessageRef.current = onChatMessage;
    onChatDeleteRef.current = onChatDelete;
    onParticipantsRef.current = onParticipants;
    onReactionRef.current = onReaction;
    onJoinedRef.current = onJoined;
    onRemovedRef.current = onRemoved;
    onRoomClosedRef.current = onRoomClosed;
    onChatCooldownRef.current = onChatCooldown;
    onChatErrorRef.current = onChatError;
    onTypingRef.current = onTyping;
  });

  useEffect(() => {
    chatCooldownRef.current = chatCooldown;
  }, [chatCooldown]);

  useEffect(() => {
    roomJoinedRef.current = roomJoined;
  }, [roomJoined]);

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
      roomJoinedRef.current = false;
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    void (async () => {
      const { wsUrl } = await getRuntimeConfig();
      if (cancelled) return;

      socket = io(wsUrl, {
        transports: ["polling", "websocket"],
        auth: { token },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
      });

      socket.on("connect", () => {
        setConnected(true);
        setReconnecting(false);
        emitJoin(socket!);
      });

      socket.on("disconnect", () => {
        setConnected(false);
        setRoomJoined(false);
        roomJoinedRef.current = false;
        setReconnecting(true);
      });

      socket.on("connect_error", (err) => {
        console.warn("[room-socket] connect_error:", err.message, "url=", wsUrl);
        setReconnecting(true);
      });

      socket.io.on("reconnect", () => {
        setReconnecting(false);
        emitJoin(socket!);
      });

      socket.on(WS_ROOM_EVENTS.JOINED, (payload: JoinedPayload) => {
        setRoomJoined(true);
        roomJoinedRef.current = true;
        setReconnecting(false);
        if (payload.syncState) onSyncStateRef.current?.(payload.syncState);
        if (payload.participants) onParticipantsRef.current?.(payload.participants);
        onJoinedRef.current?.(payload);
      });

      socket.on(WS_ROOM_EVENTS.SYNC_STATE, (state: SyncStatePayload) => {
        onSyncStateRef.current?.(state);
      });

      socket.on(WS_ROOM_EVENTS.CHAT_MESSAGE, (msg: ChatMessagePayload) => {
        onChatMessageRef.current?.(msg);
      });

      socket.on(WS_ROOM_EVENTS.CHAT_DELETE, (payload: ChatDeletePayload) => {
        onChatDeleteRef.current?.(payload);
      });

      socket.on(WS_ROOM_EVENTS.CHAT_COOLDOWN, (payload: { waitSeconds: number }) => {
        applyChatCooldown(payload.waitSeconds);
        onChatCooldownRef.current?.(payload.waitSeconds);
      });

      socket.on(
        WS_ROOM_EVENTS.CHAT_TYPING,
        (payload: { userId: string; displayName: string }) => {
          onTypingRef.current?.(payload);
        },
      );

      socket.on(WS_ROOM_EVENTS.PARTICIPANTS, (participants: Participant[]) => {
        onParticipantsRef.current?.(participants);
      });

      socket.on(WS_ROOM_EVENTS.REACTION, (data: {
        userId: string;
        displayName: string;
        emoji: string;
      }) => {
        onReactionRef.current?.(data);
      });

      socket.on(WS_ROOM_EVENTS.REMOVED, (payload: RemovedPayload) => {
        onRemovedRef.current?.(payload);
      });

      socket.on(WS_ROOM_EVENTS.CLOSED, (payload: { message: string }) => {
        onRoomClosedRef.current?.(payload);
      });

      socket.on(WS_ROOM_EVENTS.ERROR, (payload?: { message?: string; scope?: string }) => {
        const message = payload?.message ?? "";
        const isChatError =
          payload?.scope === "chat" ||
          /wait.*seconds|rate limit|Empty message|Chat error/i.test(message);
        if (isChatError) {
          if (message) onChatErrorRef.current?.(message);
          return;
        }

        setRoomJoined(false);
        roomJoinedRef.current = false;
        const blocked = /blocked|banned|Not a participant/i.test(message);
        if (blocked) {
          onRemovedRef.current?.({
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
        setTimeout(() => {
          if (socket?.connected) emitJoin(socket);
        }, 1000);
      });

      socketRef.current = socket;
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoomJoined(false);
      roomJoinedRef.current = false;
    };
  }, [enabled, token, roomCode, emitJoin, applyChatCooldown]);

  const sendSyncIntent = useCallback((intent: Omit<SyncIntentPayload, "clientTs">) => {
    socketRef.current?.emit(WS_ROOM_EVENTS.SYNC_INTENT, {
      ...intent,
      clientTs: Date.now(),
    });
  }, []);

  const sendChat = useCallback(
    (content: string): boolean => {
      if (chatCooldownRef.current > 0) return false;
      const sock = socketRef.current;
      if (!sock?.connected || !roomJoinedRef.current) {
        onChatErrorRef.current?.("Not connected to the room yet");
        return false;
      }
      const trimmed = content.trim().slice(0, CHAT_MAX_LENGTH);
      if (!trimmed) return false;
      sock.emit(WS_ROOM_EVENTS.CHAT_MESSAGE, { content: trimmed });
      applyChatCooldown(Math.ceil(CHAT_MIN_INTERVAL_MS / 1000));
      return true;
    },
    [applyChatCooldown],
  );

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit(WS_ROOM_EVENTS.REACTION, { emoji });
  }, []);

  const sendTyping = useCallback(() => {
    socketRef.current?.emit(WS_ROOM_EVENTS.CHAT_TYPING);
  }, []);

  const deleteChat = useCallback((messageId: string) => {
    socketRef.current?.emit(WS_ROOM_EVENTS.CHAT_DELETE, { messageId });
  }, []);

  return {
    connected: connected && roomJoined,
    reconnecting,
    sendSyncIntent,
    sendChat,
    sendReaction,
    sendTyping,
    deleteChat,
    chatCooldown,
  };
}
