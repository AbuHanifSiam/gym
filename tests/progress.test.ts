import { describe, expect, it } from 'vitest';
import {
  computePRs,
  computeStreaks,
  dayStatuses,
  epley1rm,
  summarizeSets,
  weekStartOf,
} from '../shared/progress.js';

const set = (setNumber: number, weight: number | null, reps: number | null, done = true) => ({
  setNumber,
  weight,
  reps,
  durationSec: null,
  done,
});

describe('exercise progress', () => {
  it('summarizes only completed sets', () => {
    const p = summarizeSets('2026-10-01', 's1', '', [
      set(1, 40, 12),
      set(2, 45, 10),
      set(3, 60, 10, false),
    ])!;
    expect(p).toMatchObject({ topWeight: 45, topWeightReps: 10, bestReps: 12, volume: 930 });
    expect(p.est1rm).toBe(epley1rm(45, 10));
    expect(summarizeSets('2026-10-01', 's1', '', [set(1, 40, 12, false)])).toBeNull();
  });

  it('estimates 1RM only for 1-12 reps', () => {
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(60, 10)).toBe(80);
    expect(epley1rm(60, 15)).toBeNull();
    expect(epley1rm(0, 5)).toBeNull();
  });

  it('finds PRs and keeps the first date on ties', () => {
    const a = summarizeSets('2026-10-01', 'a', '', [set(1, 40, 10)])!;
    const b = summarizeSets('2026-10-03', 'b', '', [set(1, 45, 8)])!;
    const c = summarizeSets('2026-10-05', 'c', '', [set(1, 45, 6), set(2, 20, 20)])!;
    const prs = computePRs([c, a, b]);
    expect(prs.heaviest).toMatchObject({ value: 45, date: '2026-10-03', reps: 8 });
    expect(prs.mostReps).toMatchObject({ value: 20, date: '2026-10-05' });
    expect(prs.longest).toBeNull();
  });
});

describe('consistency', () => {
  // Plan: Tue (2) and Fri (5) rest, everything else training.
  const planTypes = new Map<number, 'train' | 'rest'>(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, d === 2 || d === 5 ? 'rest' : 'train']),
  );

  it('classifies days', () => {
    // 2026-10-03 is a Saturday.
    const st = dayStatuses({
      from: '2026-10-01',
      to: '2026-10-08',
      today: '2026-10-07',
      trainedDates: new Set(['2026-10-03', '2026-10-05']),
      planTypes,
      trackingStart: '2026-10-03',
    });
    expect(Object.fromEntries(st)).toEqual({
      '2026-10-01': 'none', // before tracking
      '2026-10-02': 'none',
      '2026-10-03': 'trained', // Sat
      '2026-10-04': 'missed', // Sun
      '2026-10-05': 'trained', // Mon
      '2026-10-06': 'rest', // Tue
      '2026-10-07': 'planned', // Wed, today
      '2026-10-08': 'planned', // Thu
    });
  });

  it('rest days and today do not break a streak; a missed training day does', () => {
    const trained = new Set(['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-07']);
    // Tue 06 is rest; today is Thu 08 (not done yet).
    expect(
      computeStreaks({
        today: '2026-10-08',
        trainedDates: trained,
        planTypes,
        trackingStart: '2026-10-03',
      }),
    ).toEqual({ current: 4, best: 4 });
    // Thu 08 is over and was missed -> streak resets on Sat 10.
    expect(
      computeStreaks({
        today: '2026-10-10',
        trainedDates: trained,
        planTypes,
        trackingStart: '2026-10-03',
      }),
    ).toEqual({ current: 0, best: 4 });
  });

  it('finds the start of the week', () => {
    expect(weekStartOf('2026-10-07', 6)).toBe('2026-10-03'); // Wed -> Sat
    expect(weekStartOf('2026-10-03', 6)).toBe('2026-10-03');
    expect(weekStartOf('2026-10-07', 0)).toBe('2026-10-04'); // -> Sun
  });
});
