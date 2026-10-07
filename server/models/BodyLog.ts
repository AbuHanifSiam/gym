import mongoose, { type Model, type Types } from 'mongoose';
import type { BodyLogInput } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface BodyLogFields extends BodyLogInput {
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bodyLogSchema = new Schema<BodyLogFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    weight: { type: Number, default: null },
    measurements: {
      chest: { type: Number, default: null },
      waist: { type: Number, default: null },
      arm: { type: Number, default: null },
      thigh: { type: Number, default: null },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

// One entry per day.
bodyLogSchema.index({ userId: 1, date: -1 }, { unique: true });

export const BodyLogModel =
  (models.BodyLog as Model<BodyLogFields>) || model<BodyLogFields>('BodyLog', bodyLogSchema);
