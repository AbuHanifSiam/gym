import { describe, expect, it } from 'vitest';
import { orderedDays, planInputSchema, weekdayNames } from '../shared/schemas.js';
import { seedExercises } from '../server/seed/exercises.js';
import { buildDefaultPlan } from '../server/seed/plan.js';

const fakeIds = new Map(
  seedExercises.map((e, i) => [e.name.toLowerCase(), i.toString(16).padStart(24, '0')]),
);

describe('default plan', () => {
  const plan = planInputSchema.parse(buildDefaultPlan(fakeIds));

  it('is valid and uses every exercise in the right order', () => {
    const sat = plan.days.find((d) => d.dayIndex === 6)!;
    expect(sat.items).toHaveLength(14);
    expect(sat.items.map((i) => i.exerciseId)).toEqual(
      seedExercises.slice(0, 14).map((e) => fakeIds.get(e.name.toLowerCase())),
    );
  });

  it('has Tuesday and Friday as rest days', () => {
    const rest = plan.days.filter((d) => d.type === 'rest').map((d) => weekdayNames[d.dayIndex]);
    expect(rest.sort()).toEqual(['Friday', 'Tuesday']);
  });

  it('uses the grip of the day, and every grip exists on its exercise', () => {
    const grips = new Map(
      seedExercises.map((e) => [
        fakeIds.get(e.name.toLowerCase()),
        new Set((e.variations ?? []).map((v) => v.key)),
      ]),
    );
    for (const day of plan.days)
      for (const item of day.items)
        if (item.variationKey)
          expect(grips.get(item.exerciseId)!.has(item.variationKey)).toBe(true);

    const lat = fakeIds.get('lat pulldown');
    const gripOn = (dayIndex: number) =>
      plan.days.find((d) => d.dayIndex === dayIndex)!.items.find((i) => i.exerciseId === lat)!
        .variationKey;
    expect([6, 0, 1, 3, 4].map(gripOn)).toEqual([
      'wide-overhand',
      'shoulder-overhand',
      'underhand',
      'neutral-v',
      'one-arm',
    ]);
  });

  it('orders days from Saturday', () => {
    expect(orderedDays(plan.days, 6).map((d) => d.label)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
      'Rest',
      'Day 4',
      'Day 5',
      'Rest',
    ]);
  });
});

describe('plan validation', () => {
  const day = (dayIndex: number) => ({ dayIndex, type: 'rest', items: [] });

  it('requires all 7 distinct weekdays', () => {
    const days = [0, 1, 2, 3, 4, 5, 5].map(day);
    expect(planInputSchema.safeParse({ name: 'x', days }).success).toBe(false);
  });

  it('strips exercises from rest days and rejects min > max reps', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map(day);
    const item = { exerciseId: 'a'.repeat(24), sets: 3, repsMin: 12, repsMax: 10 };
    expect(
      planInputSchema.safeParse({
        name: 'x',
        days: [{ ...days[0], type: 'train', items: [item] }, ...days.slice(1)],
      }).success,
    ).toBe(false);
    const ok = planInputSchema.parse({
      name: 'x',
      days: [
        { ...days[0], intensity: 'hard', items: [{ ...item, repsMax: 12 }] },
        ...days.slice(1),
      ],
    });
    expect(ok.days[0]).toMatchObject({ type: 'rest', intensity: null, items: [] });
  });
});
