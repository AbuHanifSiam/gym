import { describe, expect, it } from 'vitest';
import { ApiError, matchRoute, parse, type Route } from '../server/http.js';
import { exerciseInputSchema, loginSchema, registerSchema } from '../shared/schemas.js';

const noop = async () => {};
const routes: Route[] = [
  { method: 'GET', path: '/exercises', handler: noop },
  { method: 'GET', path: '/exercises/:id', handler: noop },
  { method: 'PUT', path: '/exercises/:id', handler: noop },
];

describe('matchRoute', () => {
  it('matches static and param routes', () => {
    expect(matchRoute(routes, 'GET', '/exercises').route).toBe(routes[0]);
    const m = matchRoute(routes, 'PUT', '/exercises/abc');
    expect(m.route).toBe(routes[2]);
    expect(m.params).toEqual({ id: 'abc' });
  });

  it('returns 405 for a known path with the wrong method and 404 otherwise', () => {
    expect(() => matchRoute(routes, 'DELETE', '/exercises/abc')).toThrow(
      expect.objectContaining({ status: 405 }),
    );
    expect(() => matchRoute(routes, 'GET', '/nope')).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});

describe('auth validation', () => {
  it('normalises email and accepts valid input', () => {
    const out = parse(registerSchema, {
      name: ' Sam ',
      email: ' Sam@X.com ',
      password: 'longenough',
    });
    expect(out).toEqual({ name: 'Sam', email: 'sam@x.com', password: 'longenough' });
  });

  it('reports field errors', () => {
    try {
      parse(registerSchema, { name: '', email: 'bad', password: 'short' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(Object.keys((err as ApiError).fields!).sort()).toEqual(['email', 'name', 'password']);
    }
  });

  it('rejects a missing body', () => {
    expect(() => parse(loginSchema, undefined)).toThrow(ApiError);
  });
});

describe('exercise validation', () => {
  it('accepts every seed exercise', async () => {
    const { seedExercises } = await import('../server/seed/exercises.js');
    for (const e of seedExercises) expect(() => parse(exerciseInputSchema, e)).not.toThrow();
  });

  it('rejects duplicate variation keys and bad URLs', () => {
    const base = { name: 'X', category: 'pull', equipment: 'machine' };
    const v = { key: 'a', name: 'A' };
    expect(() => parse(exerciseInputSchema, { ...base, variations: [v, v] })).toThrow(ApiError);
    expect(() => parse(exerciseInputSchema, { ...base, videoUrl: 'javascript:alert(1)' })).toThrow(
      ApiError,
    );
  });
});

describe('seed images', () => {
  it('only reference real exercises and grips', async () => {
    const { seedExercises, seedImages } = await import('../server/seed/exercises.js');
    for (const [name, images] of Object.entries(seedImages)) {
      const ex = seedExercises.find((e) => e.name === name);
      expect(ex, name).toBeDefined();
      const keys = new Set((ex!.variations ?? []).map((v) => v.key));
      for (const img of images) {
        if (img.variationKey)
          expect(keys.has(img.variationKey), `${name}: ${img.variationKey}`).toBe(true);
      }
      expect(() => parse(exerciseInputSchema, { ...ex, images })).not.toThrow();
    }
  });
});
