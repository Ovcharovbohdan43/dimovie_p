"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { WS_ROOM_EVENTS } from "@dimovie/shared";
import type {
  VoiceIceServer,
  VoiceJoinPayload,
  VoicePeerInfo,
} from "@dimovie/shared";
import { getRuntimeConfig } from "@/lib/runtime-config";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const REMOTE_AUDIO_ROOT_ID = "dimovie-voice-remote";

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

function getRemoteAudioRoot(): HTMLElement {
  let root = document.getElementById(REMOTE_AUDIO_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = REMOTE_AUDIO_ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    root.style.cssText =
      "position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * iOS Safari / mobile WebViews block remote WebRTC audio unless the element is
 * in the DOM and play() runs after capture (or a user gesture).
 */
async function unlockAudioPlayback(): Promise<void> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 400);
  } catch {
    /* unlock is best-effort */
  }
}

function playRemoteAudio(audio: HTMLAudioElement) {
  audio.muted = false;
  audio.volume = 1;
  const result = audio.play();
  if (result !== undefined) {
    void result.catch(() => {
      /* Autoplay may still block until the next gesture; resumeAllRemoteAudio covers that. */
    });
  }
}

function attachRemoteAudio(
  userId: string,
  stream: MediaStream,
  audioEls: Map<string, HTMLAudioElement>,
) {
  let audio = audioEls.get(userId);
  if (!audio) {
    audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.preload = "auto";
    getRemoteAudioRoot().appendChild(audio);
    audioEls.set(userId, audio);
  }

  if (audio.srcObject !== stream) {
    audio.srcObject = stream;
  }

  playRemoteAudio(audio);

  for (const track of stream.getAudioTracks()) {
    track.onunmute = () => playRemoteAudio(audio!);
    track.onmute = () => {
      /* keep element; track may unmute again */
    };
  }
}

function resumeAllRemoteAudio(audioEls: Map<string, HTMLAudioElement>) {
  for (const audio of audioEls.values()) {
    playRemoteAudio(audio);
  }
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
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

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
    setNeedsAudioUnlock(false);
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
        const stream =
          event.streams[0] ?? new MediaStream([event.track]);
        attachRemoteAudio(targetUserId, stream, audioElsRef.current);

        const playAttempt = audioElsRef.current.get(targetUserId);
        if (playAttempt) {
          void playAttempt.play().catch(() => {
            setNeedsAudioUnlock(true);
          });
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !socketRef.current) return;
        socketRef.current.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
          targetUserId,
          signal: { candidate: event.candidate.toJSON() },
        });
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          cleanupPeer(targetUserId);
        }
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
    [cleanupPeer],
  );

  const handleSignal = useCallback(
    async (fromUserId: string, signal: Record<string, unknown>) => {
      const localUserId = currentUserIdRef.current;
      if (!localUserId || fromUserId === localUserId) return;

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
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch {
              cleanupPeer(fromUserId);
              await createPeerConnection(fromUserId, false);
              pc = peersRef.current.get(fromUserId);
              if (!pc) return;
            }
          }

          await pc.setRemoteDescription(description);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
            targetUserId: fromUserId,
            signal: { sdp: pc.localDescription },
          });
          await flushPendingCandidates(fromUserId, pc);
          resumeAllRemoteAudio(audioElsRef.current);
          return;
        }

        if (description.type === "answer") {
          if (pc.signalingState !== "have-local-offer") {
            return;
          }
          await pc.setRemoteDescription(description);
          await flushPendingCandidates(fromUserId, pc);
          resumeAllRemoteAudio(audioElsRef.current);
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
    setNeedsAudioUnlock(false);
    void enhancedAudio;

    try {
      // Avoid forced channelCount/stereo — breaks getUserMedia on some iOS devices.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      // Capture + silent AudioContext unlock lets iOS autoplay remote MediaStreams.
      await unlockAudioPlayback();

      const { wsUrl } = await getRuntimeConfig();
      const socket = io(`${wsUrl}/voice`, {
        auth: { token },
        withCredentials: true,
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

          const localUserId = currentUserIdRef.current;
          const peers = extractVoicePeers(payload).filter(
            (p) => p.userId !== localUserId,
          );
          setVoicePeers(peers);

          const activeIds = new Set(peers.map((p) => p.userId));
          for (const userId of peersRef.current.keys()) {
            if (!activeIds.has(userId)) cleanupPeer(userId);
          }

          for (const peer of peers) {
            if (peersRef.current.has(peer.userId)) continue;
            if (!localUserId) continue;
            const initiator = shouldInitiateOffer(localUserId, peer.userId);
            await createPeerConnection(peer.userId, initiator);
          }

          resumeAllRemoteAudio(audioElsRef.current);
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

  const unlockRemoteAudio = useCallback(async () => {
    await unlockAudioPlayback();
    resumeAllRemoteAudio(audioElsRef.current);
    setNeedsAudioUnlock(false);
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
    // Mute/unmute is a user gesture — retry remote playback (critical on iOS).
    void unlockRemoteAudio();
  }, [muted, unlockRemoteAudio]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && connected) {
        resumeAllRemoteAudio(audioElsRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [connected]);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  return {
    connected,
    muted,
    voicePeers,
    error,
    needsAudioUnlock,
    joinVoice,
    leaveVoice,
    toggleMute,
    unlockRemoteAudio,
  };
}
