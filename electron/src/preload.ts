import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type Unsubscribe = () => void;

const invoke = <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const listen = <T>(channel: string, cb: (payload: T) => void): Unsubscribe => {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const bisbi = {
  // App
  getAppVersion: () => invoke<string>('app:getVersion'),
  getPlatform: () => invoke<NodeJS.Platform>('app:getPlatform'),
  getSystemLocale: () => invoke<string>('app:getSystemLocale'),
  openSettings: () => invoke<void>('app:openSettings'),

  // Settings
  getSettings: () => invoke<import('./backend/types').AppSettings>('settings:get'),
  updateSettings: (patch: Partial<import('./backend/types').AppSettings>) =>
    invoke<import('./backend/types').AppSettings>('settings:update', patch),
  resetSettings: () =>
    invoke<import('./backend/types').AppSettings>('settings:reset'),
  onSettingsChange: (cb: (s: import('./backend/types').AppSettings) => void) =>
    listen<import('./backend/types').AppSettings>('settings:changed', cb),

  // Recording
  getRecordingState: () =>
    invoke<import('./backend/types').RecordingState>('recording:getState'),
  submitAudio: (pcm: ArrayBuffer, sampleRate: number, channels: number) =>
    invoke<void>('recording:submitAudio', {
      pcm,
      sampleRate,
      channels,
    }),
  submitAudioChunk: (pcm: ArrayBuffer, sampleRate: number, channels: number) =>
    invoke<void>('recording:audioChunk', {
      pcm,
      sampleRate,
      channels,
    }),
  cancelRecording: () => invoke<void>('recording:cancel'),
  cancelAll: () => invoke<void>('recording:cancelAll'),
  setRecordingArmed: (armed: boolean) =>
    invoke<void>('recording:setArmed', armed),
  onRecordingStart: (cb: () => void) =>
    listen<void>('recording:start', () => cb()),
  onRecordingStop: (cb: () => void) =>
    listen<void>('recording:stop', () => cb()),
  onRecordingCancel: (cb: () => void) =>
    listen<void>('recording:cancel', () => cb()),
  onRecordingState: (cb: (s: import('./backend/types').RecordingState) => void) =>
    listen<import('./backend/types').RecordingState>('recording:state', cb),
  onPillState: (cb: (s: import('./backend/types').RecordingState) => void) =>
    listen<import('./backend/types').RecordingState>('recording:pillState', cb),
  sendRecordingLevel: (level: number) => ipcRenderer.send('recording:level', level),
  notifyExternalKeyup: () => ipcRenderer.send('hotkey:externalKeyup'),
  notifyExternalKeydown: () => ipcRenderer.send('hotkey:externalKeydown'),
  onRecordingLevel: (cb: (level: number) => void) =>
    listen<number>('recording:level', cb),
  onTranscriptionDone: (cb: (payload: { text: string }) => void) =>
    listen<{ text: string }>('transcription:done', cb),
  onTranscriptionPartial: (cb: (payload: { text: string }) => void) =>
    listen<{ text: string }>('transcription:partial', cb),
  onTranscriptionBlocked: (cb: (payload: { reason: string }) => void) =>
    listen<{ reason: string }>('transcription:blocked', cb),

  // Local transcription engine (OpenAI's official openai-whisper Python
  // package — see electron/src/backend/pythonEnv.ts + models.ts)
  engine: {
    check: () =>
      invoke<{
        python: { ok: boolean; pythonBin: string | null; version: string | null };
        whisperPackageInstalled: boolean;
        ffmpegInstalled: boolean;
        model: { ok: boolean; modelPath: string; missing: string[] };
      }>('engine:check'),
    installWhisperPackage: () => invoke<void>('engine:installWhisperPackage'),
    onInstallLog: (cb: (line: string) => void) => listen<string>('engine:installLog', cb),
  },

  // Whisper models (which OpenAI checkpoint to use)
  models: {
    list: () => invoke<import('./backend/models').ModelListEntry[]>('models:list'),
    download: (id: string) => invoke<void>('models:download', id),
    onProgress: (
      cb: (payload: { id: string; receivedBytes: number; totalBytes: number }) => void
    ) =>
      listen<{ id: string; receivedBytes: number; totalBytes: number }>(
        'models:downloadProgress',
        cb
      ),
    onChanged: (cb: () => void) => listen<void>('models:changed', () => cb()),
  },

  // Languages a multilingual whisper model can be forced to transcribe into
  languages: {
    list: () => invoke<import('./backend/whisperLanguages').WhisperLanguageInfo[]>('languages:list'),
  },

  // Routing helper for tray-driven navigation
  onNavigate: (cb: (payload: { to: string }) => void) =>
    listen<{ to: string }>('navigate', cb),

  // External links
  openExternal: (url: string) => invoke<void>('app:openExternal', url),

  // Onboarding (first-run flow)
  onboarding: {
    getState: () =>
      invoke<import('./backend/onboarding').OnboardingState>('onboarding:getState'),
    setState: (patch: Partial<import('./backend/onboarding').OnboardingState>) =>
      invoke<import('./backend/onboarding').OnboardingState>('onboarding:setState', patch),
    onStateChange: (
      cb: (s: import('./backend/onboarding').OnboardingState) => void
    ) => listen<import('./backend/onboarding').OnboardingState>('onboarding:state', cb),
    getPermissions: () =>
      invoke<import('./backend/onboarding').PermissionStatus>('onboarding:getPermissions'),
    requestMicrophone: () =>
      invoke<import('./backend/onboarding').PermissionStatus>(
        'onboarding:requestMicrophone'
      ),
    requestAccessibility: () =>
      invoke<import('./backend/onboarding').PermissionStatus>(
        'onboarding:requestAccessibility'
      ),
    openSystemSettings: (pane: 'microphone' | 'accessibility') =>
      invoke<void>('onboarding:openSystemSettings', pane),
    validateHotkey: (accelerator: string) =>
      invoke<{ ok: boolean; reason?: string }>('onboarding:validateHotkey', accelerator),
    transcribePreview: (pcm: ArrayBuffer, sampleRate: number, channels: number) =>
      invoke<string>('onboarding:transcribePreview', { pcm, sampleRate, channels }),
  },
};

contextBridge.exposeInMainWorld('bisbi', bisbi);

export type BisbiApi = typeof bisbi;
