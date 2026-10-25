import {
  planTemplateNames,
  type PlanDay,
  type PlanInput,
  type PlanItem,
  type PlanTemplateKey,
} from '../../shared/schemas.js';

export const DEFAULT_PLAN_NAME = planTemplateNames.beginner;

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

// ---- Dumbbell Only 5-Day (muscleandstrength.com 5-day dumbbell split + 15-minute warm-ups) ----

/** Shorthand for an item; `reps` is [min, max] or a fixed number. */
function item(
  exercise: string,
  sets: number,
  reps: number | [number, number],
  notes = '',
  variationKey = '',
): ItemSeed {
  const [repsMin, repsMax] = typeof reps === 'number' ? [reps, reps] : reps;
  return { exercise, sets, repsMin, repsMax, variationKey, notes };
}

function timed(exercise: string, sets: number, durationSec: number, notes = ''): ItemSeed {
  return { exercise, sets, durationSec, variationKey: '', notes };
}

const WARM = 'Warm-up';

function upperWarmup(): ItemSeed[] {
  return [
    timed('Fast-paced walk', 1, 180, `${WARM}: 3 minutes`),
    item('Push-ups', 1, 15, WARM, 'standard'),
    item('Back push-up', 1, 15, `${WARM}: bench dips`, 'bench-dips'),
    item('Arm circles', 2, 15, `${WARM}: set 1 clockwise, set 2 counter-clockwise`),
    item('Pull-up practice', 1, 5, `${WARM}: lower slowly`, 'negative'),
    item('Seated Zottman curl', 1, 15, WARM),
    item('90/90 hip crossover', 1, 15, `${WARM}: per side`),
    item('Sit-up', 1, 15, WARM),
    item('Jump squats', 1, 15, WARM),
  ];
}

function lowerWarmup(): ItemSeed[] {
  return [
    timed('Fast-paced walk', 1, 180, `${WARM}: 3 minutes`),
    item('Bodyweight calf raise', 1, 15, WARM),
    timed('IT band foam roll', 1, 30, `${WARM}: per side`),
    item('Bodyweight single-leg deadlift', 1, 15, `${WARM}: per side`),
    item('Prisoner squat', 1, 15, WARM),
    timed('Prisoner squat hold', 1, 30, WARM),
    timed('Superman', 1, 30, WARM),
    timed('Plank', 1, 30, WARM),
    item('Band pull-apart', 1, 15, WARM),
  ];
}

const latPulldown = (grip: string) => item('Lat pulldown', 3, [10, 12], '', grip);
const seatedRow = (grip: string) => item('Seated cable row', 3, [10, 12], '', grip);

const dumbbellDays: DaySeed[] = [
  {
    dayIndex: 6,
    label: 'Day 1 · Chest, Shoulders & Triceps',
    type: 'train',
    intensity: 'hard',
    items: [
      ...upperWarmup(),
      item('Dumbbell bench press', 5, [8, 10]),
      item('Incline dumbbell bench press', 4, [8, 10]),
      item('Dumbbell floor press', 3, [8, 12]),
      item('Dumbbell shoulder press', 4, [8, 10], 'Standing'),
      item('Dumbbell side raise', 3, [8, 12]),
      item('Dumbbell tricep kickback', 3, [8, 12]),
      latPulldown('wide-overhand'),
    ],
  },
  {
    dayIndex: 0,
    label: 'Day 2 · Legs & Core',
    type: 'train',
    intensity: 'hard',
    items: [
      ...lowerWarmup(),
      item('Dumbbell goblet squat', 4, [8, 10]),
      item('Dumbbell stiff-leg deadlift', 4, [8, 10]),
      item('Dumbbell rear lunge', 4, [8, 10], 'Per leg'),
      item('Dumbbell frog squat', 3, [8, 12]),
      item('Dumbbell calf raise', 4, 20),
      seatedRow('v-handle'),
      item('Weighted crunch', 3, 20),
      timed('Side plank', 3, 20, 'Per side'),
    ],
  },
  {
    dayIndex: 1,
    label: 'Day 3 · Back & Biceps',
    type: 'train',
    intensity: 'moderate',
    items: [
      ...upperWarmup(),
      item('Dumbbell bent-over row', 4, [8, 12], '', 'overhand'),
      item('One-arm dumbbell row', 4, [8, 12], 'Per side', 'tripod'),
      item('Dumbbell pullover', 3, [8, 12]),
      item('Dumbbell bent-over row', 4, [8, 12], 'Reverse grip', 'reverse'),
      latPulldown('underhand'),
      seatedRow('wide-bar'),
      item('Dumbbell bicep curl', 3, [10, 15]),
      item('Dumbbell hammer curl', 3, [10, 15]),
    ],
  },
  rest(2),
  {
    dayIndex: 3,
    label: 'Day 4 · Legs & Core',
    type: 'train',
    intensity: 'hard',
    items: [
      ...lowerWarmup(),
      item('Dumbbell squat', 4, [8, 10]),
      item('Dumbbell deadlift', 4, [8, 10]),
      item('Dumbbell split squat', 3, [8, 12], 'Per leg'),
      item('Dumbbell hip thrust', 4, [10, 15]),
      item('Dumbbell calf raise', 4, 20),
      seatedRow('rope'),
      item('Dumbbell side bend', 3, 15, 'Per side'),
      timed('Plank', 3, 20),
    ],
  },
  {
    dayIndex: 4,
    label: 'Day 5 · Complete Upper Body',
    type: 'train',
    intensity: 'moderate',
    items: [
      ...upperWarmup(),
      item('One-arm dumbbell row', 4, [8, 10], 'Per side', 'bench'),
      item('Dumbbell Arnold press', 4, [8, 10]),
      item('Incline dumbbell bench press', 4, [8, 12]),
      item('Chest-supported dumbbell row', 3, [8, 12]),
      latPulldown('neutral-v'),
      item('Dumbbell pinwheel curl', 2, [8, 12]),
      item('Overhead dumbbell tricep extension', 3, [8, 12]),
      item('Dumbbell shrug', 3, [12, 15]),
    ],
  },
  rest(5),
];

export const planTemplateDays: Record<PlanTemplateKey, DaySeed[]> = {
  beginner: defaultDays,
  dumbbell: dumbbellDays,
};

/** Builds a built-in plan using the user's exercise ids (looked up by name). */
export function buildPlan(template: PlanTemplateKey, idByName: Map<string, string>): PlanInput {
  const days = planTemplateDays[template];
  return {
    name: planTemplateNames[template],
    days: days.map((d) => ({
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

/** Builds the default plan using the user's exercise ids (looked up by name). */
export function buildDefaultPlan(idByName: Map<string, string>): PlanInput {
  return buildPlan('beginner', idByName);
}
