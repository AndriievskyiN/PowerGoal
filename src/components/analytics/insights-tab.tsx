"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Sparkles, ScatterChart as ScatterIcon } from "lucide-react";
import { clsx } from "clsx";
import { DAY_META, MEASURE_LABEL, MIN_POINTS, correlate, rankVariables, strengthWord, type DayKey, type Dataset, type Measure, type Timing } from "@/lib/analytics";
import { shortDate } from "@/lib/dates";
import { Empty, GRID, Panel, Seg, TipBox, signed, tick } from "./kit";

const Y_LABEL: Record<Measure, string> = { strength: "% vs recent best", ease: "RPE below plan" };

export function InsightsTab({ ds }: { ds: Dataset }) {
  const [measure, setMeasure] = useState<Measure>("strength");
  const [timing, setTiming] = useState<Timing>("day");
  const ranked = useMemo(() => rankVariables(ds, measure, timing), [ds, measure, timing]);
  const [picked, setPicked] = useState<DayKey | null>(null);
  const key = picked ?? ranked.find((r) => r.n >= MIN_POINTS)?.key ?? "sleep";
  const { points, fit } = useMemo(() => correlate(ds, key, measure, timing), [ds, key, measure, timing]);
  const m = DAY_META[key];
  const enough = points.length >= MIN_POINTS;

  const xs = points.map((p) => p.x);
  const line = fit && enough ? [Math.min(...xs), Math.max(...xs)].map((x) => ({ x, y: fit.intercept + fit.slope * x })) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-muted">Compare each day&apos;s</span>
        <Seg value={timing} onChange={setTiming} options={[["day", "value on the day"], ["avg3", "3-day average before"]]} />
        <span className="text-[13px] text-ink-muted">against</span>
        <Seg value={measure} onChange={setMeasure} options={[["strength", "Top-set strength"], ["ease", "How easy it felt"]]} />
      </div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel
          className="xl:col-span-5 2xl:col-span-4"
          icon={Sparkles}
          color="var(--color-accent)"
          title="What moves your training"
          meta={`Each variable's correlation with ${MEASURE_LABEL[measure].toLowerCase()}. Longer bars mean a clearer link.`}
        >
          <ul className="flex flex-col py-2">
            {ranked.map((r) => {
              const ok = r.n >= MIN_POINTS && r.r != null;
              return (
                <li key={r.key}>
                  <button onClick={() => setPicked(r.key)} className={clsx("grid w-full grid-cols-[120px_1fr_56px] items-center gap-3 px-5 py-2.5 text-left transition-colors", r.key === key ? "bg-white/[0.04]" : "hover:bg-white/[0.02]")}>
                    <span className="flex items-center gap-2 text-[13px]">
                      <i className="h-2 w-2 rounded-full" style={{ background: DAY_META[r.key].color }} />
                      {DAY_META[r.key].label}
                    </span>
                    <span className="relative h-2 rounded-full bg-white/[0.04]">
                      <span className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15" />
                      {ok && (
                        <span
                          className="absolute top-0 bottom-0 rounded-full"
                          style={{
                            background: r.r! >= 0 ? "var(--color-recovery)" : "var(--color-deadlift)",
                            left: r.r! >= 0 ? "50%" : `${50 - Math.abs(r.r!) * 50}%`,
                            width: `${Math.abs(r.r!) * 50}%`,
                          }}
                        />
                      )}
                    </span>
                    <span className="num text-right text-[12.5px] text-ink-muted">{ok ? signed(r.r!, 2) : `${r.n}/${MIN_POINTS}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line-soft px-5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
            Green means more of it goes with better sessions, red the opposite. A variable needs {MIN_POINTS} sessions with a value before it is scored. This shows what moves together, not what causes what.
          </p>
        </Panel>

        <Panel
          className="xl:col-span-7 2xl:col-span-8"
          icon={ScatterIcon}
          color={m.color}
          title={`${m.label} and ${MEASURE_LABEL[measure].toLowerCase()}`}
          meta={
            enough && fit
              ? `${fit.r >= 0 ? "Higher" : "Lower"} ${m.label.toLowerCase()} goes with ${measure === "strength" ? "stronger top sets" : "easier sessions"}: ${strengthWord(fit.r)} (r ${signed(fit.r, 2)}, ${fit.n} sessions).`
              : `${points.length} of ${MIN_POINTS} sessions needed so far.`
          }
        >
          {points.length ? (
            <div className="h-[420px] px-3 pt-4 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis type="number" dataKey="x" name={m.label} tick={tick} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => (key === "steps" || key === "calories" ? `${Math.round(v / 1000)}k` : String(Math.round(v * 10) / 10))} label={{ value: `${m.label}${m.unit ? ` (${m.unit})` : ""}`, position: "insideBottom", offset: -4, fill: "var(--color-ink-faint)", fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" tick={tick} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => signed(v)} label={{ value: Y_LABEL[measure], angle: -90, position: "insideLeft", fill: "var(--color-ink-faint)", fontSize: 11 }} />
                  <ZAxis range={[60, 60]} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as { date?: string; name?: string; x: number; y: number } | undefined;
                      return active && p?.date ? (
                        <TipBox
                          title={`${shortDate(p.date)} · ${p.name}`}
                          rows={[
                            { color: m.color, label: m.label, value: `${Math.round(p.x * 10) / 10} ${m.unit}` },
                            { label: Y_LABEL[measure], value: signed(p.y, measure === "strength" ? 1 : 2) },
                          ]}
                        />
                      ) : null;
                    }}
                  />
                  <Scatter data={points} fill={m.color} fillOpacity={0.8} isAnimationActive={false} />
                  {line.length > 0 && <Scatter data={line} line={{ stroke: "rgba(255,255,255,0.55)", strokeWidth: 1.5, strokeDasharray: "5 4" }} shape={() => <g />} isAnimationActive={false} />}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No sessions have both a logged top set and a {m.label.toLowerCase()} value yet.</Empty>
          )}
        </Panel>
      </section>
    </div>
  );
}
