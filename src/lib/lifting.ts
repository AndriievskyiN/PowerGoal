import type { Load, LiftGroup, Prescription, Session } from "./types";

/* ---------------------------------------------------------------- RPE chart */

/**
 * Tuchscherer RPE chart: percentage of 1RM for a given rep count at a given RPE.
 * Rows are RPE 10 down to 6.5, columns are 1–12 reps.
 */
const RPE_CHART: Record<string, number[]> = {
  "10": [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0],
  "9.5": [97.8, 94.3, 91.1, 88.1, 85.1, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7],
  "9": [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3],
  "8.5": [94.3, 91.1, 88.1, 85.1, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0],
  "8": [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6],
  "7.5": [91.1, 88.1, 85.1, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3],
  "7": [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0, 65.3, 62.6, 59.9],
  "6.5": [88.1, 85.1, 82.4, 79.9, 77.4, 75.1, 72.3, 69.4, 66.7, 64.0, 61.3, 58.6],
};

/**
 * Percentage of 1RM a set of `reps` at `rpe` represents.
 *
 * The chart follows one rule: each RPE point below 10 is one rep in reserve, so
 * "3 reps @ 8" sits where "5 reps @ 10" does. Using that rule on the RPE 10 row
 * reproduces every cell above and extends it to RPE 5–6, where this program's
 * early top sets live. Past 12 reps it continues along an Epley curve.
 */
export function percentOf1RM(reps: number, rpe: number): number | null {
  if (reps < 1 || rpe > 10.5) return null;
  return pctAtEffectiveReps(reps + (10 - rpe));
}

/**
 * The chart as one curve on a half-rep grid: x = reps + (10 − RPE).
 * Whole steps come from the RPE 10 row, half steps from the RPE 9.5 row.
 */
const GRID: number[] = RPE_CHART["10"].flatMap((v, i) => [v, RPE_CHART["9.5"][i]]); // x = 1, 1.5, 2, … 12.5

function pctAtEffectiveReps(x: number): number | null {
  if (x < 1) return null;
  const pos = (x - 1) * 2;
  const last = GRID.length - 1;
  if (pos <= last) {
    const i = Math.floor(pos);
    const f = pos - i;
    return GRID[i] + ((GRID[Math.min(i + 1, last)] - GRID[i]) * f);
  }
  // Past the chart, keep its closing slope (about 2.7% per rep).
  return Math.max(30, GRID[last] - (pos - last) * 1.35);
}

/** The RPE a set was, given its weight as a percentage of 1RM. Inverse of `percentOf1RM`. */
export function rpeFor(pctOf1RM: number, reps: number): number {
  if (pctOf1RM >= 100) return 10;
  let lo = 1;
  let hi = 30;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((pctAtEffectiveReps(mid) ?? 0) > pctOf1RM) lo = mid;
    else hi = mid;
  }
  return 10 - (lo - reps);
}

/**
 * Estimated 1RM. Uses the RPE chart when an RPE was logged (far more accurate for
 * powerlifting), and falls back to Epley when it wasn't.
 */
export function e1rm(weightKg: number, reps: number, rpe?: number): number | null {
  if (!weightKg || !reps) return null;
  if (rpe != null) {
    const pct = percentOf1RM(reps, rpe);
    if (pct) return round(weightKg / (pct / 100), 0.5);
  }
  return round(weightKg * (1 + reps / 30), 0.5);
}

/** The load a target RPE implies, given a known 1RM. */
export function loadForRpe(oneRm: number, reps: number, rpe: number): number | null {
  const pct = percentOf1RM(reps, rpe);
  return pct ? round((oneRm * pct) / 100, 2.5) : null;
}

/* ------------------------------------------------------------- plate loading */

/** IPF calibrated plates, heaviest first. Colors are the real disc colors. */
export const PLATES: { kg: number; color: string; ring?: boolean }[] = [
  { kg: 25, color: "var(--color-plate-25)" },
  { kg: 20, color: "var(--color-plate-20)" },
  { kg: 15, color: "var(--color-plate-15)" },
  { kg: 10, color: "var(--color-plate-10)" },
  { kg: 5, color: "#ffffff", ring: true },
  { kg: 2.5, color: "#14171c" },
  { kg: 1.25, color: "#b4bac3" },
  { kg: 0.5, color: "#d3d7dd" },
];

export const BAR_KG = 20;

/**
 * Plates to load per side for a total bar weight. Returns an empty list when the
 * weight is below the bar or can't be made with standard discs.
 */
export function plateLoad(totalKg: number, barKg = BAR_KG) {
  let perSide = (totalKg - barKg) / 2;
  if (perSide <= 0) return [];
  const out: { kg: number; color: string; ring?: boolean }[] = [];
  for (const plate of PLATES) {
    while (perSide >= plate.kg - 1e-9 && out.length < 12) {
      out.push(plate);
      perSide = round(perSide - plate.kg, 0.01);
    }
  }
  return out;
}

/* ------------------------------------------------------------------- volume */

/** Total kg moved in a logged row. */
export function tonnage(p: Prescription): number {
  if (!p.log) return 0;
  const { weights, reps } = p.log;
  return weights.reduce((sum, w, i) => sum + w * (reps[i] ?? reps[0] ?? 0), 0);
}

export function sessionTonnage(s: Session): number {
  return s.prescriptions.reduce((sum, p) => sum + tonnage(p), 0);
}

/** Heaviest single weight logged in a row. */
export function topSet(p: Prescription): number | null {
  if (!p.log?.weights.length) return null;
  return Math.max(...p.log.weights);
}

/**
 * Logged RPE minus prescribed RPE. Positive means the session ran harder than
 * written — the number that tells you a block is cooking you.
 */
export function rpeDelta(p: Prescription): number | null {
  if (p.load.kind !== "rpe" || p.log?.lsrpe == null) return null;
  return round(p.log.lsrpe - p.load.rpe, 0.1);
}

/* ----------------------------------------------------------------- formatting */

export function round(n: number, step: number): number {
  const r = Math.round(n / step) * step;
  return Math.round(r * 1000) / 1000;
}

/** Weights read as 147.5 and 140, never 147.50 or 140.0. */
export function kg(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(Math.round(n * 100) / 100);
}

export function formatLoad(load: Load): string {
  switch (load.kind) {
    case "absolute":
      return kg(load.kg);
    case "rpe":
      return `${load.rpe} RPE`;
    case "percent":
      return `${load.pct}%${load.of ? ` ${load.of[0].toUpperCase()}` : ""}`;
    case "percentOfRow":
      return `${load.pct}% of #${load.ofOrder + 1}`;
  }
}

/** Collapses [140,140,140] to "140" and keeps [140,142.5,145] as written. */
export function formatWeights(weights: number[]): string {
  if (!weights.length) return "—";
  const allSame = weights.every((w) => w === weights[0]);
  return allSame ? kg(weights[0]) : weights.map(kg).join(", ");
}

export const GROUP_COLOR: Record<LiftGroup, { fg: string; bg: string }> = {
  SQUAT: { fg: "var(--color-squat)", bg: "var(--color-squat-soft)" },
  BENCH: { fg: "var(--color-bench)", bg: "var(--color-bench-soft)" },
  DEADLIFT: { fg: "var(--color-deadlift)", bg: "var(--color-deadlift-soft)" },
  QUADS: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  HAMSTRINGS: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  BACK: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  SHOULDERS: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  ARMS: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  CHEST: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  ABS: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
  OTHER: { fg: "var(--color-accessory)", bg: "var(--color-accessory-soft)" },
};

/**
 * Turn a prescription's load into kilograms where the program can compute it.
 * `rowWeights` are the weights logged so far on this session's rows, by order.
 * Returns null when a percent-of-row load is waiting on a weight to be entered.
 */
export function resolveLoad(
  load: Load,
  ctx: { maxes?: { squat?: number; bench?: number; deadlift?: number }; rounding?: number; rowWeights: (number | null)[] },
): number | null {
  const step = ctx.rounding ?? 2.5;
  switch (load.kind) {
    case "absolute":
      return load.kg;
    case "rpe":
      return null;
    case "percent": {
      const max = load.of ? ctx.maxes?.[load.of] : undefined;
      return max ? round((max * load.pct) / 100, step) : null;
    }
    case "percentOfRow": {
      const base = ctx.rowWeights[load.ofOrder];
      return base ? round((base * load.pct) / 100, step) : null;
    }
  }
}
