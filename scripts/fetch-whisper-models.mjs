#!/usr/bin/env node
// Descarga el checkpoint oficial de OpenAI Whisper bundleado en
// resources/models/ si no está presente. Se corre antes del build para no
// commitear binarios pesados. Fuente: https://github.com/openai/whisper —
// misma URL que usa `whisper.load_model()`, nada de terceros.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const destDir = path.join(projectRoot, 'resources', 'models');

// Solo el modelo por defecto (electron/src/backend/models.ts#DEFAULT_WHISPER_MODEL)
// se bundlea en build time. El resto de los modelos oficiales de OpenAI se
// descargan on-demand desde Settings (electron/src/backend/models.ts) y se
// guardan en userData, no en el instalador.
const MODELS = [
  {
    file: 'tiny.pt',
    url: 'https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt',
    expectedSize: 75_572_083, // ~72 MiB
  },
];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function download(model) {
  const dest = path.join(destDir, model.file);
  if (fs.existsSync(dest)) {
    const size = (await fsp.stat(dest)).size;
    // Tolerancia de 1MB por si la versión del modelo cambia ligeramente; si
    // el tamaño es totalmente distinto re-descargamos.
    if (Math.abs(size - model.expectedSize) < 1_000_000) {
      console.log(`[models] ${model.file}: ya presente (${formatBytes(size)})`);
      return;
    }
    console.log(
      `[models] ${model.file}: tamaño inesperado (${formatBytes(size)} vs ${formatBytes(model.expectedSize)}), re-descargando`
    );
  }

  console.log(`[models] ${model.file}: descargando desde ${model.url}`);
  const res = await fetch(model.url);
  if (!res.ok || !res.body) {
    throw new Error(`fetch ${model.url} → ${res.status} ${res.statusText}`);
  }

  const total = Number(res.headers.get('content-length')) || model.expectedSize;
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  let received = 0;
  let lastLog = 0;
  for await (const chunk of res.body) {
    out.write(chunk);
    received += chunk.length;
    const now = Date.now();
    if (now - lastLog > 500) {
      const pct = total ? ((received / total) * 100).toFixed(1) : '?';
      process.stdout.write(
        `\r[models] ${model.file}: ${formatBytes(received)} / ${formatBytes(total)} (${pct}%)`
      );
      lastLog = now;
    }
  }
  out.end();
  await new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });
  process.stdout.write('\n');
  await fsp.rename(tmp, dest);
  console.log(`[models] ${model.file}: listo (${formatBytes(received)})`);
}

async function main() {
  await fsp.mkdir(destDir, { recursive: true });
  for (const model of MODELS) {
    await download(model);
  }
}

main().catch((err) => {
  console.error('[models] error:', err.message || err);
  process.exit(1);
});
