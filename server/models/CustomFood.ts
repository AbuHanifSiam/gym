import mongoose, { type Model, type Types } from 'mongoose';
import type { CustomFoodInput } from '../../shared/schemas.js';

const { Schema, model, models } = mongoose;

export interface CustomFoodFields extends CustomFoodInput {
  userId: Types.ObjectId;
}

/** Foods the user adds themselves (e.g. from a packet label). Values per 100 g. */
const customFoodSchema = new Schema<CustomFoodFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    kcal: { type: Number, required: true },
    protein: { type: Number, default: null },
    fat: { type: Number, default: null },
    carbs: { type: Number, default: null },
    fibre: { type: Number, default: null },
    portions: [{ _id: false, label: String, grams: Number }],
  },
  { timestamps: true },
);

export const CustomFoodModel =
  (models.CustomFood as Model<CustomFoodFields>) ||
  model<CustomFoodFields>('CustomFood', customFoodSchema);
