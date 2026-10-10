import mongoose, { type Model, type Types } from 'mongoose';
import { meals, type FoodLogEntry } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface FoodLogFields extends Omit<FoodLogEntry, 'id'> {
  userId: Types.ObjectId;
  createdAt: Date;
}

const foodLogSchema = new Schema<FoodLogFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    meal: { type: String, enum: meals, default: 'snack' },
    foodId: { type: String, required: true },
    name: { type: String, required: true },
    portion: { type: String, default: '' },
    grams: { type: Number, required: true },
    kcal: { type: Number, required: true },
    protein: { type: Number, default: null },
    fat: { type: Number, default: null },
    carbs: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

foodLogSchema.index({ userId: 1, date: 1, createdAt: 1 });

export const FoodLogModel =
  (models.FoodLog as Model<FoodLogFields>) || model<FoodLogFields>('FoodLog', foodLogSchema);
