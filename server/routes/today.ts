import { z } from 'zod';
import type { TodayResponse } from '../../shared/schemas.js';
import { localDay } from '../../shared/time.js';
import { requireUser } from '../auth.js';
import { parse, type Route } from '../http.js';
import { ExerciseModel } from '../models/Exercise.js';
import { PlanModel } from '../models/Plan.js';
import { SessionModel } from '../models/WorkoutSession.js';
import { toExercise, type LeanExercise } from './exercises.js';
import { toPlan } from './plans.js';
import { lastPerformances, toSession, type LeanSession } from './sessions.js';

const querySchema = z.object({
  dayIndex: z.coerce.number().int().min(0).max(6).optional(),
});

export const todayRoutes: Route[] = [
  {
    method: 'GET',
    path: '/today',
    handler: async (req, res) => {
      const user = await requireUser(req);
      const userId = String(user._id);
      const { dayIndex: picked } = parse(querySchema, { dayIndex: req.query.dayIndex });
      const { date, dayIndex: todayIndex } = localDay(user.settings.timezone);
      const dayIndex = picked ?? todayIndex;

      const [planDoc, sessionDoc] = await Promise.all([
        PlanModel.findOne({ userId, isActive: true }).lean(),
        // The latest workout started today for the chosen weekday.
        SessionModel.findOne({ userId, date, dayIndex })
          .sort({ startedAt: -1 })
          .lean<LeanSession>(),
      ]);
      const plan = planDoc ? toPlan(planDoc) : null;
      const day = plan?.days.find((d) => d.dayIndex === dayIndex) ?? null;
      const session = sessionDoc ? toSession(sessionDoc) : null;

      const ids = [
        ...new Set([
          ...(day?.items.map((i) => i.exerciseId) ?? []),
          ...(session?.entries.map((e) => e.exerciseId) ?? []),
        ]),
      ];
      const [exercises, last] = await Promise.all([
        ExerciseModel.find({ _id: { $in: ids }, userId }).lean<LeanExercise[]>(),
        lastPerformances(userId, ids, session?.id),
      ]);

      const body: TodayResponse = {
        date,
        todayIndex,
        dayIndex,
        plan: plan && {
          id: plan.id,
          name: plan.name,
          days: plan.days.map(({ dayIndex, label, type, intensity }) => ({
            dayIndex,
            label,
            type,
            intensity,
          })),
        },
        day,
        exercises: exercises.map(toExercise),
        last,
        session,
      };
      res.json(body);
    },
  },
];
