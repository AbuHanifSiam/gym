import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDb } from './db.js';
import { matchRoute, sendError, type Route } from './http.js';
import { authRoutes } from './routes/auth.js';
import { bodyRoutes } from './routes/body.js';
import { exerciseRoutes } from './routes/exercises.js';
import { exportRoutes } from './routes/export.js';
import { healthRoutes } from './routes/health.js';
import { planRoutes } from './routes/plans.js';
import { progressRoutes } from './routes/progress.js';
import { sessionRoutes } from './routes/sessions.js';
import { settingsRoutes } from './routes/settings.js';
import { todayRoutes } from './routes/today.js';

const routes: Route[] = [
  ...healthRoutes,
  ...authRoutes,
  ...exerciseRoutes,
  ...planRoutes,
  ...settingsRoutes,
  ...todayRoutes,
  ...sessionRoutes,
  ...progressRoutes,
  ...bodyRoutes,
  ...exportRoutes,
];

export async function handle(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // vercel.json rewrites /api/<path> to /api?__path=<path>
    const raw = req.query.__path;
    const pathname = '/' + (Array.isArray(raw) ? raw.join('/') : (raw ?? ''));
    const { route, params } = matchRoute(routes, req.method ?? 'GET', pathname);
    if (!route.noDb) await connectDb();
    await route.handler(req, res, params);
  } catch (err) {
    sendError(res, err);
  }
}
