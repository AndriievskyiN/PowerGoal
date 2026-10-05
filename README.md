# PowerGoal

A single-user powerlifting training log built around an editable training sheet.
Plan blocks and sessions, log sets with autosaving inputs, and track strength,
volume, bodyweight, sleep, recovery, and steps. Weights are in kilograms.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts, and Convex.

## Run locally

Install Node.js 20.9 or newer and npm, then:

```bash
git clone https://github.com/AndriievskyiN/PowerGoal.git
cd PowerGoal
npm ci
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Keep Convex running. Follow its setup prompts to create your own local deployment;
it writes the connection settings to `.env.local`. The frontend requires
`NEXT_PUBLIC_CONVEX_URL` to point to that deployment.

In a second terminal:

```bash
npx next dev -p 3100
```

Open http://localhost:3100. The app uses Convex for persistent data; it is not a
standalone static site.

## Training program

The spreadsheet-derived program and its source extracts are included in
`docs/program-extract/`. To import the bundled program into your own deployment,
run this once while Convex is running:

```bash
node -e 'const fs = require("node:fs"); const { execFileSync } = require("node:child_process"); const seed = JSON.parse(fs.readFileSync("docs/program-extract/seed-program.json", "utf8")); execFileSync("npx", ["convex", "run", "seedProgram:importProgram", JSON.stringify({ seed, startDate: "2026-10-09" })], { stdio: "inherit" });'
```

Change `startDate` to your intended first Friday before importing. Running this
again creates another program. You can edit the program and training maxes in
the app afterward.

## Data and access

This repository includes application code, the extracted training template
(including its athlete fields and training maxes), and example-data generators.
Local environment files, credentials, and the live Convex database are not included.
Use your own deployment when trying the app.

The app currently assumes a single trusted user. Its Convex queries and mutations
do not implement user authentication or per-user access control. Add access
control before exposing a deployment containing personal training or health data.

Apple Health imports are optional. `POST /health` on the Convex HTTP endpoint
accepts Health Auto Export payloads and requires an `Authorization: Bearer ...`
header matching the deployment's `HEALTH_TOKEN` environment variable. Keep that
value out of Git.

## Development

```bash
npm run lint
npm run build
npm start
```

Building and running the frontend requires `NEXT_PUBLIC_CONVEX_URL`.

- [`AGENTS.md`](AGENTS.md) — project conventions and code map.
- [`docs/PLAN.md`](docs/PLAN.md) — original implementation plan; some status notes are historical.
