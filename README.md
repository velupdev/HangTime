# HangTime

Measure a vertical jump from a phone video. Film a jump, drop the clip, mark takeoff and landing. HangTime uses flight time (`h = g t² / 8`) — same math as a jump mat.

**HangTime Plus** tracks results over time for one athlete or a roster. First 100 members: **$10 lifetime**. After that: **$10/year**.

Measuring stays free.

## Stack

TanStack Start, React, Postgres, Better Auth, Stripe.

## Local

```bash
npm install
npm run dev
```

Preview / local builds work without Postgres (embedded PGLite). Measuring stays available without sign-in.

## Deploy (Vercel)

`vite.config.ts` uses Nitro’s `vercel` preset. Link this GitHub repo to a Vercel project and set:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Production (Plus + persisted auth) | Postgres URL. Omit on preview to keep PGLite. |
| `BETTER_AUTH_SECRET` | When auth is on | Random 32+ byte secret. Do not commit the value. |
| `BETTER_AUTH_URL` | When auth is on | Public origin, e.g. `https://<project>.vercel.app` |
| `VITE_AUTH_ENABLED` | Recommended | `true` for real sign-in; `false` uses a local/dev user and must not be set with `DATABASE_URL` |
| Stripe | Optional | Plus checkout uses test Payment Links in `src/lib/plus/stripe.ts`. No Stripe secret is required for that path. |

See `.env.example` for the full list. Never commit `.env` / `.env.local`.
