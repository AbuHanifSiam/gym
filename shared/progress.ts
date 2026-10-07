import type { SessionSet } from './schemas.js';
import { addDays, weekdayOf } from './time.js';

// ---------- Exercise progress ----------

export interface ExercisePoint {
  date: string;
  sessionId: string;
  variationKey: string;
  /** Heaviest weight lifted for at least one rep (kg). */
  topWeight: number | null;
  /** Reps done at the top weight. */
  topWeightReps: number | null;
  /** Most reps in one set. */
  bestReps: number | null;
  /** Estimated one-rep max (Epley), kg. */
  est1rm: number | null;
  /** Sum of weight × reps (kg). */
  volume: number;
  /** Longest hold (timed exercises). */
  bestDuration: number | null;
  sets: SessionSet[];
}

export interface PersonalRecord {
  value: number;
  date: string;
  sessionId: string;
  /** Extra detail, e.g. reps at a weight PR. */
  reps?: number | null;
}

export interface ExercisePRs {
  heaviest: PersonalRecord | null;
  mostReps: PersonalRecord | null;
  est1rm: PersonalRecord | null;
  volume: PersonalRecord | null;
  longest: PersonalRecord | null;
}

/** Epley estimate; only meaningful for 1-12 reps, so higher reps return null. */
export function epley1rm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function summarizeSets(
  date: string,
  sessionId: string,
  variationKey: string,
  allSets: SessionSet[],
): ExercisePoint | null {
  const sets = allSets.filter((s) => s.done);
  if (sets.length === 0) return null;
  let topWeight: number | null = null;
  let topWeightReps: number | null = null;
  let bestReps: number | null = null;
  let est1rm: number | null = null;
  let volume = 0;
  let bestDuration: number | null = null;
  for (const s of sets) {
    const reps = s.reps ?? 0;
    if (s.weight != null && reps > 0) {
      if (
        topWeight == null ||
        s.weight > topWeight ||
        (s.weight === topWeight && reps > (topWeightReps ?? 0))
      ) {
        topWeight = s.weight;
        topWeightReps = reps;
      }
      const e = epley1rm(s.weight, reps);
      if (e != null && (est1rm == null || e > est1rm)) est1rm = e;
      volume += s.weight * reps;
    }
    if (s.reps != null && (bestReps == null || s.reps > bestReps)) bestReps = s.reps;
    if (s.durationSec != null && (bestDuration == null || s.durationSec > bestDuration))
      bestDuration = s.durationSec;
  }
  return {
    date,
    sessionId,
    variationKey,
    topWeight,
    topWeightReps,
    bestReps,
    est1rm,
    volume: Math.round(volume * 10) / 10,
    bestDuration,
    sets,
  };
}

export function computePRs(points: ExercisePoint[]): ExercisePRs {
  const best = (
    pick: (p: ExercisePoint) => number | null,
    reps?: (p: ExercisePoint) => number | null,
  ): PersonalRecord | null => {
    let out: PersonalRecord | null = null;
    // Oldest first, strictly greater: the first time a record was set wins ties.
    for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
      const v = pick(p);
      if (v == null || v <= 0) continue;
      if (!out || v > out.value)
        out = { value: v, date: p.date, sessionId: p.sessionId, reps: reps?.(p) };
    }
    return out;
  };
  return {
    heaviest: best(
      (p) => p.topWeight,
      (p) => p.topWeightReps,
    ),
    mostReps: best((p) => p.bestReps),
    est1rm: best((p) => p.est1rm),
    volume: best((p) => p.volume),
    longest: best((p) => p.bestDuration),
  };
}

// ---------- Consistency ----------

export type DayStatus = 'trained' | 'rest' | 'missed' | 'planned' | 'none';

/**
 * Status of each date between `from` and `to` (inclusive).
 * - trained: a workout with at least one completed set
 * - rest: the plan's rest day (and no workout)
 * - missed: a past training day with no workout (only after `trackingStart`)
 * - planned: today or a future training day
 * - none: before tracking started / no plan
 */
export function dayStatuses(opts: {
  from: string;
  to: string;
  today: string;
  trainedDates: Set<string>;
  /** Weekday (0-6) -> plan day type, from the active plan. */
  planTypes: Map<number, 'train' | 'rest'> | null;
  trackingStart: string | null;
}): Map<string, DayStatus> {
  const out = new Map<string, DayStatus>();
  for (let d = opts.from; d <= opts.to; d = addDays(d, 1)) {
    const type = opts.planTypes?.get(weekdayOf(d));
    let status: DayStatus;
    if (opts.trainedDates.has(d)) status = 'trained';
    else if (!type || !opts.trackingStart || d < opts.trackingStart) status = 'none';
    else if (type === 'rest') status = 'rest';
    else status = d >= opts.today ? 'planned' : 'missed';
    out.set(d, status);
  }
  return out;
}

/**
 * Streak = training days in a row that were done. Rest days don't break it, and today
 * doesn't break it until it's over. Extra workouts on rest days count toward it.
 */
export function computeStreaks(opts: {
  today: string;
  trainedDates: Set<string>;
  planTypes: Map<number, 'train' | 'rest'> | null;
  trackingStart: string | null;
}): { current: number; best: number } {
  const { today, trainedDates, planTypes, trackingStart } = opts;
  if (!trackingStart) return { current: 0, best: 0 };
  let best = 0;
  let run = 0;
  for (let d = trackingStart; d <= today; d = addDays(d, 1)) {
    const isTrain = (planTypes?.get(weekdayOf(d)) ?? 'train') === 'train';
    if (trainedDates.has(d)) run++;
    else if (isTrain && d < today) run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** First date of the week containing `date`, for a given first weekday. */
export function weekStartOf(date: string, weekStartDay: number): string {
  return addDays(date, -((weekdayOf(date) - weekStartDay + 7) % 7));
}
