import mongoose, { type HydratedDocument, type Model, type Types } from 'mongoose';
import { dayTypes, intensities, type PlanDay, type PlanItem } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

type StoredItem = Omit<PlanItem, 'exerciseId'> & { exerciseId: Types.ObjectId };
type StoredDay = Omit<PlanDay, 'items'> & { items: StoredItem[] };

export interface PlanFields {
  userId: Types.ObjectId;
  name: string;
  isActive: boolean;
  days: StoredDay[];
  createdAt: Date;
  updatedAt: Date;
}

// Item order within a day is the array order.
const itemSchema = new Schema<StoredItem>(
  {
    exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
    sets: { type: Number, required: true },
    repsMin: { type: Number, default: null },
    repsMax: { type: Number, default: null },
    durationSec: { type: Number, default: null },
    variationKey: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false },
);

const daySchema = new Schema<StoredDay>(
  {
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    label: { type: String, default: '' },
    type: { type: String, enum: dayTypes, required: true },
    intensity: { type: String, enum: [...intensities, null], default: null },
    items: { type: [itemSchema], default: [] },
  },
  { _id: false },
);

const planSchema = new Schema<PlanFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    days: { type: [daySchema], default: [] },
  },
  { timestamps: true },
);

export type PlanDocument = HydratedDocument<PlanFields>;
export const PlanModel =
  (models.Plan as Model<PlanFields>) || model<PlanFields>('Plan', planSchema);
