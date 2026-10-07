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
    imageUrl: optionalUrl,
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
