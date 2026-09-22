/**
 * Parse the JSON that the "Health Auto Export" iOS app posts from Apple Health.
 * Shape: { data: { metrics: [{ name, units, data: [{ date, qty, ... }] }] } }.
 * Anything written to Apple Health by Bevel, Lifesum or the Watch comes through.
 */

type Point = Record<string, unknown> & { date?: string; qty?: number };
type Metric = { name?: string; units?: string; data?: Point[] };

export interface HealthDay {
  date: string;
  weight?: number;
  sleep?: number;
  steps?: number;
  hrv?: number;
  rhr?: number;
  calories?: number;
  carbs?: number;
  protein?: number;
}

const dayOf = (d: unknown) => String(d ?? "").slice(0, 10);
const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

export function parseHealthExport(body: unknown): HealthDay[] {
  const metrics: Metric[] = (body as { data?: { metrics?: Metric[] } })?.data?.metrics ?? [];
  const sums = new Map<string, Record<string, number>>();
  const avgs = new Map<string, Record<string, number[]>>();
  const lasts = new Map<string, Record<string, number>>();
  const bump = (m: Map<string, Record<string, number>>, date: string, k: string, val: number, add: boolean) => {
    const row = m.get(date) ?? {};
    row[k] = add ? (row[k] ?? 0) + val : val;
    m.set(date, row);
  };
  const push = (date: string, k: string, val: number) => {
    const row = avgs.get(date) ?? {};
    (row[k] ??= []).push(val);
    avgs.set(date, row);
  };

  for (const m of metrics) {
    const lb = (m.units ?? "").toLowerCase().startsWith("lb");
    for (const p of m.data ?? []) {
      const date = dayOf(p.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      switch (m.name) {
        case "step_count": { const q = n(p.qty); if (q != null) bump(sums, date, "steps", q, true); break; }
        case "weight_body_mass": { const q = n(p.qty); if (q != null) bump(lasts, date, "weight", lb ? q * 0.45359237 : q, false); break; }
        case "heart_rate_variability": { const q = n(p.qty); if (q != null) push(date, "hrv", q); break; }
        case "resting_heart_rate": { const q = n(p.qty); if (q != null) push(date, "rhr", q); break; }
        case "sleep_analysis": {
          const h = n(p.totalSleep) ?? n(p.asleep) ?? ((n(p.core) ?? 0) + (n(p.deep) ?? 0) + (n(p.rem) ?? 0) || n(p.qty));
          if (h != null) bump(sums, date, "sleep", h, true);
          break;
        }
        case "dietary_energy": { const q = n(p.qty); if (q != null) bump(sums, date, "calories", q, true); break; }
        case "carbohydrates": { const q = n(p.qty); if (q != null) bump(sums, date, "carbs", q, true); break; }
        case "protein": { const q = n(p.qty); if (q != null) bump(sums, date, "protein", q, true); break; }
      }
    }
  }

  const dates = new Set([...sums.keys(), ...avgs.keys(), ...lasts.keys()]);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return [...dates].sort().map((date) => {
    const s = sums.get(date) ?? {};
    const a = avgs.get(date) ?? {};
    const l = lasts.get(date) ?? {};
    const mean = (xs?: number[]) => (xs?.length ? r1(xs.reduce((x, y) => x + y, 0) / xs.length) : undefined);
    const day: HealthDay = { date };
    if (s.steps != null) day.steps = Math.round(s.steps);
    if (s.sleep != null) day.sleep = r1(s.sleep);
    if (l.weight != null) day.weight = r1(l.weight);
    if (a.hrv) day.hrv = mean(a.hrv);
    if (a.rhr) day.rhr = mean(a.rhr);
    if (s.calories != null) day.calories = Math.round(s.calories);
    if (s.carbs != null) day.carbs = Math.round(s.carbs);
    if (s.protein != null) day.protein = Math.round(s.protein);
    return day;
  });
}
