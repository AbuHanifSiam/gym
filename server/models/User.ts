import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { activityLevels, goals, sexes } from '../../shared/nutrition.js';
import type { UserProfile, UserSettings } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface UserFields {
  email: string;
  passwordHash: string;
  name: string;
  settings: UserSettings;
  profile: UserProfile;
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

// Body details for BMI and calorie needs. Weight comes from the body log.
const profileSchema = new Schema<UserProfile>(
  {
    sex: { type: String, enum: [...sexes, null], default: null },
    heightCm: { type: Number, default: null },
    birthDate: { type: String, default: null },
    activity: { type: String, enum: activityLevels, default: 'light' },
    goal: { type: String, enum: goals, default: 'maintain' },
  },
  { _id: false },
);

const userSchema = new Schema<UserFields>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    settings: { type: settingsSchema, default: () => ({}) },
    profile: { type: profileSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<UserFields>;
// The dev server hot-reloads this file but Mongoose keeps the first compiled model; replace it
// when the schema has gained fields since (otherwise e.g. user.profile is undefined until restart).
if (models.User && !models.User.schema.path('profile.activity')) mongoose.deleteModel('User');
export const User = (models.User as Model<UserFields>) || model<UserFields>('User', userSchema);
