export interface VoiceSignalPayload {
  targetUserId: string;
  signal: unknown;
}

export interface VoicePeerInfo {
  userId: string;
  displayName: string;
  socketId: string;
}

export interface MediasoupRouterCapabilities {
  routerRtpCapabilities: unknown;
}

export interface VoiceIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VoiceJoinPayload {
  mode: "p2p" | "sfu";
  maxPeers: number;
  enhancedAudio: boolean;
  iceServers?: VoiceIceServer[];
  routerRtpCapabilities?: unknown;
  transport?: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown[];
    dtlsParameters: unknown;
  } | null;
  peers: VoicePeerInfo[];
}
