import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { findOrCreateExercise } from "./helpers";

/** Upsert the log for one prescription row. Empty weights deletes the log. */
export const upsert = mutation({
  args: {
    prescriptionId: v.id("prescriptions"),
    weights: v.array(v.number()),
    reps: v.array(v.number()),
    lsrpe: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { prescriptionId, weights, reps, lsrpe, notes }) => {
    const p = await ctx.db.get(prescriptionId);
    if (!p) throw new Error("prescription not found");
    const session = await ctx.db.get(p.sessionId);
    if (!session) throw new Error("session not found");
    const existing = await ctx.db
      .query("logs")
      .withIndex("by_prescription", (q) => q.eq("prescriptionId", prescriptionId))
      .unique();
    if (!weights.length) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    const doc = { prescriptionId, sessionId: p.sessionId, exerciseId: p.exerciseId, programId: p.programId, date: session.date, weights, reps, lsrpe, notes };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return ctx.db.insert("logs", doc);
  },
});

/** Edit the prescription itself: sets, reps, load, ranges, or the exercise (by name, created if new). */
export const editPrescription = mutation({
  args: {
    prescriptionId: v.id("prescriptions"),
    sets: v.optional(v.number()),
    reps: v.optional(v.number()),
    load: v.optional(v.any()),
    beRange: v.optional(v.union(v.number(), v.null())),
    teRange: v.optional(v.union(v.number(), v.null())),
    exerciseName: v.optional(v.string()),
  },
  handler: async (ctx, { prescriptionId, exerciseName, beRange, teRange, ...rest }) => {
    const patch: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, val]) => val !== undefined));
    if (beRange !== undefined) patch.beRange = beRange ?? undefined;
    if (teRange !== undefined) patch.teRange = teRange ?? undefined;
    if (exerciseName !== undefined && exerciseName.trim()) {
      patch.exerciseId = await findOrCreateExercise(ctx, exerciseName);
    }
    await ctx.db.patch(prescriptionId, patch);
  },
});

export const setSessionNotes = mutation({
  args: { sessionId: v.id("sessions"), notes: v.string() },
  handler: async (ctx, { sessionId, notes }) => ctx.db.patch(sessionId, { notes }),
});
