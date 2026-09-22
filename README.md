# PowerGoal

A training log for powerlifting. Programs are written as cycles of blocks, trained
session by session, and read back as progress — volume, intensity, and how the RPE
you logged compares to the RPE that was written.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

The app currently runs on a seed program in `src/lib/fixtures.ts` — a full 12-week
cycle with five weeks logged — so every screen is populated without a database.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold, design tokens, app shell | done |
| M1 Domain model, metrics, seed program | done |
| M2 Program grid — block matrix + week view | done |
| M3 Session logging UI | done (local state; no persistence yet) |
| M4 Exercise detail + e1RM chart | done |
| M5 Home overview | done |
| M6 Analytics — block over block | done |
| M7 Convex backend + auth + Railway deploy | schema written, not connected |

## Connecting the backend

1. `npx convex dev` — creates the deployment and generates `convex/_generated`
   (needs an interactive login the first time).
2. Write the queries/mutations against `convex/schema.ts`, then replace the
   `@/lib/fixtures` imports in `src/app/**` with `useQuery` calls. Components take
   plain props and don't know where data comes from, so nothing below the page
   level changes.
3. Google OAuth: create a client in Google Cloud Console, then set
   `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the Convex dashboard.
4. Railway: set `NEXT_PUBLIC_CONVEX_URL` to the deployment URL.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — the full implementation plan and domain model.
- [`AGENTS.md`](AGENTS.md) — conventions, design rules, where things live.
