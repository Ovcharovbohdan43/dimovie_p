/**
 * Cross-browser voice-activity helpers for WebRTC / mic streams.
 * Uses Web Audio AnalyserNode (works on Chromium, Firefox, Safari/iOS with unlocked AudioContext).
 */

export type SpeakingMonitor = {
  stop: () => void;
};

type MonitorOptions = {
  /** RMS threshold in 0..1 — speech is typically well above noise floor. */
  threshold?: number;
  /** Keep "speaking" true this long after level drops (ms) to avoid flicker. */
  hangoverMs?: number;
  /** Poll interval (ms). */
  intervalMs?: number;
};

function createAudioContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function rmsFromTimeDomain(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = ((data[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}

export function monitorStreamSpeaking(
  stream: MediaStream,
  onSpeaking: (speaking: boolean) => void,
  options: MonitorOptions = {},
): SpeakingMonitor {
  const threshold = options.threshold ?? 0.045;
  const hangoverMs = options.hangoverMs ?? 280;
  const intervalMs = options.intervalMs ?? 80;

  let stopped = false;
  let speaking = false;
  let lastLoudAt = 0;
  let timer: number | null = null;
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;

  const emit = (next: boolean) => {
    if (speaking === next) return;
    speaking = next;
    onSpeaking(next);
  };

  const tick = () => {
    if (stopped || !analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const rms = rmsFromTimeDomain(data);
    const now = performance.now();

    if (rms >= threshold) {
      lastLoudAt = now;
      emit(true);
    } else if (now - lastLoudAt > hangoverMs) {
      emit(false);
    }
  };

  try {
    ctx = createAudioContext();
    if (!ctx) {
      return { stop: () => undefined };
    }
    const start = async () => {
      if (stopped || !ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => undefined);
      }
      if (stopped || ctx.state === "closed") return;
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      // Don't connect to destination — monitoring only (avoids echo/feedback).
      timer = window.setInterval(tick, intervalMs);
    };
    void start();
  } catch {
    return { stop: () => undefined };
  }

  return {
    stop: () => {
      stopped = true;
      emit(false);
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
      try {
        source?.disconnect();
        analyser?.disconnect();
      } catch {
        /* ignore */
      }
      source = null;
      analyser = null;
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => undefined);
      }
      ctx = null;
    },
  };
}

/** Lightweight VAD for PCM relay packets (Int16). */
export function pcmLooksLikeSpeech(
  pcm: Int16Array,
  threshold = 0.04,
): boolean {
  if (!pcm.length) return false;
  let sum = 0;
  const step = Math.max(1, Math.floor(pcm.length / 256));
  let n = 0;
  for (let i = 0; i < pcm.length; i += step) {
    const v = pcm[i]! / 32768;
    sum += v * v;
    n++;
  }
  return Math.sqrt(sum / Math.max(1, n)) >= threshold;
}
