import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { addDays, deleteRow, diffDays, findOrCreateExercise, reorder, sessionRows, weekdayOf } from "./helpers";

const loadValidator = v.union(
  v.object({ kind: v.literal("absolute"), kg: v.number() }),
  v.object({ kind: v.literal("rpe"), rpe: v.number() }),
  v.object({ kind: v.literal("percent"), pct: v.number(), of: v.optional(v.string()) }),
  v.object({ kind: v.literal("percentOfRow"), pct: v.number(), ofOrder: v.number() }),
);

/** The active program as one nested tree, with exercise names and logs joined in. */
export const activeTree = query({
  args: {},
  handler: async (ctx) => {
    const program = await ctx.db.query("programs").withIndex("by_status", (q) => q.eq("status", "active")).first();
    if (!program) return null;
    const [blocks, weeks, sessions, prescriptions, logs, exercises] = await Promise.all([
      ctx.db.query("blocks").withIndex("by_program", (q) => q.eq("programId", program._id)).collect(),
      ctx.db.query("weeks").withIndex("by_program", (q) => q.eq("programId", program._id)).collect(),
      ctx.db.query("sessions").withIndex("by_program_date", (q) => q.eq("programId", program._id)).collect(),
      ctx.db.query("prescriptions").filter((q) => q.eq(q.field("programId"), program._id)).collect(),
      ctx.db.query("logs").filter((q) => q.eq(q.field("programId"), program._id)).collect(),
      ctx.db.query("exercises").collect(),
    ]);
    const exById = new Map(exercises.map((e) => [e._id, e]));
    const logByP = new Map(logs.map((l) => [l.prescriptionId, l]));
    return {
      program,
      exercises,
      blocks: blocks
        .sort((a, b) => a.order - b.order)
        .map((b) => ({
          ...b,
          weeks: weeks
            .filter((w) => w.blockId === b._id)
            .sort((a, c) => a.blockWeekIndex - c.blockWeekIndex)
            .map((w) => ({
              ...w,
              sessions: sessions
                .filter((s) => s.weekId === w._id)
                .sort((a, c) => a.dayNumber - c.dayNumber)
                .map((s) => ({
                  ...s,
                  prescriptions: prescriptions
                    .filter((p) => p.sessionId === s._id)
                    .sort((a, c) => a.order - c.order)
                    .map((p) => ({ ...p, exercise: exById.get(p.exerciseId) ?? null, log: logByP.get(p._id) ?? null })),
                })),
            })),
        })),
    };
  },
});

/* ------------------------------------------------------------ program level */

export const updateProgram = mutation({
  args: {
    programId: v.id("programs"),
    name: v.optional(v.string()),
    meetDate: v.optional(v.union(v.string(), v.null())),
    rounding: v.optional(v.number()),
    maxes: v.optional(v.object({ squat: v.optional(v.number()), bench: v.optional(v.number()), deadlift: v.optional(v.number()) })),
  },
  handler: async (ctx, { programId, meetDate, maxes, ...rest }) => {
    const program = await ctx.db.get(programId);
    if (!program) throw new Error("program not found");
    const patch: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, val]) => val !== undefined));
    if (meetDate !== undefined) patch.meetDate = meetDate ?? undefined;
    if (maxes) patch.maxes = { ...program.maxes, ...maxes };
    await ctx.db.patch(programId, patch);
  },
});

/** Move the whole program so week 1 starts on `startDate`. Every session keeps its weekday offset; logs follow. */
export const setStartDate = mutation({
  args: { programId: v.id("programs"), startDate: v.string() },
  handler: async (ctx, { programId, startDate }) => {
    const weeks = await ctx.db.query("weeks").withIndex("by_program", (q) => q.eq("programId", programId)).collect();
    for (const w of weeks) {
      const newStart = addDays(startDate, (w.programWeekIndex - 1) * 7);
      const sessions = await ctx.db.query("sessions").withIndex("by_week", (q) => q.eq("weekId", w._id)).collect();
      for (const s of sessions) {
        const date = addDays(newStart, diffDays(w.startDate, s.date));
        await ctx.db.patch(s._id, { date, weekday: weekdayOf(date) });
        const logs = await ctx.db.query("logs").withIndex("by_session", (q) => q.eq("sessionId", s._id)).collect();
        for (const l of logs) await ctx.db.patch(l._id, { date });
      }
      await ctx.db.patch(w._id, { startDate: newStart });
    }
    await ctx.db.patch(programId, { startDate });
  },
});

export const updateBlock = mutation({
  args: { blockId: v.id("blocks"), name: v.optional(v.string()), focus: v.optional(v.string()) },
  handler: async (ctx, { blockId, ...rest }) => {
    await ctx.db.patch(blockId, Object.fromEntries(Object.entries(rest).filter(([, val]) => val !== undefined)));
  },
});

/* ---------------------------------------------- block level (many sessions) */

/** Rename a training day across every week it appears in. */
export const renameSessions = mutation({
  args: { sessionIds: v.array(v.id("sessions")), name: v.string() },
  handler: async (ctx, { sessionIds, name }) => {
    for (const id of sessionIds) await ctx.db.patch(id, { name });
  },
});

/** Point a row at a different exercise in every week at once. */
export const setRowExercise = mutation({
  args: { prescriptionIds: v.array(v.id("prescriptions")), name: v.string() },
  handler: async (ctx, { prescriptionIds, name }) => {
    if (!name.trim()) return;
    const exerciseId = await findOrCreateExercise(ctx, name);
    for (const id of prescriptionIds) await ctx.db.patch(id, { exerciseId });
  },
});

/** Append the same exercise to several sessions (one per week). */
export const addRow = mutation({
  args: { sessionIds: v.array(v.id("sessions")), name: v.string(), sets: v.number(), reps: v.number(), load: loadValidator },
  handler: async (ctx, { sessionIds, name, sets, reps, load }) => {
    const exerciseId = await findOrCreateExercise(ctx, name);
    for (const sessionId of sessionIds) {
      const s = await ctx.db.get(sessionId);
      if (!s) continue;
      const rows = await sessionRows(ctx, sessionId);
      await ctx.db.insert("prescriptions", {
        sessionId, weekId: s.weekId, blockId: s.blockId, programId: s.programId, exerciseId,
        order: rows.length, sets, reps, load: load as never,
      });
    }
  },
});

/** Remove rows (and their logs), closing the gap in each session. */
export const removeRows = mutation({
  args: { prescriptionIds: v.array(v.id("prescriptions")) },
  handler: async (ctx, { prescriptionIds }) => {
    for (const id of prescriptionIds) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      const rows = await sessionRows(ctx, row.sessionId);
      await deleteRow(ctx, row);
      await reorder(ctx, rows.filter((r) => r._id !== id));
    }
  },
});

/** Move rows one place up or down inside their own session. */
export const moveRows = mutation({
  args: { prescriptionIds: v.array(v.id("prescriptions")), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { prescriptionIds, direction }) => {
    for (const id of prescriptionIds) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      const rows = await sessionRows(ctx, row.sessionId);
      const i = rows.findIndex((r) => r._id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= rows.length) continue;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      await reorder(ctx, next);
    }
  },
});

/* ---------------------------------------------------------- session level */

export const addPrescription = mutation({
  args: { sessionId: v.id("sessions"), exerciseName: v.string(), sets: v.number(), reps: v.number() },
  handler: async (ctx, { sessionId, exerciseName, sets, reps }) => {
    const s = await ctx.db.get(sessionId);
    if (!s) throw new Error("session not found");
    const exerciseId = await findOrCreateExercise(ctx, exerciseName);
    const rows = await sessionRows(ctx, sessionId);
    return ctx.db.insert("prescriptions", {
      sessionId, weekId: s.weekId, blockId: s.blockId, programId: s.programId, exerciseId,
      order: rows.length, sets, reps, load: { kind: "rpe", rpe: 7 },
    });
  },
});

export const removePrescription = mutation({
  args: { prescriptionId: v.id("prescriptions") },
  handler: async (ctx, { prescriptionId }) => {
    const row = await ctx.db.get(prescriptionId);
    if (!row) return;
    const rows = await sessionRows(ctx, row.sessionId);
    await deleteRow(ctx, row);
    await reorder(ctx, rows.filter((r) => r._id !== prescriptionId));
  },
});
