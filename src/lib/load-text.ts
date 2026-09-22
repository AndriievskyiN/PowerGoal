import type { Load } from "./types";

/**
 * Parse what someone types into a Load cell.
 *   "7 RPE" / "7"rpe        → RPE target
 *   "152.5"                 → absolute kg
 *   "70% S" / "70%s"        → percent of the squat training max (S, B or D)
 *   "88% #3" / "88% of #3"  → percent of the weight logged on row 3
 * Unrecognised text leaves the load as it was.
 */
export function parseLoad(text: string, prev: Load): Load {
  const t = text.trim().toLowerCase();
  const rpe = t.match(/^(\d+(?:\.\d+)?)\s*rpe$/);
  if (rpe) return { kind: "rpe", rpe: parseFloat(rpe[1]) };
  const row = t.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:of\s*)?#\s*(\d+)$/);
  if (row) return { kind: "percentOfRow", pct: parseFloat(row[1]), ofOrder: parseInt(row[2]) - 1 };
  const pct = t.match(/^(\d+(?:\.\d+)?)\s*%\s*([sbd])?$/);
  if (pct) {
    const of = pct[2] === "s" ? "squat" : pct[2] === "b" ? "bench" : pct[2] === "d" ? "deadlift" : prev.kind === "percent" ? prev.of : undefined;
    return { kind: "percent", pct: parseFloat(pct[1]), of };
  }
  const kg = parseFloat(t);
  if (!Number.isNaN(kg) && /^\d+(\.\d+)?$/.test(t)) return { kind: "absolute", kg };
  return prev;
}
