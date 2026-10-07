import mongoose, { type HydratedDocument, type Model, type Types } from 'mongoose';
import { categories, equipments, measures, type ExerciseInput } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface ExerciseFields extends ExerciseInput {
  userId: Types.ObjectId;
  isSeed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const variationSchema = new Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    works: { type: String, default: '' },
  },
  { _id: false },
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    variationKey: { type: String, default: '' },
  },
  { _id: false },
);

const exerciseSchema = new Schema<ExerciseFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: categories, required: true },
    equipment: { type: String, enum: equipments, required: true },
    measure: { type: String, enum: measures, default: 'reps' },
    heavyRest: { type: Boolean, default: false },
    muscles: { type: [String], default: [] },
    steps: { type: [String], default: [] },
    variations: { type: [variationSchema], default: [] },
    images: { type: [imageSchema], default: [] },
    videoUrl: { type: String, default: '' },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

exerciseSchema.index({ userId: 1, name: 1 });

export type ExerciseDocument = HydratedDocument<ExerciseFields>;
export const ExerciseModel =
  (models.Exercise as Model<ExerciseFields>) || model<ExerciseFields>('Exercise', exerciseSchema);
