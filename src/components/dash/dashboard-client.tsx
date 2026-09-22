"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Dumbbell, Footprints, HeartPulse, Moon, Scale } from "lucide-react";
import { clsx } from "clsx";
import { Shell, CardHeader } from "./shell";
import { VarChart } from "./charts";
import { VAR_META, type VarKey } from "./meta";
import { fmtVar, varStat } from "./pieces";
import { SessionSheet, type SheetSession } from "./session-sheet";
import { Ledger } from "./ledger";
import { buildOverview } from "@/lib/overview";
import { treeToProgram } from "@/lib/program-tree";
import type { VariableDay } from "@/lib/variables";
import { addDays, dayLabel, localToday } from "@/lib/dates";
import Link from "next/link";

const ICON: Record<VarKey, typeof Scale> = { weight: Scale, sleep: Moon, recovery: HeartPulse, steps: Footprints };


/** The dashboard, live from Convex: active program tree plus daily metrics. */
export function DashboardPage() {
  const today = localToday();
  const tree = useQuery(api.programs.activeTree);
  const from = addDays(today, -41);
  const rows = useQuery(api.dailyMetrics.range, { from, to: today });

  const program = useMemo(() => (tree ? treeToProgram(tree, today) : null), [tree, today]);
  const o = useMemo(() => (program ? buildOverview(program, today) : null), [program, today]);

  const vars: VariableDay[] = useMemo(() => {
    const byDate = new Map((rows ?? []).map((r) => [r.date, r]));
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(from, i);
      const r = byDate.get(date);
      return { date, weight: r?.weight ?? null, sleep: r?.sleep ?? null, recovery: r?.recovery ?? null, steps: r?.steps ?? null };
    });
  }, [rows, from]);

  const sessions: SheetSession[] = useMemo(
    () =>
      !o
        ? []
        : o.weeks.flatMap((w) =>
            [...w.sessions]
              .sort((a, b) => a.dayNumber - b.dayNumber)
              .map((s) => ({
                ...s,
                weekLabel: `W${w.programWeekIndex}`,
                blockName: o.program.blocks.find((b) => b.id === w.blockId)?.name ?? "Block",
                blockWeek: w.blockWeekIndex,
                blockWeeks: o.program.blocks.find((b) => b.id === w.blockId)?.weeks.length ?? 4,
              })),
          ),
    [o],
  );

  const keys: VarKey[] = ["weight", "sleep", "recovery", "steps"];
  const initialId = o?.next?.id ?? sessions[0]?.id ?? "";

  return (
    <Shell
      title="Dashboard"
      meta={
        o ? (
          <>
            {o.block.name}, week {o.week.blockWeekIndex} of {o.block.weeks.length}
            {o.weeksOut != null && <> · {o.weeksOut} weeks to the meet</>}
          </>
        ) : (
          "Loading…"
        )
      }
    >
      <main className="flex flex-col gap-5 px-6 py-5 2xl:px-8">
        <section className="rise rise-1 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {keys.map((k) => {
            const st = varStat(vars, k);
            const Icon = ICON[k];
            const asOf = [...vars].reverse().find((d) => d[k] != null)?.date;
            return (
              <div key={k} className={clsx("panel flex flex-col", rows === undefined && "opacity-60")}>
                <CardHeader
                  icon={Icon}
                  color={VAR_META[k].color}
                  title={VAR_META[k].label}
                  meta="Last 28 days"
                  right={<Link href="/log" className="text-[12px] text-ink-faint hover:text-ink">Log</Link>}
                />
                <div className="flex items-end justify-between px-5 pt-4">
                  <div>
                    <div className="num text-[30px] font-semibold leading-none tracking-[-0.03em]">
                      {fmtVar(k, st.value)}
                      <span className="ml-1 text-[12.5px] font-normal text-ink-muted">{VAR_META[k].unit}</span>
                    </div>
                    <div className="mt-1.5 text-[11.5px] text-ink-faint">
                      {asOf == null ? "Nothing logged yet" : asOf === today ? "Today" : `Last logged ${dayLabel(asOf)}`}
                    </div>
                  </div>
                  <div className="text-right text-[12px] text-ink-muted">
                    <div>7-day avg <span className="num text-ink">{fmtVar(k, st.avg7)}</span></div>
                    {st.delta != null && (
                      <div className={clsx("num", st.delta > 0 ? "text-positive" : st.delta < 0 ? "text-deadlift" : "text-ink-faint")}>
                        {st.delta > 0 ? "▲" : st.delta < 0 ? "▼" : "•"} {fmtVar(k, Math.abs(st.delta))} vs 28-day
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-[170px] px-2 pt-3 pb-2 2xl:h-[190px]">
                  <VarChart rows={vars.slice(-28)} k={k} axes avg={st.avg28} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="rise rise-2 panel overflow-hidden">
          <CardHeader
            icon={Dumbbell}
            color="var(--color-accent)"
            title="Training"
            meta="Type straight into the sheet. It saves as you go."
            right={<Link href="/program" className="text-[12px] text-ink-faint hover:text-ink">Edit program</Link>}
          />
          {o && program && sessions.length ? (
            <SessionSheet program={program} sessions={sessions} initialId={initialId} today={today} ledger={<Ledger o={o} vars={vars} />} />
          ) : (
            <div className="px-5 py-10 text-center text-[13px] text-ink-muted">{tree === null ? "No active program. Import one to get started." : "Loading program…"}</div>
          )}
        </section>
      </main>
    </Shell>
  );
}
