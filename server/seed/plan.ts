import type { PlanDay, PlanInput, PlanItem } from '../../shared/schemas.js';

export const DEFAULT_PLAN_NAME = 'Beginner Month 1';

type ItemSeed = Omit<PlanItem, 'exerciseId' | 'repsMin' | 'repsMax' | 'durationSec' | 'notes'> & {
  exercise: string;
  repsMin?: number | null;
  repsMax?: number | null;
  durationSec?: number | null;
  notes?: string;
};

function trainingItems(latGrip: string, rowGrip: string): ItemSeed[] {
  return [
    { exercise: 'Warm-up', sets: 1, durationSec: 300, variationKey: '', notes: '5 minutes' },
    { exercise: 'Squats', sets: 3, repsMin: 12, repsMax: 15, variationKey: '' },
    {
      exercise: 'Push-ups',
      sets: 3,
      variationKey: 'standard',
      notes: 'Max reps with good form',
    },
    { exercise: 'Pull-up practice', sets: 3, repsMin: 3, repsMax: 5, variationKey: 'assisted' },
    {
      exercise: 'Dumbbell shoulder press',
      sets: 3,
      repsMin: 10,
      repsMax: 10,
      variationKey: '',
      notes: 'Light',
    },
    { exercise: 'Dumbbell side raise', sets: 3, repsMin: 10, repsMax: 12, variationKey: '' },
    { exercise: 'Dumbbell front raise', sets: 2, repsMin: 10, repsMax: 12, variationKey: '' },
    { exercise: 'Back push-up', sets: 3, repsMin: 8, repsMax: 10, variationKey: '' },
    {
      exercise: 'Dumbbell side bend',
      sets: 3,
      repsMin: 10,
      repsMax: 10,
      variationKey: '',
      notes: 'Per side',
    },
    { exercise: 'Lat pulldown', sets: 3, repsMin: 10, repsMax: 12, variationKey: latGrip },
    { exercise: 'Seated cable row', sets: 3, repsMin: 10, repsMax: 12, variationKey: rowGrip },
    { exercise: 'Lying leg raises', sets: 3, repsMin: 8, repsMax: 10, variationKey: '' },
    { exercise: 'Plank', sets: 3, durationSec: 30, variationKey: '' },
    { exercise: 'Stretching', sets: 1, durationSec: 300, variationKey: '', notes: '5 minutes' },
  ];
}

type DaySeed = Omit<PlanDay, 'items'> & { items: ItemSeed[] };

const train = (
  dayIndex: number,
  label: string,
  intensity: 'hard' | 'moderate',
  lat: string,
  row: string,
): DaySeed => ({ dayIndex, label, type: 'train', intensity, items: trainingItems(lat, row) });
const rest = (dayIndex: number): DaySeed => ({
  dayIndex,
  label: 'Rest',
  type: 'rest',
  intensity: null,
  items: [],
});

// Week starts Saturday (6). Tuesday (2) and Friday (5) are rest days.
const defaultDays: DaySeed[] = [
  train(6, 'Day 1', 'hard', 'wide-overhand', 'v-handle'),
  train(0, 'Day 2', 'moderate', 'shoulder-overhand', 'wide-bar'),
  train(1, 'Day 3', 'moderate', 'underhand', 'underhand-bar'),
  rest(2),
  train(3, 'Day 4', 'hard', 'neutral-v', 'rope'),
  train(4, 'Day 5', 'moderate', 'one-arm', 'one-arm'),
  rest(5),
];

/** Builds the default plan using the user's exercise ids (looked up by name). */
export function buildDefaultPlan(idByName: Map<string, string>): PlanInput {
  return {
    name: DEFAULT_PLAN_NAME,
    days: defaultDays.map((d) => ({
      ...d,
      items: d.items
        .filter((i) => idByName.has(i.exercise.toLowerCase()))
        .map(({ exercise, ...i }) => ({
          exerciseId: idByName.get(exercise.toLowerCase())!,
          repsMin: null,
          repsMax: null,
          durationSec: null,
          notes: '',
          ...i,
        })),
    })),
  };
}
