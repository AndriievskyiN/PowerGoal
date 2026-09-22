import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * PowerGoal schema.
 *
 * Nesting follows how training is actually organised:
 *   program (a cycle) → block → week → session → prescription → log
 *
 * Ids are denormalised down the tree (a prescription carries its programId and
 * weekId) so analytics can range over a cycle without walking four levels.
 */

const liftGroup = v.union(
  v.literal("SQUAT"),
  v.literal("BENCH"),
  v.literal("DEADLIFT"),
  v.literal("QUADS"),
  v.literal("HAMSTRINGS"),
  v.literal("BACK"),
  v.literal("SHOULDERS"),
  v.literal("ARMS"),
  v.literal("CHEST"),
  v.literal("ABS"),
  v.literal("OTHER"),
);

/** A set is prescribed by absolute load, by RPE target, or by percentage of 1RM. */
const load = v.union(
  v.object({ kind: v.literal("absolute"), kg: v.number() }),
  v.object({ kind: v.literal("rpe"), rpe: v.number() }),
  /** Percent of a training max held on the program (squat/bench/deadlift). */
  v.object({ kind: v.literal("percent"), pct: v.number(), of: v.optional(v.string()) }),
  /** Percent of the weight logged on another row in the same session — the sheet's back-off formulas. */
  v.object({ kind: v.literal("percentOfRow"), pct: v.number(), ofOrder: v.number() }),
);

export default defineSchema({
  programs: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    accent: v.string(),
    startDate: v.string(), // ISO yyyy-mm-dd
    meetDate: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    notes: v.optional(v.string()),
    /** Plate increment loads round to. */
    rounding: v.optional(v.number()),
    /** Current maxes the percent-based rows are computed from. */
    maxes: v.optional(
      v.object({
        squat: v.optional(v.number()),
        bench: v.optional(v.number()),
        deadlift: v.optional(v.number()),
      }),
    ),
  }).index("by_status", ["status"]),

  blocks: defineTable({
    programId: v.id("programs"),
    name: v.string(),
    focus: v.optional(v.string()),
    order: v.number(),
  }).index("by_program", ["programId", "order"]),

  weeks: defineTable({
    programId: v.id("programs"),
    blockId: v.id("blocks"),
    blockWeekIndex: v.number(),
    programWeekIndex: v.number(),
    startDate: v.string(),
  })
    .index("by_program", ["programId", "programWeekIndex"])
    .index("by_block", ["blockId", "blockWeekIndex"]),

  sessions: defineTable({
    programId: v.id("programs"),
    blockId: v.id("blocks"),
    weekId: v.id("weeks"),
    dayNumber: v.number(),
    weekday: v.string(),
    date: v.string(),
    name: v.optional(v.string()),
    motivation: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("done"), v.literal("skipped")),
    completedAt: v.optional(v.number()),
  })
    .index("by_week", ["weekId", "dayNumber"])
    .index("by_program_date", ["programId", "date"])
    .index("by_date", ["date"]),

  exercises: defineTable({
    name: v.string(),
    group: liftGroup,
    isMainLift: v.boolean(),
    aliases: v.optional(v.array(v.string())),
  }).index("by_name", ["name"]),

  prescriptions: defineTable({
    sessionId: v.id("sessions"),
    weekId: v.id("weeks"),
    blockId: v.id("blocks"),
    programId: v.id("programs"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    sets: v.number(),
    reps: v.number(),
    load,
    /** Bare-minimum and technical-excellence ranges for top singles. */
    beRange: v.optional(v.number()),
    teRange: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_session", ["sessionId", "order"])
    .index("by_exercise", ["exerciseId"])
    .index("by_program_exercise", ["programId", "exerciseId"]),

  /**
   * One row per prescription, holding every set performed against it. Weights
   * and reps are parallel arrays so "140, 142.5, 145" stays one entry, matching
   * how the sheet was always written.
   */
  logs: defineTable({
    prescriptionId: v.id("prescriptions"),
    sessionId: v.id("sessions"),
    exerciseId: v.id("exercises"),
    programId: v.id("programs"),
    date: v.string(),
    weights: v.array(v.number()),
    reps: v.array(v.number()),
    /** Last-set RPE. */
    lsrpe: v.optional(v.number()),
    notes: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
  })
    .index("by_prescription", ["prescriptionId"])
    .index("by_session", ["sessionId"])
    .index("by_exercise_date", ["exerciseId", "date"]),

  /** One row per calendar day of body/recovery data. Manual now, Apple Health later. */
  dailyMetrics: defineTable({
    date: v.string(), // ISO yyyy-mm-dd
    weight: v.optional(v.number()),
    sleep: v.optional(v.number()), // hours
    recovery: v.optional(v.number()), // 1..10
    steps: v.optional(v.number()),
    hrv: v.optional(v.number()),
    rhr: v.optional(v.number()),
    strain: v.optional(v.number()),
    calories: v.optional(v.number()),
    carbs: v.optional(v.number()),
    protein: v.optional(v.number()),
    notes: v.optional(v.string()),
    source: v.optional(v.string()), // "manual" | "apple-health" | ...
  }).index("by_date", ["date"]),

  prs: defineTable({
    exerciseId: v.id("exercises"),
    programId: v.id("programs"),
    sessionId: v.id("sessions"),
    kind: v.union(
      v.literal("1rm"),
      v.literal("3rm"),
      v.literal("5rm"),
      v.literal("e1rm"),
    ),
    kg: v.number(),
    reps: v.number(),
    date: v.string(),
  }).index("by_exercise", ["exerciseId", "date"]),
});
