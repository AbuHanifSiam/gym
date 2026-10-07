import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export type Params = Record<string, string>;
export type Handler = (req: VercelRequest, res: VercelResponse, params: Params) => Promise<unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
export interface Route {
  method: Method;
  /** e.g. /exercises/:id */
  path: string;
  handler: Handler;
  /** Skip the database connection (e.g. logout). */
  noDb?: boolean;
}

export function matchRoute(routes: Route[], method: string, pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  let pathMatched = false;
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Params = {};
    const ok = pattern.every((seg, i) => {
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return seg === parts[i];
    });
    if (!ok) continue;
    pathMatched = true;
    if (route.method === method) return { route, params };
  }
  if (pathMatched) throw new ApiError(405, 'method_not_allowed', 'Method not allowed');
  throw new ApiError(404, 'not_found', 'Route not found');
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new ApiError(400, 'validation_error', 'Some fields are invalid', fields);
}

export function sendError(res: VercelResponse, err: unknown) {
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  console.error('Unhandled API error:', err instanceof Error ? err.message : typeof err);
  return res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong' } });
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/**
 * Blocks cross-site writes: a browser always sends Origin on POST/PUT/DELETE, and it must be
 * this app's own host. (The SameSite=Lax cookie already stops most of these; this is a second
 * layer.) Requests without Origin (curl, server-to-server) carry no cookie by accident.
 */
export function assertSameOrigin(req: VercelRequest) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'bad_origin', 'Request blocked');
  }
  if (originHost !== host) throw new ApiError(403, 'bad_origin', 'Request blocked');
}
