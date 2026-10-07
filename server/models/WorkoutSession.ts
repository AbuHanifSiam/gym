import mongoose, { type Model, type Types } from 'mongoose';
import type { SessionInput, SessionSet } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

type StoredEntry = Omit<SessionInput['entries'][number], 'exerciseId'> & {
  exerciseId: Types.ObjectId;
};

export interface SessionFields extends Omit<
  SessionInput,
  'planId' | 'startedAt' | 'finishedAt' | 'entries'
> {
  userId: Types.ObjectId;
  /** Generated on the phone; the public id of the session. */
  clientId: string;
  planId: Types.ObjectId | null;
  startedAt: Date;
  finishedAt: Date | null;
  entries: StoredEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const setSchema = new Schema<SessionSet>(
  {
    setNumber: { type: Number, required: true },
    weight: { type: Number, default: null },
    reps: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const entrySchema = new Schema<StoredEntry>(
  {
    exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
    variationKey: { type: String, default: '' },
    target: {
      sets: Number,
      repsMin: { type: Number, default: null },
      repsMax: { type: Number, default: null },
      durationSec: { type: Number, default: null },
      notes: { type: String, default: '' },
    },
    sets: { type: [setSchema], default: [] },
  },
  { _id: false },
);

const sessionSchema = new Schema<SessionFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    date: { type: String, required: true },
    dayIndex: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    rev: { type: Number, required: true },
    entries: { type: [entrySchema], default: [] },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, date: -1 });
sessionSchema.index({ userId: 1, clientId: 1 }, { unique: true });
sessionSchema.index({ userId: 1, 'entries.exerciseId': 1, date: -1 });

export const SessionModel =
  (models.WorkoutSession as Model<SessionFields>) ||
  model<SessionFields>('WorkoutSession', sessionSchema);
