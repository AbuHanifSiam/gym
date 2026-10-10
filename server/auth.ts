import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { parseCookie, stringifySetCookie } from 'cookie';
import { ApiError } from './http.js';
import { User, type UserDocument } from './models/User.js';
import type { PublicUser } from '../shared/schemas.js';

const COOKIE = 'gt_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set (32+ characters)');
  return s;
}

// Plain http://localhost (vercel dev) can't use Secure cookies in every browser.
function isLocalhost(req: VercelRequest) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '');
}

function writeCookie(req: VercelRequest, res: VercelResponse, value: string, maxAge: number) {
  res.setHeader(
    'Set-Cookie',
    stringifySetCookie({
      name: COOKIE,
      value,
      httpOnly: true,
      secure: !isLocalhost(req),
      sameSite: 'lax',
      path: '/',
      maxAge,
    }),
  );
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse, userId: string) {
  const token = jwt.sign({ sub: userId }, secret(), { expiresIn: MAX_AGE_SEC });
  writeCookie(req, res, token, MAX_AGE_SEC);
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse) {
  writeCookie(req, res, '', 0);
}

/** Returns the authenticated user's id or throws 401. */
export function requireUserId(req: VercelRequest): string {
  const token = parseCookie(req.headers.cookie ?? '')[COOKIE];
  if (!token) throw new ApiError(401, 'unauthorized', 'Please log in');
  try {
    const payload = jwt.verify(token, secret());
    if (typeof payload === 'object' && typeof payload.sub === 'string') return payload.sub;
  } catch {
    // invalid or expired token
  }
  throw new ApiError(401, 'unauthorized', 'Session expired, please log in again');
}

export async function requireUser(req: VercelRequest): Promise<UserDocument> {
  const user = await User.findById(requireUserId(req));
  if (!user) throw new ApiError(401, 'unauthorized', 'Please log in');
  return user;
}

export function toPublicUser(user: UserDocument): PublicUser {
  const { timezone, weekStartDay, units, restTimerDefault, restTimerHeavy, theme } = user.settings;
  const p = user.profile;
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    settings: { timezone, weekStartDay, units, restTimerDefault, restTimerHeavy, theme },
    profile: {
      sex: p?.sex ?? null,
      heightCm: p?.heightCm ?? null,
      birthDate: p?.birthDate ?? null,
      activity: p?.activity ?? 'light',
      goal: p?.goal ?? 'maintain',
    },
  };
}
