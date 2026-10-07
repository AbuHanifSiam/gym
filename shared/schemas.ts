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
