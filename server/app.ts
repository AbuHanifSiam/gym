import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDb } from './db.js';
import { matchRoute, sendError, type Route } from './http.js';
import { authRoutes } from './routes/auth.js';
import { exerciseRoutes } from './routes/exercises.js';
import { healthRoutes } from './routes/health.js';

const routes: Route[] = [...healthRoutes, ...authRoutes, ...exerciseRoutes];

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
