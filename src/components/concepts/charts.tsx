"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekPoint } from "@/lib/metrics";
import { SERIES_LIFTS } from "@/lib/metrics";
import { kg } from "@/lib/lifting";

const COLOR: Record<string, string> = {
  SQUAT: "var(--color-squat)",
  BENCH: "var(--color-bench)",
  DEADLIFT: "var(--color-deadlift)",
};
const LABEL: Record<string, string> = { SQUAT: "Squat", BENCH: "Bench", DEADLIFT: "Deadlift" };

const tick = {
  fill: "var(--color-ink-faint)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
} as const;

function compact(n: number) {
  return Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : kg(n);
}

/** One band per block; alternate bands get a faint fill so block edges read without slicing a bar. */
function bands(data: WeekPoint[]) {
  const out: { from: string; to: string; label: string; shade: boolean }[] = [];
  for (const p of data) {
    const last = out[out.length - 1];
    if (last && last.label === p.title.split(" · ")[0]) last.to = p.label;
    else out.push({ from: p.label, to: p.label, label: p.title.split(" · ")[0], shade: out.length % 2 === 1 });
  }
  return out;
}
const bandLabel = (label: string) => ({
  value: label,
  position: "insideTopLeft" as const,
  fill: "var(--color-ink-faint)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  offset: 8,
});

function future(data: WeekPoint[]) {
  const i = data.findIndex((p) => !p.hasData);
  if (i <= 0 || i >= data.length) return null;
  return { from: data[i].label, to: data[data.length - 1].label };
}

function TipBox({
  active,
  payload,
  label,
  data,
  unit,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number | null }[];
  label?: string;
  data: WeekPoint[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const point = data.find((p) => p.label === label);
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]">
      <div className="label mb-1.5">{point?.title ?? label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: COLOR[p.dataKey] ?? "var(--color-marker)" }} />
              {LABEL[p.dataKey] ?? "Total"}
            </span>
            <span className="num font-medium">
              {kg(p.value!)}
              <span className="ml-0.5 text-ink-faint">{unit}</span>
            </span>
          </div>
        ))}
    </div>
  );
}

/** Weekly tonnage per lift, stacked. `striped` draws the diagonal hatch used in V1. */
export function VolumeBars({
  data,
  striped = false,
  todayLabel,
}: {
  data: WeekPoint[];
  striped?: boolean;
  todayLabel?: string;
}) {
  const fut = future(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="34%">
        {striped && (
          <defs>
            {SERIES_LIFTS.map((lift) => (
              <pattern
                key={lift}
                id={`hatch-${lift}`}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={COLOR[lift]} opacity="0.55" />
                <rect width="2.5" height="6" fill={COLOR[lift]} />
              </pattern>
            ))}
          </defs>
        )}
        <CartesianGrid vertical={false} stroke="var(--color-line-soft)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
        {fut && <ReferenceArea x1={fut.from} x2={fut.to} fill="var(--color-ink)" fillOpacity={0.025} />}
        {bands(data).map((b) => (
          <ReferenceArea key={b.label} x1={b.from} x2={b.to} fill="var(--color-ink)" fillOpacity={b.shade ? 0.03 : 0} label={bandLabel(b.label)} />
        ))}
        {todayLabel && <ReferenceLine x={todayLabel} stroke="var(--color-marker)" strokeWidth={2} />}
        <Tooltip cursor={{ fill: "var(--color-ink)", fillOpacity: 0.04 }} content={<TipBox data={data} unit="kg" />} />
        {SERIES_LIFTS.map((lift, i) => (
          <Bar
            key={lift}
            dataKey={lift}
            stackId="v"
            fill={striped ? `url(#hatch-${lift})` : COLOR[lift]}
            radius={i === SERIES_LIFTS.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Best e1RM per lift, per week. */
export function IntensityLines({ data, todayLabel }: { data: WeekPoint[]; todayLabel?: string }) {
  const fut = future(data);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--color-line-soft)" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} width={52} tickFormatter={(v: number) => String(Math.round(v))} />
        {fut && <ReferenceArea x1={fut.from} x2={fut.to} fill="var(--color-ink)" fillOpacity={0.025} />}
        {bands(data).map((b) => (
          <ReferenceArea key={b.label} x1={b.from} x2={b.to} fill="var(--color-ink)" fillOpacity={b.shade ? 0.03 : 0} label={bandLabel(b.label)} />
        ))}
        {todayLabel && <ReferenceLine x={todayLabel} stroke="var(--color-marker)" strokeWidth={2} />}
        <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={<TipBox data={data} unit="kg" />} />
        {SERIES_LIFTS.map((lift) => (
          <Line
            key={lift}
            type="monotone"
            dataKey={lift}
            stroke={COLOR[lift]}
            strokeWidth={2.25}
            dot={{ r: 3, strokeWidth: 2, fill: "var(--color-surface)" }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Single glowing series — used for the V2 hero. Pass a precomputed `total`. */
export function EmberArea({
  data,
  todayLabel,
}: {
  data: { label: string; title: string; total: number | null; blockId: string; hasData: boolean }[];
  todayLabel?: string;
}) {
  const fut = future(data as WeekPoint[]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="ember-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8a2a" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#ff8a2a" stopOpacity={0} />
          </linearGradient>
          <filter id="ember-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} domain={["dataMin - 15", "dataMax + 15"]} width={52} tickFormatter={(v: number) => String(Math.round(v))} />
        {fut && <ReferenceArea x1={fut.from} x2={fut.to} fill="#ffffff" fillOpacity={0.02} />}
        {bands(data as WeekPoint[]).map((b) => (
          <ReferenceArea key={b.label} x1={b.from} x2={b.to} fill="#ffffff" fillOpacity={b.shade ? 0.03 : 0} label={bandLabel(b.label)} />
        ))}
        {todayLabel && <ReferenceLine x={todayLabel} stroke="#ff8a2a" strokeWidth={1.5} strokeDasharray="4 3" />}
        <Tooltip cursor={{ stroke: "rgba(255,255,255,0.2)" }} content={<TipBox data={data as WeekPoint[]} unit="kg" />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#ff8a2a"
          strokeWidth={2.5}
          fill="url(#ember-fill)"
          filter="url(#ember-glow)"
          dot={{ r: 3.5, fill: "#0f0d0c", stroke: "#ff8a2a", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "#ff8a2a", stroke: "#0f0d0c", strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline trend, no axes. */
export function Spark({ values, color, height = 36 }: { values: (number | null)[]; color: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
