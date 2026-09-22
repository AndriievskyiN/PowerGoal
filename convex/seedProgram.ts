import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MAIN = new Set(["Competition Squat", "Competition Bench Press", "Sumo Deadlift", "Sumo Pause Deadlift", "Competition 3 Count Pause Bench Press"]);

/**
 * Import a program from the compacted spreadsheet extract. `reset` wipes every
 * program table first. Weeks start on the given Friday.
 */
export const importProgram = mutation({
  args: { seed: v.any(), startDate: v.string(), meetDate: v.optional(v.string()), reset: v.optional(v.boolean()) },
  handler: async (ctx, { seed, startDate, meetDate, reset }) => {
    if (reset) {
      for (const t of ["logs", "prescriptions", "sessions", "weeks", "blocks", "programs", "exercises", "prs"] as const) {
        for (const row of await ctx.db.query(t).collect()) await ctx.db.delete(row._id);
      }
    }
    const exerciseIds = new Map<string, Id<"exercises">>();
    async function exercise(name: string, group: string) {
      const key = name.trim();
      const hit = exerciseIds.get(key);
      if (hit) return hit;
      const found = await ctx.db.query("exercises").withIndex("by_name", (q) => q.eq("name", key)).unique();
      const id = found ? found._id : await ctx.db.insert("exercises", { name: key, group: group as never, isMainLift: MAIN.has(key) });
      exerciseIds.set(key, id);
      return id;
    }

    const programId = await ctx.db.insert("programs", {
      name: seed.name,
      description: seed.description,
      accent: "SQUAT",
      startDate,
      meetDate,
      status: "active",
      rounding: seed.rounding ?? 2.5,
      maxes: seed.maxes,
    });

    let programWeek = 0;
    const counts = { blocks: 0, weeks: 0, sessions: 0, rows: 0 };
    for (let bi = 0; bi < seed.blocks.length; bi++) {
      const b = seed.blocks[bi];
      const blockId = await ctx.db.insert("blocks", { programId, name: b.name, focus: b.focus, order: bi + 1 });
      counts.blocks++;
      for (const w of b.weeks) {
        programWeek++;
        const weekStart = addDays(startDate, (programWeek - 1) * 7);
        const weekId = await ctx.db.insert("weeks", { programId, blockId, blockWeekIndex: w.index, programWeekIndex: programWeek, startDate: weekStart });
        counts.weeks++;
        for (let si = 0; si < w.sessions.length; si++) {
          const s = w.sessions[si];
          const date = addDays(weekStart, s.offset);
          const sessionId = await ctx.db.insert("sessions", {
            programId, blockId, weekId, dayNumber: si + 1, weekday: s.weekday, date, name: s.name, status: "planned",
          });
          counts.sessions++;
          const orderBySheetRow = new Map<number, number>();
          s.rows.forEach((r: { sheetRow: number }, i: number) => orderBySheetRow.set(r.sheetRow, i));
          for (let i = 0; i < s.rows.length; i++) {
            const r = s.rows[i];
            const load = r.load.kind === "percentOfRow"
              ? { kind: "percentOfRow" as const, pct: r.load.pct, ofOrder: orderBySheetRow.get(r.load.ofSheetRow) ?? 0 }
              : r.load;
            await ctx.db.insert("prescriptions", {
              sessionId, weekId, blockId, programId,
              exerciseId: await exercise(r.name, r.group),
              order: i, sets: r.sets, reps: r.reps, load,
              beRange: r.be ?? undefined, teRange: r.te ?? undefined, notes: r.note ?? undefined,
            });
            counts.rows++;
          }
        }
      }
    }
    return { programId, ...counts };
  },
});
