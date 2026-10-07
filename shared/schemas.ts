import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email')),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const themes = ['light', 'dark', 'system'] as const;
export const units = ['kg', 'lb'] as const;

export interface UserSettings {
  timezone: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekStartDay: number;
  units: (typeof units)[number];
  restTimerDefault: number;
  restTimerHeavy: number;
  theme: (typeof themes)[number];
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  settings: UserSettings;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

// ---------- Exercises ----------

export const categories = ['push', 'pull', 'legs', 'core', 'cardio', 'mobility'] as const;
export const equipments = [
  'machine',
  'dumbbell',
  'bodyweight',
  'cable',
  'barbell',
  'other',
] as const;
export const measures = ['reps', 'time'] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must start with http:// or https://')
  .default('');

export const variationSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes'),
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(500).default(''),
  works: z.string().trim().max(200).default(''),
});
export type Variation = z.infer<typeof variationSchema>;

export const exerciseImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Image URL is required')
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), 'Must start with http:// or https://'),
  caption: z.string().trim().max(80).default(''),
  /** Optional: the grip/variation this picture shows. Empty = general. */
  variationKey: z.string().trim().max(40).default(''),
});
export type ExerciseImage = z.infer<typeof exerciseImageSchema>;

export const exerciseInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    category: z.enum(categories),
    equipment: z.enum(equipments),
    measure: z.enum(measures).default('reps'),
    /** Use the longer "heavy" rest timer (squats, machines). */
    heavyRest: z.boolean().default(false),
    muscles: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    steps: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    variations: z.array(variationSchema).max(12).default([]),
    images: z.array(exerciseImageSchema).max(20).default([]),
    videoUrl: optionalUrl,
  })
  .refine((e) => new Set(e.variations.map((v) => v.key)).size === e.variations.length, {
    message: 'Variation keys must be unique',
    path: ['variations'],
  });
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export interface Exercise extends ExerciseInput {
  id: string;
  isSeed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Settings ----------

export const settingsUpdateSchema = z
  .object({
    timezone: z
      .string()
      .trim()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown timezone'),
    weekStartDay: z.number().int().min(0).max(6),
    units: z.enum(units),
    restTimerDefault: z.number().int().min(10).max(600),
    restTimerHeavy: z.number().int().min(10).max(600),
    theme: z.enum(themes),
  })
  .partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

// ---------- Plans ----------

/** 0 = Sunday ... 6 = Saturday (same as JavaScript's Date.getDay()). */
export const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const dayTypes = ['train', 'rest'] as const;
export const intensities = ['hard', 'moderate'] as const;

const optionalInt = (max: number) => z.number().int().min(0).max(max).nullable().default(null);

export const planItemSchema = z
  .object({
    exerciseId: z.string().regex(/^[a-f0-9]{24}$/, 'Pick an exercise'),
    sets: z.number().int().min(1, 'At least 1 set').max(20),
    /** null + null = "max reps" */
    repsMin: optionalInt(200),
    repsMax: optionalInt(200),
    /** For timed exercises (plank, warm-up). */
    durationSec: optionalInt(3600),
    variationKey: z.string().trim().max(40).default(''),
    notes: z.string().trim().max(200).default(''),
  })
  .refine((i) => i.repsMin == null || i.repsMax == null || i.repsMin <= i.repsMax, {
    message: 'Min reps must not be more than max reps',
    path: ['repsMax'],
  });
export type PlanItem = z.infer<typeof planItemSchema>;

export const planDaySchema = z
  .object({
    dayIndex: z.number().int().min(0).max(6),
    label: z.string().trim().max(40).default(''),
    type: z.enum(dayTypes),
    intensity: z.enum(intensities).nullable().default(null),
    items: z.array(planItemSchema).max(40).default([]),
  })
  .transform((d) =>
    // Rest days carry no exercises or intensity.
    d.type === 'rest' ? { ...d, intensity: null, items: [] } : d,
  );
export type PlanDay = z.infer<typeof planDaySchema>;

export const planInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  days: z
    .array(planDaySchema)
    .length(7, 'A plan needs all 7 days')
    .refine((days) => new Set(days.map((d) => d.dayIndex)).size === 7, 'Each weekday once'),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export interface Plan extends PlanInput {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  isActive: boolean;
  trainingDays: number;
  updatedAt: string;
}

/** Days ordered from the user's chosen first weekday. */
export function orderedDays<T extends { dayIndex: number }>(days: T[], weekStartDay: number): T[] {
  return [...days].sort(
    (a, b) => ((a.dayIndex - weekStartDay + 7) % 7) - ((b.dayIndex - weekStartDay + 7) % 7),
  );
}

export function emptyWeek(): PlanDay[] {
  return weekdayNames.map((_, dayIndex) => ({
    dayIndex,
    label: '',
    type: 'rest' as const,
    intensity: null,
    items: [],
  }));
}

// ---------- Workout sessions ----------

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const isoDateTime = z.iso.datetime({ offset: true });

export const sessionSetSchema = z.object({
  setNumber: z.number().int().min(1).max(50),
  /** Always stored in kg; null = bodyweight / not entered. */
  weight: z.number().min(0).max(2000).nullable().default(null),
  reps: z.number().int().min(0).max(1000).nullable().default(null),
  durationSec: z.number().int().min(0).max(36000).nullable().default(null),
  done: z.boolean().default(false),
});
export type SessionSet = z.infer<typeof sessionSetSchema>;

export const sessionTargetSchema = z.object({
  sets: z.number().int().min(0).max(50),
  repsMin: z.number().int().min(0).max(1000).nullable().default(null),
  repsMax: z.number().int().min(0).max(1000).nullable().default(null),
  durationSec: z.number().int().min(0).max(36000).nullable().default(null),
  notes: z.string().max(200).default(''),
});

export const sessionEntrySchema = z.object({
  exerciseId: z.string().regex(/^[a-f0-9]{24}$/),
  variationKey: z.string().max(40).default(''),
  /** Snapshot of the plan's target when the workout started. */
  target: sessionTargetSchema,
  sets: z.array(sessionSetSchema).max(50),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

export const sessionInputSchema = z.object({
  planId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullable()
    .default(null),
  date: dateString,
  dayIndex: z.number().int().min(0).max(6),
  startedAt: isoDateTime,
  finishedAt: isoDateTime.nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
  /** Increases with every local change; the server ignores older revisions. */
  rev: z.number().int().min(0),
  entries: z.array(sessionEntrySchema).max(60),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

/** Session ids are generated on the phone so workouts can start offline. */
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);

export interface WorkoutSession extends SessionInput {
  id: string;
  updatedAt: string;
}

export interface LastPerformance {
  date: string;
  variationKey: string;
  sets: SessionSet[];
}

export interface TodayResponse {
  /** Today's date and weekday in the user's timezone. */
  date: string;
  todayIndex: number;
  /** The weekday being shown (today unless another day was picked). */
  dayIndex: number;
  plan: {
    id: string;
    name: string;
    days: Pick<PlanDay, 'dayIndex' | 'label' | 'type' | 'intensity'>[];
  } | null;
  day: PlanDay | null;
  exercises: Exercise[];
  last: Record<string, LastPerformance>;
  session: WorkoutSession | null;
}
