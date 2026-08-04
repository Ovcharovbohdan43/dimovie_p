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

const RELAY_SAMPLE_RATE = 16000;
const RELAY_BUFFER_SIZE = 2048;

type RelayCapture = {
  ctx: AudioContext;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  silent: GainNode;
};

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToPcm(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
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
  const mutedRef = useRef(false);
  const webrtcLiveRef = useRef<Set<string>>(new Set());
  const relayActiveRef = useRef(false);
  const relayCaptureRef = useRef<RelayCapture | null>(null);
  const relayPlayCtxRef = useRef<AudioContext | null>(null);
  const relayNextTimeRef = useRef(0);
  const relayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voicePeers, setVoicePeers] = useState<VoicePeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [usingRelay, setUsingRelay] = useState(false);

  const iceRestartingRef = useRef<Set<string>>(new Set());

  const stopRelayCapture = useCallback(() => {
    relayActiveRef.current = false;
    setUsingRelay(false);
    const capture = relayCaptureRef.current;
    if (capture) {
      try {
        capture.processor.disconnect();
        capture.source.disconnect();
        capture.silent.disconnect();
        void capture.ctx.close();
      } catch {
        /* ignore */
      }
      relayCaptureRef.current = null;
    }
    if (relayTimerRef.current != null) {
      window.clearTimeout(relayTimerRef.current);
      relayTimerRef.current = null;
    }
  }, []);

  const playRelayPcm = useCallback(async (pcm: Int16Array) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioCtx) return;

      let ctx = relayPlayCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioCtx({ sampleRate: RELAY_SAMPLE_RATE });
        relayPlayCtxRef.current = ctx;
        relayNextTimeRef.current = 0;
      }
      if (ctx.state === "suspended") await ctx.resume();

      const floats = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) {
        floats[i] = pcm[i]! / 32768;
      }
      const buffer = ctx.createBuffer(1, floats.length, RELAY_SAMPLE_RATE);
      buffer.copyToChannel(floats, 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.02, relayNextTimeRef.current);
      src.start(startAt);
      relayNextTimeRef.current = startAt + buffer.duration;
    } catch {
      /* ignore decode glitches */
    }
  }, []);

  const startRelayCapture = useCallback(async () => {
    if (relayActiveRef.current || !localStreamRef.current || !socketRef.current) {
      return;
    }
    if (webrtcLiveRef.current.size > 0) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx({ sampleRate: RELAY_SAMPLE_RATE });
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(localStreamRef.current);
      const processor = ctx.createScriptProcessor(RELAY_BUFFER_SIZE, 1, 1);
      const silent = ctx.createGain();
      silent.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (!relayActiveRef.current || mutedRef.current) return;
        if (webrtcLiveRef.current.size > 0) return;
        const socket = socketRef.current;
        if (!socket) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]!));
          pcm[i] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
        }
        socket.emit(WS_ROOM_EVENTS.VOICE_AUDIO, { pcm: pcmToBase64(pcm) });
      };

      source.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);

      relayCaptureRef.current = { ctx, processor, source, silent };
      relayActiveRef.current = true;
      setUsingRelay(true);
    } catch {
      /* relay optional */
    }
  }, []);

  const cleanupPeer = useCallback((userId: string) => {
    peersRef.current.get(userId)?.close();
    peersRef.current.delete(userId);
    audioElsRef.current.get(userId)?.remove();
    audioElsRef.current.delete(userId);
    pendingCandidatesRef.current.delete(userId);
    iceRestartingRef.current.delete(userId);
    webrtcLiveRef.current.delete(userId);
  }, []);

  const cleanupAll = useCallback(() => {
    stopRelayCapture();
    for (const userId of peersRef.current.keys()) {
      cleanupPeer(userId);
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_LEAVE);
    socketRef.current?.disconnect();
    socketRef.current = null;
    webrtcLiveRef.current.clear();
    if (relayPlayCtxRef.current) {
      void relayPlayCtxRef.current.close().catch(() => undefined);
      relayPlayCtxRef.current = null;
    }
    setConnected(false);
    setVoicePeers([]);
    setNeedsAudioUnlock(false);
    pendingCandidatesRef.current.clear();
  }, [cleanupPeer, stopRelayCapture]);

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
        iceCandidatePoolSize: 4,
      });
      peersRef.current.set(targetUserId, pc);

      const localStream = localStreamRef.current;
      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      } else {
        pc.addTransceiver("audio", { direction: "sendrecv" });
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
        if (pc.connectionState === "connected") {
          iceRestartingRef.current.delete(targetUserId);
          webrtcLiveRef.current.add(targetUserId);
          stopRelayCapture();
          resumeAllRemoteAudio(audioElsRef.current);
          return;
        }

        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          webrtcLiveRef.current.delete(targetUserId);
        }

        if (pc.connectionState === "closed") {
          cleanupPeer(targetUserId);
          void startRelayCapture();
          return;
        }

        if (pc.connectionState !== "failed") return;
        if (iceRestartingRef.current.has(targetUserId)) {
          void startRelayCapture();
          return;
        }

        const localUserId = currentUserIdRef.current;
        if (!localUserId || !shouldInitiateOffer(localUserId, targetUserId)) {
          void startRelayCapture();
          return;
        }

        iceRestartingRef.current.add(targetUserId);
        void (async () => {
          try {
            pc.setConfiguration({ iceServers: iceServersRef.current });
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            socketRef.current?.emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
              targetUserId,
              signal: { sdp: pc.localDescription },
            });
          } catch {
            void startRelayCapture();
          }
        })();
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
    [cleanupPeer, startRelayCapture, stopRelayCapture],
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
        (payload: {
          fromUserId: string;
          targetUserId?: string;
          signal: Record<string, unknown>;
        }) => {
          const me = currentUserIdRef.current;
          if (payload.targetUserId && me && payload.targetUserId !== me) {
            return;
          }
          void handleSignal(payload.fromUserId, payload.signal);
        },
      );

      socket.on(
        WS_ROOM_EVENTS.VOICE_AUDIO,
        (payload: { fromUserId: string; pcm: string }) => {
          const me = currentUserIdRef.current;
          if (!payload?.pcm || payload.fromUserId === me) return;
          // Prefer WebRTC when that peer already has a live media path.
          if (webrtcLiveRef.current.has(payload.fromUserId)) return;
          void playRelayPcm(base64ToPcm(payload.pcm));
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

      // If ICE/TURN cannot complete quickly (common on mobile NATs), fall back
      // to Socket.IO PCM relay so voice still works on Railway without TURN.
      if (relayTimerRef.current != null) {
        window.clearTimeout(relayTimerRef.current);
      }
      relayTimerRef.current = window.setTimeout(() => {
        if (webrtcLiveRef.current.size === 0) {
          void startRelayCapture();
        }
      }, 2500);
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
    startRelayCapture,
    playRelayPcm,
  ]);

  const leaveVoice = useCallback(() => {
    cleanupAll();
  }, [cleanupAll]);

  const unlockRemoteAudio = useCallback(async () => {
    await unlockAudioPlayback();
    resumeAllRemoteAudio(audioElsRef.current);
    if (relayPlayCtxRef.current?.state === "suspended") {
      await relayPlayCtxRef.current.resume().catch(() => undefined);
    }
    if (webrtcLiveRef.current.size === 0) {
      void startRelayCapture();
    }
    setNeedsAudioUnlock(false);
  }, [startRelayCapture]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    mutedRef.current = next;
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
    usingRelay,
    joinVoice,
    leaveVoice,
    toggleMute,
    unlockRemoteAudio,
  };
}
