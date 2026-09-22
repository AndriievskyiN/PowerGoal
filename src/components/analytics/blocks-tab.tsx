"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Rows3 } from "lucide-react";
import { clsx } from "clsx";
import { LIFTS, LIFT_COLOR, LIFT_LABEL, blockRows, weekRows, type Dataset } from "@/lib/analytics";
import { kg } from "@/lib/lifting";
import { addDays, shortDate } from "@/lib/dates";
import { Panel, signed } from "./kit";

const tonnes = (v: number | null) => (v == null ? "—" : `${(v / 1000).toFixed(1)} t`);

export function BlocksTab({ ds }: { ds: Dataset }) {
  const rows = useMemo(() => blockRows(ds), [ds]);
  const current = rows.filter((r) => r.started).at(-1) ?? rows[0];
  const [picked, setPicked] = useState<string | null>(null);
  const blockId = picked ?? current?.block.id;
  const weeks = useMemo(() => (blockId ? weekRows(ds, blockId) : []), [ds, blockId]);

  return (
    <div className="flex flex-col gap-5">
      <Panel icon={CalendarRange} color="var(--color-accent)" title="Block over block" meta="Best top-set e1RM in each block and the change from the block before, with the work it took.">
        <div className="overflow-x-auto">
          <table className="sheet w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="label px-5 py-2.5 text-left">Block</th>
                <th className="label px-2 py-2.5 text-right">Sessions</th>
                <th className="label px-2 py-2.5 text-right">Tonnage</th>
                <th className="label px-2 py-2.5 text-right">Per week</th>
                {LIFTS.map((l) => (
                  <th key={l} className="label px-2 py-2.5 text-right" style={{ color: LIFT_COLOR[l] }}>{LIFT_LABEL[l]}</th>
                ))}
                <th className="label px-2 py-2.5 text-right">RPE vs plan</th>
                <th className="label px-5 py-2.5 text-right">Top sets in range</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.block.id} className={clsx("border-b border-line-soft last:border-0", !r.started && "text-ink-faint")}>
                  <td className="px-5 py-3">
                    <div className="text-[13.5px] font-medium">{r.block.name}</div>
                    <div className="text-[11.5px] text-ink-faint">
                      {shortDate(r.block.start)} – {shortDate(r.block.end)}
                      {r.inProgress && <span className="ml-1.5 text-[var(--color-accent)]">· in progress, week {r.weeksElapsed} of {r.block.weeks.length}</span>}
                    </div>
                  </td>
                  <td className="num px-2 text-right">{r.started ? `${r.sessionsLogged}/${r.sessionsPlanned}` : "—"}</td>
                  <td className="num px-2 text-right">{r.sessionsLogged ? tonnes(r.tonnage) : "—"}</td>
                  <td className="num px-2 text-right">{tonnes(r.weeklyTonnage)}</td>
                  {LIFTS.map((l) => (
                    <td key={l} className="px-2 text-right">
                      <div className="num">{r.best[l] != null ? kg(r.best[l]) : "—"}</div>
                      {r.delta[l] != null && (
                        <div className={clsx("num text-[11.5px]", r.inProgress ? "text-ink-faint" : r.delta[l]! >= 0 ? "text-positive" : "text-deadlift")}>
                          {signed(r.delta[l]!)} kg{r.inProgress ? " so far" : ""}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className={clsx("num px-2 text-right", r.drift != null && r.drift > 0.25 && "text-[var(--color-steps)]")}>{r.drift != null ? signed(r.drift, 2) : "—"}</td>
                  <td className="num px-5 text-right">{r.inRange != null ? `${Math.round(r.inRange * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={Rows3}
        color="var(--color-sleep)"
        title="Week over week"
        meta="Each week of one block against the week before."
        right={
          <div className="flex flex-wrap gap-1">
            {rows.map((r) => (
              <button key={r.block.id} onClick={() => setPicked(r.block.id)} className={clsx("rounded-[8px] px-2.5 py-1 text-[12px]", r.block.id === blockId ? "bg-surface-hover text-ink" : "text-ink-muted hover:text-ink")}>
                {r.block.name}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="sheet w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="label px-5 py-2.5 text-left">Week</th>
                <th className="label px-2 py-2.5 text-right">Tonnage</th>
                <th className="label px-2 py-2.5 text-right">Change</th>
                {LIFTS.map((l) => (
                  <th key={l} className="label px-2 py-2.5 text-right" style={{ color: LIFT_COLOR[l] }}>{LIFT_LABEL[l]} e1RM</th>
                ))}
                <th className="label px-5 py-2.5 text-right">RPE vs plan</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const prev = weeks[i - 1];
                return (
                  <tr key={w.week} className={clsx("border-b border-line-soft last:border-0", w.future && "text-ink-faint")}>
                    <td className="px-5 py-3">
                      <div className="text-[13.5px]">Week {w.blockWeek} <span className="text-ink-faint">· W{w.week}</span></div>
                      <div className="text-[11.5px] text-ink-faint">{w.start ? `${shortDate(w.start)} – ${shortDate(addDays(w.start, 6))}` : ""}</div>
                    </td>
                    <td className="num px-2 text-right">{tonnes(w.tonnage)}</td>
                    <td className={clsx("num px-2 text-right", w.change != null && (w.change >= 0 ? "text-positive" : "text-deadlift"))}>
                      {w.change != null ? `${w.change > 0 ? "+" : ""}${Math.round(w.change * 100)}%` : "—"}
                    </td>
                    {LIFTS.map((l) => (
                      <td key={l} className="px-2 text-right">
                        <span className="num">{w.best[l] != null ? kg(w.best[l]) : "—"}</span>
                        {w.best[l] != null && prev?.best[l] != null && (
                          <span className={clsx("num ml-1.5 text-[11.5px]", w.best[l]! - prev.best[l]! >= 0 ? "text-positive" : "text-deadlift")}>{signed(w.best[l]! - prev.best[l]!)}</span>
                        )}
                      </td>
                    ))}
                    <td className="num px-5 text-right">{w.drift != null ? signed(w.drift, 2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
