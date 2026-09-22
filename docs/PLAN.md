# PowerGoal — Implementation Plan

A single-user powerlifting training app. Replaces the Excel program sheet with something
that is (a) as fast to read as the spreadsheet and (b) actually able to show progress
block-over-block and cycle-over-cycle.

## Decisions (locked)

| Area | Decision |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 |
| Backend/DB | Convex (reactive queries, no REST layer, no loading-state plumbing) |
| Auth | Convex Auth, Google provider, single user for now |
| Hosting | Next.js on Railway, Convex on Convex Cloud |
| Units | kg |
| Theme | Light only. Crisp product UI — grey canvas, white cards, 1px borders, Inter, tabular numerals |
| Charts | Recharts, one accent + per-lift colors, no chartjunk |
| v1 scope | Programs → grid → inline edit/log → exercise detail → home overview → analytics |

Explicitly **not** in v1: spreadsheet import, calendar view, video storage, nutrition,
sleep, multi-user, mobile app.

## Domain model

Powerlifting nesting, matching how you actually train:

```
Program  (= one cycle, e.g. "Craftsman Powerbuilding — 12 weeks")
└── Block (4 weeks, e.g. "Block 1 — Hypertrophy")
    └── Week (week 1..4)
        └── Session (Day 1 / Saturday / 2026-02-28)
            └── Prescription (row: SQUAT · Competition Squat · 3×5 @ 147.5)
                └── Log (weights[], reps[], LSRPE, notes, PR flag)
```

### Tables (Convex)

- **programs** — name, description, coverColor, coverImage, startDate, meetDate?, status
  (`active` | `draft` | `archived`), notes
- **blocks** — programId, name, focus, order, weekCount, startDate
- **weeks** — programId, blockId, blockWeekIndex (1..4), programWeekIndex (1..12), startDate
- **sessions** — programId, blockId, weekId, dayNumber, weekday, date, name, motivation,
  notes, status (`planned` | `done` | `skipped`), completedAt
- **exercises** — name, group (`SQUAT` | `BENCH` | `DEADLIFT` | `QUADS` | `HAMSTRINGS` |
  `BACK` | `SHOULDERS` | `ARMS` | `OTHER`), isMainLift, aliases[]
- **prescriptions** — sessionId (+ denormalized programId/blockId/weekId for cheap
  analytics), exerciseId, order, sets, reps,
  `load: { kind: "absolute", kg } | { kind: "rpe", rpe } | { kind: "percent", pct }`,
  beRange?, teRange?, notes
- **logs** — prescriptionId, sessionId, exerciseId, date, weights[], reps[], lsrpe?,
  notes, videoUrl?
- **prs** — exerciseId, kind (`1rm` | `3rm` | `5rm` | `e1rm`), kg, reps, date, sessionId

`weights[]` mirrors the spreadsheet convention (comma-separated weights per row), so a
row can be `140, 142.5, 145` across three sets and analytics still work.

### Derived metrics

- **e1RM** — RPE chart lookup (reps + RPE → %1RM, Tuchscherer table), Epley fallback when
  no RPE was logged.
- **Tonnage** — Σ weight×reps, rolled up per session / week / block / lift group.
- **Intensity** — top set kg, and top set as % of best e1RM for that lift.
- **RPE adherence** — logged LSRPE − prescribed RPE. Positive = the session was harder than
  written. This is the signal for whether a block is running hot.

## Information architecture

Sidebar, five items, nothing else:

```
Home          overview of the current week + block
Programs      card grid of cycles
Current block the active block's grid (deep link to Programs)
Exercises     library → per-exercise history
Analytics     volume / intensity / RPE over block + cycle
```

### Home
Small. Not a wall of tiles.
1. **Next session** card — date, day name, every prescribed row exactly as written, one
   primary button ("Start logging").
2. **This week** — 3 numbers: sessions done / total, weekly tonnage vs last week, average
   RPE delta.
3. **One line chart**, full width, with a segmented control: `Volume · Intensity · RPE`,
   and a scope toggle: `Block · Cycle`. One chart that answers three questions beats three
   charts.

### Program grid (the heart)
Two views over the same data:
- **Week view** (default) — one week, sessions as columns, rows are prescriptions. Reads
  like the spreadsheet but breathes.
- **Block matrix** — one day across all 4 weeks side by side (exactly your Excel layout),
  so progression is visible at a glance.
Cells are editable in place: click, type, Tab moves on. Logged weight and LSRPE live in
the same row as the prescription, greyed until filled.

### Exercise detail
Recent sessions table (date, prescribed, logged, e1RM), e1RM line over time with block
boundaries marked, tonnage bars per block, PR list.

## Milestones

- **M0 — Scaffold** ✅ Next.js + Tailwind + app shell + design tokens.
- **M1 — Data** ✅ domain model, metrics helpers, seed cycle (Convex schema written).
- **M2 — Program grid** ✅ block matrix + week view + program card grid.
- **M3 — Logging** ✅ session logger UI. Persistence lands with Convex.
- **M4 — Exercise detail** ✅ history table + e1RM chart.
- **M5 — Home** ✅ next session, week stats, switchable chart.
- **M6 — Analytics** ✅ block-over-block table, per-lift cycle deltas.
- **M7 — Backend & ship** ⬜ Convex deployment, queries/mutations, Google auth,
  Railway. PR detection and the program editor land here too.

## Status (19 Sept 2026)

Live on a local Convex deployment:

- Program imported from the Craftsmanship spreadsheet: 4 blocks, 16 weeks, 47 sessions,
  3 sessions a week (Fri = sheet day 1, Mon = days 5 + 4, Wed = day 6).
- Dashboard sheet logs weight and LSRPE per row, edits sets/reps/load/exercise, autosaves.
  Percent and back-off loads resolve live from training maxes and logged top sets.
- Program editor: name, start and meet dates (moving the start shifts every session and
  log), training maxes, rounding, block name and focus, and a day × week matrix where
  names, order, additions and removals apply across the whole block.
- Daily log: weight, sleep, recovery, steps, HRV, resting HR, notes; sample history
  removable in one click.
- `POST /health` accepts Health Auto Export JSON. Needs a cloud deployment to be
  reachable from the phone.

- Analytics: e1RM and heaviest set per session/week/month, top sets vs BE–TE range,
  RPE vs plan, weekly tonnage, sets per muscle group, block-over-block and
  week-over-week tables, recovery trends, and a correlation view ranking every daily
  variable against session performance. Shows example data until 3 sessions are logged.

Next: Convex Cloud + Google sign-in, meet-day projection, PR detection.

## Setup you'll need to do once

1. `npx convex dev` — log in / create the Convex project (interactive, needs your account).
2. Google OAuth client (Cloud Console) → set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in
   Convex env vars.
3. Railway project → set `NEXT_PUBLIC_CONVEX_URL` + auth env vars.
