# Runfolio

Runfolio is a modern running portfolio app built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

## Features in this MVP

- Supabase auth (signup, login, logout)
- Dashboard with race + bucket list summary
- Create race flow with Strava activity import (real API when configured, sample data otherwise)
- Basic race matching suggestion by distance/date
- Bucket list page (completed vs future races)
- Public profile page at `/{username}`
- Find a race library with search and filters

## Quick start (demo mode)

If you skip Supabase env vars, the app runs in **demo mode** with mock data (no login required for most pages).

```bash
npm install
npm run dev
```

## Supabase setup

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Wait for the database to finish provisioning.

### 2. API keys

In the dashboard: **Project Settings → API** (or **Connect**)

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon** (legacy JWT) or **publishable** key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  You can also set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the same value (alias from newer Supabase docs).

Copy the example env file and fill values:

```bash
cp .env.example .env.local
```

### 3. Database schema

Open **SQL Editor** in Supabase and run the full script in [`supabase/schema.sql`](./supabase/schema.sql).

This creates `users`, `races`, `activities`, `activity_race_links` and enables Row Level Security (RLS) so each user only reads/writes their own rows.

### 4. Authentication URLs

**Authentication → URL configuration**

- **Site URL**: `http://localhost:3000` for local dev (add your production URL when you deploy).
- **Redirect URLs**: include `http://localhost:3000/**` and your production origin if applicable.

**Vercel Preview:** In the Supabase dashboard, add your preview origin (e.g. `https://*.vercel.app/**` or a specific `https://runfolio-xxx.vercel.app/**`). In Vercel → Project → Settings → Environment Variables, set the same `NEXT_PUBLIC_SUPABASE_*` values for **Preview** (and set `NEXT_PUBLIC_SITE_URL` to that preview URL if OAuth redirects must match).

Email signup creates an auth user; `signUpAction` also upserts a row into `public.users` with `id` = auth user id so it matches FKs on `races`.

### 5. Run the app with Supabase

```bash
npm run dev
```

Sign up at `/auth/signup`, then use Overview, Add race, etc. Data is stored in your Supabase project.

## Strava import

On **Add race** (`/races/new`), paste a Strava activity URL and click **Import Activity**. The server calls [Strava’s activity API](https://developers.strava.com/docs/reference/) using **`activity:read`** and **`activity:read_all`** (private activities you own).

### Option A — Connect Strava (recommended)

1. In [Strava API settings](https://www.strava.com/settings/api), create an app. Set **Authorization Callback Domain** to `localhost` for local dev (or your production domain).
2. In `.env.local` (see [`.env.example`](./.env.example)):

   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   ```

   If Strava requires an exact redirect URL, set:

   ```env
   STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/oauth/callback
   ```

3. Restart `npm run dev`, open **Add race**, click **Connect Strava**, approve the app. Tokens are stored in **httpOnly cookies**; imports refresh them when they expire.
4. Paste an activity URL and use **Import Activity**.

Routes: `GET /api/strava/oauth/start` (redirect to Strava), `GET /api/strava/oauth/callback` (exchange code, set cookies).

### Option B — Static tokens in `.env.local`

If you already have tokens from Strava’s app page or Postman:

```env
STRAVA_ACCESS_TOKEN=...
STRAVA_REFRESH_TOKEN=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
```

Refresh uses `STRAVA_REFRESH_TOKEN` when the access token is stale or the API returns an authorization error. You can use **Connect Strava** instead so cookies hold the latest tokens without editing env.

### Demo mode

If Strava is not configured (no cookies and no env tokens), **Import Activity** returns **sample data** so the UI still works.

`GET /api/strava/import` returns a list of mock activities.

**Security:** Never commit `.env.local`. Tokens from screenshots or chats should be rotated in Strava if they were exposed.

## Debugging HTTP 500

Server logs use a common prefix so you can filter in **Vercel → Deployment → Logs** or your local terminal:

| Prefix | Meaning |
|--------|---------|
| `[Runfolio:error][middleware.fatal]` | Unhandled exception in middleware — request still continues with `NextResponse.next()`. |
| `[Runfolio:error][middleware.supabase.getClaims]` | Session refresh in middleware failed (bad URL/key, network, paused project). |
| `[Runfolio:error][supabase.createClient]` | Could not build the Supabase client (env or `cookies()`). |
| `[Runfolio:error][actions.*]` | Server action threw — user may see a returned `{ error }` or a boundary. |
| `[Runfolio:error][Dashboard.supabase]` | Dashboard fell back to **demo data** after a Supabase failure. |

The **root** `app/error.tsx` and `app/global-error.tsx` boundaries show the error **message** in the UI and log `[Runfolio:client]` to the browser console.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- Race cards and layout follow a dark cinematic, minimal design system.
- If Supabase env vars are missing, the app runs in temporary **demo mode** with mock data. Set `RUNFOLIO_OFFLINE_DEMO=1` to force that even when URL/key are present (see `.env.example`).
