/** Plain data shared by server and client dashboard code. No "use client" here on purpose. */
import type { VariableDay } from "@/lib/variables";
import type { SessionRow } from "@/lib/overview";

export type VarKey = "weight" | "sleep" | "recovery" | "steps";
export const VAR_META: Record<VarKey, { label: string; unit: string; color: string; kind: "area" | "bar" | "line"; domain: [number | string, number | string] }> = {
  weight: { label: "Bodyweight", unit: "kg", color: "var(--color-weight)", kind: "area", domain: ["dataMin - 0.6", "dataMax + 0.6"] },
  sleep: { label: "Sleep", unit: "h", color: "var(--color-sleep)", kind: "bar", domain: [0, 10] },
  recovery: { label: "Recovery", unit: "/10", color: "var(--color-recovery)", kind: "line", domain: [0, 10] },
  steps: { label: "Steps", unit: "", color: "var(--color-steps)", kind: "bar", domain: [0, "dataMax + 1000"] },
};


export interface DayRow extends VariableDay {
  SQUAT: number | null;
  BENCH: number | null;
  DEADLIFT: number | null;
  session?: string;
}

export function joinDays(vars: VariableDay[], sessions: SessionRow[]): DayRow[] {
  return vars.map((v) => {
    const s = sessions.find((r) => r.date === v.date && r.status === "done");
    return { ...v, SQUAT: s?.top.SQUAT?.kg ?? null, BENCH: s?.top.BENCH?.kg ?? null, DEADLIFT: s?.top.DEADLIFT?.kg ?? null, session: s?.name };
  });
}

