"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, ReferenceLine, Cell } from "recharts";
import { Gauge, Target, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { LIFTS, LIFT_COLOR, LIFT_LABEL, dots, latestDay, liftSummaries, strengthSeries, topSetChecks, volumeWeeks, type Bucket, type Dataset, type Lift } from "@/lib/analytics";
import { kg } from "@/lib/lifting";
import { shortDate } from "@/lib/dates";
import { Empty, GRID, Panel, Seg, Tile, TipBox, blockBands, signed, tick } from "./kit";

export function StrengthTab({ ds }: { ds: Dataset }) {
  const [bucket, setBucket] = useState<Bucket>("week");
  const [metric, setMetric] = useState<"e1rm" | "heaviest">("e1rm");
  const [only, setOnly] = useState<Lift | "ALL">("ALL");

  const series = useMemo(() => strengthSeries(ds, bucket, metric), [ds, bucket, metric]);
  const summary = useMemo(() => liftSummaries(ds), [ds]);
  const checks = useMemo(() => topSetChecks(ds), [ds]);
  const weeks = useMemo(() => volumeWeeks(ds), [ds]);
  const bw = latestDay(ds, "weight");
  const total = summary.every((s) => s.current != null) ? summary.reduce((a, s) => a + s.current!, 0) : null;
  const totalStart = summary.every((s) => s.start != null) ? summary.reduce((a, s) => a + s.start!, 0) : null;
  const shown = only === "ALL" ? LIFTS : [only];

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {summary.map((s) => (
          <Tile
            key={s.lift}
            label={`${LIFT_LABEL[s.lift]} e1RM`}
            color={LIFT_COLOR[s.lift]}
            value={s.current != null ? kg(s.current) : "—"}
            unit="kg"
            tone={s.current != null && s.start != null ? (s.current >= s.start ? "up" : "down") : null}
            sub={
              s.current != null && s.start != null
                ? `${signed(s.current - s.start)} kg since the first weeks · best ${kg(s.best!)}`
                : "Log a top set with its RPE"
            }
          />
        ))}
        <Tile
          label="Estimated total"
          value={total != null ? kg(Math.round(total * 2) / 2) : "—"}
          unit="kg"
          tone={total != null && totalStart != null ? (total >= totalStart ? "up" : "down") : null}
          sub={
            total != null && bw
              ? `DOTS ${Math.round(dots(total, bw.value))} at ${kg(bw.value)} kg${totalStart != null ? ` · ${signed(total - totalStart)} kg` : ""}`
              : "Needs all three lifts and a bodyweight"
          }
        />
      </section>

      <Panel
        icon={TrendingUp}
        color="var(--color-accent)"
        title={metric === "e1rm" ? "Estimated 1RM" : "Heaviest set"}
        meta={
          metric === "e1rm"
            ? "From top sets and the RPE you logged on them. Best per " + (bucket === "session" ? "session" : bucket) + "."
            : "Most weight on the bar for each competition lift, any set."
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Seg value={only} onChange={setOnly} options={[["ALL", "All"], ["SQUAT", "Squat"], ["BENCH", "Bench"], ["DEADLIFT", "Deadlift"]]} />
            <Seg value={metric} onChange={setMetric} options={[["e1rm", "e1RM"], ["heaviest", "Heaviest"]]} />
            <Seg value={bucket} onChange={setBucket} options={[["session", "Session"], ["week", "Week"], ["month", "Month"]]} />
          </div>
        }
      >
        {series.length ? (
          <div className="h-[340px] px-3 pt-4 pb-3 2xl:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                {blockBands(series, ds.blocks)}
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} minTickGap={16} />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={44} domain={["dataMin - 10", "dataMax + 10"]} tickFormatter={(v: number) => String(Math.round(v))} />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <TipBox
                        title={label}
                        rows={payload
                          .filter((p) => p.value != null)
                          .map((p) => {
                            const l = p.dataKey as Lift;
                            return { color: LIFT_COLOR[l], label: LIFT_LABEL[l], value: `${kg(p.value as number)} kg`, sub: (p.payload as { detail: Record<string, string> }).detail[l] };
                          })}
                      />
                    ) : null
                  }
                />
                {shown.map((l) => (
                  <Line key={l} dataKey={l} stroke={LIFT_COLOR[l]} strokeWidth={2.25} type="monotone" dot={{ r: 3, strokeWidth: 0, fill: LIFT_COLOR[l] }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>No top sets logged yet. Enter a weight and last-set RPE on a top set and it shows up here.</Empty>
        )}
      </Panel>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel icon={Target} color="var(--color-recovery)" title="Top sets vs the target range" meta="Where each top set landed against its BE–TE range. Below means under the bottom of the range.">
          {checks.length ? (
            <div className="flex flex-col gap-4 px-5 py-4">
              {LIFTS.map((l) => {
                const c = checks.filter((x) => x.lift === l);
                const n = c.length || 1;
                const below = c.filter((x) => x.verdict === "below").length;
                const inR = c.filter((x) => x.verdict === "in").length;
                const above = c.filter((x) => x.verdict === "above").length;
                return (
                  <div key={l}>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: LIFT_COLOR[l] }} />{LIFT_LABEL[l]}</span>
                      <span className="text-ink-muted">{c.length ? `${Math.round(((inR + above) / n) * 100)}% at or above range · ${c.length} top sets` : "none yet"}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div style={{ width: `${(below / n) * 100}%` }} className="bg-deadlift/70" />
                      <div style={{ width: `${(inR / n) * 100}%` }} className="bg-[var(--color-recovery)]/80" />
                      <div style={{ width: `${(above / n) * 100}%` }} className="bg-[var(--color-sleep)]/80" />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 text-[11.5px] text-ink-faint">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-deadlift/70" /> Below</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--color-recovery)]" /> In range</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--color-sleep)]" /> Above</span>
              </div>
              <table className="sheet w-full">
                <thead>
                  <tr className="border-y border-line-soft">
                    <th className="label py-2 text-left">Latest top sets</th>
                    <th className="label py-2 text-right">Set</th>
                    <th className="label py-2 text-right">Range</th>
                    <th className="label py-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.slice(-6).reverse().map((c, i) => (
                    <tr key={i} className="border-b border-line-soft last:border-0">
                      <td className="py-2 text-[13px]"><span className="text-ink-muted">{shortDate(c.date)}</span> · {LIFT_LABEL[c.lift]}</td>
                      <td className="num py-2 text-right text-[13px]">{c.set}</td>
                      <td className="num py-2 text-right text-[13px] text-ink-muted">{kg(c.be)}–{kg(c.te)}</td>
                      <td className={clsx("py-2 text-right text-[12.5px]", c.verdict === "below" ? "text-deadlift" : c.verdict === "above" ? "text-[var(--color-sleep)]" : "text-[var(--color-recovery)]")}>
                        {c.verdict === "in" ? "In range" : c.verdict === "above" ? "Above" : "Below"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Top sets with a BE–TE range appear here once logged.</Empty>
          )}
        </Panel>

        <Panel icon={Gauge} color="var(--color-steps)" title="RPE vs plan" meta="Average logged last-set RPE minus the target, per week. Above zero means the week ran harder than written.">
          {weeks.some((w) => w.drift != null) ? (
            <div className="h-[300px] px-3 pt-4 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} width={40} domain={[-1.5, 1.5]} tickFormatter={(v: number) => signed(v)} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length && payload[0].value != null ? (
                        <TipBox title={label} rows={[{ label: "Logged vs target", value: `${signed(payload[0].value as number, 2)} RPE` }]} />
                      ) : null
                    }
                  />
                  <Bar dataKey="drift" radius={[4, 4, 4, 4]} isAnimationActive={false}>
                    {weeks.map((w) => (
                      <Cell key={w.week} fill={(w.drift ?? 0) > 0 ? "var(--color-steps)" : "var(--color-recovery)"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>Log last-set RPE and this shows whether training is running hot or easy.</Empty>
          )}
        </Panel>
      </section>
    </div>
  );
}
