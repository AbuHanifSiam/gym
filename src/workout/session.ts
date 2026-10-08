import type {
  LastPerformance,
  PlanDay,
  SessionEntry,
  SessionSet,
  WorkoutSession,
} from '../../shared/schemas.js';

export function newSessionId(): string {
  return crypto.randomUUID();
}

/** A fresh workout built from the plan's day: one empty set row per planned set. */
export function buildSession(opts: {
  planId: string | null;
  date: string;
  day: PlanDay;
  now?: Date;
}): WorkoutSession {
  const now = (opts.now ?? new Date()).toISOString();
  return {
    id: newSessionId(),
    planId: opts.planId,
    date: opts.date,
    dayIndex: opts.day.dayIndex,
    startedAt: now,
    finishedAt: null,
    notes: '',
    rev: 1,
    updatedAt: now,
    entries: opts.day.items.map((i) => ({
      exerciseId: i.exerciseId,
      variationKey: i.variationKey,
      target: {
        sets: i.sets,
        repsMin: i.repsMin,
        repsMax: i.repsMax,
        durationSec: i.durationSec,
        notes: i.notes,
      },
      sets: Array.from({ length: i.sets }, (_, n) => emptySet(n + 1)),
    })),
  };
}

export const emptySet = (setNumber: number): SessionSet => ({
  setNumber,
  weight: null,
  reps: null,
  durationSec: null,
  done: false,
});

function updateEntry(
  s: WorkoutSession,
  entryIdx: number,
  fn: (e: SessionEntry) => SessionEntry,
): WorkoutSession {
  return { ...s, entries: s.entries.map((e, i) => (i === entryIdx ? fn(e) : e)) };
}

export function patchSet(
  s: WorkoutSession,
  entryIdx: number,
  setIdx: number,
  patch: Partial<SessionSet>,
): WorkoutSession {
  return updateEntry(s, entryIdx, (e) => ({
    ...e,
    sets: e.sets.map((x, i) => (i === setIdx ? { ...x, ...patch } : x)),
  }));
}

/**
 * Ticks a set done. Empty fields are filled from last time's same set, or the plan target,
 * so a single tap logs "did what I did last time".
 */
export function completeSet(
  s: WorkoutSession,
  entryIdx: number,
  setIdx: number,
  last: LastPerformance | undefined,
  timed: boolean,
): WorkoutSession {
  const entry = s.entries[entryIdx];
  const set = entry.sets[setIdx];
  const prev = last?.sets.find((x) => x.setNumber === set.setNumber) ?? last?.sets.at(-1);
  const t = entry.target;
  const fill: Partial<SessionSet> = { done: true };
  if (timed) {
    if (set.durationSec == null) fill.durationSec = prev?.durationSec ?? t.durationSec;
  } else {
    if (set.reps == null) fill.reps = prev?.reps ?? t.repsMax ?? t.repsMin;
    if (set.weight == null && prev?.weight != null) fill.weight = prev.weight;
  }
  return patchSet(s, entryIdx, setIdx, fill);
}

export function addSet(s: WorkoutSession, entryIdx: number): WorkoutSession {
  return updateEntry(s, entryIdx, (e) => {
    const lastSet = e.sets.at(-1);
    const next = emptySet(e.sets.length + 1);
    // Carry the previous set's weight forward; that's almost always what you want.
    if (lastSet?.weight != null) next.weight = lastSet.weight;
    return { ...e, sets: [...e.sets, next] };
  });
}

export function removeLastSet(s: WorkoutSession, entryIdx: number): WorkoutSession {
  return updateEntry(s, entryIdx, (e) => ({ ...e, sets: e.sets.slice(0, -1) }));
}

export function setVariation(s: WorkoutSession, entryIdx: number, key: string): WorkoutSession {
  return updateEntry(s, entryIdx, (e) => ({ ...e, variationKey: key }));
}

// ---------- Changing today's exercise list (the plan itself is untouched) ----------

/** What a swapped-in or added exercise needs to know about itself. */
export interface EntryExercise {
  id: string;
  measure: 'reps' | 'time';
}

/** Moves an entry one place up (-1) or down (+1). Out-of-range moves are ignored. */
export function moveEntry(s: WorkoutSession, entryIdx: number, dir: -1 | 1): WorkoutSession {
  const to = entryIdx + dir;
  if (to < 0 || to >= s.entries.length) return s;
  const entries = [...s.entries];
  [entries[entryIdx], entries[to]] = [entries[to], entries[entryIdx]];
  return { ...s, entries };
}

/** Skips an exercise for today: drops it from the workout, along with any sets logged. */
export function removeEntry(s: WorkoutSession, entryIdx: number): WorkoutSession {
  return { ...s, entries: s.entries.filter((_, i) => i !== entryIdx) };
}

/**
 * Target for an exercise that wasn't planned. Keeps the planned set count and reps when the
 * kind of exercise matches; a timed exercise swapped for a reps one (or back) gets defaults.
 */
function targetFor(ex: EntryExercise, base?: SessionEntry['target']): SessionEntry['target'] {
  const sets = base && base.sets > 0 ? base.sets : 3;
  const baseTimed = base?.durationSec != null;
  if (ex.measure === 'time') {
    return {
      sets,
      repsMin: null,
      repsMax: null,
      durationSec: baseTimed ? base!.durationSec : 30,
      notes: '',
    };
  }
  if (base && !baseTimed) return { ...base, sets, notes: '' };
  return { sets, repsMin: 8, repsMax: 12, durationSec: null, notes: '' };
}

/** Does a different exercise in this slot, with fresh (empty) sets. */
export function replaceEntry(
  s: WorkoutSession,
  entryIdx: number,
  ex: EntryExercise,
): WorkoutSession {
  return updateEntry(s, entryIdx, (e) => {
    const target = targetFor(ex, e.target);
    return {
      exerciseId: ex.id,
      variationKey: '',
      target,
      sets: Array.from({ length: target.sets }, (_, n) => emptySet(n + 1)),
    };
  });
}

/** Adds an extra exercise at the end of today's workout. */
export function addEntry(s: WorkoutSession, ex: EntryExercise): WorkoutSession {
  const target = targetFor(ex);
  return {
    ...s,
    entries: [
      ...s.entries,
      {
        exerciseId: ex.id,
        variationKey: '',
        target,
        sets: Array.from({ length: target.sets }, (_, n) => emptySet(n + 1)),
      },
    ],
  };
}

export interface SessionStats {
  totalSets: number;
  doneSets: number;
  /** Sum of weight × reps over done sets, in kg. */
  volumeKg: number;
  doneExercises: number;
}

export function sessionStats(s: WorkoutSession): SessionStats {
  let totalSets = 0;
  let doneSets = 0;
  let volumeKg = 0;
  let doneExercises = 0;
  for (const e of s.entries) {
    totalSets += e.sets.length;
    const done = e.sets.filter((x) => x.done);
    doneSets += done.length;
    if (e.sets.length > 0 && done.length === e.sets.length) doneExercises++;
    for (const x of done) volumeKg += (x.weight ?? 0) * (x.reps ?? 0);
  }
  return { totalSets, doneSets, volumeKg: Math.round(volumeKg), doneExercises };
}

/** True when this tick finishes the last open set of the whole workout. */
export function isLastOpenSet(s: WorkoutSession, entryIdx: number, setIdx: number): boolean {
  return s.entries.every((e, ei) =>
    e.sets.every((x, si) => x.done || (ei === entryIdx && si === setIdx)),
  );
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}
