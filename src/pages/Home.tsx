import { useEffect, useMemo, useState } from 'react';
import type { AppSettings, RecordingState } from '../types';
import { useTranslation } from '../i18n';
import { HotkeyKeys, type HotkeyVisualState } from '../components/HotkeyKeys';
import type { KeyPlatform } from '../lib/hotkey';

interface Props {
  settings: AppSettings;
  recState: RecordingState;
}

type KeyStyle = KeyPlatform;

export function Home({ settings, recState }: Props) {
  const { t } = useTranslation();
  const [lastTranscription, setLastTranscription] = useState('');
  const [partialCaption, setPartialCaption] = useState('');
  const [keyStyle, setKeyStyle] = useState<KeyStyle>(() =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'mac' : 'win'
  );

  useEffect(() => {
    const offDone = window.bisbi.onTranscriptionDone(({ text }) => setLastTranscription(text));
    const offPartial = window.bisbi.onTranscriptionPartial(({ text }) => setPartialCaption(text));
    void window.bisbi.getPlatform().then((p) => {
      setKeyStyle(p === 'darwin' ? 'mac' : 'win');
    });
    return () => {
      offDone();
      offPartial();
    };
  }, []);

  const greeting = useMemo(() => t(timeGreetingKey()), [t]);

  const statusText = t(`home.statusTitle.${recState}` as const);
  const watermarkText =
    recState === 'recording'
      ? partialCaption || t('home.watermark.listening')
      : recState === 'transcribing'
      ? t('home.watermark.transcribing')
      : lastTranscription || t('home.watermark.idle');
  const showWatermark = watermarkText.length > 0;

  return (
    <div className="home">
      <div className="home-hero">
        <span className="home-greeting">{greeting}</span>
        <h1 className="home-title">
          {statusText}.
          <br />
          <em>{t('home.titleHint')}</em>
        </h1>
      </div>

      <div className="home-hotkey">
        {showWatermark && (
          <div className="home-hotkey-watermark" aria-hidden="true">
            {watermarkText}
          </div>
        )}
        <div className="home-hotkey-content">
          <span className="home-hotkey-label">{t('home.hotkeyLabel')}</span>
          <div className="home-hotkey-keys">
            <HotkeyKeys
              accel={settings.hotkey}
              platform={keyStyle}
              visual={hotkeyVisualState(recState, settings.handsFreeMode)}
            />
          </div>
          <span className="home-hotkey-hint">
            {t('home.hotkeyHintPaste')}
          </span>
        </div>
      </div>
    </div>
  );
}

function hotkeyVisualState(rec: RecordingState, handsFree: boolean): HotkeyVisualState {
  if (rec !== 'recording') return 'idle';
  return handsFree ? 'lit' : 'pressed';
}

function timeGreetingKey():
  | 'home.greeting.lateNight'
  | 'home.greeting.morning'
  | 'home.greeting.afternoon'
  | 'home.greeting.evening' {
  const h = new Date().getHours();
  if (h < 6) return 'home.greeting.lateNight';
  if (h < 13) return 'home.greeting.morning';
  if (h < 20) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}
