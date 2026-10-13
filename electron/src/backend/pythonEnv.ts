// Bisbi's transcription engine is OpenAI's own openai-whisper Python package
// (https://github.com/openai/whisper) — no third-party engine (whisper.cpp,
// ggml conversions, etc). That means a system Python 3 install plus the
// `openai-whisper` pip package are real runtime requirements; this module
// detects both and drives the one-time `pip install` from Settings.
import { spawn } from 'child_process';

export interface PythonStatus {
  ok: boolean;
  pythonBin: string | null;
  version: string | null;
}

const CANDIDATE_BINARIES = process.platform === 'win32'
  ? ['python', 'python3']
  : ['python3', 'python'];

function run(bin: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve({ code: -1, stdout: '', stderr: '' });
      return;
    }
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export async function detectPython(): Promise<PythonStatus> {
  for (const bin of CANDIDATE_BINARIES) {
    const res = await run(bin, ['--version']);
    if (res.code !== 0) continue;
    const raw = `${res.stdout}${res.stderr}`.trim();
    const match = raw.match(/Python (\d+)\.(\d+)/);
    if (!match) continue;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major < 3 || (major === 3 && minor < 8)) continue;
    return { ok: true, pythonBin: bin, version: `${major}.${minor}` };
  }
  return { ok: false, pythonBin: null, version: null };
}

export async function isWhisperPackageInstalled(pythonBin: string): Promise<boolean> {
  const res = await run(pythonBin, ['-c', 'import whisper']);
  return res.code === 0;
}

// openai-whisper shells out to the `ffmpeg` CLI to decode audio — it's a
// real, documented dependency of the official package, not something we add.
export async function isFfmpegInstalled(): Promise<boolean> {
  const res = await run('ffmpeg', ['-version']);
  return res.code === 0;
}

export function installWhisperPackage(
  pythonBin: string,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, ['-m', 'pip', 'install', '-U', 'openai-whisper'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    // pip writes its download progress bars with carriage returns rather
    // than newlines, so split on \r as well to surface each update instead
    // of one giant buffered line at the end.
    const forward = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n|\r/)) {
        if (line.trim()) onLine(line.trim());
      }
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', (d) => { stderr += d.toString(); forward(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pip install exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
