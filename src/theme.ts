import { useEffect } from 'react';
import type { UserSettings } from '../shared/schemas';

type Theme = UserSettings['theme'];
const KEY = 'gt.theme';

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name=theme-color]')
    ?.setAttribute('content', dark ? '#020617' : '#f8fafc');
}

/** Keeps <html class="dark"> in sync with the user's theme setting (and the OS, for "system"). */
export function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    const t = theme ?? readSaved();
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // ignore
    }
    apply(t);
    if (t !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}

function readSaved(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark' || t === 'system') return t;
  } catch {
    // ignore
  }
  return 'system';
}
