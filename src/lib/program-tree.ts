/** Convert the Convex `activeTree` result into the domain `Program` the UI already understands. */
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { registerExercises } from "./exercises";
import type { Exercise, Load, Program } from "./types";

export type Tree = NonNullable<FunctionReturnType<typeof api.programs.activeTree>>;

export function treeToProgram(tree: Tree, today: string): Program {
  registerExercises(
    tree.exercises.map((e): Exercise => ({ id: e._id, name: e.name, group: e.group, isMainLift: e.isMainLift })),
  );
  const p = tree.program;
  return {
    id: p._id,
    name: p.name,
    description: p.description,
    accent: "SQUAT",
    startDate: p.startDate,
    meetDate: p.meetDate,
    status: p.status,
    rounding: p.rounding,
    maxes: p.maxes,
    blocks: tree.blocks.map((b) => ({
      id: b._id,
      programId: p._id,
      name: b.name,
      focus: b.focus,
      order: b.order,
      weeks: b.weeks.map((w) => ({
        id: w._id,
        programId: p._id,
        blockId: b._id,
        blockWeekIndex: w.blockWeekIndex,
        programWeekIndex: w.programWeekIndex,
        startDate: w.startDate,
        sessions: w.sessions.map((s) => ({
          id: s._id,
          programId: p._id,
          blockId: b._id,
          weekId: w._id,
          dayNumber: s.dayNumber,
          weekday: s.weekday,
          date: s.date,
          name: s.name,
          notes: s.notes,
          // A day that has passed is done. No ceremony.
          status: s.date < today ? "done" : "planned",
          prescriptions: s.prescriptions.map((r) => ({
            id: r._id,
            sessionId: s._id,
            exerciseId: r.exerciseId,
            exerciseName: r.exercise?.name ?? "",
            order: r.order,
            sets: r.sets,
            reps: r.reps,
            load: r.load as Load,
            beRange: r.beRange,
            teRange: r.teRange,
            notes: r.notes,
            log: r.log ? { weights: r.log.weights, reps: r.log.reps, lsrpe: r.log.lsrpe, notes: r.log.notes } : undefined,
          })),
        })),
      })),
    })),
  };
}
