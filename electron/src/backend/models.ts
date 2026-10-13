// Registry of OpenAI's own official Whisper checkpoints
// (https://github.com/openai/whisper). URLs + content are content-addressed
// (the sha256 is baked into the path) straight from
// raw.githubusercontent.com/openai/whisper/main/whisper/__init__.py's
// _MODELS dict — no third-party mirror, no ggml conversion, nothing hosted
// outside OpenAI's own CDN. Bisbi downloads the .pt directly and hands it to
// the official `openai-whisper` pip package (see pythonEnv.ts + transcribe.py)
// for inference, so the file on disk is byte-identical to what
// `whisper.load_model()` would fetch itself.
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface WhisperModelInfo {
  id: string;
  label: string;
  url: string;
  sizeMb: number;
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  { id: 'tiny', label: 'Tiny', sizeMb: 75, url: 'https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt' },
  { id: 'tiny.en', label: 'Tiny (English)', sizeMb: 75, url: 'https://openaipublic.azureedge.net/main/whisper/models/d3dd57d32accea0b295c96e26691aa14d8822fac7d9d27d5dc00b4ca2826dd03/tiny.en.pt' },
  { id: 'base', label: 'Base', sizeMb: 145, url: 'https://openaipublic.azureedge.net/main/whisper/models/ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e/base.pt' },
  { id: 'base.en', label: 'Base (English)', sizeMb: 145, url: 'https://openaipublic.azureedge.net/main/whisper/models/25a8566e1d0c1e2231d1c762132cd20e0f96a85d16145c3a00adf5d1ac670ead/base.en.pt' },
  { id: 'small', label: 'Small', sizeMb: 483, url: 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf19d441fb42bf17a411e794/small.pt' },
  { id: 'small.en', label: 'Small (English)', sizeMb: 483, url: 'https://openaipublic.azureedge.net/main/whisper/models/f953ad0fd29cacd07d5a9eda5624af0f6bcf2258be67c92b79389873d91e0872/small.en.pt' },
  { id: 'medium', label: 'Medium', sizeMb: 1528, url: 'https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97c714f32e89e936602e85993674d08dcb1/medium.pt' },
  { id: 'medium.en', label: 'Medium (English)', sizeMb: 1528, url: 'https://openaipublic.azureedge.net/main/whisper/models/d7440d1dc186f76616474e0ff0b3b6b879abc9d1a4926b7adfa41db2d497ab4f/medium.en.pt' },
  { id: 'large-v1', label: 'Large v1', sizeMb: 2950, url: 'https://openaipublic.azureedge.net/main/whisper/models/e4b87e7e0bf463eb8e6956e646f1e277e901512310def2c24bf0e11bd3c28e9a/large-v1.pt' },
  { id: 'large-v2', label: 'Large v2', sizeMb: 2950, url: 'https://openaipublic.azureedge.net/main/whisper/models/81f7c96c852ee8fc832187b0132e569d6c3065a3252ed18e56effd0b6a73e524/large-v2.pt' },
  { id: 'large-v3', label: 'Large v3', sizeMb: 2950, url: 'https://openaipublic.azureedge.net/main/whisper/models/e5b1a55b89c1367dacf97e3e19bfd829a01529dbfdeefa8caeb59b3f1b81dadb/large-v3.pt' },
  { id: 'large-v3-turbo', label: 'Large v3 Turbo', sizeMb: 1620, url: 'https://openaipublic.azureedge.net/main/whisper/models/aff26ae408abcba5fbf8813c21e62b0941638c5f6eebfb145be0c9839262a19a/large-v3-turbo.pt' },
];

// Matches the model bundled at build time by scripts/fetch-whisper-models.mjs,
// so a fresh install always has one working model without any download.
// Smallest multilingual checkpoint, to keep the installer light.
export const DEFAULT_WHISPER_MODEL = 'tiny';

export function isKnownModel(id: unknown): id is string {
  return typeof id === 'string' && WHISPER_MODELS.some((m) => m.id === id);
}

// `.en` checkpoints are English-only (see the labels above) — they don't
// accept a `language` kwarg the way the multilingual checkpoints do, so
// there's nothing useful to pass to `model.transcribe()` for them.
export function isMultilingualModel(id: string): boolean {
  return !id.endsWith('.en');
}

function findModel(id: string): WhisperModelInfo | undefined {
  return WHISPER_MODELS.find((m) => m.id === id);
}

function modelFileName(id: string): string {
  const m = findModel(id);
  return m ? path.basename(m.url) : `${id}.pt`;
}

// Bundled models ship inside the app (fetched at build time); anything the
// user picks later downloads straight from OpenAI into userData instead of
// bloating the installer.
function bundledResourceDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'models');
  }
  return path.resolve(__dirname, '..', '..', '..', 'resources', 'models');
}

// This is also the `download_root` passed to `whisper.load_model()` in
// transcribe.py — Python's own loader checks for a file matching the official
// URL's basename + sha256 before touching the network, so pre-fetching here
// means it never re-downloads what we already have.
export function modelsDownloadRoot(): string {
  const dir = path.join(app.getPath('userData'), 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function modelPath(id: string): string {
  const file = modelFileName(id);
  const bundled = path.join(bundledResourceDir(), file);
  if (fs.existsSync(bundled)) return bundled;
  return path.join(modelsDownloadRoot(), file);
}

export function isModelDownloaded(id: string): boolean {
  return fs.existsSync(modelPath(id));
}

export interface ModelListEntry extends WhisperModelInfo {
  downloaded: boolean;
  multilingual: boolean;
}

export function listModels(): ModelListEntry[] {
  return WHISPER_MODELS.map((m) => ({
    ...m,
    downloaded: isModelDownloaded(m.id),
    multilingual: isMultilingualModel(m.id),
  }));
}

export async function downloadModel(
  id: string,
  onProgress: (receivedBytes: number, totalBytes: number) => void
): Promise<void> {
  const model = findModel(id);
  if (!model) throw new Error(`Unknown whisper model: ${id}`);
  if (isModelDownloaded(id)) return;

  const dest = path.join(modelsDownloadRoot(), modelFileName(id));
  const tmp = `${dest}.part`;

  try {
    const res = await fetch(model.url);
    if (!res.ok || !res.body) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const total = Number(res.headers.get('content-length')) || 0;
    const out = fs.createWriteStream(tmp);
    let received = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      out.write(chunk);
      received += chunk.length;
      onProgress(received, total);
    }
    await new Promise<void>((resolve, reject) => {
      out.end(() => resolve());
      out.on('error', reject);
    });
    // The response stream can end early (proxy/CDN cutting the connection
    // short) without `fetch` ever throwing, silently leaving a truncated
    // file that looks "downloaded" to isModelDownloaded()'s mere
    // fs.existsSync check. Verify the byte count against Content-Length
    // before promoting the .part file, so a truncated transfer surfaces as
    // an error instead of a corrupt model that hangs/fails at inference time.
    if (total > 0 && received !== total) {
      throw new Error(
        `Download incomplete: received ${received} of ${total} bytes`
      );
    }
    fs.renameSync(tmp, dest);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}
