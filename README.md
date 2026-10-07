# Gym Tracker

A mobile-first personal workout app. Build a weekly plan, follow today's workout as a checklist at the gym, log every set, and track progress and body measurements over time. It works offline and installs to your phone's home screen.

**Live:** https://gym-zeta-gules.vercel.app

## Features

| Area          | What it does                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**     | Today's plan day (in your timezone) as a checklist: grip of the day, how-to, last session's numbers, one-tap set logging, rest timer, finish summary    |
| **Plan**      | Several plans with one active. 7-day week, train/rest days, hard/moderate intensity, drag-and-drop order, sets/reps/seconds/grip/notes, copy a day      |
| **Exercises** | Library with categories, muscles, how-to steps, grips/variations, photos (start/end positions, per grip) and YouTube links                              |
| **Progress**  | Workout history, per-exercise charts and personal records (heaviest, est. 1RM, reps, volume, longest hold), consistency calendar, streaks, weekly count |
| **Body**      | Weight and chest/waist/arm/thigh measurements with charts                                                                                               |
| **Settings**  | Theme (light/dark/auto), kg/lb, rest timers, week start, timezone, export all data as JSON                                                              |
| **Offline**   | Installable PWA; a workout in progress is saved on the phone first and synced when online                                                               |

New accounts start with 14 default exercises and the **Beginner Month 1** plan (week starts Saturday, Tuesday and Friday rest).

## Tech stack

React 19 + Vite + TypeScript + Tailwind CSS 4 · TanStack Query · Recharts · dnd-kit · vite-plugin-pwa
Vercel serverless (one function) · MongoDB Atlas (free M0) via Mongoose · zod · bcrypt + JWT cookie · Vitest

## Project layout

```
api/index.ts         The single Vercel function. vercel.json rewrites every /api/* request here
server/
  app.ts             Route table + request handling (origin check, DB connect, errors)
  db.ts              Cached Mongoose connection (reused across serverless invocations)
  auth.ts, http.ts   JWT cookie helpers, router, zod parsing, JSON errors
  models/            User, Exercise, Plan, WorkoutSession, BodyLog, LoginAttempt
  routes/            auth, exercises, plans, today, sessions, progress, body, settings, export
  seed/              Default exercises, photos and the Beginner Month 1 plan
shared/              Code used by both API and UI: zod schemas, progress maths, dates/units
src/
  pages/             One file per screen (all but Today/login are loaded on demand)
  components/        UI pieces (today/, plan/, charts, gallery)
  workout/           Workout logic, offline sync queue, rest timer
  api/               TanStack Query hooks
tests/               Vitest: validation, access control, progress maths, workout logic, config
scripts/             generate-icons.mjs (PWA icons, no extra dependencies)
```

## 1. Create the database (MongoDB Atlas, free)

1. Sign up at https://www.mongodb.com/cloud/atlas/register and create an **M0 (Free)** cluster. For Bangladesh, pick Mumbai (`ap-south-1`) or Singapore.
2. **Database Access** → add a user with a generated password and the role _Read and write to any database_.
3. **Network Access** → **Allow access from anywhere** (`0.0.0.0/0`). Vercel functions have no fixed IP addresses; the database stays protected by the username and password.
4. **Connect → Drivers**: copy the connection string. Put your password in it and add `gym` after `.net/`:
   `mongodb+srv://gymuser:PASSWORD@cluster0.xxxxx.mongodb.net/gym?retryWrites=true&w=majority`

## 2. Environment variables

| Name                 | Value                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`        | The Atlas connection string from step 1                                                                 |
| `JWT_SECRET`         | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ALLOW_REGISTRATION` | `true` until you've created your account, then `false`                                                  |

Locally they go in `.env.local` (copy `.env.example`; git-ignored). On Vercel they go in **Project → Settings → Environment Variables**.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npx vercel login             # one time
npx vercel link              # one time: pick the existing project
npm run dev:full             # UI + API at http://localhost:3000
```

| Script           | Does                                                 |
| ---------------- | ---------------------------------------------------- |
| `npm run dev`    | UI only (no API)                                     |
| `npm run check`  | lint + typecheck + tests + formatting (what CI runs) |
| `npm test`       | Vitest                                               |
| `npm run build`  | Production build (includes the service worker)       |
| `npm run format` | Prettier                                             |
| `npm run icons`  | Regenerate the PWA icons in `public/`                |

## 4. Deploy (Vercel)

Pushing to `main` deploys automatically. GitHub Actions also runs `npm run check` and a build on every push.

### Deploy checklist

- [ ] `npm run check` passes locally
- [ ] Vercel env vars set for **Production**: `MONGODB_URI`, `JWT_SECRET`, `ALLOW_REGISTRATION`
- [ ] Atlas **Network Access** allows `0.0.0.0/0`
- [ ] `https://<app>/api/health` returns `{"ok":true,"db":"connected"}`
- [ ] You can log in, and a workout set saves ("✓ Saved" on Today)
- [ ] After creating your account: `ALLOW_REGISTRATION=false`, then **Redeploy**
- [ ] The **Create an account** link no longer shows on the login screen
- [ ] **More → Export all my data** downloads a JSON file. Keep one as a backup now and then.

## Install on your phone

- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**
- **iPhone (Safari):** Share → **Add to Home Screen**

## How offline saving works

- Each workout gets an id generated on the phone, so you can start one with no signal.
- Every tap is written to the phone's storage first, then sent to `PUT /api/sessions/:id` in the background. Unsynced workouts are retried when the phone comes back online, when the app opens, and every 20 seconds.
- Every change bumps a revision number, and the server ignores anything older than what it has. A delayed retry can never overwrite newer sets.
- The last loaded Today screen is kept on the phone, so the workout still opens offline. The service worker caches the app itself and exercise photos, never API responses.

## Data notes

- Weights are stored in **kg** and body measurements in **cm**. Switching to lb/in only changes what's displayed.
- Dates are `YYYY-MM-DD` in your timezone (Settings, default `Asia/Dhaka`).
- A workout stores a **snapshot** of the plan's targets, so editing a plan never changes past workouts.
- Rest/missed days on the calendar follow the **current** active plan. Days before your first workout aren't counted.
- Estimated 1RM uses the Epley formula and only for sets of 1–12 reps.

## Security

- Passwords: bcrypt (cost 12). Sessions: a JWT in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (30 days).
- Login: 5 failed attempts per email and IP, then a 15-minute lockout (stored in MongoDB with a TTL index). Unknown emails take the same time as wrong passwords.
- Every route except register/login/logout/config/health requires the cookie and only touches that user's data. A test checks this for every route.
- Cross-site writes are rejected (Origin check), on top of `SameSite=Lax`.
- All input is validated with zod. Errors are always `{ "error": { "code", "message", "fields?" } }`.
- Headers: strict Content-Security-Policy (inline script allowed only by hash; a test keeps it in sync), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy.
- Secrets live only in environment variables. Logs never include request bodies.
- Logging out clears the cookie on this device. To log out **everywhere**, change `JWT_SECRET` in Vercel and redeploy.

## API

All routes are under `/api` and return JSON.

| Route                                                           | Methods                | Purpose                                                   |
| --------------------------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| `/auth/register`, `/auth/login`, `/auth/logout`                 | POST                   | Account and session                                       |
| `/auth/me`, `/auth/config`                                      | GET                    | Current user; whether registration is open                |
| `/settings`                                                     | PUT                    | Update settings (partial)                                 |
| `/exercises`, `/exercises/:id`                                  | GET, POST, PUT, DELETE | Exercise library (delete is blocked while used in a plan) |
| `/exercises/seed`                                               | POST                   | Add any missing default exercises                         |
| `/plans`, `/plans/:id`                                          | GET, POST, PUT, DELETE | Plans                                                     |
| `/plans/default`, `/plans/:id/activate`, `/plans/:id/duplicate` | POST                   | Default plan, set active, copy                            |
| `/today?dayIndex=`                                              | GET                    | Plan day, exercises, last numbers, today's workout        |
| `/sessions?before=`                                             | GET                    | History, 20 per page                                      |
| `/sessions/:id`                                                 | GET, PUT, DELETE       | One workout; PUT creates or updates (autosave)            |
| `/progress/exercise/:id`                                        | GET                    | Time series and PRs                                       |
| `/progress/summary?month=YYYY-MM`                               | GET                    | Calendar, streaks, weekly count                           |
| `/body`, `/body/:id`                                            | GET, POST, PUT, DELETE | Body log (POST saves the entry for that date)             |
| `/export`                                                       | GET                    | Download everything as JSON                               |
| `/health`                                                       | GET                    | Is the database connected                                 |

## Troubleshooting

| Problem                                     | Fix                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/api/health` says `disconnected` or errors | Check `MONGODB_URI` (password, `/gym` database name) and Atlas Network Access `0.0.0.0/0`, then redeploy |
| A push didn't update the site               | Vercel → Deployments → **Redeploy** (or push an empty commit). GitHub sometimes misses a webhook.        |
| "Too many failed attempts"                  | Wait 15 minutes                                                                                          |
| The app shows an old version after a deploy | Close and reopen it. The service worker updates on the next launch.                                      |
| "Not synced yet" on Today                   | Sets are safe on the phone. They sync automatically once the connection is back.                         |

## Credits

Default exercise photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), served via jsDelivr.

## Later ideas

Progress photos (Vercel Blob) · nutrition and water log · voice notes · weekly summary and progression suggestions · read-only plan link for a trainer.
