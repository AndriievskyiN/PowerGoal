"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers, Weight } from "lucide-react";
import { GROUPS, GROUP_LABEL, LIFT_COLOR, volumeWeeks, type Dataset } from "@/lib/analytics";
import { kg } from "@/lib/lifting";
import { Empty, GRID, Panel, Tile, TipBox, blockBands, tick } from "./kit";

const STACK = [
  { key: "SQUAT", label: "Squat", color: LIFT_COLOR.SQUAT },
  { key: "BENCH", label: "Bench", color: LIFT_COLOR.BENCH },
  { key: "DEADLIFT", label: "Deadlift", color: LIFT_COLOR.DEADLIFT },
  { key: "ACCESSORY", label: "Accessories", color: "#6f665e" },
] as const;

const tonnes = (kgv: number) => `${(kgv / 1000).toFixed(1)} t`;

export function VolumeTab({ ds }: { ds: Dataset }) {
  const weeks = useMemo(() => volumeWeeks(ds), [ds]);
  if (!weeks.length) return <div className="panel"><Empty>Volume appears once you log weights on any exercise.</Empty></div>;

  const last = weeks.at(-1)!;
  const prev = weeks.at(-2);
  const change = prev ? (last.total - prev.total) / prev.total : null;
  const blockWeeks = weeks.filter((w) => w.blockId === last.blockId);
  const blockAvg = blockWeeks.reduce((a, w) => a + w.total, 0) / blockWeeks.length;
  const cycle = weeks.reduce((a, w) => a + w.total, 0);
  const recent = weeks.slice(-8);
  const groups = GROUPS.filter((g) => recent.some((w) => w.sets[g]));
  const maxSets = Math.max(1, ...recent.flatMap((w) => groups.map((g) => w.sets[g] ?? 0)));

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Tile label={`Latest week · ${last.label}`} value={(last.total / 1000).toFixed(1)} unit="t" sub={`${last.sessions} sessions logged`} />
        <Tile
          label="vs the week before"
          value={change == null ? "—" : `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`}
          tone={change == null ? null : change >= 0 ? "up" : "down"}
          sub={prev ? `${tonnes(prev.total)} in ${prev.label}` : "Needs two weeks"}
        />
        <Tile label="Block average per week" value={(blockAvg / 1000).toFixed(1)} unit="t" sub={`${blockWeeks.length} weeks so far`} />
        <Tile label="Cycle total" value={(cycle / 1000).toFixed(0)} unit="t" sub={`${weeks.length} weeks logged`} />
      </section>

      <Panel
        icon={Weight}
        color="var(--color-accent)"
        title="Tonnage per week"
        meta="Weight × reps for every logged set. Competition lifts and their variations stack by lift; everything else is accessories."
        right={
          <div className="hidden items-center gap-4 text-[12px] text-ink-muted md:flex">
            {STACK.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
            ))}
          </div>
        }
      >
        <div className="h-[340px] px-3 pt-4 pb-3 2xl:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 16, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={GRID} />
              {blockBands(weeks, ds.blocks)}
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${Math.round(v / 1000)}t`} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TipBox
                      title={`${label} · ${tonnes((payload[0].payload as { total: number }).total)}`}
                      rows={STACK.map((s) => ({ color: s.color, label: s.label, value: `${kg(Math.round((payload[0].payload as Record<string, number>)[s.key]))} kg` }))}
                    />
                  ) : null
                }
              />
              {STACK.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} stackId="t" fill={s.color} fillOpacity={0.9} radius={i === STACK.length - 1 ? [5, 5, 0, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel icon={Layers} color="var(--color-sleep)" title="Sets per muscle group" meta="Working sets logged each week. Brighter cells are more sets. The small number counts hard sets, RPE 7 or higher.">
        <div className="overflow-x-auto">
          <table className="sheet w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="label w-[200px] px-5 py-2.5 text-left">Group</th>
                {recent.map((w) => (
                  <th key={w.week} className="label px-2 py-2.5 text-center">{w.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-2 text-[13px]">{GROUP_LABEL[g]}</td>
                  {recent.map((w) => {
                    const n = w.sets[g] ?? 0;
                    return (
                      <td key={w.week} className="px-1.5 py-1.5">
                        <div
                          className="num flex h-9 items-center justify-center gap-1 rounded-lg text-[13px]"
                          style={{ background: n ? `rgba(255,122,26,${0.06 + (n / maxSets) * 0.32})` : "transparent", color: n ? "var(--color-ink)" : "var(--color-ink-faint)" }}
                        >
                          {n || "·"}
                          {n > 0 && <span className="text-[10.5px] text-ink-muted">{w.hardSets[g] ?? 0}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
