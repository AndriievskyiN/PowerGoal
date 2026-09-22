/**
 * Seed program. Stands in for Convex until the deployment is connected — every
 * component reads the same shapes it will read from the database, so wiring the
 * real backend is an import swap, not a rewrite.
 *
 * The structure mirrors a real 12-week powerbuilding cycle: three 4-week blocks,
 * four sessions a week, top singles prescribed by RPE with BE/TE ranges and
 * back-off work prescribed by absolute load.
 */
import type {
  Block,
  Exercise,
  LiftGroup,
  Prescription,
  Program,
  Session,
  Week,
} from "./types";
import { loadForRpe, round } from "./lifting";

/* ------------------------------------------------------------------ helpers */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- templates */

type RowKind = "top" | "work" | "accessory";

interface TemplateRow {
  exercise: string;
  group: LiftGroup;
  kind: RowKind;
  sets: number;
  reps: number;
  /** Week-1 working load in kg, for absolute rows. */
  base?: number;
  /** Week-1 RPE target, for RPE rows. */
  rpe?: number;
  /** Week-1 bare-minimum range for top singles. */
  be?: number;
}

interface DayTemplate {
  dayNumber: number;
  weekday: string;
  /** Days after the week start. */
  offset: number;
  name: string;
  rows: TemplateRow[];
}

const DAYS: DayTemplate[] = [
  {
    dayNumber: 1,
    weekday: "Saturday",
    offset: 0,
    name: "Full — competition lifts",
    rows: [
      { exercise: "Competition Squat", group: "SQUAT", kind: "top", sets: 1, reps: 1, rpe: 5, be: 162.5 },
      { exercise: "Competition Squat", group: "SQUAT", kind: "work", sets: 3, reps: 5, base: 140 },
      { exercise: "Competition Bench Press", group: "BENCH", kind: "top", sets: 2, reps: 1, rpe: 6, be: 125 },
      { exercise: "Competition Bench Press", group: "BENCH", kind: "work", sets: 4, reps: 6, base: 107.5 },
      { exercise: "Sumo Deadlift", group: "DEADLIFT", kind: "top", sets: 1, reps: 1, rpe: 5, be: 200 },
      { exercise: "Sumo Deadlift", group: "DEADLIFT", kind: "work", sets: 3, reps: 5, base: 175 },
      { exercise: "Belt Squat", group: "QUADS", kind: "accessory", sets: 2, reps: 8, rpe: 7 },
      { exercise: "Hamstring Curl", group: "HAMSTRINGS", kind: "accessory", sets: 3, reps: 10, rpe: 8 },
    ],
  },
  {
    dayNumber: 2,
    weekday: "Sunday",
    offset: 1,
    name: "Upper — bench volume",
    rows: [
      { exercise: "Competition Bench Press", group: "BENCH", kind: "work", sets: 5, reps: 4, base: 112.5 },
      { exercise: "Close-Grip Bench Press", group: "BENCH", kind: "accessory", sets: 3, reps: 8, rpe: 7 },
      { exercise: "Incline Dumbbell Press", group: "SHOULDERS", kind: "accessory", sets: 3, reps: 10, rpe: 8 },
      { exercise: "Chest-Supported Row", group: "BACK", kind: "accessory", sets: 4, reps: 10, rpe: 8 },
      { exercise: "Lateral Raise", group: "SHOULDERS", kind: "accessory", sets: 3, reps: 15, rpe: 9 },
    ],
  },
  {
    dayNumber: 3,
    weekday: "Monday",
    offset: 2,
    name: "Lower — pulling emphasis",
    rows: [
      { exercise: "Pause Squat", group: "SQUAT", kind: "work", sets: 4, reps: 3, base: 125 },
      { exercise: "Sumo Deadlift", group: "DEADLIFT", kind: "work", sets: 4, reps: 3, base: 182.5 },
      { exercise: "Romanian Deadlift", group: "HAMSTRINGS", kind: "accessory", sets: 3, reps: 8, rpe: 8 },
      { exercise: "Lat Pulldown", group: "BACK", kind: "accessory", sets: 3, reps: 12, rpe: 8 },
      { exercise: "Ab Wheel", group: "OTHER", kind: "accessory", sets: 3, reps: 12, rpe: 7 },
    ],
  },
  {
    dayNumber: 4,
    weekday: "Tuesday",
    offset: 3,
    name: "Upper — pressing variations",
    rows: [
      { exercise: "Competition Bench Press", group: "BENCH", kind: "top", sets: 1, reps: 3, rpe: 7, be: 115 },
      { exercise: "Larsen Press", group: "BENCH", kind: "work", sets: 4, reps: 6, base: 95 },
      { exercise: "Pendlay Row", group: "BACK", kind: "accessory", sets: 4, reps: 6, rpe: 8 },
      { exercise: "Overhead Press", group: "SHOULDERS", kind: "accessory", sets: 3, reps: 8, rpe: 8 },
      { exercise: "Triceps Pushdown", group: "OTHER", kind: "accessory", sets: 3, reps: 15, rpe: 9 },
    ],
  },
];

const BLOCKS = [
  { name: "Block 1 — Accumulation", focus: "Volume at moderate RPE", rpeStart: 5, loadStep: 2.5 },
  { name: "Block 2 — Intensification", focus: "Heavier top sets, trimmed volume", rpeStart: 6, loadStep: 2.5 },
  { name: "Block 3 — Peaking", focus: "Openers, attempts, taper", rpeStart: 7, loadStep: 2.5 },
];

/* ----------------------------------------------------------------- exercises */

const exerciseIndex = new Map<string, Exercise>();
for (const day of DAYS) {
  for (const row of day.rows) {
    if (!exerciseIndex.has(row.exercise)) {
      exerciseIndex.set(row.exercise, {
        id: row.exercise.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: row.exercise,
        group: row.group,
        isMainLift: row.group === "SQUAT" || row.group === "BENCH" || row.group === "DEADLIFT",
      });
    }
  }
}

export const EXERCISES: Exercise[] = [...exerciseIndex.values()];

import { registerExercises, exerciseById as lookup } from "./exercises";
registerExercises([...exerciseIndex.values()]);
export function exerciseById(id: string): Exercise | undefined {
  const hit = lookup(id);
  if (hit) return hit;
  return EXERCISES.find((e) => e.id === id);
}

/* ------------------------------------------------------------------- builder */

const PROGRAM_START = "2026-08-08"; // a Saturday
export const TODAY = new Date().toISOString().slice(0, 10);

const rand = mulberry32(7);

function buildPrescription(
  row: TemplateRow,
  sessionId: string,
  order: number,
  weekInBlock: number,
  blockIndex: number,
  programWeek: number,
  isPast: boolean,
): Prescription {
  const id = `${sessionId}-p${order}`;
  const exerciseId = exerciseIndex.get(row.exercise)!.id;
  const p: Prescription = {
    id,
    sessionId,
    exerciseId,
    order,
    sets: row.sets,
    reps: row.reps,
    load: { kind: "absolute", kg: 0 },
  };

  if (row.kind === "work" && row.base != null) {
    const kgLoad = round(row.base + BLOCKS[blockIndex].loadStep * (programWeek - 1), 2.5);
    p.load = { kind: "absolute", kg: kgLoad };
  } else if (row.kind === "top") {
    const rpe = Math.min(9.5, (BLOCKS[blockIndex].rpeStart ?? 5) + weekInBlock - 1);
    p.load = { kind: "rpe", rpe };
    if (row.be != null) {
      const be = round(row.be + 5 * (programWeek - 1), 2.5);
      p.beRange = be;
      p.teRange = round(be * 1.05, 2.5);
    }
  } else {
    const rpe = Math.min(10, (row.rpe ?? 7) + Math.floor((weekInBlock - 1) / 2));
    p.load = { kind: "rpe", rpe };
  }

  if (isPast) p.log = buildLog(p, row);
  return p;
}

/** Plausible logged results: on target, with the honest drift you get in real life. */
function buildLog(p: Prescription, row: TemplateRow): Prescription["log"] {
  const drift = rand();
  if (p.load.kind === "absolute") {
    const weights = Array.from({ length: p.sets }, () => (p.load as { kg: number }).kg);
    return {
      weights,
      reps: Array.from({ length: p.sets }, () => p.reps),
      lsrpe: round(6.5 + drift * 2.5, 0.5),
    };
  }
  if (p.load.kind !== "rpe") return undefined;
  const target = p.beRange ?? row.base ?? 100;
  const reference = p.teRange ?? target * 1.05;
  const achieved = round(target + (reference - target) * drift, 2.5);
  const estimate = loadForRpe(achieved * 1.08, p.reps, p.load.rpe) ?? achieved;
  const weight = row.kind === "top" ? achieved : round(estimate, 2.5);
  return {
    weights: Array.from({ length: p.sets }, () => weight),
    reps: Array.from({ length: p.sets }, () => p.reps),
    lsrpe: round(p.load.rpe + (drift - 0.45), 0.5),
  };
}

function buildProgram(): Program {
  const blocks: Block[] = [];
  let programWeek = 0;

  for (let b = 0; b < BLOCKS.length; b++) {
    const blockId = `block-${b + 1}`;
    const weeks: Week[] = [];

    for (let w = 1; w <= 4; w++) {
      programWeek++;
      const weekId = `${blockId}-w${w}`;
      const weekStart = addDays(PROGRAM_START, (programWeek - 1) * 7);
      const sessions: Session[] = DAYS.map((day) => {
        const sessionId = `${weekId}-d${day.dayNumber}`;
        const date = addDays(weekStart, day.offset);
        const isPast = date < TODAY;
        const prescriptions = day.rows.map((row, i) =>
          buildPrescription(row, sessionId, i, w, b, programWeek, isPast),
        );
        return {
          id: sessionId,
          programId: "cycle-1",
          blockId,
          weekId,
          dayNumber: day.dayNumber,
          weekday: day.weekday,
          date,
          name: day.name,
          status: isPast ? "done" : "planned",
          prescriptions,
        };
      });

      weeks.push({
        id: weekId,
        programId: "cycle-1",
        blockId,
        blockWeekIndex: w,
        programWeekIndex: programWeek,
        startDate: weekStart,
        sessions,
      });
    }

    blocks.push({
      id: blockId,
      programId: "cycle-1",
      name: BLOCKS[b].name,
      focus: BLOCKS[b].focus,
      order: b + 1,
      weeks,
    });
  }

  return {
    id: "cycle-1",
    name: "Powerbuilding — 12 weeks to Nationals",
    description: "Three blocks: accumulate, intensify, peak. Sumo pulls, competition commands from block 3.",
    accent: "SQUAT",
    startDate: PROGRAM_START,
    meetDate: "2026-11-21",
    status: "active",
    blocks,
  };
}

export const PROGRAM: Program = buildProgram();

export const PROGRAMS: Program[] = [
  PROGRAM,
  {
    id: "cycle-0",
    name: "Off-season hypertrophy",
    description: "Ten weeks of higher reps after last meet. Closed out at +6kg bodyweight.",
    accent: "NEUTRAL",
    startDate: "2026-05-16",
    status: "archived",
    blocks: [],
  },
];

/* --------------------------------------------------------------- selectors */

export const ALL_SESSIONS: Session[] = PROGRAM.blocks.flatMap((b) =>
  b.weeks.flatMap((w) => w.sessions),
);

export function currentWeek(): Week {
  const weeks = PROGRAM.blocks.flatMap((b) => b.weeks);
  return (
    weeks.find((w) => TODAY >= w.startDate && TODAY <= addDays(w.startDate, 6)) ?? weeks[0]
  );
}

export function currentBlock(): Block {
  const week = currentWeek();
  return PROGRAM.blocks.find((b) => b.id === week.blockId)!;
}

export function nextSession(): Session | undefined {
  return ALL_SESSIONS.filter((s) => s.status === "planned").sort((a, b) =>
    a.date < b.date ? -1 : 1,
  )[0];
}

export function weeksOut(): number | null {
  if (!PROGRAM.meetDate) return null;
  const days =
    (new Date(PROGRAM.meetDate + "T00:00:00Z").getTime() -
      new Date(TODAY + "T00:00:00Z").getTime()) /
    86400000;
  return Math.floor(days / 7);
}
