export type RecordingState = 'idle' | 'recording' | 'transcribing';

export type UiLanguage = 'en' | 'es' | 'zh' | 'hi' | 'ar';
export type UiLanguageSetting = UiLanguage | 'system';

export interface AppSettings {
  hotkey: string;
  handsFreeMode: boolean;
  uiLanguage: UiLanguageSetting;
  microphoneId: string | null;
  muteSystemAudioWhileRecording: boolean;
  openAtLogin: boolean;
  whisperModel: string;
  transcriptionLanguage: string;
}

export interface WhisperModelInfo {
  id: string;
  label: string;
  url: string;
  sizeMb: number;
}

export interface ModelListEntry extends WhisperModelInfo {
  downloaded: boolean;
  multilingual: boolean;
}

export interface WhisperLanguageInfo {
  code: string;
  label: string;
}

export interface PythonStatus {
  ok: boolean;
  pythonBin: string | null;
  version: string | null;
}

export interface EngineResourceCheck {
  ok: boolean;
  modelPath: string;
  missing: string[];
}

export interface EngineStatus {
  python: PythonStatus;
  whisperPackageInstalled: boolean;
  ffmpegInstalled: boolean;
  model: EngineResourceCheck;
}

export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingState {
  completed: boolean;
  lastStep: OnboardingStep;
}

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'unknown';
  accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
}

export interface TranscriptionBlockedPayload {
  reason: 'python-missing' | 'engine-error' | string;
}

declare global {
  interface Window {
    bisbi: {
      getAppVersion: () => Promise<string>;
      getPlatform: () => Promise<NodeJS.Platform>;
      getSystemLocale: () => Promise<string>;
      openSettings: () => Promise<void>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      resetSettings: () => Promise<AppSettings>;
      onSettingsChange: (cb: (s: AppSettings) => void) => () => void;
      getRecordingState: () => Promise<RecordingState>;
      submitAudio: (
        pcm: ArrayBuffer,
        sampleRate: number,
        channels: number
      ) => Promise<void>;
      submitAudioChunk: (
        pcm: ArrayBuffer,
        sampleRate: number,
        channels: number
      ) => Promise<void>;
      cancelRecording: () => Promise<void>;
      cancelAll: () => Promise<void>;
      setRecordingArmed: (armed: boolean) => Promise<void>;
      onRecordingStart: (cb: () => void) => () => void;
      onRecordingStop: (cb: () => void) => () => void;
      onRecordingCancel: (cb: () => void) => () => void;
      onRecordingState: (cb: (s: RecordingState) => void) => () => void;
      onPillState: (cb: (s: RecordingState) => void) => () => void;
      sendRecordingLevel: (level: number) => void;
      notifyExternalKeyup: () => void;
      notifyExternalKeydown: () => void;
      onRecordingLevel: (cb: (level: number) => void) => () => void;
      onTranscriptionDone: (cb: (payload: { text: string }) => void) => () => void;
      onTranscriptionPartial: (cb: (payload: { text: string }) => void) => () => void;
      onTranscriptionBlocked: (cb: (payload: TranscriptionBlockedPayload) => void) => () => void;
      engine: {
        check: () => Promise<EngineStatus>;
        installWhisperPackage: () => Promise<void>;
        onInstallLog: (cb: (line: string) => void) => () => void;
      };
      models: {
        list: () => Promise<ModelListEntry[]>;
        download: (id: string) => Promise<void>;
        onProgress: (
          cb: (payload: { id: string; receivedBytes: number; totalBytes: number }) => void
        ) => () => void;
        onChanged: (cb: () => void) => () => void;
      };
      languages: {
        list: () => Promise<WhisperLanguageInfo[]>;
      };
      onNavigate: (cb: (payload: { to: string }) => void) => () => void;
      openExternal: (url: string) => Promise<void>;
      onboarding: {
        getState: () => Promise<OnboardingState>;
        setState: (patch: Partial<OnboardingState>) => Promise<OnboardingState>;
        onStateChange: (cb: (s: OnboardingState) => void) => () => void;
        getPermissions: () => Promise<PermissionStatus>;
        requestMicrophone: () => Promise<PermissionStatus>;
        requestAccessibility: () => Promise<PermissionStatus>;
        openSystemSettings: (pane: 'microphone' | 'accessibility') => Promise<void>;
        validateHotkey: (accelerator: string) => Promise<{ ok: boolean; reason?: string }>;
        transcribePreview: (
          pcm: ArrayBuffer,
          sampleRate: number,
          channels: number
        ) => Promise<string>;
      };
    };
  }
}
