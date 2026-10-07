import mongoose from 'mongoose';
import { z } from 'zod';
import {
  computePRs,
  computeStreaks,
  dayStatuses,
  summarizeSets,
  weekStartOf,
  type ExercisePoint,
} from '../../shared/progress.js';
import type {
  ExerciseProgress,
  ProgressSummary,
  SessionPage,
  SessionSummary,
} from '../../shared/schemas.js';
import { addDays, localDay } from '../../shared/time.js';
import { requireUser, requireUserId } from '../auth.js';
import { ApiError, parse, type Route } from '../http.js';
import { ExerciseModel } from '../models/Exercise.js';
import { PlanModel } from '../models/Plan.js';
import { SessionModel } from '../models/WorkoutSession.js';
import { toExercise, type LeanExercise } from './exercises.js';
import type { LeanSession } from './sessions.js';

const PAGE_SIZE = 20;

function summarize(s: LeanSession): SessionSummary {
  let doneSets = 0;
  let totalSets = 0;
  let volume = 0;
  for (const e of s.entries) {
    totalSets += e.sets.length;
    for (const x of e.sets) {
      if (!x.done) continue;
      doneSets++;
      volume += (x.weight ?? 0) * (x.reps ?? 0);
    }
  }
  return {
    id: s.clientId,
    date: s.date,
    dayIndex: s.dayIndex,
    planId: s.planId ? String(s.planId) : null,
    startedAt: s.startedAt.toISOString(),
    finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
    exercises: s.entries.length,
    doneSets,
    totalSets,
    volumeKg: Math.round(volume),
  };
}

/** Dates with at least one completed set. */
async function trainedDates(userId: string) {
  const rows = await SessionModel.find({ userId, 'entries.sets.done': true }, { date: 1 }).lean();
  return new Set(rows.map((r) => r.date));
}

const pageQuery = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(PAGE_SIZE),
});

const monthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const progressRoutes: Route[] = [
  {
    method: 'GET',
    path: '/sessions',
    handler: async (req, res) => {
      const userId = requireUserId(req);
      const { before, limit } = parse(pageQuery, req.query);
      const rows = await SessionModel.find({
        userId,
        ...(before ? { startedAt: { $lt: new Date(before) } } : {}),
      })
        .sort({ startedAt: -1 })
        .limit(limit + 1)
        .lean<LeanSession[]>();
      const page = rows.slice(0, limit);
      const body: SessionPage = {
        sessions: page.map(summarize),
        nextCursor: rows.length > limit ? page.at(-1)!.startedAt.toISOString() : null,
      };
      res.json(body);
    },
  },
  {
    method: 'GET',
    path: '/progress/exercise/:id',
    handler: async (req, res, { id }) => {
      const userId = requireUserId(req);
      if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'not_found', 'Exercise not found');
      const exercise = await ExerciseModel.findOne({ _id: id, userId }).lean<LeanExercise>();
      if (!exercise) throw new ApiError(404, 'not_found', 'Exercise not found');
      const sessions = await SessionModel.find(
        { userId, 'entries.exerciseId': id },
        { clientId: 1, date: 1, startedAt: 1, entries: 1 },
      )
        .sort({ date: 1, startedAt: 1 })
        .limit(500)
        .lean<LeanSession[]>();
      const points: ExercisePoint[] = [];
      for (const s of sessions) {
        for (const e of s.entries) {
          if (String(e.exerciseId) !== id) continue;
          const p = summarizeSets(
            s.date,
            s.clientId,
            e.variationKey,
            e.sets.map(({ setNumber, weight, reps, durationSec, done }) => ({
              setNumber,
              weight: weight ?? null,
              reps: reps ?? null,
              durationSec: durationSec ?? null,
              done,
            })),
          );
          if (p) points.push(p);
        }
      }
      const body: ExerciseProgress = {
        exercise: toExercise(exercise),
        points,
        prs: computePRs(points),
      };
      res.json(body);
    },
  },
  {
    method: 'GET',
    path: '/progress/summary',
    handler: async (req, res) => {
      const user = await requireUser(req);
      const userId = String(user._id);
      const { date: today } = localDay(user.settings.timezone);
      const { month = today.slice(0, 7) } = parse(monthQuery, req.query);

      const [dates, plan, first, totalWorkouts] = await Promise.all([
        trainedDates(userId),
        PlanModel.findOne({ userId, isActive: true }, { days: 1 }).lean(),
        SessionModel.findOne({ userId }, { date: 1 }).sort({ date: 1 }).lean(),
        SessionModel.countDocuments({ userId, 'entries.sets.done': true }),
      ]);
      const planTypes = plan ? new Map(plan.days.map((d) => [d.dayIndex, d.type])) : null;
      const trackingStart = first?.date ?? null;

      const from = `${month}-01`;
      const to = addDays(addDays(from, 31).slice(0, 7) + '-01', -1);
      const statuses = dayStatuses({
        from,
        to,
        today,
        trainedDates: dates,
        planTypes,
        trackingStart,
      });

      const weekStart = weekStartOf(today, user.settings.weekStartDay);
      let done = 0;
      for (let d = weekStart; d < addDays(weekStart, 7); d = addDays(d, 1))
        if (dates.has(d)) done++;
      const planned = plan ? plan.days.filter((d) => d.type === 'train').length : 0;

      const body: ProgressSummary = {
        today,
        month,
        days: Object.fromEntries(statuses),
        streak: computeStreaks({ today, trainedDates: dates, planTypes, trackingStart }),
        week: { done, planned, start: weekStart },
        totalWorkouts,
      };
      res.json(body);
    },
  },
];
