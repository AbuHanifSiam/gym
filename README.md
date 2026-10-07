# Gym Tracker

A mobile-first personal workout planner and logger. It's built with React (Vite, TypeScript, Tailwind) and a single Vercel serverless API backed by MongoDB Atlas.

## Project layout

```
api/index.ts       Single Vercel function: every /api/* request is rewritten here and routed to server/app.ts
server/            API code: db connection (cached), auth, router, models, routes
shared/            zod schemas and types used by both the API and the UI
src/               React app (pages, components, data hooks)
tests/             Vitest unit tests
```

The whole API is **one** Vercel function. That keeps the project under the Hobby plan's function limit and lets every request share one cached MongoDB connection.

## 1. Create a free MongoDB Atlas database

1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. **Create a cluster**: choose **M0 (Free)**. Pick a region close to you (for Bangladesh: Mumbai `ap-south-1` or Singapore).
3. **Database Access** → _Add New Database User_. Choose username + password auth, use a generated password, and save it somewhere safe. Role: _Read and write to any database_.
4. **Network Access** → _Add IP Address_ → **Allow access from anywhere** (`0.0.0.0/0`). Vercel functions don't have fixed IP addresses, so this is required on the free tier. The database stays protected by the username and password.
5. **Database** → _Connect_ → _Drivers_, then copy the connection string. Replace `<password>` with your password and add a database name before the `?`:
   `mongodb+srv://gymuser:PASSWORD@cluster0.xxxxx.mongodb.net/gym?retryWrites=true&w=majority`

## 2. Run locally

```bash
npm install
cp .env.example .env.local      # then fill in the values
npx vercel login                # one time
npx vercel link                 # one time: link the folder to a Vercel project
npm run dev:full                # runs the UI and /api together at http://localhost:3000
```

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format`.
(`npm run dev` starts only the Vite UI, without the API.)

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project**, import the repo, and keep the detected **Vite** preset.
3. Open **Project Settings → Environment Variables** and add these for _Production_ (and _Preview_ if you want):
   - `MONGODB_URI`: your Atlas connection string
   - `JWT_SECRET`: a long random string (different from your local one)
   - `ALLOW_REGISTRATION`: `true` for now
4. Deploy. Open `https://<your-app>.vercel.app/api/health` and it should return `{"ok":true,"db":"connected"}`.
5. Register your account in the app, then set `ALLOW_REGISTRATION=false` and **redeploy** so nobody else can sign up.

## Security notes

- Passwords are hashed with bcrypt (cost 12). Sessions are a JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie that lasts 30 days.
- Login is rate-limited to 5 failed attempts per email and IP every 15 minutes. Attempts are stored in MongoDB and expire automatically through a TTL index.
- All input is validated with zod. Errors use one format: `{ "error": { "code", "message", "fields?" } }`.
- Secrets live only in environment variables. `.env*` files are git-ignored.
