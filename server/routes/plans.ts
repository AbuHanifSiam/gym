import mongoose, { type Types } from 'mongoose';
import {
  dayItemsSchema,
  planInputSchema,
  type Plan,
  type PlanInput,
  type PlanSummary,
} from '../../shared/schemas.js';
import { requireUserId } from '../auth.js';
import { ApiError, parse, type Route } from '../http.js';
import { ExerciseModel } from '../models/Exercise.js';
import { PlanModel, type PlanFields } from '../models/Plan.js';
import { buildDefaultPlan } from '../seed/plan.js';
import { seedUserExercises } from '../seed/seedUser.js';

export type LeanPlan = PlanFields & { _id: Types.ObjectId };
type Lean = LeanPlan;

export function toPlan(p: Lean): Plan {
  return {
    id: String(p._id),
    name: p.name,
    isActive: p.isActive,
    days: p.days.map((d) => ({
      dayIndex: d.dayIndex,
      label: d.label,
      type: d.type,
      intensity: d.intensity ?? null,
      items: d.items.map((i) => ({
        exerciseId: String(i.exerciseId),
        sets: i.sets,
        repsMin: i.repsMin ?? null,
        repsMax: i.repsMax ?? null,
        durationSec: i.durationSec ?? null,
        variationKey: i.variationKey,
        notes: i.notes,
      })),
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toSummary(p: Lean): PlanSummary {
  return {
    id: String(p._id),
    name: p.name,
    isActive: p.isActive,
    trainingDays: p.days.filter((d) => d.type === 'train').length,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function planId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Plan not found');
  return id;
}

/** Every exercise must be the user's own, and every grip must exist on that exercise. */
async function assertExercisesOwned(userId: string, input: PlanInput) {
  const ids = [...new Set(input.days.flatMap((d) => d.items.map((i) => i.exerciseId)))];
  if (ids.length === 0) return;
  const found = await ExerciseModel.find({ _id: { $in: ids }, userId }, { variations: 1 }).lean();
  const grips = new Map(found.map((e) => [String(e._id), new Set(e.variations.map((v) => v.key))]));
  input.days.forEach((d, di) =>
    d.items.forEach((item, ii) => {
      const keys = grips.get(item.exerciseId);
      if (!keys) {
        throw new ApiError(400, 'validation_error', 'An exercise in this plan no longer exists', {
          [`days.${di}.items.${ii}.exerciseId`]: 'Exercise not found',
        });
      }
      // A grip that was removed from the exercise falls back to "any grip".
      if (item.variationKey && !keys.has(item.variationKey)) item.variationKey = '';
    }),
  );
}

/** Creates the default plan for a user (and the default exercises it needs). */
export async function createDefaultPlan(userId: Types.ObjectId | string, activate: boolean) {
  await seedUserExercises(userId);
  const exercises = await ExerciseModel.find({ userId }, { name: 1 }).lean();
  const input = buildDefaultPlan(
    new Map(exercises.map((e) => [e.name.toLowerCase(), String(e._id)])),
  );
  if (activate) await PlanModel.updateMany({ userId }, { isActive: false });
  return PlanModel.create({ ...input, userId, isActive: activate });
}

async function findOwned(userId: string, id: string) {
  const p = await PlanModel.findOne({ _id: planId(id), userId }).lean<Lean>();
  if (!p) throw new ApiError(404, 'not_found', 'Plan not found');
  return p;
}

export const planRoutes: Route[] = [
  {
    method: 'GET',
    path: '/plans',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const plans = await PlanModel.find({ userId })
        .sort({ isActive: -1, updatedAt: -1 })
        .lean<Lean[]>();
      res.json({ plans: plans.map(toSummary) });
    },
  },
  {
    method: 'POST',
    path: '/plans',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const input = parse(planInputSchema, req.body);
      await assertExercisesOwned(userId, input);
      const hasActive = await PlanModel.exists({ userId, isActive: true });
      const doc = await PlanModel.create({ ...input, userId, isActive: !hasActive });
      res.status(201).json({ plan: toPlan(doc.toObject() as Lean) });
    },
  },
  {
    method: 'POST',
    path: '/plans/default',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const hasActive = await PlanModel.exists({ userId, isActive: true });
      const doc = await createDefaultPlan(userId, !hasActive);
      res.status(201).json({ plan: toPlan(doc.toObject() as Lean) });
    },
  },
  {
    method: 'GET',
    path: '/plans/:id',
    handler: async (req, res, { id }) => {
      res.json({ plan: toPlan(await findOwned(requireUserId(req), id)) });
    },
  },
  {
    method: 'PUT',
    path: '/plans/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const input = parse(planInputSchema, req.body);
      await assertExercisesOwned(userId, input);
      const p = await PlanModel.findOneAndUpdate({ _id: planId(id), userId }, input, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>();
      if (!p) throw new ApiError(404, 'not_found', 'Plan not found');
      res.json({ plan: toPlan(p) });
    },
  },
  {
    // Replaces one day's exercise list (and its order) without touching the rest of the plan.
    method: 'PUT',
    path: '/plans/:id/days/:dayIndex/items',
    handler: async (req, res, { id, dayIndex }) => {
      const userId = requireUserId(req);
      const day = Number(dayIndex);
      if (!Number.isInteger(day) || day < 0 || day > 6)
        throw new ApiError(404, 'not_found', 'Day not found');
      const { items } = parse(dayItemsSchema, req.body);
      await assertExercisesOwned(userId, {
        name: '-',
        days: [{ dayIndex: day, label: '', type: 'train', intensity: null, items }],
      });
      const p = await PlanModel.findOneAndUpdate(
        { _id: planId(id), userId },
        { $set: { 'days.$[d].items': items } },
        {
          arrayFilters: [{ 'd.dayIndex': day, 'd.type': 'train' }],
          returnDocument: 'after',
          runValidators: true,
        },
      ).lean<Lean>();
      if (!p) throw new ApiError(404, 'not_found', 'Plan not found');
      res.json({ plan: toPlan(p) });
    },
  },
  {
    method: 'DELETE',
    path: '/plans/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const p = await findOwned(userId, id);
      await PlanModel.deleteOne({ _id: p._id });
      // Keep one plan active if any remain.
      if (p.isActive) {
        const next = await PlanModel.findOne({ userId }).sort({ updatedAt: -1 });
        if (next) await PlanModel.updateOne({ _id: next._id }, { isActive: true });
      }
      res.json({ ok: true });
    },
  },
  {
    method: 'POST',
    path: '/plans/:id/activate',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const p = await findOwned(userId, id);
      await PlanModel.updateMany({ userId, _id: { $ne: p._id } }, { isActive: false });
      await PlanModel.updateOne({ _id: p._id }, { isActive: true });
      res.json({ ok: true });
    },
  },
  {
    method: 'POST',
    path: '/plans/:id/duplicate',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const p = await findOwned(userId, id);
      const doc = await PlanModel.create({
        userId,
        name: `${p.name} (copy)`.slice(0, 60),
        days: p.days,
        isActive: false,
      });
      res.status(201).json({ plan: toPlan(doc.toObject() as Lean) });
    },
  },
];
