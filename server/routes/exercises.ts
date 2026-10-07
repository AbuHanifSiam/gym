import mongoose from 'mongoose';
import { exerciseInputSchema, type Exercise } from '../../shared/schemas.js';
import { requireUserId } from '../auth.js';
import { ApiError, parse, type Route } from '../http.js';
import { ExerciseModel, type ExerciseFields } from '../models/Exercise.js';
import { PlanModel } from '../models/Plan.js';
import { backfillSeedImages, seedUserExercises } from '../seed/seedUser.js';

export type LeanExercise = ExerciseFields & { _id: mongoose.Types.ObjectId };
type Lean = LeanExercise;

export function toExercise(e: Lean): Exercise {
  return {
    id: String(e._id),
    name: e.name,
    category: e.category,
    equipment: e.equipment,
    measure: e.measure,
    heavyRest: e.heavyRest,
    muscles: e.muscles,
    steps: e.steps,
    variations: e.variations.map(({ key, name, description, works }) => ({
      key,
      name,
      description,
      works,
    })),
    images: (e.images ?? []).map(({ url, caption, variationKey }) => ({
      url,
      caption,
      variationKey,
    })),
    videoUrl: e.videoUrl,
    isSeed: e.isSeed,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function objectId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Exercise not found');
  return id;
}

async function assertNameFree(userId: string, name: string, exceptId?: string) {
  const clash = await ExerciseModel.exists({
    userId,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) {
    throw new ApiError(409, 'name_taken', 'You already have an exercise with this name', {
      name: 'Already exists',
    });
  }
}

export const exerciseRoutes: Route[] = [
  {
    method: 'GET',
    path: '/exercises',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const list = await ExerciseModel.find({ userId }).sort({ name: 1 }).lean<Lean[]>();
      await backfillSeedImages(list);
      res.json({ exercises: list.map(toExercise) });
    },
  },
  {
    method: 'POST',
    path: '/exercises',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const input = parse(exerciseInputSchema, req.body);
      await assertNameFree(userId, input.name);
      const doc = await ExerciseModel.create({ ...input, userId, isSeed: false });
      res.status(201).json({ exercise: toExercise(doc.toObject() as Lean) });
    },
  },
  {
    method: 'POST',
    path: '/exercises/seed',
    handler: async (req, res) => {
      const added = await seedUserExercises(requireUserId(req));
      res.json({ added });
    },
  },
  {
    method: 'GET',
    path: '/exercises/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const e = await ExerciseModel.findOne({ _id: objectId(id), userId }).lean<Lean>();
      if (!e) throw new ApiError(404, 'not_found', 'Exercise not found');
      res.json({ exercise: toExercise(e) });
    },
  },
  {
    method: 'PUT',
    path: '/exercises/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const input = parse(exerciseInputSchema, req.body);
      await assertNameFree(userId, input.name, objectId(id));
      const e = await ExerciseModel.findOneAndUpdate({ _id: id, userId }, input, {
        returnDocument: 'after',
        runValidators: true,
      }).lean<Lean>();
      if (!e) throw new ApiError(404, 'not_found', 'Exercise not found');
      res.json({ exercise: toExercise(e) });
    },
  },
  {
    method: 'DELETE',
    path: '/exercises/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const usedIn = await PlanModel.find(
        { userId, 'days.items.exerciseId': objectId(id) },
        { name: 1 },
      ).lean();
      if (usedIn.length) {
        throw new ApiError(
          409,
          'in_use',
          `Used in plan: ${usedIn.map((p) => p.name).join(', ')}. Remove it from the plan first.`,
        );
      }
      const r = await ExerciseModel.deleteOne({ _id: id, userId });
      if (r.deletedCount === 0) throw new ApiError(404, 'not_found', 'Exercise not found');
      res.json({ ok: true });
    },
  },
];
