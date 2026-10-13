import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import { modelPath, modelsDownloadRoot, isMultilingualModel } from './models';

export interface TranscribeOutput {
  text: string;
  language: string | null;
  durationMs: number;
  audioDurationMs: number;
}

export interface TranscribeOptions {
  pythonBin: string;
  modelId: string;
  // Whisper language code (e.g. 'es'), or 'auto'/undefined for auto-detect.
  // Only forwarded to the worker when modelId supports it (see
  // isMultilingualModel) — English-only checkpoints get nothing, since
  // there's no language parameter for them to honor.
  language?: string;
}

function workerScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'worker.py');
  }
  return path.resolve(__dirname, '..', '..', '..', 'electron', 'python', 'worker.py');
}

function writeWavFile(pcm: Buffer, sampleRate: number, channels: number): string {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const tmpDir = path.join(os.tmpdir(), 'bisbi');
  fs.mkdirSync(tmpDir, { recursive: true });
  const file = path.join(tmpDir, `${randomUUID()}.wav`);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
  return file;
}

interface PendingRequest {
  resolve: (out: { text: string; language: string | null }) => void;
  reject: (err: Error) => void;
}

interface WhisperWorker {
  pythonBin: string;
  modelId: string;
  child: ChildProcess;
  ready: Promise<void>;
  nextId: number;
  pending: Map<number, PendingRequest>;
  buffer: string;
  alive: boolean;
}

// A resident worker keeps the model loaded in memory across calls — loading
// it (reading + deserializing the checkpoint) is the expensive part, from a
// couple seconds for `base` to tens of seconds for `large`. Spawning a fresh
// python process per transcription (the original design) paid that cost on
// every single call, including the live-caption pass that fires every
// ~1.8s while recording — fine for small models, unusably slow for anything
// medium+. Only one worker is kept at a time; switching models kills the old
// one and pays the load cost once for the new one.
let currentWorker: WhisperWorker | null = null;

function killWorker(worker: WhisperWorker, reason: string): void {
  worker.alive = false;
  try { worker.child.kill('SIGKILL'); } catch {}
  const err = new Error(reason);
  for (const [, pending] of worker.pending) pending.reject(err);
  worker.pending.clear();
}

export function shutdownWorker(): void {
  if (!currentWorker) return;
  killWorker(currentWorker, 'worker shut down');
  currentWorker = null;
}

// Cancelling a recording kills whatever the engine is currently doing —
// there's no way to abort a single in-flight `model.transcribe()` call
// inside the worker without killing the process, so a cancel pays the
// reload cost on the next transcription. That's an acceptable tradeoff:
// cancel is an explicit, infrequent user action (Escape / cancelAll), not
// something that happens on every recording.
export function cancelActiveTranscription(): boolean {
  if (!currentWorker || !currentWorker.alive) return false;
  killWorker(currentWorker, 'cancelled');
  currentWorker = null;
  return true;
}

function spawnWorker(pythonBin: string, modelId: string): WhisperWorker {
  // Pass the *resolved* checkpoint path, not just the download root:
  // modelPath() prefers the copy bundled in resources/ (fetched at build
  // time), but whisper.load_model(name, download_root=...) only ever looks
  // for `<download_root>/<name>.pt` — it can't see the bundled file. Handing
  // it the bare model id therefore made Python silently re-download the whole
  // checkpoint (1.6GB for large-v3-turbo) on first use even though the UI
  // reported the model as ready, which read as the app hanging in
  // "transcribing" forever. download_root stays as the fallback for the case
  // where neither copy exists yet.
  const child = spawn(
    pythonBin,
    [workerScriptPath(), modelId, modelsDownloadRoot(), modelPath(modelId)],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  let readyResolve!: () => void;
  let readyReject!: (err: Error) => void;
  let sawReady = false;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const worker: WhisperWorker = {
    pythonBin,
    modelId,
    child,
    ready,
    nextId: 1,
    pending: new Map(),
    buffer: '',
    alive: true,
  };

  let stderrTail = '';
  child.stderr?.on('data', (d: Buffer) => {
    stderrTail = (stderrTail + d.toString()).slice(-2000);
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    worker.buffer += chunk.toString();
    let idx: number;
    while ((idx = worker.buffer.indexOf('\n')) !== -1) {
      const line = worker.buffer.slice(0, idx).trim();
      worker.buffer = worker.buffer.slice(idx + 1);
      if (!line) continue;
      let msg: { ready?: boolean; id?: number; text?: string; language?: string | null; error?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (!sawReady) {
        sawReady = true;
        if (msg.ready) readyResolve();
        else readyReject(new Error(msg.error ?? 'worker failed to start'));
        continue;
      }
      if (msg.id === undefined) continue;
      const pending = worker.pending.get(msg.id);
      if (!pending) continue;
      worker.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error));
      else pending.resolve({ text: msg.text ?? '', language: msg.language ?? null });
    }
  });

  const onDown = (err: Error) => {
    worker.alive = false;
    if (!sawReady) {
      sawReady = true;
      readyReject(err);
    }
    for (const [, pending] of worker.pending) pending.reject(err);
    worker.pending.clear();
    if (currentWorker === worker) currentWorker = null;
  };
  child.on('error', onDown);
  child.on('exit', () => onDown(new Error(`worker exited (model=${modelId}): ${stderrTail.slice(-500)}`)));

  return worker;
}

async function getWorker(pythonBin: string, modelId: string): Promise<WhisperWorker> {
  if (
    currentWorker &&
    currentWorker.alive &&
    currentWorker.pythonBin === pythonBin &&
    currentWorker.modelId === modelId
  ) {
    await currentWorker.ready;
    return currentWorker;
  }
  if (currentWorker) killWorker(currentWorker, 'switching model');
  const worker = spawnWorker(pythonBin, modelId);
  currentWorker = worker;
  await worker.ready;
  return worker;
}

export async function transcribePcm(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  opts: TranscribeOptions
): Promise<TranscribeOutput> {
  const wavPath = writeWavFile(pcm, sampleRate, channels);
  const startedAt = Date.now();
  const bytesPerFrame = 2 * Math.max(1, channels);
  const audioDurationMs = Math.round((pcm.length / (sampleRate * bytesPerFrame)) * 1000);

  try {
    const worker = await getWorker(opts.pythonBin, opts.modelId);
    const id = worker.nextId++;
    const shouldSendLanguage =
      opts.language && opts.language !== 'auto' && isMultilingualModel(opts.modelId);
    const result = await new Promise<{ text: string; language: string | null }>((resolve, reject) => {
      worker.pending.set(id, { resolve, reject });
      worker.child.stdin!.write(
        `${JSON.stringify({
          id,
          wav_path: wavPath,
          ...(shouldSendLanguage ? { language: opts.language } : {}),
        })}\n`
      );
    });
    return {
      text: result.text.trim(),
      language: result.language,
      durationMs: Date.now() - startedAt,
      audioDurationMs,
    };
  } finally {
    try { fs.unlinkSync(wavPath); } catch {}
  }
}

export interface EngineResourceCheck {
  ok: boolean;
  modelPath: string;
  missing: string[];
}

export function checkModelResource(modelId: string): EngineResourceCheck {
  const p = modelPath(modelId);
  const missing = fs.existsSync(p) ? [] : [p];
  return { ok: missing.length === 0, modelPath: p, missing };
}
