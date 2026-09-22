/**
 * Daily tracked variables — bodyweight, sleep, recovery. Sample data until the
 * log button writes real entries. Deterministic so the preview is stable.
 */
import { TODAY } from "./fixtures";

export interface VariableDay {
  date: string;
  weight: number | null;
  sleep: number | null;
  recovery: number | null;
  steps: number | null;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleVariables(days = 42): VariableDay[] {
  const r = prng(11);
  const out: VariableDay[] = [];
  let weight = 92.2;
  for (let i = days - 1; i >= 0; i--) {
    weight += (r() - 0.44) * 0.35;
    const sleep = Math.round((6.4 + r() * 2.1) * 4) / 4;
    const recovery = Math.max(1, Math.min(10, Math.round(4.5 + sleep * 0.5 + (r() - 0.5) * 3)));
    const steps = Math.round((5500 + r() * 7000 + (recovery - 5) * 300) / 100) * 100;
    const skip = r() < 0.08;
    out.push({
      date: addDays(TODAY, -i),
      weight: skip ? null : Math.round(weight * 10) / 10,
      sleep: skip ? null : sleep,
      recovery: skip ? null : recovery,
      steps: skip ? null : steps,
    });
  }
  return out;
}

export function latest<K extends keyof VariableDay>(rows: VariableDay[], key: K): VariableDay[K] | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return rows[i][key];
  return null;
}

export function average(rows: VariableDay[], key: "weight" | "sleep" | "recovery" | "steps", lastN: number): number | null {
  const xs = rows.slice(-lastN).map((r) => r[key]).filter((v): v is number => v != null);
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}
