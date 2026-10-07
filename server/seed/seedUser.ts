import type { Types } from 'mongoose';
import type { ExerciseImage } from '../../shared/schemas.js';
import { ExerciseModel } from '../models/Exercise.js';
import { seedExercises, seedImages } from './exercises.js';

/** Adds any default exercises the user doesn't have yet (matched by name). Safe to run repeatedly. */
export async function seedUserExercises(userId: Types.ObjectId | string): Promise<number> {
  const existing = await ExerciseModel.find({ userId }, { name: 1 }).lean();
  const have = new Set(existing.map((e) => e.name.toLowerCase()));
  const missing = seedExercises.filter((e) => !have.has(e.name.toLowerCase()));
  if (missing.length === 0) return 0;
  await ExerciseModel.insertMany(
    missing.map((e) => ({
      ...e,
      userId,
      isSeed: true,
      images: seedImages[e.name] ?? [],
      videoUrl: '',
    })),
  );
  return missing.length;
}

/**
 * Seed exercises created before photos existed get the default photos. Mutates the given
 * list in place so the caller can return it straight away.
 */
export async function backfillSeedImages<
  T extends { _id: Types.ObjectId; name: string; isSeed: boolean; images?: ExerciseImage[] },
>(list: T[]): Promise<void> {
  const todo = list.filter((e) => e.isSeed && !e.images?.length && seedImages[e.name]);
  if (todo.length === 0) return;
  await ExerciseModel.bulkWrite(
    todo.map((e) => ({
      updateOne: { filter: { _id: e._id }, update: { $set: { images: seedImages[e.name] } } },
    })),
  );
  for (const e of todo) e.images = seedImages[e.name];
}
