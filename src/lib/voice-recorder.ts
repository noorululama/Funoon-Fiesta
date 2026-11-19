"use client";

/**
 * Microphone recorder used on iPhone/iPad (and any browser without the Web
 * Speech API). iOS Safari's SpeechRecognition is unreliable: it fails in
 * home-screen (PWA) mode, in Chrome/in-app browsers, when Siri & Dictation is
 * off, with continuous listening, and for Malayalam. Recording raw audio and
 * transcribing it on the server works everywhere getUserMedia works.
 *
 * Audio is captured as PCM, stopped automatically after a pause in speech,
 * and returned as a 16 kHz mono WAV blob.
 */

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function canRecordAudio(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

type StartOptions = {
  /** Called once when the speaker pauses (or nobody spoke for a while). */
  onAutoStop: () => void;
  silenceMs?: number;
  noSpeechMs?: number;
  maxMs?: number;
};

const TARGET_RATE = 16_000;

export class VoiceRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private heardSpeech = false;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get isActive() {
    return this.active;
  }

  async start({ onAutoStop, silenceMs = 1500, noSpeechMs = 8000, maxMs = 25000 }: StartOptions) {
    if (this.active) return;
    // Create/resume the AudioContext inside the tap, before any await (iOS rule).
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    this.ctx = ctx;
    const resumed = ctx.resume().catch(() => {});

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      this.release();
      throw e;
    }
    await resumed;
    this.stream = stream;
    this.chunks = [];
    this.heardSpeech = false;
    this.active = true;

    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    this.source = source;
    this.node = node;

    const startedAt = performance.now();
    let lastVoiceAt = startedAt;
    let noiseFloor = 0.004;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      onAutoStop();
    };

    node.onaudioprocess = (ev) => {
      if (!this.active) return;
      const input = ev.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      const now = performance.now();
      // Learn the room's background level in the first moments.
      if (now - startedAt < 350) noiseFloor = Math.max(noiseFloor, rms);
      const threshold = Math.max(0.012, noiseFloor * 2.2);
      if (rms > threshold) {
        lastVoiceAt = now;
        this.heardSpeech = true;
      }
      if (this.heardSpeech && now - lastVoiceAt > silenceMs) fire();
      else if (!this.heardSpeech && now - startedAt > noSpeechMs) fire();
      else if (now - startedAt > maxMs) fire();
    };

    source.connect(node);
    // iOS only runs the processor when it is connected to the output; a muted gain keeps it silent.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(ctx.destination);

    this.timer = setTimeout(() => this.active && fire(), maxMs + 1000);
  }

  /** Stops the mic. Resolves to a WAV blob, or null if nobody spoke. */
  async stop(): Promise<Blob | null> {
    if (!this.active && !this.ctx) return null;
    const rate = this.ctx?.sampleRate ?? 44_100;
    const chunks = this.chunks;
    const heard = this.heardSpeech;
    this.release();
    if (!heard || chunks.length === 0) return null;
    return encodeWav(downsample(merge(chunks), rate, TARGET_RATE), TARGET_RATE);
  }

  cancel() {
    this.release();
  }

  private release() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.node) this.node.onaudioprocess = null;
    try {
      this.source?.disconnect();
      this.node?.disconnect();
    } catch {}
    // Releasing the mic matters on iPhone: while it is open, speech plays quietly through the earpiece.
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.source = null;
    this.node = null;
    this.ctx = null;
    this.chunks = [];
  }
}

function merge(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function downsample(data: Float32Array, from: number, to: number): Float32Array {
  if (from <= to) return data;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(data.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
