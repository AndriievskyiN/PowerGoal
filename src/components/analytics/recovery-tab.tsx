"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { clsx } from "clsx";
import { DAY_META, avgOver, dayRange, rolling, type DayKey, type Dataset } from "@/lib/analytics";
import { shortDate } from "@/lib/dates";
import { GRID, Seg, TipBox, tick } from "./kit";

const KEYS: DayKey[] = ["weight", "sleep", "recovery", "steps", "hrv", "rhr", "calories", "carbs", "protein"];
const fmt = (k: DayKey, v: number | null) => (v == null ? "—" : DAY_META[k].digits === 0 ? Math.round(v).toLocaleString("en-GB") : (Math.round(v * 10) / 10).toString());

export function RecoveryTab({ ds }: { ds: Dataset }) {
  const [range, setRange] = useState<"28" | "56" | "90">("56");
  const days = useMemo(() => dayRange(ds, Number(range)), [ds, range]);
  const keys = KEYS.filter((k) => days.some((d) => d[k] != null));

  if (!keys.length) {
    return <div className="panel px-5 py-12 text-center text-[13px] text-ink-muted">Nothing logged yet. Use the daily log or the + button.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">Daily values with a 7-day average line. The number is the last 7 days against the 28 before them.</p>
        <Seg value={range} onChange={setRange} options={[["28", "4 weeks"], ["56", "8 weeks"], ["90", "90 days"]]} />
      </div>
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {keys.map((k) => (
          <MetricCard key={k} k={k} ds={ds} days={days} />
        ))}
      </section>
    </div>
  );
}

function MetricCard({ k, ds, days }: { k: DayKey; ds: Dataset; days: ReturnType<typeof dayRange> }) {
  const m = DAY_META[k];
  const avg7 = avgOver(ds, k, 7);
  const avg28 = avgOver(ds, k, 28);
  const raw = avg7 != null && avg28 != null ? avg7 - avg28 : null;
  // Treat a change that rounds away as no change.
  const delta = raw == null ? null : m.digits === 0 ? Math.round(raw) : Math.round(raw * 10) / 10;
  const roll = rolling(days, k);
  const data = days.map((d, i) => ({ date: d.date, v: d[k] ?? null, avg: roll[i] }));
  // For resting HR, lower is the good direction.
  const good = delta == null || delta === 0 ? null : k === "rhr" ? delta < 0 : delta > 0;

  return (
    <div className="panel flex flex-col">
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Activity size={13} style={{ color: m.color }} /> {m.label}
          </div>
          <div className="num mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em]">
            {fmt(k, avg7)}
            <span className="ml-1 text-[12px] font-normal text-ink-muted">{m.unit} · 7-day avg</span>
          </div>
        </div>
        {delta != null && (
          <span className={clsx("num mt-1 text-[12px]", good == null ? "text-ink-faint" : good ? "text-positive" : "text-deadlift")}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {fmt(k, Math.abs(delta))} vs 28-day
          </span>
        )}
      </div>
      <div className="h-[170px] px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -6 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} tickFormatter={(d: string) => shortDate(d)} minTickGap={28} dy={4} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={42} domain={m.kind === "bar" ? [0, "auto"] : ["auto", "auto"]} tickFormatter={(v: number) => (k === "steps" || k === "calories" ? `${Math.round(v / 1000)}k` : String(Math.round(v * 10) / 10))} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.15)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TipBox
                    title={shortDate(String(label))}
                    rows={[
                      { color: m.color, label: m.label, value: `${fmt(k, payload.find((p) => p.dataKey === "v")?.value as number)} ${m.unit}` },
                      { label: "7-day avg", value: `${fmt(k, payload.find((p) => p.dataKey === "avg")?.value as number)} ${m.unit}` },
                    ]}
                  />
                ) : null
              }
            />
            {m.kind === "bar" ? (
              <Bar dataKey="v" fill={m.color} fillOpacity={0.5} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            ) : (
              <Line dataKey="v" stroke={m.color} strokeOpacity={0.45} strokeWidth={1.25} dot={{ r: 1.75, fill: m.color, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
            )}
            <Line dataKey="avg" stroke={m.color} strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
