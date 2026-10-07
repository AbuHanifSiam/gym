import type { Types } from 'mongoose';
import {
  sessionIdSchema,
  sessionInputSchema,
  type LastPerformance,
  type WorkoutSession,
} from '../../shared/schemas.js';
import { requireUserId } from '../auth.js';
import { ApiError, parse, type Route } from '../http.js';
import { SessionModel, type SessionFields } from '../models/WorkoutSession.js';

export type LeanSession = SessionFields & { _id: Types.ObjectId };

export function toSession(s: LeanSession): WorkoutSession {
  return {
    id: s.clientId,
    planId: s.planId ? String(s.planId) : null,
    date: s.date,
    dayIndex: s.dayIndex,
    startedAt: s.startedAt.toISOString(),
    finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
    notes: s.notes,
    rev: s.rev,
    updatedAt: s.updatedAt.toISOString(),
    entries: s.entries.map((e) => ({
      exerciseId: String(e.exerciseId),
      variationKey: e.variationKey,
      target: {
        sets: e.target?.sets ?? e.sets.length,
        repsMin: e.target?.repsMin ?? null,
        repsMax: e.target?.repsMax ?? null,
        durationSec: e.target?.durationSec ?? null,
        notes: e.target?.notes ?? '',
      },
      sets: e.sets.map(({ setNumber, weight, reps, durationSec, done }) => ({
        setNumber,
        weight: weight ?? null,
        reps: reps ?? null,
        durationSec: durationSec ?? null,
        done,
      })),
    })),
  };
}

/**
 * Most recent completed sets per exercise, from sessions other than `excludeId`.
 * Looks back over the latest 40 sessions that include any of the exercises.
 */
export async function lastPerformances(
  userId: string,
  exerciseIds: string[],
  excludeId?: string,
): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};
  const sessions = await SessionModel.find(
    {
      userId,
      'entries.exerciseId': { $in: exerciseIds },
      ...(excludeId ? { clientId: { $ne: excludeId } } : {}),
    },
    { date: 1, entries: 1, startedAt: 1 },
  )
    .sort({ date: -1, startedAt: -1 })
    .limit(40)
    .lean<LeanSession[]>();

  const wanted = new Set(exerciseIds);
  const out: Record<string, LastPerformance> = {};
  for (const s of sessions) {
    for (const e of s.entries) {
      const id = String(e.exerciseId);
      if (!wanted.has(id) || out[id]) continue;
      const done = e.sets.filter((x) => x.done);
      if (done.length === 0) continue;
      out[id] = {
        date: s.date,
        variationKey: e.variationKey,
        sets: done.map(({ setNumber, weight, reps, durationSec, done }) => ({
          setNumber,
          weight: weight ?? null,
          reps: reps ?? null,
          durationSec: durationSec ?? null,
          done,
        })),
      };
    }
  }
  return out;
}

export const sessionRoutes: Route[] = [
  {
    method: 'GET',
    path: '/sessions/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const s = await SessionModel.findOne({
        userId,
        clientId: parse(sessionIdSchema, id),
      }).lean<LeanSession>();
      if (!s) throw new ApiError(404, 'not_found', 'Workout not found');
      res.json({ session: toSession(s) });
    },
  },
  {
    // Create or update (autosave). Older revisions never overwrite newer ones.
    method: 'PUT',
    path: '/sessions/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      const clientId = parse(sessionIdSchema, id);
      const input = parse(sessionInputSchema, req.body);
      const doc = {
        ...input,
        startedAt: new Date(input.startedAt),
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
      };
      try {
        const s = await SessionModel.findOneAndUpdate(
          { userId, clientId, rev: { $lt: input.rev } },
          { $set: doc, $setOnInsert: { userId, clientId } },
          { upsert: true, returnDocument: 'after', runValidators: true },
        ).lean<LeanSession>();
        return res.json({ session: toSession(s!), applied: true });
      } catch (err) {
        // Duplicate key = the session exists with a newer (or same) revision.
        if ((err as { code?: number }).code !== 11000) throw err;
        const current = await SessionModel.findOne({ userId, clientId }).lean<LeanSession>();
        return res.json({ session: toSession(current!), applied: false });
      }
    },
  },
  {
    method: 'DELETE',
    path: '/sessions/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      await SessionModel.deleteOne({ userId, clientId: parse(sessionIdSchema, id) });
      res.json({ ok: true });
    },
  },
];
