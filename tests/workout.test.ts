import { describe, expect, it } from 'vitest';
import type { PlanDay } from '../shared/schemas.js';
import { addDays, displayToKg, kgToDisplay, localDay, weekdayOf } from '../shared/time.js';
import {
  addEntry,
  addSet,
  buildSession,
  completeSet,
  formatDuration,
  isLastOpenSet,
  entriesToPlanItems,
  moveEntry,
  reorderEntry,
  removeEntry,
  removeLastSet,
  replaceEntry,
  sessionStats,
} from '../src/workout/session.js';

const day: PlanDay = {
  dayIndex: 6,
  label: 'Day 1',
  type: 'train',
  intensity: 'hard',
  items: [
    {
      exerciseId: 'a'.repeat(24),
      sets: 3,
      repsMin: 10,
      repsMax: 12,
      durationSec: null,
      variationKey: 'wide-overhand',
      notes: '',
    },
    {
      exerciseId: 'b'.repeat(24),
      sets: 2,
      repsMin: null,
      repsMax: null,
      durationSec: 30,
      variationKey: '',
      notes: '',
    },
  ],
};

describe('workout session', () => {
  const s = buildSession({ planId: null, date: '2026-10-10', day });

  it('builds one empty set per planned set and snapshots the target', () => {
    expect(s.entries.map((e) => e.sets.length)).toEqual([3, 2]);
    expect(s.entries[0].target).toMatchObject({ repsMin: 10, repsMax: 12 });
    expect(s.entries[0].variationKey).toBe('wide-overhand');
    expect(s.entries[0].sets.every((x) => !x.done)).toBe(true);
  });

  it('fills a ticked set from last time, else from the target', () => {
    const last = {
      date: '2026-10-08',
      variationKey: '',
      sets: [{ setNumber: 1, weight: 25, reps: 11, durationSec: null, done: true }],
    };
    const a = completeSet(s, 0, 0, last, false);
    expect(a.entries[0].sets[0]).toMatchObject({ done: true, weight: 25, reps: 11 });
    const b = completeSet(s, 0, 1, undefined, false);
    expect(b.entries[0].sets[1]).toMatchObject({ done: true, weight: null, reps: 12 });
    const c = completeSet(s, 1, 0, undefined, true);
    expect(c.entries[1].sets[0]).toMatchObject({ done: true, durationSec: 30 });
  });

  it('keeps values the user typed', () => {
    const typed = { ...s, entries: s.entries.map((e) => ({ ...e })) };
    typed.entries[0] = {
      ...typed.entries[0],
      sets: typed.entries[0].sets.map((x, i) => (i === 0 ? { ...x, weight: 30, reps: 8 } : x)),
    };
    const done = completeSet(typed, 0, 0, undefined, false);
    expect(done.entries[0].sets[0]).toMatchObject({ weight: 30, reps: 8, done: true });
  });

  it('adds sets carrying the weight forward, and removes the last set', () => {
    const withWeight = completeSet(
      s,
      0,
      2,
      {
        date: 'x',
        variationKey: '',
        sets: [{ setNumber: 3, weight: 40, reps: 10, durationSec: null, done: true }],
      },
      false,
    );
    const added = addSet(withWeight, 0);
    expect(added.entries[0].sets).toHaveLength(4);
    expect(added.entries[0].sets[3]).toMatchObject({ setNumber: 4, weight: 40, done: false });
    expect(removeLastSet(added, 0).entries[0].sets).toHaveLength(3);
  });

  it('computes stats and detects the final set', () => {
    let x = s;
    for (const [ei, si] of [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ] as const)
      x = completeSet(x, ei, si, undefined, ei === 1);
    expect(isLastOpenSet(x, 1, 1)).toBe(true);
    expect(isLastOpenSet(x, 0, 0)).toBe(false);
    expect(sessionStats(x)).toMatchObject({ totalSets: 5, doneSets: 4, doneExercises: 1 });
  });

  it('reorders entries and ignores moves past either end', () => {
    const ids = (x: typeof s) => x.entries.map((e) => e.exerciseId[0]);
    expect(ids(moveEntry(s, 0, 1))).toEqual(['b', 'a']);
    expect(ids(moveEntry(s, 1, -1))).toEqual(['b', 'a']);
    expect(moveEntry(s, 0, -1)).toBe(s);
    expect(moveEntry(s, 1, 1)).toBe(s);
  });

  it('drags an entry to any position', () => {
    const three = addEntry(s, { id: 'c'.repeat(24), measure: 'reps' });
    const ids = (x: typeof s) => x.entries.map((e) => e.exerciseId[0]);
    expect(ids(reorderEntry(three, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(reorderEntry(three, 2, 0))).toEqual(['c', 'a', 'b']);
    expect(reorderEntry(three, 1, 1)).toBe(three);
    expect(reorderEntry(three, 0, 5)).toBe(three);
  });

  it('turns the current list back into plan items, in order', () => {
    const x = reorderEntry(addEntry(s, { id: 'c'.repeat(24), measure: 'reps' }), 2, 0);
    const items = entriesToPlanItems(x);
    expect(items.map((i) => i.exerciseId[0])).toEqual(['c', 'a', 'b']);
    expect(items[1]).toMatchObject({ sets: 3, repsMin: 10, repsMax: 12 });
  });

  it('skips an entry for today', () => {
    const x = removeEntry(s, 0);
    expect(x.entries.map((e) => e.exerciseId)).toEqual(['b'.repeat(24)]);
    expect(s.entries).toHaveLength(2);
  });

  it('swaps an exercise, keeping the planned target when the kind matches', () => {
    const logged = completeSet(s, 0, 0, undefined, false);
    const x = replaceEntry(logged, 0, { id: 'c'.repeat(24), measure: 'reps' });
    expect(x.entries[0]).toMatchObject({ exerciseId: 'c'.repeat(24), variationKey: '' });
    expect(x.entries[0].target).toMatchObject({ sets: 3, repsMin: 10, repsMax: 12 });
    expect(x.entries[0].sets).toHaveLength(3);
    expect(x.entries[0].sets.every((y) => !y.done)).toBe(true);
  });

  it('gives sensible targets when swapping between timed and reps exercises', () => {
    const toTimed = replaceEntry(s, 0, { id: 'c'.repeat(24), measure: 'time' });
    expect(toTimed.entries[0].target).toMatchObject({ sets: 3, repsMax: null, durationSec: 30 });
    const toReps = replaceEntry(s, 1, { id: 'c'.repeat(24), measure: 'reps' });
    expect(toReps.entries[1].target).toMatchObject({ sets: 2, repsMin: 8, durationSec: null });
  });

  it('adds an extra exercise at the end', () => {
    const x = addEntry(s, { id: 'd'.repeat(24), measure: 'reps' });
    expect(x.entries).toHaveLength(3);
    expect(x.entries[2]).toMatchObject({ exerciseId: 'd'.repeat(24) });
    expect(x.entries[2].sets).toHaveLength(3);
  });

  it('formats durations', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('time helpers', () => {
  it('uses the user timezone for the date and weekday', () => {
    // 2026-10-09 20:30 UTC is already Saturday 2026-10-10 in Dhaka (UTC+6).
    const now = new Date('2026-10-09T20:30:00Z');
    expect(localDay('Asia/Dhaka', now)).toEqual({ date: '2026-10-10', dayIndex: 6 });
    expect(localDay('UTC', now)).toEqual({ date: '2026-10-09', dayIndex: 5 });
  });

  it('does date arithmetic and weekday lookup', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-10-10')).toBe(6);
  });

  it('converts units', () => {
    expect(kgToDisplay(20, 'lb')).toBe(44.1);
    expect(kgToDisplay(displayToKg(100, 'lb'), 'lb')).toBe(100);
    expect(displayToKg(22.5, 'kg')).toBe(22.5);
  });
});
