"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { clsx } from "clsx";
import { api } from "../../../convex/_generated/api";
import { Shell } from "@/components/dash/shell";
import { exampleFrom, fromTree, loggedSessions, type ADay } from "@/lib/analytics";
import { addDays, localToday, shortDate } from "@/lib/dates";
import { Seg } from "./kit";
import { StrengthTab } from "./strength-tab";
import { VolumeTab } from "./volume-tab";
import { BlocksTab } from "./blocks-tab";
import { RecoveryTab } from "./recovery-tab";
import { InsightsTab } from "./insights-tab";

const TABS = [
  { id: "strength", label: "Strength" },
  { id: "volume", label: "Volume" },
  { id: "blocks", label: "Blocks & weeks" },
  { id: "recovery", label: "Recovery" },
  { id: "insights", label: "What moves training" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AnalyticsPage() {
  const today = localToday();
  const tree = useQuery(api.programs.activeTree);
  const from = tree ? addDays(tree.program.startDate, -60) : addDays(today, -120);
  const metricRows = useQuery(api.dailyMetrics.range, { from, to: today });
  const [tab, setTab] = useState<Tab>("strength");
  const [source, setSource] = useState<"auto" | "mine" | "example">("auto");

  const real = useMemo(() => {
    if (!tree || !metricRows) return null;
    const days: ADay[] = metricRows.map((r) => ({
      date: r.date, weight: r.weight, sleep: r.sleep, recovery: r.recovery, steps: r.steps,
      hrv: r.hrv, rhr: r.rhr, carbs: r.carbs, calories: r.calories, protein: r.protein,
    }));
    return fromTree(tree, days, today);
  }, [tree, metricRows, today]);
  const example = useMemo(() => (tree ? exampleFrom(tree) : null), [tree]);

  const loggedCount = real ? loggedSessions(real).length : 0;
  const useExample = source === "example" || (source === "auto" && loggedCount < 3);
  const ds = useExample ? example : real;

  return (
    <Shell
      title="Analytics"
      meta={ds ? (ds.example ? `Example: first 10 weeks of your program, up to ${shortDate(ds.today)}` : `${loggedCount} sessions logged since ${shortDate(ds.blocks[0]?.start ?? today)}`) : "Loading…"}
      actions={<Seg value={useExample ? "example" : "mine"} onChange={(v) => setSource(v)} options={[["mine", "Your data"], ["example", "Example data"]]} />}
    >
      <main className="flex flex-col gap-5 px-6 py-5 2xl:px-8">
        {ds?.example && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[0.06] px-4 py-3 text-[13px]">
            <span className="font-medium text-ink">You&apos;re looking at example data.</span>
            <span className="text-ink-muted">
              It&apos;s your real program with made-up lifts and recovery for the first 10 weeks, generated on the page. Nothing is saved.{" "}
              {loggedCount < 3 ? `You have ${loggedCount} logged session${loggedCount === 1 ? "" : "s"}; these views switch to your numbers after 3.` : ""}
            </span>
          </div>
        )}

        <nav className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx("-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] transition-colors", tab === t.id ? "border-[var(--color-accent)] text-ink" : "border-transparent text-ink-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {!ds ? (
          <div className="px-1 py-10 text-[13px] text-ink-muted">Loading…</div>
        ) : tab === "strength" ? (
          <StrengthTab ds={ds} />
        ) : tab === "volume" ? (
          <VolumeTab ds={ds} />
        ) : tab === "blocks" ? (
          <BlocksTab ds={ds} />
        ) : tab === "recovery" ? (
          <RecoveryTab ds={ds} />
        ) : (
          <InsightsTab ds={ds} />
        )}
      </main>
    </Shell>
  );
}
