"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatLoad, kg, resolveLoad, round } from "@/lib/lifting";
import type { Prescription, Program, Session } from "@/lib/types";
import { parseLoad } from "@/lib/load-text";
import { track } from "./field";
import { Toggle } from "./charts";

export interface SheetSession extends Session {
  weekLabel: string;
  blockName: string;
  blockWeek: number;
  blockWeeks: number;
}

/** Local, in-progress text for a row. Server values fill anything not being edited. */
interface Draft {
  name?: string;
  sets?: string;
  reps?: string;
  load?: string;
  weights?: string;
  lsrpe?: string;
  be?: string;
  te?: string;
}

function parseWeights(s: string): number[] {
  return s.split(/[,\s]+/).map(parseFloat).filter((x) => !Number.isNaN(x));
}
function longDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * The training sheet. One exercise per row, typed in place, saved to Convex on
 * a short debounce. Percent loads resolve as soon as the weight they depend on
 * is entered, exactly like the spreadsheet formulas.
 */
export function SessionSheet({ program, sessions, initialId, today, ledger }: { program: Program; sessions: SheetSession[]; initialId: string; today: string; ledger: React.ReactNode }) {
  const initialIdx = Math.max(0, sessions.findIndex((s) => s.id === initialId));
  const [idx, setIdx] = useState(initialIdx);
  const [view, setView] = useState<"session" | "ledger">("session");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const upsertLog = useMutation(api.logs.upsert);
  const editPrescription = useMutation(api.logs.editPrescription);
  const setSessionNotes = useMutation(api.logs.setSessionNotes);
  const addPrescription = useMutation(api.programs.addPrescription);
  const removePrescription = useMutation(api.programs.removePrescription);

  const session = sessions[idx];
  const isToday = session.date === today;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(sessions.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessions.length]);

  /** Server value rendered as the sheet shows it. */
  function base(p: Prescription): Required<Draft> {
    return {
      name: p.exerciseName ?? "",
      sets: String(p.sets),
      reps: String(p.reps),
      load: formatLoad(p.load),
      weights: p.log?.weights.length ? [...new Set(p.log.weights)].map(kg).join(", ") : "",
      lsrpe: p.log?.lsrpe != null ? String(p.log.lsrpe) : "",
      be: p.beRange != null ? kg(p.beRange) : "",
      te: p.teRange != null ? kg(p.teRange) : "",
    };
  }
  const val = (p: Prescription, k: keyof Draft) => drafts[p.id]?.[k] ?? base(p)[k];

  function debounce(key: string, fn: () => Promise<unknown>) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => void track(fn()), 450);
  }

  function edit(p: Prescription, k: keyof Draft, text: string) {
    setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], [k]: text } }));
    const id = p.id as Id<"prescriptions">;
    if (k === "weights" || k === "lsrpe") {
      const weights = parseWeights(k === "weights" ? text : val(p, "weights"));
      const reps = parseInt(val(p, "reps")) || p.reps;
      const lsrpeText = k === "lsrpe" ? text : val(p, "lsrpe");
      const lsrpe = lsrpeText === "" ? undefined : parseFloat(lsrpeText);
      debounce(`${p.id}:log`, () => upsertLog({ prescriptionId: id, weights, reps: weights.map(() => reps), lsrpe: Number.isNaN(lsrpe) ? undefined : lsrpe }));
    } else if (k === "name") {
      debounce(`${p.id}:name`, () => editPrescription({ prescriptionId: id, exerciseName: text }));
    } else if (k === "sets" || k === "reps") {
      const n = parseInt(text);
      if (!Number.isNaN(n) && n > 0) debounce(`${p.id}:${k}`, () => editPrescription({ prescriptionId: id, [k]: n }));
    } else if (k === "load") {
      debounce(`${p.id}:load`, () => editPrescription({ prescriptionId: id, load: parseLoad(text, p.load) }));
    } else if (k === "be" || k === "te") {
      const n = text.trim() === "" ? null : parseFloat(text);
      if (n === null || !Number.isNaN(n)) debounce(`${p.id}:${k}`, () => editPrescription({ prescriptionId: id, [k === "be" ? "beRange" : "teRange"]: n }));
    }
  }

  // Weights per row order, for percent-of-row loads.
  const rowWeights = session.prescriptions.map((p) => {
    const w = parseWeights(val(p, "weights"));
    return w.length ? Math.max(...w) : null;
  });
  const ctx = { maxes: program.maxes, rounding: program.rounding, rowWeights };

  const tonnage = useMemo(() => {
    let t = 0;
    session.prescriptions.forEach((p) => {
      const w = parseWeights(val(p, "weights"));
      if (!w.length) return;
      const sets = parseInt(val(p, "sets")) || 0;
      const reps = parseInt(val(p, "reps")) || 0;
      const per = w.length === 1 ? Array(sets).fill(w[0]) : w;
      t += per.reduce((s: number, x: number) => s + x * reps, 0);
    });
    return round(t, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, drafts]);
  const logged = session.prescriptions.filter((p) => parseWeights(val(p, "weights")).length).length;
  const hasRange = session.prescriptions.some((p) => p.beRange != null || p.teRange != null);
  const notes = notesDraft[session.id] ?? session.notes ?? "";

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-4 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button className="nav-btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} aria-label="Previous session"><ChevronLeft size={16} /></button>
          <button className="nav-btn" onClick={() => setIdx(Math.min(sessions.length - 1, idx + 1))} disabled={idx === sessions.length - 1} aria-label="Next session"><ChevronRight size={16} /></button>
        </div>
        <div>
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            {isToday && <span className="rounded-md bg-marker px-1.5 py-0.5 text-[11px] font-semibold text-ink-inverse">Today</span>}
            <span>{longDate(session.date)}</span>
            <span className="text-ink-faint">·</span>
            <span>{session.blockName}, week {session.blockWeek} of {session.blockWeeks}</span>
            {session.status === "done" && <span className="flex items-center gap-1 text-[var(--color-recovery)]"><Check size={12} strokeWidth={3} /> done</span>}
          </div>
          <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em]">{session.name}</h2>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {idx !== initialIdx && <button onClick={() => setIdx(initialIdx)} className="chip hover:text-ink">Back to today</button>}
          <Toggle value={view} onChange={setView} options={[["session", "Session"], ["ledger", "Ledger"]]} />
        </div>
      </div>

      {view === "ledger" ? (
        ledger
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="sheet w-full">
              <thead>
                <tr className="border-y border-line-soft">
                  <th className="label w-[34%] px-5 py-2.5 text-left">Exercise</th>
                  <th className="label w-[6%] px-1 py-2.5 text-right">Sets</th>
                  <th className="label w-[6%] px-1 py-2.5 text-right">Reps</th>
                  <th className="label w-[14%] px-1 py-2.5 text-right">Load</th>
                  <th className="label w-[14%] px-1 py-2.5 text-right">Weight</th>
                  <th className="label w-[7%] px-1 py-2.5 text-right">LSRPE</th>
                  {hasRange && <th className="label w-[7%] px-1 py-2.5 text-right">BE</th>}
                  {hasRange && <th className="label w-[7%] px-1 py-2.5 text-right">TE</th>}
                  <th className="w-[44px]" />
                </tr>
              </thead>
              <tbody>
                {session.prescriptions.map((p, i) => {
                  const computed = resolveLoad(p.load, ctx);
                  const isTop = p.load.kind === "rpe" && (p.beRange != null || p.reps <= 1);
                  const loadText = val(p, "load");
                  const showComputed = (p.load.kind === "percent" || p.load.kind === "percentOfRow") && !drafts[p.id]?.load;
                  return (
                    <tr key={p.id} className="group border-b border-line-soft last:border-0">
                      <td className="pr-1 pl-5">
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-[11.5px] text-ink-faint">{i + 1}</span>
                          <input className="cell cell-text" value={val(p, "name")} placeholder="Exercise" onChange={(e) => edit(p, "name", e.target.value)} />
                          {isTop && <span className="label shrink-0 pr-2 text-ink-faint">top</span>}
                          {p.notes && <span className="shrink-0 pr-2 text-[11px] text-ink-faint">{p.notes}</span>}
                        </div>
                      </td>
                      <td className="px-1"><input className="cell" inputMode="numeric" value={val(p, "sets")} onChange={(e) => edit(p, "sets", e.target.value)} /></td>
                      <td className="px-1"><input className="cell" inputMode="numeric" value={val(p, "reps")} onChange={(e) => edit(p, "reps", e.target.value)} /></td>
                      <td className="px-1">
                        <div className="relative">
                          <input
                            className={clsx("cell", showComputed && "cell-dim")}
                            value={showComputed ? (computed != null ? `${kg(computed)}` : "") : loadText}
                            placeholder={showComputed ? loadText : "RPE or kg"}
                            title={showComputed ? `${loadText}${computed != null ? ` = ${kg(computed)} kg` : " — enter the weight it depends on"}` : "e.g. 7 RPE · 152.5 · 70% S · 88% #1"}
                            onFocus={(e) => { if (showComputed) e.target.value = loadText; }}
                            onChange={(e) => edit(p, "load", e.target.value)}
                          />
                          {showComputed && computed != null && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[10.5px] text-ink-faint">{loadText}</span>}
                        </div>
                      </td>
                      <td className="px-1">
                        <input
                          className={clsx("cell", !val(p, "weights") && "cell-empty")}
                          inputMode="decimal"
                          placeholder={computed != null ? kg(computed) : session.status === "done" ? "—" : "kg"}
                          value={val(p, "weights")}
                          onChange={(e) => edit(p, "weights", e.target.value)}
                          title="One weight for every set, or one per set separated by commas"
                        />
                      </td>
                      <td className="px-1"><input className={clsx("cell", !val(p, "lsrpe") && "cell-empty")} inputMode="decimal" placeholder="—" value={val(p, "lsrpe")} onChange={(e) => edit(p, "lsrpe", e.target.value)} /></td>
                      {hasRange && <td className="px-1"><input className="cell cell-dim" inputMode="decimal" value={val(p, "be")} placeholder={isTop ? "—" : ""} onChange={(e) => edit(p, "be", e.target.value)} /></td>}
                      {hasRange && <td className="px-1"><input className="cell cell-dim" inputMode="decimal" value={val(p, "te")} placeholder={isTop ? "—" : ""} onChange={(e) => edit(p, "te", e.target.value)} /></td>}
                      <td className="pr-3 text-right">
                        <button onClick={() => track(removePrescription({ prescriptionId: p.id as Id<"prescriptions"> }))} aria-label="Remove exercise" className="rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/5 hover:text-ink">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line-soft px-5 py-3 pr-24">
            <button onClick={() => track(addPrescription({ sessionId: session.id as Id<"sessions">, exerciseName: "", sets: 3, reps: 8 }))} className="flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
              <Plus size={14} /> Add exercise
            </button>
            <span className="ml-auto flex items-center gap-6 text-[13px] text-ink-muted">
              <span>Tonnage <span className="num font-medium text-ink">{tonnage ? `${kg(tonnage)} kg` : "—"}</span></span>
              <span>Logged <span className="num font-medium text-ink">{logged}/{session.prescriptions.length}</span></span>
            </span>
          </div>

          <div className="border-t border-line-soft px-5 py-3">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotesDraft((d) => ({ ...d, [session.id]: e.target.value }));
                debounce(`${session.id}:notes`, () => setSessionNotes({ sessionId: session.id as Id<"sessions">, notes: e.target.value }));
              }}
              placeholder="Notes for this session…"
              rows={1}
              className="w-full resize-none bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
        </>
      )}
    </div>
  );
}
