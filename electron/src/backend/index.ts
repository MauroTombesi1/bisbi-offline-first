import { BrowserWindow, ipcMain, app, shell, systemPreferences } from 'electron';
import { getSettings, updateSettings, resetSettings } from './settings';
import { registerHotkey, unregisterAll, notifyExternalKeyup, notifyExternalKeydown } from './hotkey';
import { transcribePcm, checkModelResource, cancelActiveTranscription, shutdownWorker } from './transcriber';
import { listModels, downloadModel } from './models';
import { WHISPER_LANGUAGES } from './whisperLanguages';
import {
  detectPython,
  isWhisperPackageInstalled,
  isFfmpegInstalled,
  installWhisperPackage,
  type PythonStatus,
} from './pythonEnv';
import { deliverText } from './paster';
import {
  getOnboardingState,
  setOnboardingState,
  getPermissionStatus,
  requestMicrophonePermission,
  requestAccessibilityPermission,
  openSystemSettingsFor,
  validateHotkey,
  type OnboardingState,
  type PermissionStatus,
} from './onboarding';
import {
  initTray,
  setRecordingState as setTrayState,
  destroyTray,
} from './tray';
import {
  warmUpRecordingWindow,
  showRecordingWindow,
  setLevel as setRecordingWindowLevel,
  hideRecordingWindow,
} from './recordingWindow';
import {
  muteSystemAudio,
  restoreSystemAudio,
  prewarmMediaControl,
  shutdownMediaControl,
  type MuteSnapshot,
} from './mediaControl';
import { getSystemLocale, resolveUiLanguage, tBackend } from './i18n';
import { rebuildTrayLabels } from './tray';
import { getAppVersion } from './appVersion';
import type { RecordingState, AppSettings } from './types';

interface BackendOptions {
  onOpenSettings: () => void;
  onQuit: () => void;
}

let registered = false;
let recordingState: RecordingState = 'idle';
let activeMainWindowOpener: (() => void) | null = null;

let isRecording = false;
let recordingArmed = false;
let workerRunning = false;
let muteSnapshot: MuteSnapshot | null = null;
// One dictation = one session. While recording, the renderer cuts the audio
// at silences (audio.ts) and ships each piece as a 'segment' job; they are
// transcribed in order in the background while recording continues, and their
// text accumulates here. When recording stops, the remaining tail is queued as
// the 'final' job, and only then is the joined text pasted. The user perceives
// near-instant output because almost everything is already transcribed.
interface DictationSession {
  texts: string[];
  cancelled: boolean;
}
interface TranscriptionJob {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
  kind: 'segment' | 'final';
  session: DictationSession;
}
const transcriptionQueue: TranscriptionJob[] = [];
let currentSession: DictationSession = { texts: [], cancelled: false };

function newSession(): void {
  // Don't cancel the previous session: its final job may still be queued.
  currentSession = { texts: [], cancelled: false };
}
function abortSession(): void {
  currentSession.cancelled = true;
  for (let i = transcriptionQueue.length - 1; i >= 0; i--) {
    if (transcriptionQueue[i]!.session === currentSession) transcriptionQueue.splice(i, 1);
  }
}
function isTranscribable(pcm: Buffer, sampleRate: number, channels: number): boolean {
  const bytesPerSample = 2 * Math.max(1, channels);
  return pcm.length >= Math.floor(sampleRate * 0.1) * bytesPerSample;
}

// `python3 --version` is a real subprocess spawn — too slow to re-run on
// every partial chunk (every ~1.5-2s while recording). Cache it and refresh
// once at recording start (fire-and-forget, so it's warm by the time the
// first chunk lands) plus whenever Settings explicitly asks via engine:check.
let cachedPython: PythonStatus | null = null;
async function refreshPythonStatus(): Promise<PythonStatus> {
  cachedPython = await detectPython();
  return cachedPython;
}
async function getPythonStatus(): Promise<PythonStatus> {
  return cachedPython ?? refreshPythonStatus();
}

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function computeState(): RecordingState {
  if (isRecording) return 'recording';
  if (workerRunning || transcriptionQueue.length > 0) return 'transcribing';
  return 'idle';
}

function syncState(): void {
  const next = computeState();
  if (next === recordingState) return;
  recordingState = next;
  setTrayState(next);
  broadcast('recording:state', next);
  if (next === 'idle') {
    hideRecordingWindow();
  } else {
    showRecordingWindow(next);
  }
}

async function processQueue(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  syncState();
  try {
    while (transcriptionQueue.length > 0) {
      const job = transcriptionQueue.shift()!;
      const { session } = job;
      if (session.cancelled) continue;
      try {
        if (isTranscribable(job.pcm, job.sampleRate, job.channels)) {
          const cfg = getSettings();
          const python = await getPythonStatus();
          if (!python.ok || !python.pythonBin) {
            broadcast('transcription:blocked', { reason: 'python-missing' });
            session.cancelled = true;
            continue;
          }
          const out = await transcribePcm(job.pcm, job.sampleRate, job.channels, {
            pythonBin: python.pythonBin,
            modelId: cfg.whisperModel,
            language: cfg.transcriptionLanguage,
          });
          if (session.cancelled) continue;
          const text = out.text.trim();
          if (text) session.texts.push(text);
        }
        if (job.kind === 'segment') {
          // Live caption: everything transcribed so far.
          if (isRecording) broadcast('transcription:partial', { text: session.texts.join(' ') });
          continue;
        }
        const fullText = session.texts.join(' ');
        const meaningful = fullText.replace(/\s/g, '').length >= 2;
        if (meaningful) {
          // Delivery is a separate failure domain from transcription: the
          // synthetic Cmd+V goes through osascript/System Events, which macOS
          // refuses without Accessibility consent. Letting that reject fall
          // into the outer catch used to discard a perfectly good transcript —
          // no transcription:done, just a generic 'engine-error' — even though
          // deliverText had already put the text on the clipboard. Report the
          // paste problem specifically and still hand the text to the UI so
          // the user can paste it themselves.
          try {
            await deliverText(fullText);
          } catch (err) {
            console.error('[backend] paste failed:', err);
            broadcast('transcription:blocked', { reason: 'paste-failed' });
          }
          broadcast('transcription:done', { text: fullText });
        }
      } catch (err) {
        console.error('[backend] transcription job failed:', err);
        broadcast('transcription:blocked', { reason: 'engine-error' });
        // A failed piece would otherwise silently drop words mid-text; abandon
        // the whole dictation rather than paste something incomplete.
        session.cancelled = true;
      }
    }
  } finally {
    workerRunning = false;
    syncState();
  }
}

function applySettingsPatch(patch: Partial<AppSettings>): AppSettings {
  const prev = getSettings();
  const next = updateSettings(patch);
  const hotkeyChanged = patch.hotkey !== undefined && patch.hotkey !== prev.hotkey;
  const handsFreeChanged =
    patch.handsFreeMode !== undefined && patch.handsFreeMode !== prev.handsFreeMode;
  if (hotkeyChanged || handsFreeChanged) {
    const ok = applyHotkey(next);
    if (!ok) {
      const reverted = updateSettings({
        hotkey: prev.hotkey,
        handsFreeMode: prev.handsFreeMode,
      });
      applyHotkey(reverted);
      const lang = resolveUiLanguage(next.uiLanguage);
      throw new Error(tBackend(lang, 'errors.hotkeyRegister', { accel: next.hotkey }));
    }
  }
  if (
    patch.uiLanguage !== undefined &&
    patch.uiLanguage !== prev.uiLanguage
  ) {
    rebuildTrayLabels(resolveUiLanguage(next.uiLanguage));
  }
  if (patch.openAtLogin !== undefined && patch.openAtLogin !== prev.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
  }
  if (patch.whisperModel !== undefined && patch.whisperModel !== prev.whisperModel) {
    // Free the old model's memory immediately rather than waiting for
    // the next transcription to lazily replace it — large checkpoints
    // hold onto multiple GB of RAM while resident.
    shutdownWorker();
  }
  broadcast('settings:changed', next);
  return next;
}

function applyHotkey(settings: AppSettings): boolean {
  return registerHotkey(
    { accelerator: settings.hotkey, handsFreeMode: settings.handsFreeMode },
    {
      onStartRecording: handleStartRecording,
      onStopRecording: handleStopRecording,
      onCancelRecording: handleCancelRecording,
    }
  );
}

// uiohook-napi creates a CGEventTap with kCGEventTapOptionDefault on macOS,
// which silently produces a dead tap when Accessibility isn't granted to the
// running binary — global hotkeys stop firing while the window-focused fallback
// (DOM keydown forwarded by App.tsx) keeps working, making it look like a
// partial bug. Re-check on every launch and surface the system prompt so the
// user can re-grant after a TCC reset, OS upgrade, or signature change.
function ensureAccessibilityForHotkey(): void {
  if (process.platform !== 'darwin') return;
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (trusted) {
    console.log('[backend] accessibility: granted — global hotkey active');
    return;
  }
  console.warn(
    '[backend] accessibility: NOT granted — global hotkey will only work while ' +
    'the Bisbi window is focused. Triggering system prompt.'
  );
  systemPreferences.isTrustedAccessibilityClient(true);
  broadcast('permission:accessibilityMissing', { platform: 'darwin' });
}

export async function registerBackend(opts: BackendOptions): Promise<void> {
  if (registered) return;
  registered = true;
  activeMainWindowOpener = opts.onOpenSettings;

  const settings = getSettings();
  initTray({
    uiLanguage: resolveUiLanguage(settings.uiLanguage),
    onOpenSettings: opts.onOpenSettings,
    onQuit: opts.onQuit,
  });

  applyHotkey(settings);
  ensureAccessibilityForHotkey();
  warmUpRecordingWindow();
  prewarmMediaControl();

  ipcMain.handle('settings:get', (): AppSettings => getSettings());
  ipcMain.handle(
    'settings:update',
    (_e, patch: Partial<AppSettings>): AppSettings => applySettingsPatch(patch)
  );
  ipcMain.handle('settings:reset', (): AppSettings => {
    const next = resetSettings();
    applyHotkey(next);
    rebuildTrayLabels(resolveUiLanguage(next.uiLanguage));
    app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
    broadcast('settings:changed', next);
    return next;
  });

  ipcMain.handle('recording:getState', () => recordingState);

  ipcMain.on('recording:level', (_e, level: number) => {
    if (!isRecording) return;
    setRecordingWindowLevel(typeof level === 'number' ? level : 0);
  });

  ipcMain.handle(
    'recording:submitAudio',
    (
      _e,
      payload: { pcm: ArrayBuffer; sampleRate: number; channels: number }
    ): void => {
      // Always queue the final (tail) job, even if the tail is too short to
      // transcribe: it is what flushes the accumulated text to the paster.
      transcriptionQueue.push({
        pcm: Buffer.from(payload.pcm),
        sampleRate: payload.sampleRate,
        channels: payload.channels,
        kind: 'final',
        session: currentSession,
      });
      void processQueue();
      syncState();
    }
  );

  ipcMain.handle(
    'recording:audioChunk',
    (
      _e,
      payload: { pcm: ArrayBuffer; sampleRate: number; channels: number }
    ): void => {
      // No isRecording gate: a segment cut just before key release can land
      // after stop; IPC order guarantees it still precedes the final tail.
      if (currentSession.cancelled) return;
      transcriptionQueue.push({
        pcm: Buffer.from(payload.pcm),
        sampleRate: payload.sampleRate,
        channels: payload.channels,
        kind: 'segment',
        session: currentSession,
      });
      void processQueue();
    }
  );

  ipcMain.handle('recording:cancel', () => {
    isRecording = false;
    abortSession();
    syncState();
  });

  ipcMain.handle('recording:setArmed', (_e, armed: boolean) => {
    recordingArmed = !!armed;
    if (!recordingArmed && isRecording) {
      handleCancelRecording();
    }
  });

  ipcMain.on('hotkey:externalKeyup', () => {
    notifyExternalKeyup();
  });

  ipcMain.on('hotkey:externalKeydown', () => {
    notifyExternalKeydown();
  });

  ipcMain.handle('recording:cancelAll', () => {
    cancelEverything();
  });

  ipcMain.handle('app:getVersion', () => getAppVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:getSystemLocale', () => getSystemLocale());
  ipcMain.handle('app:openSettings', () => activeMainWindowOpener?.());

  ipcMain.handle('models:list', () => listModels());
  ipcMain.handle('languages:list', () => WHISPER_LANGUAGES);
  ipcMain.handle('models:download', async (_e, id: string) => {
    await downloadModel(id, (receivedBytes, totalBytes) => {
      broadcast('models:downloadProgress', { id, receivedBytes, totalBytes });
    });
    broadcast('models:changed');
  });
  ipcMain.handle('engine:check', async () => {
    const python = await refreshPythonStatus();
    const whisperPackageInstalled = python.pythonBin
      ? await isWhisperPackageInstalled(python.pythonBin)
      : false;
    const ffmpegInstalled = await isFfmpegInstalled();
    const model = checkModelResource(getSettings().whisperModel);
    return { python, whisperPackageInstalled, ffmpegInstalled, model };
  });
  ipcMain.handle('engine:installWhisperPackage', async () => {
    const python = await getPythonStatus();
    if (!python.ok || !python.pythonBin) {
      throw new Error('Python not found');
    }
    await installWhisperPackage(python.pythonBin, (line) => {
      broadcast('engine:installLog', line);
    });
  });

  ipcMain.handle('onboarding:getState', (): OnboardingState => getOnboardingState());
  ipcMain.handle(
    'onboarding:setState',
    (_e, patch: Partial<OnboardingState>): OnboardingState => {
      const next = setOnboardingState(patch);
      broadcast('onboarding:state', next);
      return next;
    }
  );
  ipcMain.handle('onboarding:getPermissions', (): PermissionStatus => getPermissionStatus());
  ipcMain.handle('onboarding:requestMicrophone', async (): Promise<PermissionStatus> => {
    await requestMicrophonePermission();
    return getPermissionStatus();
  });
  ipcMain.handle('onboarding:requestAccessibility', (): PermissionStatus => {
    requestAccessibilityPermission();
    return getPermissionStatus();
  });
  ipcMain.handle(
    'onboarding:openSystemSettings',
    async (_e, pane: 'microphone' | 'accessibility'): Promise<void> => {
      await openSystemSettingsFor(pane);
    }
  );
  ipcMain.handle(
    'onboarding:validateHotkey',
    (_e, accelerator: string): { ok: boolean; reason?: string } =>
      validateHotkey(accelerator)
  );
  ipcMain.handle(
    'onboarding:transcribePreview',
    async (
      _e,
      payload: { pcm: ArrayBuffer; sampleRate: number; channels: number }
    ): Promise<string> => {
      const pcm = Buffer.from(payload.pcm);
      const cfg = getSettings();
      const python = await getPythonStatus();
      if (!python.ok || !python.pythonBin) {
        throw new Error('Python not found');
      }
      const out = await transcribePcm(pcm, payload.sampleRate, payload.channels, {
        pythonBin: python.pythonBin,
        modelId: cfg.whisperModel,
        language: cfg.transcriptionLanguage,
      });
      return out.text;
    }
  );

  ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url));

  app.on('before-quit', () => {
    unregisterAll();
    destroyTray();
    shutdownMediaControl();
    shutdownWorker();
  });
}

function handleStartRecording(): void {
  if (isRecording) return;
  if (!recordingArmed) return;
  const cfg = getSettings();
  isRecording = true;
  newSession();
  void refreshPythonStatus();
  broadcast('transcription:partial', { text: '' });
  showRecordingWindow('recording');
  syncState();
  broadcast('recording:start');
  if (cfg.muteSystemAudioWhileRecording) {
    void muteSystemAudio().then((snap) => {
      if (!isRecording) {
        void restoreSystemAudio(snap);
        return;
      }
      muteSnapshot = snap;
    });
  }
}

function handleStopRecording(): void {
  if (!isRecording) return;
  isRecording = false;
  syncState();
  broadcast('recording:stop');
  if (muteSnapshot) {
    const snap = muteSnapshot;
    muteSnapshot = null;
    void restoreSystemAudio(snap);
  }
}

function handleCancelRecording(): void {
  if (!isRecording) return;
  isRecording = false;
  abortSession();
  syncState();
  broadcast('recording:cancel');
  if (muteSnapshot) {
    const snap = muteSnapshot;
    muteSnapshot = null;
    void restoreSystemAudio(snap);
  }
}

function cancelEverything(): void {
  if (isRecording) handleCancelRecording();
  transcriptionQueue.length = 0;
  currentSession.cancelled = true;
  cancelActiveTranscription();
}
