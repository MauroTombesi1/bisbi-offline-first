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
  // Whisper language code (e.g. 'es') to force transcription output into, or
  // 'auto' to let the model detect it. Only sent to models that support it —
  // see isMultilingualModel() in models.ts.
  transcriptionLanguage: string;
}
