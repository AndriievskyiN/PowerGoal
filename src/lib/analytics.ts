/**
 * Analytics over the program tree and daily metrics. Pure functions, no React.
 * Everything works on a `Dataset` so real data and example data share one path.
 */
import type { Tree } from "./program-tree";
import type { Load } from "./types";
import { e1rm, kg, loadForRpe, resolveLoad, round, rpeFor } from "./lifting";
import { addDays, shortDate } from "./dates";

export type Lift = "SQUAT" | "BENCH" | "DEADLIFT";
export const LIFTS: Lift[] = ["SQUAT", "BENCH", "DEADLIFT"];
export const LIFT_LABEL: Record<Lift, string> = { SQUAT: "Squat", BENCH: "Bench", DEADLIFT: "Deadlift" };
export const LIFT_COLOR: Record<Lift, string> = { SQUAT: "var(--color-squat)", BENCH: "var(--color-bench)", DEADLIFT: "var(--color-deadlift)" };

export const GROUPS = ["SQUAT", "BENCH", "DEADLIFT", "QUADS", "HAMSTRINGS", "BACK", "CHEST", "SHOULDERS", "ARMS", "ABS", "OTHER"] as const;
export const GROUP_LABEL: Record<string, string> = {
  SQUAT: "Squat", BENCH: "Bench", DEADLIFT: "Deadlift", QUADS: "Quads", HAMSTRINGS: "Hamstrings & glutes",
  BACK: "Back", CHEST: "Chest", SHOULDERS: "Shoulders", ARMS: "Arms", ABS: "Abs", OTHER: "Other",
};

export type DayKey = "weight" | "sleep" | "recovery" | "steps" | "hrv" | "rhr" | "carbs" | "calories" | "protein";
export const DAY_META: Record<DayKey, { label: string; unit: string; color: string; digits: number; kind: "bar" | "line" }> = {
  weight: { label: "Bodyweight", unit: "kg", color: "var(--color-weight)", digits: 1, kind: "line" },
  sleep: { label: "Sleep", unit: "h", color: "var(--color-sleep)", digits: 1, kind: "bar" },
  recovery: { label: "Recovery", unit: "/10", color: "var(--color-recovery)", digits: 1, kind: "line" },
  steps: { label: "Steps", unit: "", color: "var(--color-steps)", digits: 0, kind: "bar" },
  hrv: { label: "HRV", unit: "ms", color: "#b78cf2", digits: 0, kind: "line" },
  rhr: { label: "Resting HR", unit: "bpm", color: "#e0719a", digits: 0, kind: "line" },
  carbs: { label: "Carbs", unit: "g", color: "#e8c35a", digits: 0, kind: "bar" },
  calories: { label: "Calories", unit: "kcal", color: "#d9a37a", digits: 0, kind: "bar" },
  protein: { label: "Protein", unit: "g", color: "#7fc4c9", digits: 0, kind: "bar" },
};

export interface ARow {
  name: string;
  group: string;
  /** Set only for the competition lifts themselves, not their variations. */
  lift: Lift | null;
  sets: number;
  reps: number;
  load: Load;
  target?: number;
  be?: number;
  te?: number;
  isTop: boolean;
  weights: number[];
  repsDone: number[];
  lsrpe?: number;
}

export interface ASession {
  id: string;
  date: string;
  name: string;
  blockId: string;
  blockName: string;
  blockOrder: number;
  programWeek: number;
  blockWeek: number;
  rows: ARow[];
}

export type ADay = { date: string } & Partial<Record<DayKey, number>>;
export interface ABlock { id: string; name: string; order: number; start: string; end: string; weeks: number[] }

export interface Dataset {
  sessions: ASession[];
  days: ADay[];
  blocks: ABlock[];
  today: string;
  example: boolean;
}

/* ------------------------------------------------------------- building */

function liftOf(group: string, name: string, isMain: boolean): Lift | null {
  if (group !== "SQUAT" && group !== "BENCH" && group !== "DEADLIFT") return null;
  if (!isMain || /pause/i.test(name)) return null;
  return group;
}

export function fromTree(tree: Tree, days: ADay[], today: string): Dataset {
  const blocks: ABlock[] = tree.blocks.map((b) => ({
    id: b._id,
    name: b.name,
    order: b.order,
    start: b.weeks[0]?.startDate ?? tree.program.startDate,
    end: addDays(b.weeks.at(-1)?.startDate ?? tree.program.startDate, 6),
    weeks: b.weeks.map((w) => w.programWeekIndex),
  }));
  const sessions: ASession[] = tree.blocks.flatMap((b) =>
    b.weeks.flatMap((w) =>
      w.sessions.map((s) => ({
        id: s._id,
        date: s.date,
        name: s.name ?? "",
        blockId: b._id,
        blockName: b.name,
        blockOrder: b.order,
        programWeek: w.programWeekIndex,
        blockWeek: w.blockWeekIndex,
        rows: s.prescriptions.map((p) => {
          const group = p.exercise?.group ?? "OTHER";
          const name = p.exercise?.name ?? "";
          const lift = liftOf(group, name, p.exercise?.isMainLift ?? false);
          const load = p.load as Load;
          return {
            name, group, lift, sets: p.sets, reps: p.reps, load,
            target: load.kind === "rpe" ? load.rpe : undefined,
            be: p.beRange, te: p.teRange,
            isTop: lift != null && load.kind === "rpe" && (p.beRange != null || p.sets <= 2),
            weights: p.log?.weights ?? [],
            repsDone: p.log?.reps ?? [],
            lsrpe: p.log?.lsrpe,
          };
        }),
      })),
    ),
  );
  return { sessions: sessions.sort((a, b) => (a.date < b.date ? -1 : 1)), days, blocks, today, example: false };
}

export function loggedSessions(ds: Dataset) {
  return ds.sessions.filter((s) => s.date <= ds.today && s.rows.some((r) => r.weights.length));
}

/* ------------------------------------------------------ example dataset */

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Ten weeks of plausible training and recovery on your real program, built in
 * memory so the views can be judged before there is real history. Sleep,
 * recovery and carbs nudge performance, so the correlation view has signal.
 */
export function exampleFrom(tree: Tree): Dataset {
  const base = fromTree(tree, [], tree.program.startDate);
  const weeks = tree.blocks.flatMap((b) => b.weeks);
  const asOf = weeks[Math.min(weeks.length, 10) - 1];
  const today = addDays(asOf.startDate, 6);
  const rand = prng(42);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

  const days: ADay[] = [];
  let weight = 91.6;
  for (let d = addDays(tree.program.startDate, -21); d <= today; d = addDays(d, 1)) {
    weight += 0.008 + gauss() * 0.09 - (weight - 92.4) * 0.05;
    const sleep = clamp(7.2 + gauss() * 0.75, 4.75, 9.5);
    const recovery = clamp(Math.round(4 + (sleep - 5) * 1.1 + gauss() * 1.1), 1, 10);
    const carbs = Math.round((340 + gauss() * 70) / 5) * 5;
    const protein = Math.round((190 + gauss() * 20) / 5) * 5;
    if (rand() < 0.06) continue;
    days.push({
      date: d,
      weight: Math.round(weight * 10) / 10,
      sleep: round(sleep, 0.25),
      recovery,
      hrv: Math.round(46 + recovery * 2.3 + gauss() * 5),
      rhr: Math.round(62 - recovery * 0.9 + gauss() * 2),
      steps: Math.max(1500, Math.round((7200 + gauss() * 2600) / 100) * 100),
      carbs,
      protein,
      calories: Math.round((carbs * 4 + protein * 4 + (85 + gauss() * 15) * 9) / 10) * 10,
    });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  const trueMax = (lift: Lift, week: number) => ({ SQUAT: 203 + week * 1.3, BENCH: 151 + week * 0.6, DEADLIFT: 251 + week * 1.6 })[lift];

  for (const s of base.sessions) {
    for (const r of s.rows) { r.weights = []; r.repsDone = []; r.lsrpe = undefined; }
    if (s.date > today) continue;
    const v = byDate.get(s.date);
    const ready = 1 + 0.012 * ((v?.sleep ?? 7.2) - 7.2) + 0.004 * ((v?.recovery ?? 7) - 7) + 0.00007 * ((v?.carbs ?? 340) - 340) + gauss() * 0.007;
    const rowWeights: (number | null)[] = [];
    for (const r of s.rows) {
      let w: number | null = null;
      let rpe: number | undefined;
      const g = r.group === "SQUAT" || r.group === "BENCH" || r.group === "DEADLIFT" ? (r.group as Lift) : null;
      if (g) {
        const max = trueMax(g, s.programWeek) * ready * (r.lift ? 1 : 0.9);
        if (r.load.kind === "rpe") {
          w = r.be != null && r.te != null ? round((r.be + r.te) / 2 + (ready - 1) * 400 + gauss() * 4, 2.5) : loadForRpe(max, r.reps, r.load.rpe);
        } else {
          w = resolveLoad(r.load, { maxes: tree.program.maxes, rounding: 2.5, rowWeights });
        }
        if (w) rpe = clamp(round(rpeFor((w / max) * 100, r.reps), 0.5), 5, 10);
      } else {
        w = round((20 + (hash(r.name) % 80)) * (1 + s.programWeek * 0.01), 2.5);
        if (r.target != null) rpe = clamp(round(r.target + gauss() * 0.5 - (ready - 1) * 25, 0.5), 5, 10);
      }
      rowWeights.push(w);
      if (w) {
        r.weights = [w];
        r.repsDone = Array(r.sets).fill(r.reps);
        r.lsrpe = rpe;
      }
    }
  }
  return { ...base, days, today, example: true };
}

/* --------------------------------------------------------- per row maths */

export function rowTonnage(r: ARow) {
  if (!r.weights.length) return 0;
  const ws = r.weights.length === 1 ? Array(r.sets).fill(r.weights[0]) : r.weights;
  return ws.reduce((s: number, w: number, i: number) => s + w * (r.repsDone[i] ?? r.reps), 0);
}

export function rowE1rm(r: ARow) {
  if (!r.weights.length) return null;
  return e1rm(Math.max(...r.weights), r.repsDone[0] ?? r.reps, r.lsrpe);
}

function describe(r: ARow) {
  return `${kg(Math.max(...r.weights))} × ${r.repsDone[0] ?? r.reps}${r.lsrpe != null ? ` @ ${r.lsrpe}` : ""}`;
}

/* ------------------------------------------------------------- strength */

export type Bucket = "session" | "week" | "month";

export interface Point {
  key: string;
  label: string;
  date: string;
  blockId: string;
  SQUAT: number | null;
  BENCH: number | null;
  DEADLIFT: number | null;
  detail: Partial<Record<Lift, string>>;
}

function bucketOf(s: ASession, b: Bucket) {
  if (b === "session") return { key: s.date, label: shortDate(s.date) };
  if (b === "week") return { key: `W${String(s.programWeek).padStart(2, "0")}`, label: `W${s.programWeek}` };
  const m = s.date.slice(0, 7);
  return { key: m, label: new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }) };
}

/** Best value per lift per bucket. `e1rm` uses top sets only; `heaviest` uses every competition-lift set. */
export function strengthSeries(ds: Dataset, bucket: Bucket, metric: "e1rm" | "heaviest"): Point[] {
  const map = new Map<string, Point>();
  for (const s of loggedSessions(ds)) {
    for (const r of s.rows) {
      if (!r.lift || !r.weights.length) continue;
      if (metric === "e1rm" && !r.isTop) continue;
      const val = metric === "e1rm" ? rowE1rm(r) : Math.max(...r.weights);
      if (!val) continue;
      const { key, label } = bucketOf(s, bucket);
      const p = map.get(key) ?? { key, label, date: s.date, blockId: s.blockId, SQUAT: null, BENCH: null, DEADLIFT: null, detail: {} };
      if (p[r.lift] == null || val > p[r.lift]!) {
        p[r.lift] = val;
        p.detail[r.lift] = `${describe(r)} · ${shortDate(s.date)}`;
      }
      map.set(key, p);
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

export interface LiftSummary {
  lift: Lift;
  current: number | null;
  start: number | null;
  best: number | null;
  bestDetail?: string;
  heaviest: number | null;
  heaviestDetail?: string;
  points: number;
}

export function liftSummaries(ds: Dataset): LiftSummary[] {
  const e = strengthSeries(ds, "session", "e1rm");
  const h = strengthSeries(ds, "session", "heaviest");
  return LIFTS.map((lift) => {
    const pts = e.filter((p) => p[lift] != null);
    // "Current" smooths out one bad day: best of the last three top sets.
    const recent = pts.slice(-3).map((p) => p[lift]!);
    const bestP = pts.reduce<Point | null>((a, p) => (!a || p[lift]! > a[lift]! ? p : a), null);
    const heavy = h.filter((p) => p[lift] != null).reduce<Point | null>((a, p) => (!a || p[lift]! > a[lift]! ? p : a), null);
    return {
      lift,
      current: recent.length ? Math.max(...recent) : null,
      start: pts.length ? Math.max(...pts.slice(0, 3).map((p) => p[lift]!)) : null,
      best: bestP?.[lift] ?? null,
      bestDetail: bestP?.detail[lift],
      heaviest: heavy?.[lift] ?? null,
      heaviestDetail: heavy?.detail[lift],
      points: pts.length,
    };
  });
}

/** Men's DOTS coefficient. Compares totals across bodyweights. */
export function dots(totalKg: number, bw: number) {
  const den = -307.75076 + 24.0900756 * bw - 0.1918759221 * bw ** 2 + 0.0007391293 * bw ** 3 - 0.000001093 * bw ** 4;
  return (totalKg * 500) / den;
}

export function latestDay(ds: Dataset, key: DayKey) {
  for (let i = ds.days.length - 1; i >= 0; i--) {
    const d = ds.days[i];
    if (d.date <= ds.today && d[key] != null) return { date: d.date, value: d[key]! };
  }
  return null;
}

export interface TopSetCheck {
  date: string;
  lift: Lift;
  set: string;
  weight: number;
  be: number;
  te: number;
  verdict: "below" | "in" | "above";
}

/** Every logged top set that had a BE–TE range, and where it landed. */
export function topSetChecks(ds: Dataset): TopSetCheck[] {
  const out: TopSetCheck[] = [];
  for (const s of loggedSessions(ds)) {
    for (const r of s.rows) {
      if (!r.lift || !r.isTop || !r.weights.length || r.be == null || r.te == null) continue;
      const w = Math.max(...r.weights);
      out.push({ date: s.date, lift: r.lift, set: describe(r), weight: w, be: r.be, te: r.te, verdict: w < r.be ? "below" : w > r.te ? "above" : "in" });
    }
  }
  return out;
}

/** Average of (logged last-set RPE − target RPE) for a list of rows. Positive means harder than written. */
function drift(rows: ARow[]) {
  const xs = rows.filter((r) => r.target != null && r.lsrpe != null && r.weights.length).map((r) => r.lsrpe! - r.target!);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function sessionDrift(s: ASession) {
  return drift(s.rows);
}

/* --------------------------------------------------------------- volume */

export interface VolumeWeek {
  week: number;
  label: string;
  blockId: string;
  start: string;
  SQUAT: number;
  BENCH: number;
  DEADLIFT: number;
  ACCESSORY: number;
  total: number;
  sets: Record<string, number>;
  hardSets: Record<string, number>;
  drift: number | null;
  sessions: number;
}

export function volumeWeeks(ds: Dataset): VolumeWeek[] {
  const map = new Map<number, VolumeWeek & { _rows: ARow[] }>();
  for (const s of loggedSessions(ds)) {
    const w = map.get(s.programWeek) ?? {
      week: s.programWeek, label: `W${s.programWeek}`, blockId: s.blockId, start: s.date,
      SQUAT: 0, BENCH: 0, DEADLIFT: 0, ACCESSORY: 0, total: 0, sets: {}, hardSets: {}, drift: null, sessions: 0, _rows: [],
    };
    w.sessions++;
    if (s.date < w.start) w.start = s.date;
    for (const r of s.rows) {
      if (!r.weights.length) continue;
      const t = rowTonnage(r);
      const bucket = r.group === "SQUAT" || r.group === "BENCH" || r.group === "DEADLIFT" ? r.group : "ACCESSORY";
      w[bucket as "SQUAT"] += t;
      w.total += t;
      const g = (GROUPS as readonly string[]).includes(r.group) ? r.group : "OTHER";
      w.sets[g] = (w.sets[g] ?? 0) + r.sets;
      if ((r.lsrpe ?? r.target ?? 0) >= 7) w.hardSets[g] = (w.hardSets[g] ?? 0) + r.sets;
      w._rows.push(r);
    }
    map.set(s.programWeek, w);
  }
  return [...map.values()]
    .sort((a, b) => a.week - b.week)
    .map(({ _rows, ...w }) => ({ ...w, drift: drift(_rows) }));
}

/* --------------------------------------------------------------- blocks */

export interface BlockRow {
  block: ABlock;
  sessionsLogged: number;
  sessionsPlanned: number;
  tonnage: number;
  weeklyTonnage: number | null;
  best: Record<Lift, number | null>;
  delta: Record<Lift, number | null>;
  drift: number | null;
  inRange: number | null;
  started: boolean;
  /** Weeks of this block that have begun, and whether it is still running. */
  weeksElapsed: number;
  inProgress: boolean;
}

export function blockRows(ds: Dataset): BlockRow[] {
  const vol = volumeWeeks(ds);
  const checks = topSetChecks(ds);
  const rows: BlockRow[] = [];
  for (const b of ds.blocks) {
    const sess = ds.sessions.filter((s) => s.blockId === b.id);
    const logged = loggedSessions(ds).filter((s) => s.blockId === b.id);
    const weeks = vol.filter((w) => w.blockId === b.id);
    const best = Object.fromEntries(
      LIFTS.map((l) => {
        const xs = logged.flatMap((s) => s.rows.filter((r) => r.lift === l && r.isTop).map(rowE1rm)).filter((v): v is number => v != null);
        return [l, xs.length ? Math.max(...xs) : null];
      }),
    ) as Record<Lift, number | null>;
    const prev = rows.at(-1);
    const delta = Object.fromEntries(LIFTS.map((l) => [l, prev && prev.best[l] != null && best[l] != null ? best[l]! - prev.best[l]! : null])) as Record<Lift, number | null>;
    const c = checks.filter((x) => logged.some((s) => s.date === x.date));
    const tonnage = weeks.reduce((a, w) => a + w.total, 0);
    rows.push({
      block: b,
      sessionsLogged: logged.length,
      sessionsPlanned: sess.filter((s) => s.date <= ds.today).length,
      tonnage,
      weeklyTonnage: weeks.length ? tonnage / weeks.length : null,
      best,
      delta,
      drift: drift(logged.flatMap((s) => s.rows)),
      inRange: c.length ? c.filter((x) => x.verdict !== "below").length / c.length : null,
      started: b.start <= ds.today,
      weeksElapsed: b.weeks.filter((wk) => (ds.sessions.find((x) => x.programWeek === wk)?.date ?? "9999") <= ds.today).length,
      inProgress: b.start <= ds.today && b.end >= ds.today,
    });
  }
  return rows;
}

export interface WeekRow {
  week: number;
  blockWeek: number;
  start: string;
  tonnage: number | null;
  change: number | null;
  best: Record<Lift, number | null>;
  drift: number | null;
  future: boolean;
}

export function weekRows(ds: Dataset, blockId: string): WeekRow[] {
  const block = ds.blocks.find((b) => b.id === blockId);
  if (!block) return [];
  const vol = new Map(volumeWeeks(ds).map((w) => [w.week, w]));
  const logged = loggedSessions(ds);
  return block.weeks.map((wk, i) => {
    const v = vol.get(wk);
    const prevV = vol.get(wk - 1);
    const sess = logged.filter((s) => s.programWeek === wk);
    const start = ds.sessions.find((s) => s.programWeek === wk)?.date ?? "";
    const best = Object.fromEntries(
      LIFTS.map((l) => {
        const xs = sess.flatMap((s) => s.rows.filter((r) => r.lift === l && r.isTop).map(rowE1rm)).filter((x): x is number => x != null);
        return [l, xs.length ? Math.max(...xs) : null];
      }),
    ) as Record<Lift, number | null>;
    return {
      week: wk,
      blockWeek: i + 1,
      start,
      tonnage: v?.total ?? null,
      change: v && prevV ? (v.total - prevV.total) / prevV.total : null,
      best,
      drift: v?.drift ?? null,
      future: start > ds.today,
    };
  });
}

/* ------------------------------------------------------ recovery trends */

export function dayRange(ds: Dataset, days: number) {
  const from = addDays(ds.today, -(days - 1));
  const byDate = new Map(ds.days.map((d) => [d.date, d]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { ...(byDate.get(date) ?? {}), date } as ADay;
  });
}

export function rolling(rows: ADay[], key: DayKey, window = 7) {
  return rows.map((_, i) => {
    const xs = rows.slice(Math.max(0, i - window + 1), i + 1).map((r) => r[key]).filter((v): v is number => v != null);
    return xs.length >= Math.min(3, window) ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  });
}

export function avgOver(ds: Dataset, key: DayKey, days: number) {
  const xs = dayRange(ds, days).map((d) => d[key]).filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/* ---------------------------------------------------------- correlations */

export type Measure = "strength" | "ease";
export type Timing = "day" | "avg3";
export const MEASURE_LABEL: Record<Measure, string> = {
  strength: "Top-set strength vs your recent best",
  ease: "How easy sets felt vs plan",
};

/**
 * One number per session describing how it went.
 *  strength: top-set e1RM as % above/below the best of the previous 28 days, averaged over lifts.
 *  ease:     target RPE − logged RPE, averaged over rows. Positive means easier than written.
 */
export function sessionOutcomes(ds: Dataset) {
  const logged = loggedSessions(ds);
  return logged.map((s) => {
    const ratios: number[] = [];
    for (const r of s.rows) {
      if (!r.lift || !r.isTop) continue;
      const v = rowE1rm(r);
      if (!v) continue;
      const prior = logged
        .filter((p) => p.date < s.date && p.date >= addDays(s.date, -28))
        .flatMap((p) => p.rows.filter((x) => x.lift === r.lift && x.isTop).map(rowE1rm))
        .filter((x): x is number => x != null);
      if (prior.length) ratios.push((v / Math.max(...prior) - 1) * 100);
    }
    const d = sessionDrift(s);
    return {
      date: s.date,
      name: s.name,
      strength: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null,
      ease: d == null ? null : -d,
    };
  });
}

export function variableFor(ds: Dataset, date: string, key: DayKey, timing: Timing) {
  const byDate = new Map(ds.days.map((d) => [d.date, d]));
  if (timing === "day") return byDate.get(date)?.[key] ?? null;
  const xs = [0, 1, 2].map((i) => byDate.get(addDays(date, -i))?.[key]).filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx || !syy) return null;
  return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, intercept: my - (sxy / sxx) * mx, n };
}

export function correlate(ds: Dataset, key: DayKey, measure: Measure, timing: Timing) {
  const points = sessionOutcomes(ds)
    .map((o) => ({ date: o.date, name: o.name, x: variableFor(ds, o.date, key, timing), y: o[measure] }))
    .filter((p): p is { date: string; name: string; x: number; y: number } => p.x != null && p.y != null);
  const fit = pearson(points.map((p) => p.x), points.map((p) => p.y));
  return { points, fit };
}

export const MIN_POINTS = 10;

export function rankVariables(ds: Dataset, measure: Measure, timing: Timing) {
  return (Object.keys(DAY_META) as DayKey[])
    .map((key) => {
      const { fit, points } = correlate(ds, key, measure, timing);
      return { key, r: fit?.r ?? null, n: points.length };
    })
    .sort((a, b) => Math.abs(b.r ?? 0) * (b.n >= MIN_POINTS ? 1 : 0) - Math.abs(a.r ?? 0) * (a.n >= MIN_POINTS ? 1 : 0));
}

export function strengthWord(r: number) {
  const a = Math.abs(r);
  if (a < 0.1) return "no visible link";
  if (a < 0.3) return "a weak link";
  if (a < 0.5) return "a moderate link";
  return "a strong link";
}
