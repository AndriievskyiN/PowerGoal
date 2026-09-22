import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const num = v.optional(v.union(v.number(), v.null()));
const fields = {
  weight: num,
  sleep: num,
  recovery: num,
  steps: num,
  hrv: num,
  rhr: num,
  strain: num,
  calories: num,
  carbs: num,
  protein: num,
  notes: v.optional(v.union(v.string(), v.null())),
};

export const range = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const rows = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .collect();
    return rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  },
});

/** Upsert values for a day. `null` clears a value; omitted keys are untouched. */
export const log = mutation({
  args: { date: v.string(), ...fields },
  handler: async (ctx, { date, ...values }) => {
    const set: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(values)) {
      if (val === undefined) continue;
      set[k] = val === null || val === "" ? undefined : val;
    }
    const existing = await ctx.db.query("dailyMetrics").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (existing) {
      // Editing a sample row makes it yours.
      await ctx.db.patch(existing._id, { ...set, source: existing.source === "seed" ? "manual" : existing.source });
      return existing._id;
    }
    const clean = Object.fromEntries(Object.entries(set).filter(([, val]) => val !== undefined));
    return ctx.db.insert("dailyMetrics", { date, source: "manual", ...clean });
  },
});

/** Delete the generated sample history. Rows you have edited are kept. */
export const clearSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("dailyMetrics").collect();
    let removed = 0;
    for (const r of rows) {
      if (r.source === "seed") {
        await ctx.db.delete(r._id);
        removed++;
      }
    }
    return { removed };
  },
});

/** Write days coming from Apple Health. Only the fields present are touched. */
export const ingest = internalMutation({
  args: {
    days: v.array(
      v.object({
        date: v.string(),
        weight: v.optional(v.number()),
        sleep: v.optional(v.number()),
        steps: v.optional(v.number()),
        hrv: v.optional(v.number()),
        rhr: v.optional(v.number()),
        calories: v.optional(v.number()),
        carbs: v.optional(v.number()),
        protein: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { days }) => {
    for (const { date, ...values } of days) {
      const existing = await ctx.db.query("dailyMetrics").withIndex("by_date", (q) => q.eq("date", date)).unique();
      if (existing) await ctx.db.patch(existing._id, { ...values, source: existing.source === "seed" ? "apple-health" : existing.source });
      else await ctx.db.insert("dailyMetrics", { date, source: "apple-health", ...values });
    }
    return { days: days.length };
  },
});
