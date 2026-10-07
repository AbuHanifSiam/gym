import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema } from '../../shared/schemas.js';
import { clearSessionCookie, requireUser, setSessionCookie, toPublicUser } from '../auth.js';
import { ApiError, clientIp, parse, type Route } from '../http.js';
import { LoginAttempt } from '../models/LoginAttempt.js';
import { User } from '../models/User.js';
import { createDefaultPlan } from './plans.js';

const MAX_FAILED_LOGINS = 5;
// Compared against when the email doesn't exist, so timing doesn't reveal registered emails.
const DUMMY_HASH = '$2b$12$fqeoLqHBN5Uev2AUMiF2i.GkNsWW3wAPIjzT.XpTWJP04IF1p9ZMS';

export function registrationOpen() {
  return process.env.ALLOW_REGISTRATION !== 'false';
}

export const authRoutes: Route[] = [
  {
    method: 'POST',
    path: '/auth/register',
    handler: async (req, res) => {
      if (!registrationOpen()) {
        throw new ApiError(403, 'registration_closed', 'Registration is closed');
      }
      const input = parse(registerSchema, req.body);
      if (await User.exists({ email: input.email })) {
        throw new ApiError(409, 'email_taken', 'An account with this email already exists', {
          email: 'Already registered',
        });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await User.create({ email: input.email, name: input.name, passwordHash });
      await createDefaultPlan(user._id, true);
      setSessionCookie(req, res, String(user._id));
      res.status(201).json({ user: toPublicUser(user) });
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: async (req, res) => {
      const input = parse(loginSchema, req.body);
      const key = `${input.email}|${clientIp(req)}`;
      if ((await LoginAttempt.countDocuments({ key })) >= MAX_FAILED_LOGINS) {
        throw new ApiError(
          429,
          'too_many_attempts',
          'Too many failed attempts. Try again in 15 minutes.',
        );
      }
      const user = await User.findOne({ email: input.email });
      const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) {
        await LoginAttempt.create({ key });
        throw new ApiError(401, 'invalid_credentials', 'Wrong email or password');
      }
      await LoginAttempt.deleteMany({ key });
      setSessionCookie(req, res, String(user._id));
      res.json({ user: toPublicUser(user) });
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    noDb: true,
    handler: async (req, res) => {
      clearSessionCookie(req, res);
      res.json({ ok: true });
    },
  },
  {
    method: 'GET',
    path: '/auth/me',
    handler: async (req, res) => {
      const user = await requireUser(req);
      res.json({ user: toPublicUser(user) });
    },
  },
  {
    method: 'GET',
    path: '/auth/config',
    noDb: true,
    handler: async (_req, res) => {
      res.json({ registrationOpen: registrationOpen() });
    },
  },
];
