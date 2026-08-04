"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { WS_ROOM_EVENTS } from "@dimovie/shared";
import type {
  VoiceIceServer,
  VoiceJoinPayload,
  VoicePeerInfo,
} from "@dimovie/shared";
import { WS_URL } from "@/lib/api";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function toRtcIceServers(servers?: VoiceIceServer[]): RTCIceServer[] {
  if (!servers?.length) return DEFAULT_ICE_SERVERS;
  return servers.map((s) => ({
    urls: s.urls,
    ...(s.username ? { username: s.username } : {}),
    ...(s.credential ? { credential: s.credential } : {}),
  }));
}

function extractVoicePeers(
  payload: VoiceJoinPayload | VoicePeerInfo[] | { peers?: VoicePeerInfo[] },
): VoicePeerInfo[] {
  if (Array.isArray(payload)) return payload;
  return payload.peers ?? [];
}

function extractIceServers(
  payload: VoiceJoinPayload | VoicePeerInfo[] | { peers?: VoicePeerInfo[] },
): RTCIceServer[] | null {
  if (Array.isArray(payload)) return null;
  if ("iceServers" in payload && payload.iceServers) {
    return toRtcIceServers(payload.iceServers);
  }
  return null;
}

interface UseVoiceChatOptions {
  roomCode: string;
  token: string;
  currentUserId: string;
  enabled?: boolean;
  enhancedAudio?: boolean;
}

/** Lower user id initiates the offer for each pair. */
function shouldInitiateOffer(localUserId: string, remoteUserId: string) {
  return localUserId.localeCompare(remoteUserId) < 0;
}

/** Higher user id rolls back on offer glare. */
function isPolitePeer(localUserId: string, remoteUserId: string) {
  return localUserId.localeCompare(remoteUserId) > 0;
}

function parseSessionDescription(
  signal: Record<string, unknown>,
): RTCSessionDescriptionInit | null {
  const nested = signal.sdp as RTCSessionDescriptionInit | undefined;
  if (nested?.type && nested.sdp) return nested;
  if (typeof signal.type === "string" && typeof signal.sdp === "string") {
    return { type: signal.type as RTCSdpType, sdp: signal.sdp };
  }
  return null;
}

export function useVoiceChat({
  roomCode,
  token,
  currentUserId,
  enabled = true,
  enhancedAudio = false,
}: UseVoiceChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const currentUserIdRef = useRef(currentUserId);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voicePeers, setVoicePeers] = useState<VoicePeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cleanupPeer = useCallback((userId: string) => {
    peersRef.current.get(userId)?.close();
    peersRef.current.delete(userId);
    audioElsRef.current.get(userId)?.remove();
    audioElsRef.current.delete(userId);
    pendingCandidatesRef.current.delete(userId);
  }, []);

  const cleanupAll = useCallback(() => {
    for (const userId of peersRef.current.keys()) {
      cleanupPeer(userId);
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_LEAVE);
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setVoicePeers([]);
    pendingCandidatesRef.current.clear();
  }, [cleanupPeer]);

  const flushPendingCandidates = useCallback(
    async (userId: string, pc: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(userId) ?? [];
      pendingCandidatesRef.current.delete(userId);
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore stale candidates */
        }
      }
    },
    [],
  );

  const createPeerConnection = useCallback(
    async (targetUserId: string, initiator: boolean) => {
      if (peersRef.current.has(targetUserId)) return;

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
      });
      peersRef.current.set(targetUserId, pc);

      const localStream = localStreamRef.current;
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      }

      pc.ontrack = (event) => {
        const audio = audioElsRef.current.get(targetUserId) ?? new Audio();
        audio.autoplay = true;
        audio.srcObject = event.streams[0] ?? null;
        audioElsRef.current.set(targetUserId, audio);
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !socketRef.current) return;
        socketRef.current.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
          targetUserId,
          signal: { candidate: event.candidate.toJSON() },
        });
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
          targetUserId,
          signal: { sdp: pc.localDescription },
        });
      }
    },
    [],
  );

  const handleSignal = useCallback(
    async (fromUserId: string, signal: Record<string, unknown>) => {
      const localUserId = currentUserIdRef.current;
      if (!localUserId) return;

      try {
        if (signal.candidate) {
          let pc = peersRef.current.get(fromUserId);
          const candidate =
            signal.candidate instanceof RTCIceCandidate
              ? signal.candidate.toJSON()
              : (signal.candidate as RTCIceCandidateInit);

          if (!pc) {
            const queue = pendingCandidatesRef.current.get(fromUserId) ?? [];
            queue.push(candidate);
            pendingCandidatesRef.current.set(fromUserId, queue);
            return;
          }

          if (!pc.remoteDescription) {
            const queue = pendingCandidatesRef.current.get(fromUserId) ?? [];
            queue.push(candidate);
            pendingCandidatesRef.current.set(fromUserId, queue);
            return;
          }

          await pc.addIceCandidate(candidate);
          return;
        }

        const sdp = parseSessionDescription(signal);
        if (!sdp) return;

        let pc = peersRef.current.get(fromUserId);
        if (!pc) {
          await createPeerConnection(fromUserId, false);
          pc = peersRef.current.get(fromUserId);
        }
        if (!pc) return;

        const description = new RTCSessionDescription(sdp);

        if (description.type === "offer") {
          if (
            pc.signalingState === "have-local-offer" &&
            !isPolitePeer(localUserId, fromUserId)
          ) {
            return;
          }

          if (
            pc.signalingState === "have-local-offer" &&
            isPolitePeer(localUserId, fromUserId)
          ) {
            await pc.setLocalDescription({ type: "rollback" });
          }

          await pc.setRemoteDescription(description);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
            targetUserId: fromUserId,
            signal: { sdp: pc.localDescription },
          });
          await flushPendingCandidates(fromUserId, pc);
          return;
        }

        if (description.type === "answer") {
          if (pc.signalingState !== "have-local-offer") {
            return;
          }
          await pc.setRemoteDescription(description);
          await flushPendingCandidates(fromUserId, pc);
        }
      } catch {
        cleanupPeer(fromUserId);
      }
    },
    [createPeerConnection, cleanupPeer, flushPendingCandidates],
  );

  const joinVoice = useCallback(async () => {
    if (!enabled || !token || connected) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: enhancedAudio,
          autoGainControl: enhancedAudio,
          channelCount: enhancedAudio ? 2 : 1,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const socket = io(`${WS_URL}/voice`, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socket.on(
        WS_ROOM_EVENTS.VOICE_PEERS,
        async (
          payload:
            | VoiceJoinPayload
            | VoicePeerInfo[]
            | { peers?: VoicePeerInfo[] },
        ) => {
          const ice = extractIceServers(payload);
          if (ice) iceServersRef.current = ice;

          const peers = extractVoicePeers(payload);
          setVoicePeers(peers);

          const activeIds = new Set(peers.map((p) => p.userId));
          for (const userId of peersRef.current.keys()) {
            if (!activeIds.has(userId)) cleanupPeer(userId);
          }

          const localUserId = currentUserIdRef.current;
          for (const peer of peers) {
            if (peersRef.current.has(peer.userId)) continue;
            if (!localUserId) continue;
            const initiator = shouldInitiateOffer(localUserId, peer.userId);
            await createPeerConnection(peer.userId, initiator);
          }
        },
      );

      socket.on(
        WS_ROOM_EVENTS.VOICE_SIGNAL,
        (payload: { fromUserId: string; signal: Record<string, unknown> }) => {
          void handleSignal(payload.fromUserId, payload.signal);
        },
      );

      socket.on(WS_ROOM_EVENTS.ERROR, (payload?: { message?: string }) => {
        setError(
          payload?.message ??
            "Couldn’t connect voice. Check your mic and try again.",
        );
        cleanupAll();
      });

      socketRef.current = socket;
      socket.emit(WS_ROOM_EVENTS.VOICE_JOIN, {
        roomCode: roomCode.toUpperCase(),
      });
      setConnected(true);
    } catch (err) {
      setError(
        err instanceof Error && /denied|notallowed|permission/i.test(err.message)
          ? "Microphone access is blocked. Allow it in browser settings."
          : "Couldn’t connect voice. Check your mic and try again.",
      );
      cleanupAll();
    }
  }, [
    enabled,
    token,
    connected,
    roomCode,
    enhancedAudio,
    createPeerConnection,
    handleSignal,
    cleanupPeer,
    cleanupAll,
  ]);

  const leaveVoice = useCallback(() => {
    cleanupAll();
  }, [cleanupAll]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  return {
    connected,
    muted,
    voicePeers,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
  };
}
