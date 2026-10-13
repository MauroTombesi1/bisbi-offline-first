const TARGET_SAMPLE_RATE = 16000;
const CHANNELS = 1;

export interface RecordingHandle {
  stop: () => Promise<{ pcm: ArrayBuffer; sampleRate: number; channels: number }>;
  cancel: () => void;
}

export interface StartRecordingOptions {
  onLevel?: (level: number) => void;
  // Segment hook: while recording, audio is cut at natural pauses (silence
  // after at least MIN_SEGMENT_MS of speech) and each finished piece is handed
  // off here so the backend can transcribe it while recording continues. Cuts
  // only land in silence, so words are never split. stop() then returns just
  // the remaining tail. Without this hook, stop() returns the whole clip.
  onSegment?: (pcm: ArrayBuffer, sampleRate: number, channels: number) => void;
  deviceId?: string | null;
}

const MIN_SEGMENT_MS = 5000;
// Pause needed to cut shrinks as the piece grows: early on only a clear
// sentence break (600ms) qualifies, so short "eh…" hesitations don't split a
// phrase; by RELAX_BY_MS any breath (250ms) is enough, so pieces stay short
// and the backend never falls behind.
const SILENCE_MS_START = 600;
const SILENCE_MS_END = 250;
const RELAX_BY_MS = 15000;
// Hard cap for non-stop talkers: cut at the quietest point of the last
// FORCED_CUT_LOOKBACK_MS instead of mid-word.
const MAX_SEGMENT_MS = 25000;
const FORCED_CUT_LOOKBACK_MS = 2000;
const MIN_SILENCE_RMS = 0.008;
const SILENCE_NOISE_MULT = 2.5;
// Pieces with less voice than this are dropped: Whisper hallucinates text
// ("Thanks for watching") on near-silent audio.
const MIN_VOICED_MS = 250;
const MIN_SEGMENT_SAMPLES = Math.round(TARGET_SAMPLE_RATE * 0.3);

function requiredSilenceMs(segmentMs: number): number {
  const t = Math.min(1, Math.max(0, (segmentMs - MIN_SEGMENT_MS) / (RELAX_BY_MS - MIN_SEGMENT_MS)));
  return SILENCE_MS_START + (SILENCE_MS_END - SILENCE_MS_START) * t;
}

export async function startRecording(
  opts: StartRecordingOptions = {}
): Promise<RecordingHandle> {
  const deviceId = await resolveDeviceId(opts.deviceId ?? null);
  const audio: MediaTrackConstraints = {
    channelCount: 1,
    sampleRate: 48000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({
    audio,
    video: false,
  });

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  const sourceSampleRate = ctx.sampleRate;
  let chunks: Float32Array[] = [];
  // Parallel to chunks: per-block RMS and voiced flag, for cut decisions.
  let blockRms: number[] = [];
  let blockVoiced: boolean[] = [];
  let stopped = false;
  let everCaptured = false;
  let silentSamples = 0;
  // Slow-rising minimum of block RMS ≈ ambient noise; speech must stay above it.
  let noiseFloor = 0.01;

  const msOf = (samples: number) => (samples / sourceSampleRate) * 1000;
  const samplesIn = (list: Float32Array[]) => list.reduce((n, c) => n + c.length, 0);
  const voicedMsIn = (from: number, to: number) => {
    let n = 0;
    for (let i = from; i < to; i++) if (blockVoiced[i]) n += chunks[i]!.length;
    return msOf(n);
  };

  // Emits chunks[0..count) as one piece and keeps the rest as the start of
  // the next piece.
  const flushSegment = (count: number) => {
    const piece = chunks.slice(0, count);
    const voicedMs = voicedMsIn(0, count);
    chunks = chunks.slice(count);
    blockRms = blockRms.slice(count);
    blockVoiced = blockVoiced.slice(count);
    silentSamples = 0;
    for (let i = blockVoiced.length - 1; i >= 0 && !blockVoiced[i]; i--) {
      silentSamples += chunks[i]!.length;
    }
    if (voicedMs < MIN_VOICED_MS) return;
    const downsampled = downsampleBuffer(mergeFloat32(piece), sourceSampleRate, TARGET_SAMPLE_RATE);
    if (downsampled.length < MIN_SEGMENT_SAMPLES) return;
    const pcm16 = floatTo16BitPcm(downsampled);
    opts.onSegment!(pcm16.buffer as ArrayBuffer, TARGET_SAMPLE_RATE, CHANNELS);
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    everCaptured = true;
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
    const rms = Math.sqrt(sum / input.length);
    if (opts.onLevel) opts.onLevel(Math.min(1, rms * 4));

    if (!opts.onSegment) return;
    noiseFloor = rms < noiseFloor ? rms : noiseFloor * 1.002 + 1e-6;
    const silent = rms < Math.max(MIN_SILENCE_RMS, noiseFloor * SILENCE_NOISE_MULT);
    blockRms.push(rms);
    blockVoiced.push(!silent);
    silentSamples = silent ? silentSamples + input.length : 0;

    const segmentMs = msOf(samplesIn(chunks));
    if (segmentMs >= MIN_SEGMENT_MS && msOf(silentSamples) >= requiredSilenceMs(segmentMs)) {
      // Cut in the middle of the pause so both pieces keep a little padding.
      let silentBlocks = 0;
      for (let i = blockVoiced.length - 1; i >= 0 && !blockVoiced[i]; i--) silentBlocks++;
      flushSegment(chunks.length - Math.floor(silentBlocks / 2));
    } else if (segmentMs >= MAX_SEGMENT_MS) {
      const lookback = Math.max(1, Math.round(FORCED_CUT_LOOKBACK_MS / msOf(input.length)));
      let best = chunks.length - 1;
      for (let i = Math.max(0, chunks.length - lookback); i < chunks.length; i++) {
        if (blockRms[i]! < blockRms[best]!) best = i;
      }
      flushSegment(best + 1);
    }
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  const cleanup = () => {
    stopped = true;
    try { processor.disconnect(); } catch {}
    try { source.disconnect(); } catch {}
    for (const t of stream.getTracks()) t.stop();
    void ctx.close().catch(() => {});
  };

  return {
    stop: async () => {
      if (!everCaptured) {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (everCaptured) { clearInterval(interval); resolve(); }
          }, 20);
          setTimeout(() => { clearInterval(interval); resolve(); }, 300);
        });
      }
      stopped = true;
      // In segmenting mode a tail with no real voice is sent empty: the
      // backend still finalizes the dictation but skips Whisper on it.
      const tail =
        opts.onSegment && voicedMsIn(0, chunks.length) < MIN_VOICED_MS ? [] : chunks;
      const merged = mergeFloat32(tail);
      cleanup();
      const downsampled = downsampleBuffer(merged, sourceSampleRate, TARGET_SAMPLE_RATE);
      const pcm16 = floatTo16BitPcm(downsampled);
      return {
        pcm: pcm16.buffer as ArrayBuffer,
        sampleRate: TARGET_SAMPLE_RATE,
        channels: CHANNELS,
      };
    },
    cancel: () => cleanup(),
  };
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function downsampleBuffer(buffer: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (dstRate === srcRate) return buffer;
  if (dstRate > srcRate) throw new Error('Downsample-only supported');
  const ratio = srcRate / dstRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]!;
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export async function listMicrophones(): Promise<MicrophoneDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch {
    return [];
  }
}

async function resolveDeviceId(preferred: string | null): Promise<string | null> {
  if (!preferred) return null;
  const mics = await listMicrophones();
  return mics.some((m) => m.deviceId === preferred) ? preferred : null;
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
