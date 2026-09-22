import type { Block, LiftGroup, Program, Session, Week } from "./types";
import { e1rm, round, sessionTonnage, tonnage } from "./lifting";
import { exerciseById } from "./exercises";

export type SeriesLift = Extract<LiftGroup, "SQUAT" | "BENCH" | "DEADLIFT">;
export const SERIES_LIFTS: SeriesLift[] = ["SQUAT", "BENCH", "DEADLIFT"];

export interface WeekPoint {
  weekId: string;
  /** "W6" — the label on the x-axis. */
  label: string;
  /** "Block 2 · week 2" — the tooltip title. */
  title: string;
  blockId: string;
  startDate: string;
  hasData: boolean;
  SQUAT: number | null;
  BENCH: number | null;
  DEADLIFT: number | null;
  total: number | null;
}

function groupOf(exerciseId: string): LiftGroup {
  return exerciseById(exerciseId)?.group ?? "OTHER";
}

/** Weekly tonnage (kg moved) per competition lift. Accessories roll into `total`. */
export function volumeByWeek(weeks: Week[], program: Program): WeekPoint[] {
  return weeks.map((week) => {
    const totals: Record<string, number> = { SQUAT: 0, BENCH: 0, DEADLIFT: 0 };
    let all = 0;
    let logged = false;

    for (const session of week.sessions) {
      for (const p of session.prescriptions) {
        const load = tonnage(p);
        if (!load) continue;
        logged = true;
        all += load;
        const group = groupOf(p.exerciseId);
        if (group in totals) totals[group] += load;
      }
    }

    return {
      ...frame(week, program),
      hasData: logged,
      SQUAT: logged ? round(totals.SQUAT, 1) : null,
      BENCH: logged ? round(totals.BENCH, 1) : null,
      DEADLIFT: logged ? round(totals.DEADLIFT, 1) : null,
      total: logged ? round(all, 1) : null,
    };
  });
}

/** Best estimated 1RM reached each week, per competition lift. */
export function intensityByWeek(weeks: Week[], program: Program): WeekPoint[] {
  return weeks.map((week) => {
    const best: Record<string, number> = { SQUAT: 0, BENCH: 0, DEADLIFT: 0 };
    let logged = false;

    for (const session of week.sessions) {
      for (const p of session.prescriptions) {
        if (!p.log?.weights.length) continue;
        const group = groupOf(p.exerciseId);
        if (!(group in best)) continue;
        const exercise = exerciseById(p.exerciseId);
        if (!exercise?.isMainLift) continue;
        const top = Math.max(...p.log.weights);
        const estimate = e1rm(top, p.log.reps[0] ?? p.reps, p.log.lsrpe);
        if (estimate && estimate > best[group]) {
          best[group] = estimate;
          logged = true;
        }
      }
    }

    return {
      ...frame(week, program),
      hasData: logged,
      SQUAT: best.SQUAT || null,
      BENCH: best.BENCH || null,
      DEADLIFT: best.DEADLIFT || null,
      total: null,
    };
  });
}

/**
 * Average (logged RPE − prescribed RPE) per week. Above zero means the week ran
 * harder than it was written to run.
 */
export function rpeDeltaByWeek(weeks: Week[], program: Program): WeekPoint[] {
  return weeks.map((week) => {
    const deltas: Record<string, number[]> = { SQUAT: [], BENCH: [], DEADLIFT: [] };
    const all: number[] = [];

    for (const session of week.sessions) {
      for (const p of session.prescriptions) {
        if (p.load.kind !== "rpe" || p.log?.lsrpe == null) continue;
        const delta = p.log.lsrpe - p.load.rpe;
        all.push(delta);
        const group = groupOf(p.exerciseId);
        if (group in deltas) deltas[group].push(delta);
      }
    }

    const mean = (xs: number[]) =>
      xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 0.01) : null;

    return {
      ...frame(week, program),
      hasData: all.length > 0,
      SQUAT: mean(deltas.SQUAT),
      BENCH: mean(deltas.BENCH),
      DEADLIFT: mean(deltas.DEADLIFT),
      total: mean(all),
    };
  });
}

function frame(week: Week, program: Program) {
  const block = program.blocks.find((b) => b.id === week.blockId);
  return {
    weekId: week.id,
    label: `W${week.programWeekIndex}`,
    title: `${block?.name.split(" — ")[0] ?? "Block"} · week ${week.blockWeekIndex}`,
    blockId: week.blockId,
    startDate: week.startDate,
  };
}

/* ------------------------------------------------------------ week summaries */

export interface WeekSummary {
  sessionsDone: number;
  sessionsTotal: number;
  tonnage: number;
  tonnageDelta: number | null;
  rpeDelta: number | null;
}

export function summarizeWeek(week: Week, previous?: Week): WeekSummary {
  const done = week.sessions.filter((s) => s.status === "done").length;
  const load = week.sessions.reduce((sum, s) => sum + sessionTonnage(s), 0);
  const prior = previous
    ? previous.sessions.reduce((sum, s) => sum + sessionTonnage(s), 0)
    : null;

  const deltas: number[] = [];
  for (const session of week.sessions) {
    for (const p of session.prescriptions) {
      if (p.load.kind === "rpe" && p.log?.lsrpe != null) deltas.push(p.log.lsrpe - p.load.rpe);
    }
  }

  return {
    sessionsDone: done,
    sessionsTotal: week.sessions.length,
    tonnage: round(load, 1),
    tonnageDelta: prior && load ? round(((load - prior) / prior) * 100, 0.1) : null,
    rpeDelta: deltas.length
      ? round(deltas.reduce((a, b) => a + b, 0) / deltas.length, 0.01)
      : null,
  };
}

/* ----------------------------------------------------------- exercise history */

export interface ExerciseEntry {
  sessionId: string;
  date: string;
  blockName: string;
  weekLabel: string;
  prescribed: string;
  weights: number[];
  reps: number[];
  lsrpe?: number;
  e1rm: number | null;
  topSet: number | null;
  tonnage: number;
}

export function exerciseHistory(program: Program, exerciseId: string): ExerciseEntry[] {
  const entries: ExerciseEntry[] = [];

  for (const block of program.blocks) {
    for (const week of block.weeks) {
      for (const session of week.sessions) {
        for (const p of session.prescriptions) {
          if (p.exerciseId !== exerciseId || !p.log?.weights.length) continue;
          const top = Math.max(...p.log.weights);
          entries.push({
            sessionId: session.id,
            date: session.date,
            blockName: block.name.split(" — ")[0],
            weekLabel: `W${week.programWeekIndex}`,
            prescribed:
              p.load.kind === "absolute"
                ? `${p.sets}×${p.reps} @ ${p.load.kg}`
                : p.load.kind === "rpe"
                  ? `${p.sets}×${p.reps} @ ${p.load.rpe} RPE`
                  : `${p.sets}×${p.reps} @ ${p.load.pct}%`,
            weights: p.log.weights,
            reps: p.log.reps,
            lsrpe: p.log.lsrpe,
            topSet: top,
            e1rm: e1rm(top, p.log.reps[0] ?? p.reps, p.log.lsrpe),
            tonnage: tonnage(p),
          });
        }
      }
    }
  }

  return entries.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function allWeeks(program: Program): Week[] {
  return program.blocks.flatMap((b) => b.weeks);
}

export function blockWeeks(block: Block): Week[] {
  return block.weeks;
}

export function sessionsOf(week: Week): Session[] {
  return [...week.sessions].sort((a, b) => a.dayNumber - b.dayNumber);
}

/* -------------------------------------------------------- block comparisons */

export interface BlockSummary {
  blockId: string;
  name: string;
  focus?: string;
  weeks: number;
  sessionsDone: number;
  sessionsTotal: number;
  tonnage: number;
  /** Best e1RM reached in the block, per competition lift. */
  best: Record<SeriesLift, number | null>;
  rpeDelta: number | null;
}

export function blockSummaries(program: Program): BlockSummary[] {
  return program.blocks.map((block) => {
    const intensity = intensityByWeek(block.weeks, program);
    const volume = volumeByWeek(block.weeks, program);
    const rpe = rpeDeltaByWeek(block.weeks, program);

    const best = Object.fromEntries(
      SERIES_LIFTS.map((lift) => [
        lift,
        intensity.reduce<number | null>(
          (max, point) =>
            point[lift] != null && (max == null || point[lift]! > max) ? point[lift]! : max,
          null,
        ),
      ]),
    ) as Record<SeriesLift, number | null>;

    const deltas = rpe.map((p) => p.total).filter((v): v is number => v != null);
    const sessions = block.weeks.flatMap((w) => w.sessions);

    return {
      blockId: block.id,
      name: block.name,
      focus: block.focus,
      weeks: block.weeks.length,
      sessionsDone: sessions.filter((s) => s.status === "done").length,
      sessionsTotal: sessions.length,
      tonnage: round(
        volume.reduce((sum, p) => sum + (p.total ?? 0), 0),
        1,
      ),
      best,
      rpeDelta: deltas.length
        ? round(deltas.reduce((a, b) => a + b, 0) / deltas.length, 0.01)
        : null,
    };
  });
}
