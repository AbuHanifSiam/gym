import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDb } from './db.js';
import { matchRoute, sendError, type Route } from './http.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

const routes: Route[] = [...healthRoutes, ...authRoutes];

export async function handle(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname.replace(/^\/api/, '');
    const { route, params } = matchRoute(routes, req.method ?? 'GET', pathname);
    if (!route.noDb) await connectDb();
    await route.handler(req, res, params);
  } catch (err) {
    sendError(res, err);
  }
}
