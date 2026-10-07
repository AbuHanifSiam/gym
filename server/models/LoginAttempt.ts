import mongoose, { type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

export const LOCKOUT_WINDOW_SEC = 15 * 60;

interface LoginAttemptFields {
  key: string;
  createdAt: Date;
}

// Failed logins, auto-removed by a TTL index after the lockout window.
const loginAttemptSchema = new Schema<LoginAttemptFields>({
  key: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, expires: LOCKOUT_WINDOW_SEC },
});

export const LoginAttempt =
  (models.LoginAttempt as Model<LoginAttemptFields>) ||
  model<LoginAttemptFields>('LoginAttempt', loginAttemptSchema);
