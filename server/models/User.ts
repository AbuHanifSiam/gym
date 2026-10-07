import mongoose, { type HydratedDocument, type Model } from 'mongoose';

import type { UserSettings } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface UserFields {
  email: string;
  passwordHash: string;
  name: string;
  settings: UserSettings;
}

const settingsSchema = new Schema<UserSettings>(
  {
    timezone: { type: String, default: 'Asia/Dhaka' },
    weekStartDay: { type: Number, default: 6, min: 0, max: 6 }, // Saturday
    units: { type: String, enum: ['kg', 'lb'], default: 'kg' },
    restTimerDefault: { type: Number, default: 60 },
    restTimerHeavy: { type: Number, default: 90 },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  },
  { _id: false },
);

const userSchema = new Schema<UserFields>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<UserFields>;
export const User = (models.User as Model<UserFields>) || model<UserFields>('User', userSchema);
