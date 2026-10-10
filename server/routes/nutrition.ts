import mongoose, { type Types } from 'mongoose';
import { z } from 'zod';
import { gramsOf, kcalFor, type FoodSeed } from '../../shared/nutrition.js';
import {
  customFoodSchema,
  dateString,
  foodLogInputSchema,
  profileUpdateSchema,
  type FoodLogEntry,
} from '../../shared/schemas.js';
import { requireUser, requireUserId, toPublicUser } from '../auth.js';
import { searchFoods, seedFood } from '../foods.js';
import { ApiError, parse, type Route } from '../http.js';
import { CustomFoodModel, type CustomFoodFields } from '../models/CustomFood.js';
import { FoodLogModel, type FoodLogFields } from '../models/FoodLog.js';
import { seedFoods } from '../seed/foods.js';

export type LeanCustom = CustomFoodFields & { _id: Types.ObjectId };
export type LeanLog = FoodLogFields & { _id: Types.ObjectId };

export function toFood(c: LeanCustom): FoodSeed {
  return {
    id: String(c._id),
    name: c.name,
    local: '',
    group: 'My foods',
    source: 'custom',
    kcal: c.kcal,
    protein: c.protein ?? null,
    fat: c.fat ?? null,
    carbs: c.carbs ?? null,
    fibre: c.fibre ?? null,
    portions: (c.portions ?? []).map((p) => ({ label: p.label, grams: p.grams })),
  };
}

export function toEntry(l: LeanLog): FoodLogEntry {
  return {
    id: String(l._id),
    date: l.date,
    meal: l.meal,
    foodId: l.foodId,
    name: l.name,
    portion: l.portion ?? '',
    grams: l.grams,
    kcal: l.kcal,
    protein: l.protein ?? null,
    fat: l.fat ?? null,
    carbs: l.carbs ?? null,
  };
}

async function findFood(userId: string, id: string): Promise<FoodSeed> {
  const seed = seedFood(id);
  if (seed) return seed;
  if (mongoose.isValidObjectId(id)) {
    const c = await CustomFoodModel.findOne({ _id: id, userId }).lean<LeanCustom>();
    if (c) return toFood(c);
  }
  throw new ApiError(404, 'not_found', 'Food not found');
}

const searchQuery = z.object({ q: z.string().max(80).default('') });
const dateQuery = z.object({ date: dateString });

export const nutritionRoutes: Route[] = [
  {
    method: 'PUT',
    path: '/profile',
    handler: async (req, res) => {
      const user = await requireUser(req);
      const update = parse(profileUpdateSchema, req.body);
      Object.assign(user.profile, update);
      await user.save();
      res.json({ user: toPublicUser(user) });
    },
  },
  {
    // Looking a food up never logs it; that's POST /food-log.
    method: 'GET',
    path: '/foods',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const { q } = parse(searchQuery, req.query);
      const custom = await CustomFoodModel.find({ userId }).limit(500).lean<LeanCustom[]>();
      res.json({ foods: searchFoods([...custom.map(toFood), ...seedFoods], q) });
    },
  },
  {
    method: 'GET',
    path: '/foods/:id',
    handler: async (req, res, { id }) => {
      res.json({ food: await findFood(requireUserId(req), id) });
    },
  },
  {
    method: 'POST',
    path: '/foods',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const input = parse(customFoodSchema, req.body);
      const doc = await CustomFoodModel.create({ ...input, userId });
      res.status(201).json({ food: toFood(doc.toObject() as LeanCustom) });
    },
  },
  {
    method: 'DELETE',
    path: '/foods/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Food not found');
      const r = await CustomFoodModel.deleteOne({ _id: id, userId });
      if (r.deletedCount === 0) throw new ApiError(404, 'not_found', 'Food not found');
      res.json({ ok: true });
    },
  },
  {
    method: 'GET',
    path: '/food-log',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const { date } = parse(dateQuery, req.query);
      const logs = await FoodLogModel.find({ userId, date })
        .sort({ createdAt: 1 })
        .limit(300)
        .lean<LeanLog[]>();
      res.json({ entries: logs.map(toEntry) });
    },
  },
  {
    method: 'POST',
    path: '/food-log',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const input = parse(foodLogInputSchema, req.body);
      const food = await findFood(userId, input.foodId);
      // Calories are computed here from the source values, never taken from the client.
      const doc = await FoodLogModel.create({
        ...input,
        userId,
        name: food.name,
        kcal: kcalFor(food.kcal, input.grams),
        protein: gramsOf(food.protein, input.grams),
        fat: gramsOf(food.fat, input.grams),
        carbs: gramsOf(food.carbs, input.grams),
      });
      res.status(201).json({ entry: toEntry(doc.toObject() as LeanLog) });
    },
  },
  {
    method: 'DELETE',
    path: '/food-log/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Entry not found');
      const r = await FoodLogModel.deleteOne({ _id: id, userId });
      if (r.deletedCount === 0) throw new ApiError(404, 'not_found', 'Entry not found');
      res.json({ ok: true });
    },
  },
];
