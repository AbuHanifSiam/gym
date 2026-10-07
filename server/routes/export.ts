import { localDay } from '../../shared/time.js';
import { requireUser, toPublicUser } from '../auth.js';
import type { Route } from '../http.js';
import { BodyLogModel } from '../models/BodyLog.js';
import { ExerciseModel } from '../models/Exercise.js';
import { PlanModel } from '../models/Plan.js';
import { SessionModel } from '../models/WorkoutSession.js';
import { toBodyLog } from './body.js';
import { toExercise, type LeanExercise } from './exercises.js';
import { toPlan, type LeanPlan } from './plans.js';
import { toSession, type LeanSession } from './sessions.js';

export const exportRoutes: Route[] = [
  {
    // Everything the user owns, as one JSON file. Never includes the password hash.
    method: 'GET',
    path: '/export',
    handler: async (req, res) => {
      const user = await requireUser(req);
      const userId = user._id;
      const [exercises, plans, sessions, body] = await Promise.all([
        ExerciseModel.find({ userId }).sort({ name: 1 }).lean<LeanExercise[]>(),
        PlanModel.find({ userId }).sort({ createdAt: 1 }).lean<LeanPlan[]>(),
        SessionModel.find({ userId }).sort({ date: 1, startedAt: 1 }).lean<LeanSession[]>(),
        BodyLogModel.find({ userId }).sort({ date: 1 }).lean(),
      ]);
      const date = localDay(user.settings.timezone).date;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="gym-tracker-export-${date}.json"`,
      );
      res.status(200).send(
        JSON.stringify(
          {
            format: 'gym-tracker-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            note: 'Weights are in kg and body measurements in cm.',
            user: toPublicUser(user),
            exercises: exercises.map(toExercise),
            plans: plans.map(toPlan),
            sessions: sessions.map(toSession),
            bodyLogs: body.map(toBodyLog),
          },
          null,
          2,
        ),
      );
    },
  },
];
