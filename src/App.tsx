import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { startRecording, type RecordingHandle } from './audio';
import type { AppSettings, EngineStatus, RecordingState } from './types';
import { useTranslation } from './i18n';
import owlIdleSvg from '../build-resources/owl_head.svg';
import owlRecSvg from '../build-resources/owl_head_rec.svg';

export function App() {
  const { t } = useTranslation();
  const settingsSectionRef = useRef<HTMLElement | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const settingsRef = useRef<AppSettings | null>(null);
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [appVersion, setAppVersion] = useState('');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [tourActive, setTourActive] = useState<boolean | null>(null);
  // The onboarding's first-dictation step needs the hotkey live (it listens
  // for recording:start itself and never pastes); earlier steps keep it off.
  const [onboardingDictation, setOnboardingDictation] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const scrollToSettings = useCallback(() => {
    settingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const refreshEngine = useCallback(() => {
    void window.bisbi.engine.check().then(setEngineStatus);
  }, []);

  // Null while the first check is still in flight — treated as "not ready"
  // so the hotkey never arms on an unknown engine state.
  const engineReady =
    engineStatus !== null &&
    engineStatus.python.ok &&
    engineStatus.whisperPackageInstalled &&
    engineStatus.ffmpegInstalled &&
    engineStatus.model.ok;

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!window.bisbi) return;
    void window.bisbi.getSettings().then(setSettings);
    void window.bisbi.getAppVersion().then(setAppVersion);
    void window.bisbi.getRecordingState().then(setRecState);
    refreshEngine();
    void window.bisbi.onboarding.getState().then((s) => setTourActive(!s.completed));

    const offSettings = window.bisbi.onSettingsChange((s) => {
      setSettings(s);
      refreshEngine();
    });
    const offState = window.bisbi.onRecordingState(setRecState);
    const offNav = window.bisbi.onNavigate(({ to }) => {
      if (to === '/settings') scrollToSettings();
    });
    const offBlocked = window.bisbi.onTranscriptionBlocked(({ reason }) => {
      setBlockedReason(reason);
      refreshEngine();
      if (reason === 'python-missing' || reason === 'engine-error') {
        scrollToSettings();
      }
    });
    const offModelsChanged = window.bisbi.models.onChanged(refreshEngine);
    return () => {
      offSettings();
      offState();
      offNav();
      offBlocked();
      offModelsChanged();
    };
  }, [refreshEngine, scrollToSettings]);

  useEffect(() => {
    if (!window.bisbi) return;
    if (tourActive === null) return;
    void window.bisbi.setRecordingArmed(engineReady && (!tourActive || onboardingDictation));
  }, [tourActive, engineReady, onboardingDictation]);

  useEffect(() => {
    if (!window.bisbi) return;
    if (!settings) return;
    const accel = settings.hotkey;
    const downHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (matchesAccelerator(e, accel)) {
        window.bisbi.notifyExternalKeydown();
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (matchesAccelerator(e, accel)) {
        window.bisbi.notifyExternalKeyup();
      }
    };
    window.addEventListener('keydown', downHandler, true);
    window.addEventListener('keyup', upHandler, true);
    return () => {
      window.removeEventListener('keydown', downHandler, true);
      window.removeEventListener('keyup', upHandler, true);
    };
  }, [settings?.hotkey]);

  useEffect(() => {
    if (!window.bisbi) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (recState === 'idle') return;
      void window.bisbi.cancelAll();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recState]);

  useEffect(() => {
    if (!window.bisbi) return;
    if (tourActive !== false) return;
    let handle: RecordingHandle | null = null;
    let chain: Promise<void> = Promise.resolve();

    const offStart = window.bisbi.onRecordingStart(() => {
      chain = chain.then(async () => {
        try {
          handle = await startRecording({
            onLevel: (level) => window.bisbi.sendRecordingLevel(level),
            onSegment: (pcm, sampleRate, channels) =>
              window.bisbi.submitAudioChunk(pcm, sampleRate, channels),
            deviceId: settingsRef.current?.microphoneId ?? null,
          });
        } catch (err) {
          console.error('[App] mic access failed:', err);
          await window.bisbi.cancelRecording();
          alert(t('app.micError'));
        }
      });
    });

    const offStop = window.bisbi.onRecordingStop(() => {
      chain = chain.then(async () => {
        const cur = handle;
        handle = null;
        if (!cur) {
          await window.bisbi.cancelRecording();
          return;
        }
        try {
          const { pcm, sampleRate, channels } = await cur.stop();
          await window.bisbi.submitAudio(pcm, sampleRate, channels);
        } catch (err) {
          console.error('[App] mic stop failed:', err);
          await window.bisbi.cancelRecording();
        }
      });
    });

    const offCancel = window.bisbi.onRecordingCancel(() => {
      chain = chain.then(async () => {
        const cur = handle;
        handle = null;
        cur?.cancel();
      });
    });

    return () => {
      offStart();
      offStop();
      offCancel();
      handle?.cancel();
    };
  }, [t, tourActive]);

  if (!window.bisbi) {
    return (
      <div className="not-electron">
        <h1>Bisbi</h1>
        <p>{t('app.notElectron.body')}</p>
        <p>
          {renderWithTokens(
            t('app.notElectron.devHint', {
              cmd: '__CMD__',
              url: '__URL__',
            }),
            {
              __CMD__: <code key="cmd">npm run dev</code>,
              __URL__: <code key="url">{window.location.origin}</code>,
            }
          )}
        </p>
      </div>
    );
  }

  if (!settings || tourActive === null) {
    return <div className="loading">{t('app.loading')}</div>;
  }

  if (tourActive) {
    return (
      <Onboarding
        settings={settings}
        onSettingsChange={setSettings}
        onDictationStepChange={setOnboardingDictation}
        onExit={() => {
          setTourActive(false);
          void window.bisbi.onboarding.setState({ completed: true });
        }}
      />
    );
  }

  const pythonMissing = engineStatus !== null && !engineStatus.python.ok;
  const packageMissing =
    engineStatus !== null && engineStatus.python.ok && !engineStatus.whisperPackageInstalled;
  const ffmpegMissing =
    engineStatus !== null &&
    engineStatus.python.ok &&
    engineStatus.whisperPackageInstalled &&
    !engineStatus.ffmpegInstalled;
  const modelMissing =
    engineStatus !== null &&
    engineStatus.python.ok &&
    engineStatus.whisperPackageInstalled &&
    engineStatus.ffmpegInstalled &&
    !engineStatus.model.ok;

  return (
    <div
      className="app"
      style={{
        '--owl-idle': `url(${owlIdleSvg})`,
        '--owl-rec': `url(${owlRecSvg})`,
      } as CSSProperties}
    >
      <aside
        className={`sidebar${recState === 'recording' ? ' is-recording' : ''}`}
      >
        <div className="sidebar-top">
          <div className="sidebar-brand">{t('app.brand')}</div>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-status-row">
            <StatusBadge state={recState} />
            {appVersion && <span className="sidebar-version">v{appVersion}</span>}
          </div>
        </div>
      </aside>

      <main className="content">
        {pythonMissing && (
          <div className="banner banner-error">{t('app.pythonMissing')}</div>
        )}
        {packageMissing && (
          <div className="banner banner-error">{t('app.enginePackageMissing')}</div>
        )}
        {ffmpegMissing && (
          <div className="banner banner-error">{t('app.ffmpegMissing')}</div>
        )}
        {modelMissing && (
          <div className="banner banner-error">{t('app.modelMissing')}</div>
        )}
        {blockedReason === 'engine-error' && (
          <div className="banner banner-error">{t('app.engineError')}</div>
        )}
        <div className="content-inner">
          <Home settings={settings} recState={recState} />
          <section ref={settingsSectionRef} className="content-settings">
            <Settings
              settings={settings}
              engineStatus={engineStatus}
              onRefreshEngine={refreshEngine}
              onChange={async (patch) => {
                try {
                  const next = await window.bisbi.updateSettings(patch);
                  setSettings(next);
                  if (patch.whisperModel !== undefined) {
                    setBlockedReason(null);
                  }
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
              onReset={async () => {
                const next = await window.bisbi.resetSettings();
                setSettings(next);
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ state }: { state: RecordingState }) {
  const { t } = useTranslation();
  const text = t(`app.status.${state}` as const);
  return <span className={`badge badge-${state}`}>{text}</span>;
}

function renderWithTokens(
  template: string,
  replacements: Record<string, React.ReactNode>
): React.ReactNode[] {
  const tokens = Object.keys(replacements);
  if (tokens.length === 0) return [template];
  const re = new RegExp(`(${tokens.join('|')})`, 'g');
  return template.split(re).map((part, i) =>
    tokens.includes(part) ? (
      <span key={i}>{replacements[part]}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const ACCEL_TO_DOM_CODE: Record<string, string> = {
  CtrlRight: 'ControlRight',
  CtrlLeft: 'ControlLeft',
  AltRight: 'AltRight',
  AltLeft: 'AltLeft',
  ShiftRight: 'ShiftRight',
  ShiftLeft: 'ShiftLeft',
  MetaRight: 'MetaRight',
  MetaLeft: 'MetaLeft',
};

function matchesAccelerator(e: KeyboardEvent, accel: string): boolean {
  const parts = accel.split('+').map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return false;
  const expected = ACCEL_TO_DOM_CODE[last] ?? last;
  return e.code === expected;
}
