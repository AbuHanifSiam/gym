import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// No database in unit tests: every request below must be answered before any query runs.
vi.mock('../server/db.js', () => ({ connectDb: vi.fn().mockResolvedValue(undefined) }));

const { handle, routes } = await import('../server/app.js');
const { setSessionCookie } = await import('../server/auth.js');

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

interface Result {
  status: number;
  body: { error?: { code: string; fields?: Record<string, string> } } & Record<string, unknown>;
  headers: Record<string, string>;
}

async function call(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Result> {
  const result: Result = { status: 200, body: {}, headers: {} };
  const res = {
    setHeader(k: string, v: string) {
      result.headers[k.toLowerCase()] = v;
      return res;
    },
    status(code: number) {
      result.status = code;
      return res;
    },
    json(b: Result['body']) {
      result.body = b;
      return res;
    },
    send(b: string) {
      result.body = JSON.parse(b);
      return res;
    },
  };
  const req = {
    method,
    url: `/api${path}`,
    query: { __path: path.replace(/^\//, '').split('?')[0] },
    headers: { host: 'gym.example.com', ...opts.headers },
    body: opts.body,
    socket: { remoteAddress: '127.0.0.1' },
  };
  await handle(req as unknown as VercelRequest, res as unknown as VercelResponse);
  return result;
}

const PUBLIC = new Set([
  'GET /health',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/logout',
  'GET /auth/config',
]);

const sample: Record<string, string> = {
  id: '0123456789abcdef01234567',
};
const concrete = (path: string) => path.replace(/:(\w+)/g, (_, k) => sample[k] ?? 'x');

describe('API access control', () => {
  const protectedRoutes = routes.filter((r) => !PUBLIC.has(`${r.method} ${r.path}`));

  it('covers every non-public route', () => {
    expect(protectedRoutes.length).toBeGreaterThan(20);
  });

  it.each(protectedRoutes.map((r) => [r.method, r.path]))(
    '%s %s needs a login',
    async (method, path) => {
      const r = await call(method, concrete(path), { body: {} });
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('unauthorized');
    },
  );

  it('rejects a forged or expired session cookie', async () => {
    const forged = jwt.sign({ sub: sample.id }, 'some-other-secret-that-is-32-chars-long!');
    const expired = jwt.sign({ sub: sample.id, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    for (const token of [forged, expired, 'garbage']) {
      const r = await call('GET', '/exercises', { headers: { cookie: `gt_session=${token}` } });
      expect(r.status).toBe(401);
    }
  });

  it('blocks writes from another website', async () => {
    const r = await call('POST', '/plans', { headers: { origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
    expect(r.body.error?.code).toBe('bad_origin');
    // Same origin passes the check (and then needs a login).
    const ok = await call('POST', '/plans', { headers: { origin: 'https://gym.example.com' } });
    expect(ok.status).toBe(401);
  });

  it('never caches API responses', async () => {
    const r = await call('GET', '/auth/config');
    expect(r.headers['cache-control']).toBe('no-store');
  });
});

describe('public routes', () => {
  it('validates register and login input before touching the database', async () => {
    const reg = await call('POST', '/auth/register', { body: { email: 'nope' } });
    expect(reg.status).toBe(400);
    expect(Object.keys(reg.body.error!.fields!)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
    const login = await call('POST', '/auth/login', { body: {} });
    expect(login.status).toBe(400);
  });

  it('closes registration with ALLOW_REGISTRATION=false', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    try {
      const r = await call('POST', '/auth/register', {
        body: { name: 'A', email: 'a@b.co', password: 'longenough' },
      });
      expect(r.status).toBe(403);
      expect((await call('GET', '/auth/config')).body).toEqual({ registrationOpen: false });
    } finally {
      delete process.env.ALLOW_REGISTRATION;
    }
  });

  it('logout clears the cookie', async () => {
    const r = await call('POST', '/auth/logout');
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie']).toMatch(/gt_session=;.*Max-Age=0/);
  });

  it('returns 404 for unknown routes and 405 for wrong methods', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
    expect((await call('DELETE', '/today')).status).toBe(405);
  });
});

describe('session cookie', () => {
  const cookieFor = (host: string) => {
    const headers: Record<string, string> = {};
    setSessionCookie(
      { headers: { host } } as unknown as VercelRequest,
      { setHeader: (k: string, v: string) => (headers[k] = v) } as unknown as VercelResponse,
      sample.id,
    );
    return headers['Set-Cookie'];
  };

  it('is httpOnly, Secure and SameSite=Lax in production', () => {
    const c = cookieFor('gym.example.com');
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    const token = c.split(';')[0].split('=')[1];
    expect(jwt.verify(token, SECRET)).toMatchObject({ sub: sample.id });
  });

  it('drops Secure only for plain-http localhost', () => {
    expect(cookieFor('localhost:3000')).not.toMatch(/Secure/);
  });
});
