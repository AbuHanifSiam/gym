import type { Types } from 'mongoose';
import { ExerciseModel } from '../models/Exercise.js';
import { seedExercises } from './exercises.js';

/** Adds any default exercises the user doesn't have yet (matched by name). Safe to run repeatedly. */
export async function seedUserExercises(userId: Types.ObjectId | string): Promise<number> {
  const existing = await ExerciseModel.find({ userId }, { name: 1 }).lean();
  const have = new Set(existing.map((e) => e.name.toLowerCase()));
  const missing = seedExercises.filter((e) => !have.has(e.name.toLowerCase()));
  if (missing.length === 0) return 0;
  await ExerciseModel.insertMany(
    missing.map((e) => ({ ...e, userId, isSeed: true, imageUrl: '', videoUrl: '' })),
  );
  return missing.length;
}
