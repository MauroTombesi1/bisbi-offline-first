import { useEffect, useRef, useState } from 'react';
import type { RecordingState } from './types';

const BARS = 12;
const FALLOFF = 0.78;
const MIN_PEAK = 0.04;
const PEAK_ATTACK = 0.6;
const PEAK_DECAY = 0.992;

export function RecordingApp() {
  // Default to 'idle' so the warmed-up pill window never renders a
  // recording UI before the backend has explicitly told it to.
  const [state, setState] = useState<RecordingState>('idle');
  const [bars, setBars] = useState<number[]>(() => new Array(BARS).fill(0));
  const [seconds, setSeconds] = useState(0);
  const [caption, setCaption] = useState('');
  const lastLevelRef = useRef(0);
  const peakRef = useRef(MIN_PEAK);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!window.bisbi) return;
    const offState = window.bisbi.onPillState((s) => {
      if (s === 'recording') {
        startedAtRef.current = Date.now();
        setSeconds(0);
        setCaption('');
      } else if (s === 'idle') {
        startedAtRef.current = null;
        setCaption('');
      }
      setState(s);
    });
    const offLevel = window.bisbi.onRecordingLevel((level) => {
      lastLevelRef.current = level;
    });
    const offPartial = window.bisbi.onTranscriptionPartial(({ text }) => {
      setCaption(text);
    });
    return () => {
      offState();
      offLevel();
      offPartial();
    };
  }, []);

  useEffect(() => {
    if (state !== 'recording') {
      peakRef.current = MIN_PEAK;
      return;
    }
    const id = window.setInterval(() => {
      setBars((prev) => {
        const next = prev.slice(1);
        const v = lastLevelRef.current;
        lastLevelRef.current = v * FALLOFF;
        const decayed = Math.max(MIN_PEAK, peakRef.current * PEAK_DECAY);
        peakRef.current = v > decayed ? decayed + (v - decayed) * PEAK_ATTACK : decayed;
        next.push(Math.min(1, v / peakRef.current));
        return next;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state === 'idle') {
      setSeconds(0);
      return;
    }
    if (state === 'recording') {
      const id = window.setInterval(() => {
        if (startedAtRef.current == null) return;
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      return () => window.clearInterval(id);
    }
  }, [state]);

  const hasCaption = state === 'recording' && caption.length > 0;

  return (
    <div className={`recording-pill state-${state}${hasCaption ? ' has-caption' : ''}`}>
      <div className="rec-indicator" aria-hidden="true" />
      <div className="rec-waveform" aria-hidden="true">
        {bars.map((v, i) => (
          <span
            key={i}
            className="rec-bar"
            style={{ transform: `scaleY(${0.12 + Math.min(1, v) * 0.68})` }}
          />
        ))}
      </div>
      {state !== 'idle' && (
        <span className="rec-time">{formatTime(seconds)}</span>
      )}
      {hasCaption && <span className="rec-caption">{caption}</span>}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
