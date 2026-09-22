"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Dumbbell, Plus, Settings2, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../../convex/_generated/api";
import { Shell, CardHeader } from "./shell";
import { Field, track } from "./field";
import type { Tree } from "@/lib/program-tree";
import { formatLoad, kg, resolveLoad } from "@/lib/lifting";
import { parseLoad } from "@/lib/load-text";
import { addDays, isIsoDate, localToday, shortDate } from "@/lib/dates";
import type { Load } from "@/lib/types";

type Block = Tree["blocks"][number];
type Week = Block["weeks"][number];
type Sess = Week["sessions"][number];
type Row = Sess["prescriptions"][number];
type ProgramDoc = Tree["program"];

const SLOT_COLOR = ["var(--color-squat)", "var(--color-bench)", "var(--color-deadlift)", "var(--color-steps)"];

function inWeek(today: string, w: { startDate: string }) {
  return today >= w.startDate && today <= addDays(w.startDate, 6);
}

export function ProgramEditor() {
  const tree = useQuery(api.programs.activeTree);
  const today = localToday();
  const [picked, setPicked] = useState<number | null>(null);

  if (tree === undefined) {
    return (
      <Shell title="Program">
        <div className="px-6 py-10 text-[13px] text-ink-muted">Loading program…</div>
      </Shell>
    );
  }
  if (tree === null) {
    return (
      <Shell title="Program">
        <div className="px-6 py-10 text-[13px] text-ink-muted">No active program yet.</div>
      </Shell>
    );
  }

  const current = tree.blocks.findIndex((b) => b.weeks.some((w) => inWeek(today, w)));
  const bi = picked ?? Math.max(0, current);
  const block = tree.blocks[bi];
  const lastWeek = tree.blocks.at(-1)?.weeks.at(-1);

  return (
    <Shell
      title={tree.program.name}
      meta={
        <>
          {shortDate(tree.program.startDate)} – {lastWeek ? shortDate(addDays(lastWeek.startDate, 6)) : ""} · {tree.blocks.length} blocks
        </>
      }
    >
      <main className="flex flex-col gap-5 px-6 py-5 2xl:px-8">
        <ProgramSettings program={tree.program} />

        <div className="flex flex-wrap items-center gap-1.5">
          {tree.blocks.map((b, i) => (
            <button key={b._id} onClick={() => setPicked(i)} className={clsx("tab", i === bi && "tab-active")}>
              <span className="flex items-center gap-2 text-[13.5px] font-medium">
                {b.name}
                {i === current && <span className="h-1.5 w-1.5 rounded-full bg-marker" title="You are here" />}
              </span>
              <span className="text-[11.5px] text-ink-faint">
                {b.weeks.length ? `${shortDate(b.weeks[0].startDate)} – ${shortDate(addDays(b.weeks[b.weeks.length - 1].startDate, 6))}` : "No weeks"}
              </span>
            </button>
          ))}
        </div>

        <BlockHeader key={block._id} block={block} />

        {slotsOf(block).map((slot, i) => (
          <SlotMatrix key={`${block._id}-${slot.dayNumber}`} slot={slot} program={tree.program} today={today} color={SLOT_COLOR[i % SLOT_COLOR.length]} />
        ))}
      </main>
    </Shell>
  );
}

/* ------------------------------------------------------------ settings */

function ProgramSettings({ program }: { program: ProgramDoc }) {
  const update = useMutation(api.programs.updateProgram);
  const setStart = useMutation(api.programs.setStartDate);
  const programId = program._id;
  const num = (t: string) => {
    const n = parseFloat(t.replace(",", "."));
    return Number.isNaN(n) || n <= 0 ? null : n;
  };
  const max = (lift: "squat" | "bench" | "deadlift") => (t: string) => {
    const n = num(t);
    return n == null ? undefined : update({ programId, maxes: { [lift]: n } });
  };

  return (
    <section className="panel">
      <CardHeader icon={Settings2} color="var(--color-weight)" title="Program settings" meta="Percentage loads are worked out from these training maxes. Changing the start date moves every session with it." />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 md:grid-cols-4 2xl:grid-cols-8">
        <Labeled label="Name" className="col-span-2">
          <Field className="input" value={program.name} onSave={(t) => (t.trim() ? update({ programId, name: t.trim() }) : undefined)} />
        </Labeled>
        <Labeled label="Week 1 starts">
          <Field type="date" className="input" delay={-1} value={program.startDate} onSave={(t) => (isIsoDate(t) && t !== program.startDate ? setStart({ programId, startDate: t }) : undefined)} />
        </Labeled>
        <Labeled label="Meet date">
          <Field type="date" className="input" delay={-1} value={program.meetDate ?? ""} onSave={(t) => (t === "" ? update({ programId, meetDate: null }) : isIsoDate(t) ? update({ programId, meetDate: t }) : undefined)} />
        </Labeled>
        <Labeled label="Squat max · kg">
          <Field className="input" inputMode="decimal" value={program.maxes?.squat != null ? kg(program.maxes.squat) : ""} onSave={max("squat")} />
        </Labeled>
        <Labeled label="Bench max · kg">
          <Field className="input" inputMode="decimal" value={program.maxes?.bench != null ? kg(program.maxes.bench) : ""} onSave={max("bench")} />
        </Labeled>
        <Labeled label="Deadlift max · kg">
          <Field className="input" inputMode="decimal" value={program.maxes?.deadlift != null ? kg(program.maxes.deadlift) : ""} onSave={max("deadlift")} />
        </Labeled>
        <Labeled label="Round to · kg">
          <Field className="input" inputMode="decimal" value={program.rounding != null ? kg(program.rounding) : "2.5"} onSave={(t) => { const n = num(t); return n == null ? undefined : update({ programId, rounding: n }); }} />
        </Labeled>
      </div>
    </section>
  );
}

function Labeled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function BlockHeader({ block }: { block: Block }) {
  const update = useMutation(api.programs.updateBlock);
  return (
    <section className="flex flex-wrap items-end gap-4">
      <Labeled label="Block name" className="w-[240px]">
        <Field className="input" value={block.name} onSave={(t) => (t.trim() ? update({ blockId: block._id, name: t.trim() }) : undefined)} />
      </Labeled>
      <Labeled label="Focus" className="min-w-[280px] flex-1">
        <Field className="input" value={block.focus ?? ""} placeholder="What this block is for" onSave={(t) => update({ blockId: block._id, focus: t })} />
      </Labeled>
    </section>
  );
}

/* ---------------------------------------------------------- block matrix */

interface Slot {
  dayNumber: number;
  weeks: Week[];
  sessions: (Sess | undefined)[];
}

/** Group a block's sessions into training days (Friday, Monday, …), one session per week. */
function slotsOf(block: Block): Slot[] {
  const map = new Map<number, (Sess | undefined)[]>();
  block.weeks.forEach((w, wi) =>
    w.sessions.forEach((s) => {
      const arr = map.get(s.dayNumber) ?? Array<Sess | undefined>(block.weeks.length).fill(undefined);
      arr[wi] = s;
      map.set(s.dayNumber, arr);
    }),
  );
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([dayNumber, sessions]) => ({ dayNumber, weeks: block.weeks, sessions }));
}

/**
 * Line the same exercise up across weeks. Rows match by name and occurrence
 * ("Competition Squat" #1 is the top set, #2 the back-off), so a week with
 * fewer rows still lands in the right place.
 */
function matrixOf(sessions: (Sess | undefined)[]) {
  const keyed = sessions.map((s) => {
    const seen = new Map<string, number>();
    return (s?.prescriptions ?? []).map((p) => {
      const n = p.exercise?.name ?? "";
      const k = seen.get(n) ?? 0;
      seen.set(n, k + 1);
      return { key: `${n}#${k}`, p };
    });
  });
  const base = keyed.reduce((a, b) => (b.length > a.length ? b : a), [] as { key: string; p: Row }[]);
  const keys = base.map((x) => x.key);
  for (const list of keyed) for (const x of list) if (!keys.includes(x.key)) keys.push(x.key);
  return keys.map((key) => ({ key, cells: keyed.map((list) => list.find((x) => x.key === key)?.p) }));
}

function SlotMatrix({ slot, program, today, color }: { slot: Slot; program: ProgramDoc; today: string; color: string }) {
  const rename = useMutation(api.programs.renameSessions);
  const setRowExercise = useMutation(api.programs.setRowExercise);
  const addRow = useMutation(api.programs.addRow);
  const removeRows = useMutation(api.programs.removeRows);
  const moveRows = useMutation(api.programs.moveRows);
  const [confirm, setConfirm] = useState<string | null>(null);

  const first = slot.sessions.find((s): s is Sess => !!s)!;
  const sessionIds = slot.sessions.filter((s): s is Sess => !!s).map((s) => s._id);
  const rows = matrixOf(slot.sessions);
  const nowIdx = slot.weeks.findIndex((w) => inWeek(today, w));

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-3">
        <span className="tile" style={{ background: color, color }}>
          <span className="text-[#0b0a09]"><Dumbbell size={16} strokeWidth={2.2} /></span>
        </span>
        <span className="w-[86px] text-[13px] text-ink-muted">{first.weekday}</span>
        <Field className="cell-text !w-[340px] !text-[15px] !font-semibold" value={first.name ?? ""} placeholder="Session name" onSave={(t) => rename({ sessionIds, name: t })} />
        <span className="ml-auto text-[12px] text-ink-faint">Sets, reps and load change one week. Name, order and removal change every week.</span>
      </div>

      <div className="overflow-x-auto">
        <table className="sheet w-full min-w-[1080px]">
          <thead>
            <tr className="border-b border-line-soft">
              <th className="w-[40px]" />
              <th className="label px-2 py-2.5 text-left">Exercise</th>
              {slot.weeks.map((w, wi) => (
                <th key={w._id} className={clsx("label w-[18%] px-2 py-2.5 text-left", wi === nowIdx && "col-now")}>
                  Week {w.blockWeekIndex}
                  <span className="ml-2 text-[11px] font-normal tracking-normal text-ink-faint normal-case">
                    {slot.sessions[wi] ? shortDate(slot.sessions[wi]!.date) : "no session"}
                  </span>
                  {wi === nowIdx && <span className="ml-1.5 text-marker">●</span>}
                </th>
              ))}
              <th className="w-[100px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const ids = r.cells.filter((p): p is Row => !!p).map((p) => p._id);
              const name = r.cells.find(Boolean)?.exercise?.name ?? "";
              return (
                <tr key={`row-${i}`} className="group border-b border-line-soft align-top last:border-0">
                  <td className="pt-3 pl-5 text-[11.5px] text-ink-faint">{i + 1}</td>
                  <td className="px-1 py-1.5">
                    <Field className="cell-text" value={name} onSave={(t) => (t.trim() ? setRowExercise({ prescriptionIds: ids, name: t }) : undefined)} />
                  </td>
                  {r.cells.map((p, wi) => (
                    <td key={wi} className={clsx("px-1 py-1.5", wi === nowIdx && "col-now")}>
                      {p ? <WeekCell p={p} session={slot.sessions[wi]!} program={program} /> : <span className="block px-2 pt-1.5 text-ink-faint">—</span>}
                    </td>
                  ))}
                  <td className="pt-1.5 pr-3">
                    <div className="flex justify-end gap-0.5 opacity-30 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button className="icon-btn" disabled={i === 0} onClick={() => track(moveRows({ prescriptionIds: ids, direction: -1 }))} aria-label="Move up"><ArrowUp size={14} /></button>
                      <button className="icon-btn" disabled={i === rows.length - 1} onClick={() => track(moveRows({ prescriptionIds: ids, direction: 1 }))} aria-label="Move down"><ArrowDown size={14} /></button>
                      {confirm === r.key ? (
                        <button
                          autoFocus
                          className="h-7 rounded-lg bg-deadlift/15 px-2 text-[12px] font-medium text-deadlift"
                          onClick={() => { setConfirm(null); track(removeRows({ prescriptionIds: ids })); }}
                          onBlur={() => setConfirm(null)}
                        >
                          Remove?
                        </button>
                      ) : (
                        <button className="icon-btn" onClick={() => setConfirm(r.key)} aria-label="Remove from every week"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line-soft px-5 py-3">
        <button
          onClick={() => track(addRow({ sessionIds, name: "New exercise", sets: 3, reps: 10, load: { kind: "rpe", rpe: 7 } }))}
          className="flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink"
        >
          <Plus size={14} /> Add exercise to every week
        </button>
      </div>
    </section>
  );
}

function WeekCell({ p, session, program }: { p: Row; session: Sess; program: ProgramDoc }) {
  const edit = useMutation(api.logs.editPrescription);
  const load = p.load as Load;
  const rowWeights = session.prescriptions.map((r) => (r.log?.weights.length ? Math.max(...r.log.weights) : null));
  const computed = resolveLoad(load, { maxes: program.maxes, rounding: program.rounding, rowWeights });

  let hint = "";
  if (p.log?.weights.length) hint = `logged ${[...new Set(p.log.weights)].map(kg).join(", ")}${p.log.lsrpe != null ? ` @${p.log.lsrpe}` : ""}`;
  else if (computed != null) hint = `= ${kg(computed)} kg`;
  else if (p.beRange != null) hint = `${kg(p.beRange)}–${p.teRange != null ? kg(p.teRange) : "?"} kg`;
  else if (load.kind === "percentOfRow") hint = "after row " + (load.ofOrder + 1) + " is logged";

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Field className="cell-sm !w-[38px] shrink-0" inputMode="numeric" value={String(p.sets)} onSave={(t) => { const n = parseInt(t); return n > 0 ? edit({ prescriptionId: p._id, sets: n }) : undefined; }} />
        <span className="text-[12px] text-ink-faint">×</span>
        <Field className="cell-sm !w-[38px] shrink-0" inputMode="numeric" value={String(p.reps)} onSave={(t) => { const n = parseInt(t); return n > 0 ? edit({ prescriptionId: p._id, reps: n }) : undefined; }} />
        <Field
          className="cell-sm min-w-0 flex-1 !text-left"
          value={formatLoad(load)}
          title="Examples: 7 RPE · 152.5 · 70% S · 88% #3"
          onSave={(t) => {
            const next = parseLoad(t, load);
            return JSON.stringify(next) !== JSON.stringify(load) ? edit({ prescriptionId: p._id, load: next }) : undefined;
          }}
        />
      </div>
      {hint && <div className={clsx("px-1.5 pb-1 text-[11px]", p.log ? "text-[var(--color-recovery)]" : "text-ink-faint")}>{hint}</div>}
    </div>
  );
}
