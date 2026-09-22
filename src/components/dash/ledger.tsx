import { clsx } from "clsx";
import type { Overview } from "@/lib/overview";
import type { VariableDay } from "@/lib/variables";
import { kg } from "@/lib/lifting";
import { TopCell } from "./pieces";

/** One row per session: heaviest set per lift, tonnage, and that day's variables. */
export function Ledger({ o, vars }: { o: Overview; vars: VariableDay[] }) {
  const byDate = new Map(vars.map((v) => [v.date, v]));
  const rows = o.sessions.filter((r) => Number(r.weekLabel.slice(1)) <= o.week.programWeekIndex);
  const weeks = [...new Set(rows.map((r) => r.weekLabel))].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="sheet data w-full">
        <thead>
          <tr className="border-y border-line-soft text-left">
            <th className="label px-5 py-2.5 font-normal">Session</th>
            <th className="label px-3 py-2.5 text-right font-normal" style={{ color: "var(--color-squat)" }}>Squat</th>
            <th className="label px-3 py-2.5 text-right font-normal" style={{ color: "var(--color-bench)" }}>Bench</th>
            <th className="label px-3 py-2.5 text-right font-normal" style={{ color: "var(--color-deadlift)" }}>Deadlift</th>
            <th className="label px-3 py-2.5 text-right font-normal">Tonnage</th>
            <th className="label hidden px-3 py-2.5 text-right font-normal md:table-cell" style={{ color: "var(--color-weight)" }}>Weight</th>
            <th className="label hidden px-3 py-2.5 text-right font-normal md:table-cell" style={{ color: "var(--color-sleep)" }}>Sleep</th>
            <th className="label hidden px-3 py-2.5 text-right font-normal md:table-cell" style={{ color: "var(--color-recovery)" }}>Recovery</th>
            <th className="label hidden px-5 py-2.5 text-right font-normal lg:table-cell" style={{ color: "var(--color-steps)" }}>Steps</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <WeekGroup key={w} label={w} rows={rows.filter((r) => r.weekLabel === w)} byDate={byDate} blockName={rows.find((r) => r.weekLabel === w)?.blockName ?? ""} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekGroup({ label, blockName, rows, byDate }: { label: string; blockName: string; rows: Overview["sessions"]; byDate: Map<string, VariableDay> }) {
  return (
    <>
      <tr className="bg-white/[0.02]">
        <td colSpan={9} className="label px-5 py-1.5 text-ink-faint">{blockName} · {label}</td>
      </tr>
      {rows.map((r) => {
        const v = byDate.get(r.date);
        const planned = r.status !== "done";
        return (
          <tr key={r.id} className={clsx("border-b border-line-soft last:border-0", r.isToday && "bg-[var(--color-marker-wash)]", planned && "text-ink-faint")}>
            <td className="px-5">
              <div className="flex items-center gap-3">
                <span className={clsx("num w-9 text-[11.5px]", r.isToday ? "rounded-md bg-marker px-1.5 py-0.5 text-center text-ink-inverse" : "text-ink-faint")}>{r.weekday.slice(0, 3)}</span>
                <span className={clsx("truncate font-sans", !planned && "text-ink")}>{r.name.split(" — ")[1] ?? r.name}</span>
              </div>
            </td>
            <td className="px-3 text-right"><TopCell t={r.top.SQUAT} /></td>
            <td className="px-3 text-right"><TopCell t={r.top.BENCH} /></td>
            <td className="px-3 text-right"><TopCell t={r.top.DEADLIFT} /></td>
            <td className="px-3 text-right">{r.tonnage ? `${kg(r.tonnage)}` : "—"}</td>
            <td className="hidden px-3 text-right md:table-cell">{v?.weight != null ? kg(v.weight) : "—"}</td>
            <td className="hidden px-3 text-right md:table-cell">{v?.sleep ?? "—"}</td>
            <td className="hidden px-3 text-right md:table-cell">{v?.recovery ?? "—"}</td>
            <td className="hidden px-5 text-right lg:table-cell">{v?.steps != null ? v.steps.toLocaleString("en-GB") : "—"}</td>
          </tr>
        );
      })}
    </>
  );
}
