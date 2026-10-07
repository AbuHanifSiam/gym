import { useEffect, useState, useSyncExternalStore } from 'react';

/** Rest timer that survives reloads (stored as an end timestamp). */

const KEY = 'gt.rest';

interface Timer {
  endAt: number;
  total: number;
}

let timer: Timer | null = load();
const listeners = new Set<() => void>();
let audio: AudioContext | null = null;
let alarm: ReturnType<typeof setTimeout> | undefined;

function load(): Timer | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Timer | null;
    return t && t.endAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function set(next: Timer | null) {
  timer = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  clearTimeout(alarm);
  if (next) alarm = setTimeout(ring, Math.max(0, next.endAt - Date.now()));
  listeners.forEach((l) => l());
}

if (timer) alarm = setTimeout(ring, timer.endAt - Date.now());

function ring() {
  navigator.vibrate?.([250, 120, 250]);
  try {
    if (audio) {
      const now = audio.currentTime;
      [0, 0.25].forEach((offset) => {
        const osc = audio!.createOscillator();
        const gain = audio!.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
        osc.connect(gain).connect(audio!.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    }
  } catch {
    // Sound is a nice-to-have.
  }
  set(null);
}

/** Call from a tap handler so the browser allows sound later. */
export function startRest(seconds: number) {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // no audio support
  }
  set({ endAt: Date.now() + seconds * 1000, total: seconds });
}

export function adjustRest(deltaSec: number) {
  if (!timer) return;
  const endAt = timer.endAt + deltaSec * 1000;
  if (endAt <= Date.now()) set(null);
  else set({ endAt, total: Math.max(timer.total + deltaSec, 1) });
}

export function stopRest() {
  set(null);
}

/** Current timer with a live remaining-seconds count. */
export function useRestTimer() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => timer,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!t) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [t]);
  if (!t) return null;
  return { remaining: Math.max(0, Math.ceil((t.endAt - now) / 1000)), total: t.total };
}
