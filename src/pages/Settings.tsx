import { useState, useRef, useEffect, useMemo } from 'react';
import type { AppSettings, EngineStatus, ModelListEntry, WhisperLanguageInfo } from '../types';
import {
  SUPPORTED_UI_LANGUAGES,
  matchLocale,
  useTranslation,
  type UiLanguage,
  type UiLanguageSetting,
} from '../i18n';
import { Select } from '../components/Select';
import { SegmentedToggle } from '../components/SegmentedToggle';
import { ConfirmButton } from '../components/ConfirmButton';
import { listMicrophones, type MicrophoneDevice } from '../audio';
import { HotkeyKeys } from '../components/HotkeyKeys';

interface Props {
  settings: AppSettings;
  engineStatus: EngineStatus | null;
  onRefreshEngine: () => void;
  onChange: (patch: Partial<AppSettings>) => Promise<void>;
  onReset: () => Promise<void>;
}

export function Settings({ settings, engineStatus, onRefreshEngine, onChange, onReset }: Props) {
  const { t, systemLocale } = useTranslation();

  const detectedSystemLang: UiLanguage =
    matchLocale(systemLocale ?? '') ?? 'en';
  const systemLabel = t('settings.uiLanguage.system', {
    detected: t(`uiLanguageOption.${detectedSystemLang}` as const),
  });

  return (
    <div className="settings">
      <Section
        title={t('settings.hotkey.title')}
        description={t('settings.hotkey.description')}
      >
        <HotkeyInput
          value={settings.hotkey}
          onChange={(hotkey) => onChange({ hotkey })}
        />
      </Section>

      <Section
        title={t('settings.microphone.title')}
        description={t('settings.microphone.description')}
      >
        <MicrophonePicker
          value={settings.microphoneId}
          onChange={(microphoneId) => onChange({ microphoneId })}
        />
      </Section>

      <Section
        title={t('settings.handsFree.title')}
        description={t('settings.handsFree.description')}
      >
        <SegmentedToggle<'pushToTalk' | 'tapToToggle'>
          value={settings.handsFreeMode ? 'tapToToggle' : 'pushToTalk'}
          onChange={(next) =>
            onChange({ handsFreeMode: next === 'tapToToggle' })
          }
          ariaLabel={t('settings.handsFree.title')}
          options={[
            {
              value: 'pushToTalk',
              label: t('settings.handsFree.pushToTalk.label'),
            },
            {
              value: 'tapToToggle',
              label: t('settings.handsFree.tapToToggle.label'),
            },
          ]}
          hint={
            settings.handsFreeMode
              ? t('settings.handsFree.tapToToggle.hint')
              : t('settings.handsFree.pushToTalk.hint')
          }
        />
      </Section>

      <Section
        title={t('settings.uiLanguage.title')}
        description={t('settings.uiLanguage.description')}
      >
        <Select<UiLanguageSetting>
          value={settings.uiLanguage}
          onChange={(uiLanguage) => onChange({ uiLanguage })}
          ariaLabel={t('settings.uiLanguage.title')}
          options={[
            { value: 'system', label: systemLabel },
            ...SUPPORTED_UI_LANGUAGES.map((lang) => ({
              value: lang,
              label: t(`uiLanguageOption.${lang}` as const),
            })),
          ]}
        />
      </Section>

      <Section
        title={t('settings.engine.title')}
        description={t('settings.engine.description')}
      >
        <EngineStatusPanel status={engineStatus} onRefresh={onRefreshEngine} />
      </Section>

      <Section
        title={t('settings.whisperModel.title')}
        description={t('settings.whisperModel.description')}
      >
        <WhisperModelPicker
          value={settings.whisperModel}
          onSelect={(whisperModel) => {
            void onChange({ whisperModel }).then(onRefreshEngine);
          }}
        />
      </Section>

      <Section
        title={t('settings.transcriptionLanguage.title')}
        description={t('settings.transcriptionLanguage.description')}
      >
        <TranscriptionLanguagePicker
          value={settings.transcriptionLanguage}
          whisperModel={settings.whisperModel}
          onChange={(transcriptionLanguage) => onChange({ transcriptionLanguage })}
        />
      </Section>

      <Section
        title={t('settings.openAtLogin.title')}
        description={t('settings.openAtLogin.description')}
      >
        <SegmentedToggle<'enabled' | 'disabled'>
          value={settings.openAtLogin ? 'enabled' : 'disabled'}
          onChange={(next) => onChange({ openAtLogin: next === 'enabled' })}
          ariaLabel={t('settings.openAtLogin.title')}
          options={[
            {
              value: 'enabled',
              label: t('settings.openAtLogin.enabled.label'),
            },
            {
              value: 'disabled',
              label: t('settings.openAtLogin.disabled.label'),
            },
          ]}
          hint={
            settings.openAtLogin
              ? t('settings.openAtLogin.enabled.hint')
              : t('settings.openAtLogin.disabled.hint')
          }
        />
      </Section>

      <Section
        title={t('settings.muteAudio.title')}
        description={t('settings.muteAudio.description')}
      >
        <SegmentedToggle<'enabled' | 'disabled'>
          value={settings.muteSystemAudioWhileRecording ? 'enabled' : 'disabled'}
          onChange={(next) =>
            onChange({ muteSystemAudioWhileRecording: next === 'enabled' })
          }
          ariaLabel={t('settings.muteAudio.title')}
          options={[
            {
              value: 'enabled',
              label: t('settings.muteAudio.enabled.label'),
            },
            {
              value: 'disabled',
              label: t('settings.muteAudio.disabled.label'),
            },
          ]}
          hint={
            settings.muteSystemAudioWhileRecording
              ? t('settings.muteAudio.enabled.hint')
              : t('settings.muteAudio.disabled.hint')
          }
        />
      </Section>

      <Section
        title={t('settings.dangerZone.title')}
        description={t('settings.dangerZone.description')}
      >
        <div className="actions">
          <ConfirmButton
            label={t('settings.reset')}
            question={t('settings.confirmReset')}
            onConfirm={onReset}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <header>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

function HotkeyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  // Tracks whether a non-modifier key was pressed during this capture
  // session. If only modifiers were pressed and then released, we accept
  // the modifier itself as a bare-modifier hotkey (e.g. AltRight).
  const sawNonModifierRef = useRef(false);
  const isMac = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPod|iPad/.test(navigator.platform),
    []
  );

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!capturing) return;
    sawNonModifierRef.current = false;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const isMod =
        e.key === 'Control' ||
        e.key === 'Shift' ||
        e.key === 'Alt' ||
        e.key === 'Meta';
      if (!isMod) sawNonModifierRef.current = true;
      const accel = keyEventToAccelerator(e);
      if (accel) {
        setDraft(accel);
        if (isFinalAccelerator(accel)) {
          finish(accel);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // If the user released a modifier without ever pressing a non-modifier,
      // treat the modifier itself as a bare-modifier accelerator (handy for
      // single-key hotkeys like Right Alt / Right Cmd).
      if (sawNonModifierRef.current) return;
      const bare = bareModifierFromCode(e.code);
      if (!bare) return;
      e.preventDefault();
      finish(bare);
    };

    const finish = (accel: string) => {
      setDraft(accel);
      setCapturing(false);
      onChange(accel);
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [capturing, onChange]);

  const showCapturePreview = capturing && draft && draft !== value;
  const platform = isMac ? 'mac' : 'win';

  return (
    <div className="hotkey-input" ref={ref}>
      <div className={`hotkey-row${capturing ? ' capturing' : ''}`}>
        <div className="hotkey-display">
          {capturing && !showCapturePreview ? (
            <>
              <span className="hotkey-display-pulse" aria-hidden="true" />
              <span className="hotkey-display-text">
                {t('settings.hotkey.waiting')}
              </span>
            </>
          ) : (
            <span className="hotkey-display-keys">
              <HotkeyKeys accel={draft} platform={platform} size="sm" />
            </span>
          )}
        </div>
        <button
          className="btn-secondary hotkey-change-btn"
          onClick={() => {
            setCapturing((c) => !c);
          }}
        >
          {capturing ? t('settings.hotkey.cancel') : t('settings.hotkey.change')}
        </button>
      </div>
      <div className="hotkey-presets">
        {isMac && (
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setDraft('MetaRight');
              onChange('MetaRight');
              setCapturing(false);
            }}
          >
            Right Command
          </button>
        )}
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setDraft('AltRight');
            onChange('AltRight');
            setCapturing(false);
          }}
        >
          {isMac ? 'Right Option' : 'Right Alt'}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_MIC_VALUE = '__system_default__';

function MicrophonePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);

  // Refresh whenever the OS reports a device add/remove (plugging in a USB
  // mic, switching Bluetooth headphones, etc.).
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const list = await listMicrophones();
      if (!cancelled) setDevices(list);
    };
    void refresh();
    const md = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refresh);
    return () => {
      cancelled = true;
      md?.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  // If the persisted device isn't currently available, the dropdown shows
  // "System default" — the saved id stays put so the device gets re-picked
  // automatically when it comes back.
  const persistedAvailable =
    value !== null && devices.some((d) => d.deviceId === value);
  const selected = persistedAvailable ? (value as string) : DEFAULT_MIC_VALUE;

  const options = [
    { value: DEFAULT_MIC_VALUE, label: t('settings.microphone.systemDefault') },
    ...devices.map((d, i) => ({
      value: d.deviceId,
      label: d.label || t('settings.microphone.unnamed', { index: i + 1 }),
    })),
  ];

  return (
    <Select<string>
      value={selected}
      onChange={(next) =>
        onChange(next === DEFAULT_MIC_VALUE ? null : next)
      }
      ariaLabel={t('settings.microphone.title')}
      options={options}
    />
  );
}

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.metaKey) parts.push('Cmd');
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = normalizeKey(e.key, e.code);
  if (!key) return parts.join('+');
  parts.push(key);
  return parts.join('+');
}

function isFinalAccelerator(accel: string): boolean {
  const lastPart = accel.split('+').pop() ?? '';
  return !['Cmd', 'Ctrl', 'Alt', 'Shift'].includes(lastPart);
}

function bareModifierFromCode(code: string): string | null {
  switch (code) {
    case 'AltRight':
      return 'AltRight';
    case 'AltLeft':
      return 'AltLeft';
    case 'ControlRight':
      return 'CtrlRight';
    case 'ControlLeft':
      return 'CtrlLeft';
    case 'ShiftRight':
      return 'ShiftRight';
    case 'ShiftLeft':
      return 'ShiftLeft';
    case 'MetaRight':
    case 'OSRight':
      return 'MetaRight';
    case 'MetaLeft':
    case 'OSLeft':
      return 'MetaLeft';
    default:
      return null;
  }
}

function EngineStatusPanel({
  status,
  onRefresh,
}: {
  status: EngineStatus | null;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState('');
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    if (!installing) return;
    return window.bisbi.engine.onInstallLog(setInstallLog);
  }, [installing]);

  if (!status) return null;

  const install = async () => {
    setInstalling(true);
    setInstallLog('');
    setInstallError(null);
    try {
      await window.bisbi.engine.installWhisperPackage();
      onRefresh();
    } catch (err) {
      setInstallError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="engine-status">
      <div className="engine-status-row">
        <span className={`engine-status-dot${status.python.ok ? ' ok' : ' bad'}`} />
        <span className="engine-status-label">
          {status.python.ok
            ? t('settings.engine.pythonFound', { version: status.python.version ?? '' })
            : t('settings.engine.pythonMissing')}
        </span>
        {!status.python.ok && (
          <button
            type="button"
            className="btn-link"
            onClick={() => void window.bisbi.openExternal('https://www.python.org/downloads/')}
          >
            python.org
          </button>
        )}
      </div>
      {status.python.ok && (
        <div className="engine-status-row">
          <span className={`engine-status-dot${status.whisperPackageInstalled ? ' ok' : ' bad'}`} />
          <span className="engine-status-label">
            {status.whisperPackageInstalled
              ? t('settings.engine.packageInstalled')
              : t('settings.engine.packageMissing')}
          </span>
          {!status.whisperPackageInstalled && (
            <button
              type="button"
              className="btn-secondary"
              disabled={installing}
              onClick={install}
            >
              {installing ? t('settings.engine.installing') : t('settings.engine.install')}
            </button>
          )}
        </div>
      )}
      {installing && installLog && <p className="engine-status-log">{installLog}</p>}
      {status.python.ok && (
        <div className="engine-status-row">
          <span className={`engine-status-dot${status.ffmpegInstalled ? ' ok' : ' bad'}`} />
          <span className="engine-status-label">
            {status.ffmpegInstalled
              ? t('settings.engine.ffmpegInstalled')
              : t('settings.engine.ffmpegMissing')}
          </span>
        </div>
      )}
      {installError && <p className="engine-status-error">{installError}</p>}
    </div>
  );
}

function formatModelSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function WhisperModelPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [models, setModels] = useState<ModelListEntry[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => void window.bisbi.models.list().then(setModels);
    refresh();
    const offChanged = window.bisbi.models.onChanged(refresh);
    const offProgress = window.bisbi.models.onProgress(({ id, receivedBytes, totalBytes }) => {
      setProgress((p) => ({ ...p, [id]: totalBytes > 0 ? receivedBytes / totalBytes : 0 }));
    });
    return () => {
      offChanged();
      offProgress();
    };
  }, []);

  const handleSelect = async (m: ModelListEntry) => {
    setError(null);
    if (m.downloaded) {
      onSelect(m.id);
      return;
    }
    setDownloading(m.id);
    try {
      await window.bisbi.models.download(m.id);
      onSelect(m.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="model-picker">
      {models.map((m) => {
        const active = m.id === value;
        const pct = progress[m.id];
        const isDownloading = downloading === m.id;
        return (
          <div key={m.id} className={`model-row${active ? ' model-row-active' : ''}`}>
            <div className="model-row-info">
              <span className="model-row-label">{m.label}</span>
              <span className="model-row-size">{formatModelSize(m.sizeMb)}</span>
            </div>
            <div className="model-row-actions">
              {isDownloading ? (
                <span className="model-row-progress">{Math.round((pct ?? 0) * 100)}%</span>
              ) : active ? (
                <span className="model-row-badge">{t('settings.whisperModel.active')}</span>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => handleSelect(m)}>
                  {m.downloaded ? t('settings.whisperModel.use') : t('settings.whisperModel.download')}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="engine-status-error">{error}</p>}
    </div>
  );
}

const AUTO_LANGUAGE = 'auto';

function TranscriptionLanguagePicker({
  value,
  whisperModel,
  onChange,
}: {
  value: string;
  whisperModel: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<WhisperLanguageInfo[]>([]);
  const [models, setModels] = useState<ModelListEntry[]>([]);

  useEffect(() => {
    void window.bisbi.languages.list().then(setLanguages);
    const refreshModels = () => void window.bisbi.models.list().then(setModels);
    refreshModels();
    return window.bisbi.models.onChanged(refreshModels);
  }, []);

  // English-only checkpoints (`*.en`) don't accept a language parameter —
  // nothing to pick when the active model can't honor it.
  const currentModel = models.find((m) => m.id === whisperModel);
  const supportsLanguage = currentModel ? currentModel.multilingual : true;

  return (
    <div>
      <Select<string>
        value={value}
        onChange={onChange}
        ariaLabel={t('settings.transcriptionLanguage.title')}
        disabled={!supportsLanguage}
        searchPlaceholder={t('settings.transcriptionLanguage.search')}
        options={[
          { value: AUTO_LANGUAGE, label: t('settings.transcriptionLanguage.auto') },
          ...languages.map((l) => ({ value: l.code, label: l.label })),
        ]}
      />
      {!supportsLanguage && (
        <p className="segmented-toggle-hint">{t('settings.transcriptionLanguage.unsupportedHint')}</p>
      )}
    </div>
  );
}

function normalizeKey(key: string, code: string): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;
  if (key === ' ' || code === 'Space') return 'Space';
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^F\d+$/.test(key)) return key;
  if (/^Arrow/.test(key)) return key.replace('Arrow', '');
  if (key.length === 1) return key;
  return key;
}
