<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PowerGoal

Single-user powerlifting training log. Replaces a spreadsheet, so the training
sheet is the product. Everything else supports it.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Recharts ·
Convex (live, local anonymous deployment for now) · deploys to Railway.

Run it: `CONVEX_AGENT_MODE=anonymous npx convex dev` and `npx next dev -p 3100`.

## Where things live

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Dashboard: four daily-variable cards + the training sheet. |
| `src/app/program/` | Program editor: settings, training maxes, block tabs, day × week matrix. |
| `src/app/log/` | Daily log: one editable row per day. |
| `src/app/analytics/` | Tabs: strength, volume, blocks & weeks, recovery, what moves training. |
| `src/lib/analytics.ts` | All analytics maths, plus the in-memory example dataset. |
| `src/components/dash/` | All UI. `shell.tsx` is the sidebar layout, `field.tsx` the autosaving input. |
| `convex/schema.ts` | Database schema. `programs.ts`, `logs.ts`, `dailyMetrics.ts` hold the functions. |
| `convex/http.ts` | `POST /health` for Apple Health (Health Auto Export). Token in `HEALTH_TOKEN`. |
| `src/lib/program-tree.ts` | Converts the Convex tree into the domain `Program` in `types.ts`. |
| `src/lib/lifting.ts` | RPE chart, e1RM, `resolveLoad` for percent loads, formatting. |
| `src/lib/load-text.ts` | Parses what is typed into a Load cell. |
| `docs/program-extract/` | The spreadsheet, extracted. `seed-program.json` feeds `convex/seedProgram.ts`. |

## Design rules

- Dark "ember" theme only (`.theme-ember` in `globals.css`). Warm charcoal, off-white text.
- Geist for words and numbers, with tabular figures. Numerals get `.num`.
- Orange (`--color-accent`) means action or "now": primary button, today marker, steps.
- Variables have fixed colors: bodyweight neutral, sleep blue, recovery green, steps orange.
- One card recipe: `.panel`. Card headers use `CardHeader` with a colored icon tile.
- Never put a colored bar on the left edge of a card or row.
- Inputs in sheets are `.cell`: invisible until hovered or focused. Everything autosaves.
- Never use `.grid` as a class name. It collides with Tailwind's `display: grid`.

## Conventions

- kg everywhere. `kg()` formats (147.5, not 147.50).
- A row's logged weights are an array: `[140, 142.5, 145]` is one row, three sets.
- Loads are `rpe`, `absolute`, `percent` of a training max, or `percentOfRow`
  (a back-off from the weight logged on another row). Reordering rows keeps those links.
- A session is done once its date has passed. There is no completion step.
- e1RM comes from the RPE chart when an RPE was logged, Epley otherwise. The chart is
  one curve (one RPE point = one rep in reserve), so RPE 5–6 top sets work too.
- Analytics e1RM uses top sets of the competition lifts only, not pause variations.
