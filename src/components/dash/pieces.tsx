import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { clsx } from "clsx";
import { kg } from "@/lib/lifting";
import type { Overview, SessionRow } from "@/lib/overview";
import { average, latest, type VariableDay } from "@/lib/variables";
import { VAR_META, type VarKey } from "./meta";

export function fmtVar(k: VarKey, v: number | null | undefined) {
  if (v == null) return "—";
  return k === "steps" ? v.toLocaleString("en-GB") : String(v);
}

export function varStat(rows: VariableDay[], k: VarKey) {
  const value = latest(rows, k);
  const avg7 = average(rows, k, 7);
  const avg28 = average(rows, k, 28);
  const delta = avg7 != null && avg28 != null ? Math.round((avg7 - avg28) * 10) / 10 : null;
  return { value, avg7, avg28, delta };
}

/** Compact "today" row: session + what's been logged. */
export function TodayRow({ o, vars }: { o: Overview; vars: VariableDay[] }) {
  const s = o.next;
  const today = vars[vars.length - 1];
  const items: [VarKey, number | null][] = [["weight", today?.weight ?? null], ["sleep", today?.sleep ?? null], ["recovery", today?.recovery ?? null], ["steps", today?.steps ?? null]];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <span className="num rounded-lg bg-marker px-2 py-1 text-[12px] font-semibold text-ink-inverse">
          {new Date(o.today + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}
        </span>
        {s ? (
          <span className="text-[13.5px]">
            <span className="text-ink-muted">Today ·</span> <span className="font-medium">{s.name}</span>
          </span>
        ) : (
          <span className="text-[13.5px] text-ink-muted">Rest day</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.map(([k, v]) => (
          <span key={k} className="chip">
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: VAR_META[k].color }} />
            {VAR_META[k].label}
            <span className={clsx("num", v == null ? "text-ink-faint" : "text-ink")}>{fmtVar(k, v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Week list — session names only, ticks for done. */
export function WeekList({ o, className }: { o: Overview; className?: string }) {
  return (
    <ul className={clsx("flex flex-col", className)}>
      {o.days.map((d) => (
        <li key={d.session.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0">
          <span
            className={clsx(
              "num flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[11.5px] font-medium",
              d.session.status === "done" ? "bg-[var(--color-accent-soft)] text-ink" : d.isNext ? "ring-accent bg-[var(--color-accent)] text-ink-inverse" : "border border-line text-ink-faint",
            )}
          >
            {d.session.status === "done" ? <Check size={13} strokeWidth={3} /> : d.session.weekday.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px]">{d.session.name?.split(" — ")[1] ?? d.session.name}</div>
            <div className="num text-[11px] text-ink-faint">
              {d.session.weekday} · {d.session.status === "done" ? `${Math.round(d.tonnage / 100) / 10} t` : d.isNext ? "next" : "planned"}
            </div>
          </div>
          <div className="flex gap-1">
            {d.mainLifts.map((l) => (
              <i key={l} className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--color-${l.toLowerCase()})` }} />
            ))}
          </div>
          <Link href={`/sessions/${d.session.id}`} className="tile-soft h-7 w-7 rounded-[8px] hover:text-ink"><ArrowUpRight size={13} /></Link>
        </li>
      ))}
    </ul>
  );
}

export function TopCell({ t }: { t: SessionRow["top"]["SQUAT"] }) {
  if (!t) return <span className="text-ink-faint">—</span>;
  return (
    <span className="num">
      {kg(t.kg)}
      <span className="text-ink-faint"> ×{t.reps}</span>
      {t.rpe != null && <span className="text-ink-faint"> @{t.rpe}</span>}
    </span>
  );
}
