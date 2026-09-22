/**
 * Everything the overview page needs, computed once. The three design concepts
 * (/v1, /v2, /v3) are pure presentation over this shape.
 */
import { PROGRAM as FIXTURE_PROGRAM, TODAY as FIXTURE_TODAY } from "./fixtures";
import { exerciseById } from "./exercises";
import type { Program } from "./types";
import {
  SERIES_LIFTS,
  allWeeks,
  intensityByWeek,
  rpeDeltaByWeek,
  summarizeWeek,
  volumeByWeek,
  type SeriesLift,
  type WeekPoint,
} from "./metrics";
import { round, sessionTonnage } from "./lifting";
import { e1rm as estimate1rm } from "./lifting";
import type { Block, Session, Week } from "./types";

export interface LiftStat {
  lift: SeriesLift;
  label: string;
  /** Best e1RM in the most recent logged week. */
  current: number | null;
  /** Best e1RM in the block before the current one. */
  previousBlockBest: number | null;
  /** Best e1RM ever in this cycle. */
  cycleBest: number | null;
  delta: number | null;
  /** Weekly e1RM series, nulls for untrained weeks. */
  trend: (number | null)[];
}

export interface WeekCell {
  week: Week;
  state: "done" | "current" | "upcoming";
  tonnage: number;
}

export interface BlockLane {
  block: Block;
  cells: WeekCell[];
  state: "done" | "current" | "upcoming";
}

export interface DaySlot {
  session: Session;
  isToday: boolean;
  isNext: boolean;
  mainLifts: SeriesLift[];
  tonnage: number;
}

export interface TopSet {
  kg: number;
  reps: number;
  rpe?: number;
}

export interface SessionRow {
  id: string;
  date: string;
  weekday: string;
  weekLabel: string;
  blockId: string;
  blockName: string;
  name: string;
  status: Session["status"];
  isToday: boolean;
  top: Record<SeriesLift, TopSet | null>;
  tonnage: number;
}

export interface Overview {
  program: Program;
  today: string;
  block: Block;
  week: Week;
  weeks: Week[];
  next: Session | undefined;
  nextIsToday: boolean;
  nextWeek: Week | undefined;
  weeksOut: number | null;
  lifts: LiftStat[];
  total: { current: number | null; delta: number | null };
  weekSummary: ReturnType<typeof summarizeWeek>;
  volume: WeekPoint[];
  intensity: WeekPoint[];
  rpe: WeekPoint[];
  lanes: BlockLane[];
  days: DaySlot[];
  /** Heaviest actual top set per week per lift (kg lifted, not estimated). */
  topSet: WeekPoint[];
  /** One row per session in the cycle, with the heaviest set per lift. */
  sessions: SessionRow[];
  /** Best e1RM per block per lift, for block-to-block comparison. */
  blockBest: { block: string; blockId: string; SQUAT: number | null; BENCH: number | null; DEADLIFT: number | null }[];
  /** Cycle-wide totals for the stat row. */
  cycle: { tonnage: number; sessionsDone: number; sessionsTotal: number; prs: number };
}

const LIFT_LABEL: Record<SeriesLift, string> = {
  SQUAT: "Squat",
  BENCH: "Bench",
  DEADLIFT: "Deadlift",
};

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildOverview(PROGRAM: Program = FIXTURE_PROGRAM, TODAY: string = FIXTURE_TODAY): Overview {
  const weeks = allWeeks(PROGRAM);
  const week =
    weeks.find((w) => TODAY >= w.startDate && TODAY <= addDays(w.startDate, 6)) ??
    (TODAY < weeks[0].startDate ? weeks[0] : weeks[weeks.length - 1]);
  const block = PROGRAM.blocks.find((b) => b.id === week.blockId)!;
  const allS = weeks.flatMap((w) => w.sessions);
  const next = allS.filter((s) => s.date >= TODAY).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const weeksOut = () =>
    PROGRAM.meetDate
      ? Math.floor((new Date(PROGRAM.meetDate + "T00:00:00Z").getTime() - new Date(TODAY + "T00:00:00Z").getTime()) / 86400000 / 7)
      : null;
  const previousWeek = weeks.find((w) => w.programWeekIndex === week.programWeekIndex - 1);

  const volume = volumeByWeek(weeks, PROGRAM);
  const intensity = intensityByWeek(weeks, PROGRAM);
  const rpe = rpeDeltaByWeek(weeks, PROGRAM);

  const previousBlock = PROGRAM.blocks.find((b) => b.order === block.order - 1);

  const lifts: LiftStat[] = SERIES_LIFTS.map((lift) => {
    const logged = intensity.filter((p) => p[lift] != null);
    const current = logged.length ? logged[logged.length - 1][lift] : null;
    const cycleBest = logged.length ? Math.max(...logged.map((p) => p[lift]!)) : null;
    const prevPoints = previousBlock
      ? intensity.filter((p) => p.blockId === previousBlock.id && p[lift] != null)
      : [];
    const previousBlockBest = prevPoints.length
      ? Math.max(...prevPoints.map((p) => p[lift]!))
      : null;
    // Delta against the first logged week of the cycle: how far the lift has moved.
    const first = logged.length ? logged[0][lift] : null;
    const delta = current != null && first != null ? round(current - first, 0.5) : null;
    return {
      lift,
      label: LIFT_LABEL[lift],
      current: current != null ? round(current, 0.5) : null,
      previousBlockBest,
      cycleBest: cycleBest != null ? round(cycleBest, 0.5) : null,
      delta,
      trend: intensity.map((p) => p[lift]),
    };
  });

  const total = lifts.every((l) => l.current != null)
    ? lifts.reduce((s, l) => s + (l.current ?? 0), 0)
    : null;
  const totalDelta = lifts.every((l) => l.delta != null)
    ? lifts.reduce((s, l) => s + (l.delta ?? 0), 0)
    : null;

  const lanes: BlockLane[] = PROGRAM.blocks.map((b) => {
    const cells: WeekCell[] = b.weeks.map((w) => {
      const point = volume.find((p) => p.weekId === w.id);
      const state: WeekCell["state"] =
        w.id === week.id
          ? "current"
          : w.programWeekIndex < week.programWeekIndex
            ? "done"
            : "upcoming";
      return { week: w, state, tonnage: point?.total ?? 0 };
    });
    const state: BlockLane["state"] =
      b.id === block.id ? "current" : b.order < block.order ? "done" : "upcoming";
    return { block: b, cells, state };
  });

  const days: DaySlot[] = [...week.sessions]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((s) => {
      const groups = new Set<SeriesLift>();
      for (const p of s.prescriptions) {
        const g = exerciseById(p.exerciseId)?.group;
        if (g === "SQUAT" || g === "BENCH" || g === "DEADLIFT") groups.add(g);
      }
      return {
        session: s,
        isToday: s.date === TODAY,
        isNext: s.id === next?.id,
        mainLifts: SERIES_LIFTS.filter((l) => groups.has(l)),
        tonnage: round(sessionTonnage(s), 1),
      };
    });

  const allSessions = weeks.flatMap((w) => w.sessions);

  const blockNameOf = (id: string) => PROGRAM.blocks.find((b) => b.id === id)?.name.split(" — ")[0] ?? "Block";

  const sessions: SessionRow[] = weeks.flatMap((w) =>
    [...w.sessions]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((s) => {
        const top: Record<SeriesLift, TopSet | null> = { SQUAT: null, BENCH: null, DEADLIFT: null };
        for (const p of s.prescriptions) {
          const ex = exerciseById(p.exerciseId);
          if (!ex?.isMainLift || !p.log?.weights.length) continue;
          const g = ex.group as SeriesLift;
          if (!(g in top)) continue;
          const kgv = Math.max(...p.log.weights);
          if (!top[g] || kgv > top[g]!.kg) top[g] = { kg: kgv, reps: p.log.reps[0] ?? p.reps, rpe: p.log.lsrpe };
        }
        return {
          id: s.id,
          date: s.date,
          weekday: s.weekday,
          weekLabel: `W${w.programWeekIndex}`,
          blockId: w.blockId,
          blockName: blockNameOf(w.blockId),
          name: s.name ?? "",
          status: s.status,
          isToday: s.date === TODAY,
          top,
          tonnage: round(sessionTonnage(s), 1),
        };
      }),
  );

  const topSet: WeekPoint[] = intensity.map((p) => {
    const rows = sessions.filter((r) => r.weekLabel === p.label);
    const best = (l: SeriesLift) => {
      const xs = rows.map((r) => r.top[l]?.kg).filter((v): v is number => v != null);
      return xs.length ? Math.max(...xs) : null;
    };
    return { ...p, SQUAT: best("SQUAT"), BENCH: best("BENCH"), DEADLIFT: best("DEADLIFT"), total: null };
  });

  const blockBest = PROGRAM.blocks.map((b) => {
    const pts = intensity.filter((p) => p.blockId === b.id);
    const best = (l: SeriesLift) => {
      const xs = pts.map((p) => p[l]).filter((v): v is number => v != null);
      return xs.length ? round(Math.max(...xs), 0.5) : null;
    };
    return { block: b.name.split(" — ")[0], blockId: b.id, SQUAT: best("SQUAT"), BENCH: best("BENCH"), DEADLIFT: best("DEADLIFT") };
  });
  void estimate1rm;
  // A "PR" here is any week where a lift's e1RM beat every prior week.
  let prs = 0;
  for (const lift of SERIES_LIFTS) {
    let best = 0;
    for (const p of intensity) {
      if (p[lift] != null && p[lift]! > best) {
        if (best > 0) prs++;
        best = p[lift]!;
      }
    }
  }

  return {
    program: PROGRAM,
    today: TODAY,
    block,
    week,
    weeks,
    next,
    nextIsToday: next?.date === TODAY,
    nextWeek: weeks.find((w) => w.programWeekIndex === week.programWeekIndex + 1),
    weeksOut: weeksOut(),
    lifts,
    total: {
      current: total != null ? round(total, 0.5) : null,
      delta: totalDelta != null ? round(totalDelta, 0.5) : null,
    },
    weekSummary: summarizeWeek(week, previousWeek),
    volume,
    intensity,
    rpe,
    lanes,
    days,
    topSet,
    sessions,
    blockBest,
    cycle: {
      tonnage: round(
        volume.reduce((s, p) => s + (p.total ?? 0), 0),
        1,
      ),
      sessionsDone: allSessions.filter((s) => s.status === "done").length,
      sessionsTotal: allSessions.length,
      prs,
    },
  };
}

export function prettyDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    timeZone: "UTC",
    ...opts,
  });
}
