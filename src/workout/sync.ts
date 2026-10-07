import { useSyncExternalStore } from 'react';
import type { WorkoutSession } from '../../shared/schemas';
import { api, ApiError } from '../api/client';

/**
 * Local-first workout storage. Every change is written to localStorage immediately, then
 * pushed to the server in the background. Unsynced sessions are retried when the phone is
 * back online, when the app opens, and every 20 seconds.
 */

const PREFIX = 'gt.session.';
const RETRY_MS = 20_000;
const DEBOUNCE_MS = 700;

interface Stored {
  session: WorkoutSession;
  syncedRev: number;
  deleted?: boolean;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

let status: SyncStatus = 'idle';
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();

function setStatus(s: SyncStatus) {
  if (status === s) return;
  status = s;
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

function read(id: string): Stored | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(id: string, value: Stored) {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the server copy is still the fallback.
  }
}

function allStored(): Stored[] {
  const out: Stored[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) {
        const v = read(key.slice(PREFIX.length));
        if (v) out.push(v);
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/** The local copy if it's newer than what the server returned. */
export function preferLocal(
  server: WorkoutSession | null,
  date: string,
  dayIndex: number,
): WorkoutSession | null {
  const local = allStored()
    .filter((s) => !s.deleted && s.session.date === date && s.session.dayIndex === dayIndex)
    .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))[0]?.session;
  if (!local) return server;
  if (!server) return local;
  if (local.id === server.id) return local.rev > server.rev ? local : server;
  return local.startedAt > server.startedAt ? local : server;
}

/** Save locally now and schedule a server sync. */
export function saveSession(session: WorkoutSession) {
  const prev = read(session.id);
  write(session.id, { session, syncedRev: prev?.syncedRev ?? 0 });
  schedule(session.id, DEBOUNCE_MS);
}

/** Server copy just loaded: remember it as synced so we don't push it back. */
export function rememberServerSession(session: WorkoutSession) {
  const prev = read(session.id);
  if (!prev || prev.session.rev <= session.rev) {
    write(session.id, { session, syncedRev: session.rev });
  }
}

export function deleteSession(id: string) {
  const prev = read(id);
  if (prev) write(id, { ...prev, deleted: true });
  schedule(id, 0);
}

function schedule(id: string, delay: number) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => void push(id), delay),
  );
}

async function push(id: string) {
  const stored = read(id);
  if (!stored || inFlight.has(id)) return;
  if (!stored.deleted && stored.syncedRev >= stored.session.rev) return;
  inFlight.add(id);
  setStatus('saving');
  try {
    if (stored.deleted) {
      await api(`/sessions/${id}`, { method: 'DELETE' });
      localStorage.removeItem(PREFIX + id);
    } else {
      const { id: _id, updatedAt: _u, ...body } = stored.session;
      const res = await api<{ session: WorkoutSession }>(`/sessions/${id}`, {
        method: 'PUT',
        body,
      });
      const latest = read(id);
      if (latest) write(id, { ...latest, syncedRev: Math.max(latest.syncedRev, res.session.rev) });
    }
    setStatus(pendingCount() > 0 ? 'saving' : 'saved');
  } catch (err) {
    const offline = err instanceof ApiError && err.status === 0;
    setStatus(offline ? 'offline' : 'error');
    // A 4xx other than auth won't fix itself; stop retrying it to avoid a loop.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401) {
      const latest = read(id);
      if (latest) write(id, { ...latest, syncedRev: latest.session.rev });
    }
  } finally {
    inFlight.delete(id);
  }
  // Something changed while the request was running.
  const after = read(id);
  if (after && !after.deleted && after.syncedRev < after.session.rev) schedule(id, DEBOUNCE_MS);
}

function pendingCount() {
  return allStored().filter((s) => s.deleted || s.syncedRev < s.session.rev).length;
}

export function flushPending() {
  for (const s of allStored()) {
    if (s.deleted || s.syncedRev < s.session.rev) void push(s.session.id);
  }
}

/** Drops synced local copies older than a week so storage doesn't grow forever. */
function prune() {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  for (const s of allStored()) {
    if (s.session.date < cutoff && s.syncedRev >= s.session.rev && !s.deleted) {
      localStorage.removeItem(PREFIX + s.session.id);
    }
  }
}

let started = false;
export function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  prune();
  flushPending();
  window.addEventListener('online', flushPending);
  setInterval(() => navigator.onLine && flushPending(), RETRY_MS);
}
