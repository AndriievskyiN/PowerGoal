"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Smartphone } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Shell, CardHeader } from "./shell";
import { Field, track } from "./field";
import { addDays, dayLabel, localToday, mondayOf, shortDate } from "@/lib/dates";

type Key = "weight" | "sleep" | "recovery" | "steps" | "hrv" | "rhr";
const COLS: { k: Key; label: string; unit: string; color?: string; digits: number }[] = [
  { k: "weight", label: "Weight", unit: "kg", color: "var(--color-weight)", digits: 1 },
  { k: "sleep", label: "Sleep", unit: "h", color: "var(--color-sleep)", digits: 1 },
  { k: "recovery", label: "Recovery", unit: "/10", color: "var(--color-recovery)", digits: 1 },
  { k: "steps", label: "Steps", unit: "", color: "var(--color-steps)", digits: 0 },
  { k: "hrv", label: "HRV", unit: "ms", digits: 0 },
  { k: "rhr", label: "Resting HR", unit: "bpm", digits: 0 },
];
const DAYS = 60;

function fmt(v: number | undefined | null, digits: number) {
  if (v == null) return "";
  return digits === 0 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

export function DailyLogPage() {
  const today = localToday();
  const from = addDays(today, -(DAYS - 1));
  const rows = useQuery(api.dailyMetrics.range, { from, to: today });
  const log = useMutation(api.dailyMetrics.log);
  const clearSeed = useMutation(api.dailyMetrics.clearSeed);
  const [confirmClear, setConfirmClear] = useState(false);

  const byDate = new Map((rows ?? []).map((r) => [r.date, r]));
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const weeks: { monday: string; dates: string[] }[] = [];
  for (const d of dates) {
    const m = mondayOf(d);
    if (weeks.at(-1)?.monday !== m) weeks.push({ monday: m, dates: [] });
    weeks.at(-1)!.dates.push(d);
  }
  const seedCount = (rows ?? []).filter((r) => r.source === "seed").length;

  function save(date: string, k: Key | "notes", text: string) {
    const t = text.trim();
    if (k === "notes") return log({ date, notes: t === "" ? null : t });
    if (t === "") return log({ date, [k]: null } as Parameters<typeof log>[0]);
    const n = parseFloat(t.replace(/,/g, k === "steps" ? "" : "."));
    if (Number.isNaN(n)) return undefined;
    return log({ date, [k]: n } as Parameters<typeof log>[0]);
  }

  return (
    <Shell
      title="Daily log"
      meta="Bodyweight, sleep, recovery and steps, one row per day. Type in any cell; it saves by itself."
      actions={
        seedCount > 0 ? (
          confirmClear ? (
            <button
              autoFocus
              onBlur={() => setConfirmClear(false)}
              onClick={() => { setConfirmClear(false); track(clearSeed({})); }}
              className="chip !border-deadlift/40 !text-deadlift"
            >
              Delete {seedCount} sample days?
            </button>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="chip hover:text-ink">
              {seedCount} days are sample data · remove
            </button>
          )
        ) : null
      }
    >
      <main className="flex flex-col gap-5 px-6 py-5 2xl:px-8">
        <section className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="sheet w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-line-soft">
                  <th className="label w-[200px] px-5 py-2.5 text-left">Day</th>
                  {COLS.map((c) => (
                    <th key={c.k} className="label w-[9%] px-2 py-2.5 text-right whitespace-nowrap" style={c.color ? { color: c.color } : undefined}>
                      {c.label}
                      {c.unit && <span className="ml-1 text-ink-faint normal-case">{c.unit}</span>}
                    </th>
                  ))}
                  <th className="label px-3 py-2.5 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <Fragment key={w.monday}>
                    <WeekRow monday={w.monday} rows={w.dates.map((d) => byDate.get(d)).filter((r): r is Doc<"dailyMetrics"> => !!r)} />
                    {w.dates.map((date) => {
                      const r = byDate.get(date);
                      const isToday = date === today;
                      return (
                        <tr key={date} className={clsx("border-b border-line-soft", isToday && "bg-[var(--color-marker-wash)]")}>
                          <td className="px-5">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className={clsx("text-[13px]", isToday ? "font-medium text-ink" : "text-ink-muted")}>{dayLabel(date)}</span>
                              {isToday && <span className="rounded-md bg-marker px-1.5 text-[10.5px] font-semibold text-ink-inverse">Today</span>}
                              {r?.source === "seed" && <span className="label text-ink-faint">sample</span>}
                              {r?.source === "apple-health" && <span className="label text-ink-faint">health</span>}
                            </div>
                          </td>
                          {COLS.map((c) => (
                            <td key={c.k} className="px-1">
                              <Field
                                inputMode="decimal"
                                className={clsx(r?.source === "seed" && "cell-dim")}
                                placeholder="—"
                                value={fmt(r?.[c.k], c.digits)}
                                onSave={(t) => save(date, c.k, t)}
                              />
                            </td>
                          ))}
                          <td className="px-1">
                            <Field className="cell-text !font-normal" placeholder="" value={r?.notes ?? ""} onSave={(t) => save(date, "notes", t)} />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <CardHeader icon={Smartphone} color="var(--color-sleep)" title="Apple Health" meta="Sleep, steps, HRV, resting heart rate, weight and nutrition, sent automatically from your iPhone." />
          <div className="grid gap-3 px-5 py-4 text-[13px] leading-relaxed text-ink-muted md:grid-cols-3">
            <p>
              <span className="text-ink">Ready on this side.</span> PowerGoal accepts the export format of the Health Auto Export app at <span className="num text-ink">/health</span>, protected by a private token. Anything Bevel, Lifesum or your Watch writes to Apple Health comes through.
            </p>
            <p>
              <span className="text-ink">Waiting on one step.</span> The database runs on this Mac, so your phone can&apos;t reach it yet. Once PowerGoal moves to Convex Cloud, the phone posts straight to it.
            </p>
            <p>
              <span className="text-ink">What stays manual.</span> Recovery is Bevel&apos;s own score and isn&apos;t written to Apple Health, so it stays a quick daily entry here or from the + button.
            </p>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function WeekRow({ monday, rows }: { monday: string; rows: Doc<"dailyMetrics">[] }) {
  const avg = (k: Key) => {
    const xs = rows.map((r) => r[k]).filter((v): v is number => v != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  return (
    <tr className="border-b border-line-soft bg-white/[0.02]">
      <td className="label px-5 py-2 whitespace-nowrap text-ink-faint">Week of {shortDate(monday)}</td>
      {COLS.map((c) => {
        const v = avg(c.k);
        return (
          <td key={c.k} className="px-3 py-2 text-right text-[12px] text-ink-faint">
            {v == null ? "" : `avg ${c.digits === 0 ? Math.round(v).toLocaleString("en-GB") : (Math.round(v * 10) / 10).toString()}`}
          </td>
        );
      })}
      <td />
    </tr>
  );
}
