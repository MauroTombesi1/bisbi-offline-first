import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { BUILD_CONFIG } from '../buildConfig';
import { DEFAULT_WHISPER_MODEL, isKnownModel } from './models';
import { isKnownLanguageCode } from './whisperLanguages';
import type { AppSettings } from './types';

const SETTINGS_FILE = 'settings.json';
const DEFAULT_TRANSCRIPTION_LANGUAGE = 'auto';

function buildDefaults(): AppSettings {
  return {
    hotkey: BUILD_CONFIG.DEFAULT_HOTKEY,
    handsFreeMode: BUILD_CONFIG.DEFAULT_HANDS_FREE,
    uiLanguage: 'system',
    microphoneId: null,
    muteSystemAudioWhileRecording: false,
    openAtLogin: true,
    whisperModel: DEFAULT_WHISPER_MODEL,
    transcriptionLanguage: DEFAULT_TRANSCRIPTION_LANGUAGE,
  };
}

function settingsPath(): string {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, SETTINGS_FILE);
}

function normalizeWhisperModel(value: unknown): string {
  return isKnownModel(value) ? value : DEFAULT_WHISPER_MODEL;
}

function normalizeTranscriptionLanguage(value: unknown): string {
  if (value === 'auto' || isKnownLanguageCode(value)) return value;
  return DEFAULT_TRANSCRIPTION_LANGUAGE;
}

let cached: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cached) return cached;
  const defaults = buildDefaults();
  let migrated = false;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings> & Record<string, unknown>;
    // Drop legacy fields removed in older versions so they don't linger in the
    // saved settings file.
    for (const stale of [
      'precision',
      'language',
      'saveHistory',
      'mode',
      'openaiApiKey',
      'openaiModel',
    ] as const) {
      if (stale in parsed) {
        delete (parsed as Record<string, unknown>)[stale];
        migrated = true;
      }
    }
    cached = {
      ...defaults,
      ...parsed,
      whisperModel: normalizeWhisperModel(parsed.whisperModel),
      transcriptionLanguage: normalizeTranscriptionLanguage(parsed.transcriptionLanguage),
    };
  } catch {
    cached = defaults;
  }
  if (cached.hotkey === 'Fn') {
    cached = { ...cached, hotkey: BUILD_CONFIG.DEFAULT_HOTKEY };
    migrated = true;
  }
  if (migrated) {
    persist(cached);
  }
  return cached;
}

function persist(value: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(value, null, 2), 'utf8');
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    whisperModel: patch.whisperModel
      ? normalizeWhisperModel(patch.whisperModel)
      : current.whisperModel,
    transcriptionLanguage: patch.transcriptionLanguage
      ? normalizeTranscriptionLanguage(patch.transcriptionLanguage)
      : current.transcriptionLanguage,
  };
  cached = next;
  persist(next);
  return next;
}

export function resetSettings(): AppSettings {
  cached = buildDefaults();
  persist(cached);
  return cached;
}
