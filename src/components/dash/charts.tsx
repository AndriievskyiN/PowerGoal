"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IntensityLines } from "@/components/concepts/charts";
import type { WeekPoint } from "@/lib/metrics";
import type { VariableDay } from "@/lib/variables";
import { kg } from "@/lib/lifting";
import { VAR_META, type VarKey, type DayRow } from "./meta";
export { VAR_META, joinDays, type VarKey, type DayRow } from "./meta";

const tick = { fill: "var(--color-ink-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" } as const;

export function short(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
function fmt(v: number, key: VarKey) {
  return key === "steps" ? v.toLocaleString("en-GB") : String(v);
}

function VarTip({ active, payload, label, k }: { active?: boolean; payload?: { value: number }[]; label?: string; k: VarKey }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-pop)]">
      <span className="text-ink-faint">{short(label!)}</span>{" "}
      <span className="num font-medium">
        {fmt(payload[0].value, k)}
        {VAR_META[k].unit && <span className="text-ink-faint"> {VAR_META[k].unit}</span>}
      </span>
    </div>
  );
}

/** One daily variable. `axes` shows a date axis and gridlines for the big version. */
export function VarChart({ rows, k, axes = false, avg }: { rows: VariableDay[]; k: VarKey; axes?: boolean; avg?: number | null }) {
  const m = VAR_META[k];
  const id = `vf-${k}`;
  const common = { data: rows, margin: { top: 6, right: 4, bottom: 0, left: axes ? -4 : 0 } };
  const xaxis = <XAxis dataKey="date" tick={tick} tickFormatter={(d: string) => short(d).split(" ")[0]} axisLine={false} tickLine={false} interval={axes ? 6 : 0} hide={!axes} dy={4} />;
  const yaxis = <YAxis hide={!axes} domain={m.domain} tick={tick} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => (k === "steps" ? `${Math.round(v / 1000)}k` : String(v))} />;
  const grid = axes ? <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" /> : null;
  const avgLine = axes && avg != null ? <ReferenceLine y={avg} stroke={m.color} strokeOpacity={0.35} strokeDasharray="3 4" /> : null;
  const tip = <Tooltip content={<VarTip k={k} />} cursor={{ stroke: "var(--color-line-strong)", fill: "rgba(255,255,255,0.04)" }} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {m.kind === "area" ? (
        <AreaChart {...common}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={m.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}{xaxis}{yaxis}{avgLine}{tip}
          <Area type="monotone" dataKey={k} stroke={m.color} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </AreaChart>
      ) : m.kind === "bar" ? (
        <BarChart {...common} barCategoryGap="32%">
          {grid}{xaxis}{yaxis}{avgLine}{tip}
          <Bar dataKey={k} fill={m.color} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      ) : (
        <LineChart {...common}>
          {grid}{xaxis}{yaxis}{avgLine}{tip}
          <Line type="monotone" dataKey={k} stroke={m.color} strokeWidth={2} dot={{ r: 2.5, fill: m.color, strokeWidth: 0 }} activeDot={{ r: 4.5, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

/** Lift progression with a Top set / e1RM toggle. */
export function LiftProgress({ topSet, intensity, todayLabel }: { topSet: WeekPoint[]; intensity: WeekPoint[]; todayLabel: string }) {
  const [mode, setMode] = useState<"top" | "e1rm">("top");
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
        <p className="text-[12.5px] text-ink-muted">{mode === "top" ? "Heaviest set each week · kilograms on the bar" : "Estimated 1RM each week · RPE chart, Epley when no RPE was logged"}</p>
        <div className="flex items-center gap-5">
          <Legend />
          <Toggle value={mode} onChange={setMode} options={[["top", "Top set"], ["e1rm", "e1RM"]]} />
        </div>
      </header>
      <div className="min-h-[260px] flex-1 px-3 pb-3">
        <IntensityLines data={mode === "top" ? topSet : intensity} todayLabel={todayLabel} />
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="hidden items-center gap-4 text-[12px] text-ink-muted md:flex">
      {[["Squat", "var(--color-squat)"], ["Bench", "var(--color-bench)"], ["Deadlift", "var(--color-deadlift)"]].map(([k, v]) => (
        <span key={k} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: v }} /> {k}</span>
      ))}
    </div>
  );
}

export function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex items-center rounded-lg border border-line bg-surface-sunken p-0.5 text-[12px]">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={clsx("rounded-[7px] px-3 py-1.5 transition-colors", value === v ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Block-to-block best e1RM, grouped bars per lift. */
export function BlockBars({ data }: { data: { block: string; SQUAT: number | null; BENCH: number | null; DEADLIFT: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -10 }} barCategoryGap="28%" barGap={4}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="block" tick={{ ...tick, fontFamily: "var(--font-sans)", fontSize: 12 }} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} domain={["dataMin - 20", "dataMax + 10"]} width={44} tickFormatter={(v: number) => String(Math.round(v))} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
                <div className="label mb-1.5">{label}</div>
                {payload.filter((p) => p.value != null).map((p) => (
                  <div key={String(p.dataKey)} className="flex justify-between gap-6">
                    <span className="text-ink-muted">{String(p.dataKey)[0] + String(p.dataKey).slice(1).toLowerCase()}</span>
                    <span className="num font-medium">{kg(p.value as number)} kg</span>
                  </div>
                ))}
              </div>
            ) : null
          }
        />
        {[["SQUAT", "var(--color-squat)"], ["BENCH", "var(--color-bench)"], ["DEADLIFT", "var(--color-deadlift)"]].map(([k, c]) => (
          <Bar key={k} dataKey={k} fill={c} radius={[5, 5, 0, 0]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------------------- timeline */

const M = { top: 6, right: 12, bottom: 0, left: 12 };

/** Training lane: heaviest set per lift on the days you trained. Same `rows` as the variable lanes so the x axes line up. */
export function TrainingLane({ rows, today }: { rows: DayRow[]; today: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={M}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" hide />
        <YAxis domain={["dataMin - 15", "dataMax + 15"]} tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => String(Math.round(v))} />
        <ReferenceLine x={today} stroke="var(--color-accent)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ stroke: "var(--color-line-strong)" }}
          content={({ active, payload, label }) =>
            active && payload?.some((p) => p.value != null) ? (
              <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-pop)]">
                <div className="text-ink-faint">{short(String(label))} · {payload[0].payload.session}</div>
                {payload.filter((p) => p.value != null).map((p) => (
                  <div key={String(p.dataKey)} className="flex justify-between gap-5">
                    <span className="text-ink-muted">{String(p.dataKey)[0] + String(p.dataKey).slice(1).toLowerCase()}</span>
                    <span className="num font-medium">{kg(p.value as number)} kg</span>
                  </div>
                ))}
              </div>
            ) : null
          }
        />
        {(["SQUAT", "BENCH", "DEADLIFT"] as const).map((l) => (
          <Line
            key={l}
            dataKey={l}
            type="linear"
            stroke={`var(--color-${l.toLowerCase()})`}
            strokeWidth={1.25}
            strokeOpacity={0.45}
            dot={{ r: 3.5, fill: `var(--color-${l.toLowerCase()})`, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** One aligned variable lane sharing the training lane's margins. */
export function VarLane({ rows, k, today, showDates = false }: { rows: DayRow[]; k: VarKey; today: string; showDates?: boolean }) {
  const m = VAR_META[k];
  const shared = (
    <>
      <XAxis dataKey="date" tick={tick} tickFormatter={(d: string) => short(d)} axisLine={false} tickLine={false} interval={6} hide={!showDates} dy={4} />
      <YAxis domain={m.domain} hide />
      <ReferenceLine x={today} stroke="var(--color-accent)" strokeDasharray="3 3" />
      <Tooltip content={<VarTip k={k} />} cursor={{ stroke: "var(--color-line-strong)", fill: "rgba(255,255,255,0.04)" }} />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {m.kind === "bar" ? (
        <BarChart data={rows} margin={{ ...M, left: M.left + 40 }} barCategoryGap="35%">
          {shared}
          <Bar dataKey={k} fill={m.color} fillOpacity={0.85} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      ) : (
        <LineChart data={rows} margin={{ ...M, left: M.left + 40 }}>
          {shared}
          <Line type="monotone" dataKey={k} stroke={m.color} strokeWidth={1.75} dot={m.kind === "line" ? { r: 2, fill: m.color, strokeWidth: 0 } : false} connectNulls isAnimationActive={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
