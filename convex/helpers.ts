import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type Row = Doc<"prescriptions">;

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string) {
  return Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);
}

export function weekdayOf(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

export async function sessionRows(ctx: MutationCtx, sessionId: Id<"sessions">) {
  const rows = await ctx.db
    .query("prescriptions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return rows.sort((a, b) => a.order - b.order);
}

/**
 * Rewrite a session's rows to orders 0..n-1 in the given sequence. Back-off
 * rows that point at another row ("88% of #3") follow the row they point at.
 * If that row is gone, the back-off becomes a plain RPE target.
 */
export async function reorder(ctx: MutationCtx, next: Row[]) {
  const to = new Map<number, number>();
  next.forEach((p, i) => to.set(p.order, i));
  for (let i = 0; i < next.length; i++) {
    const p = next[i];
    let load = p.load;
    if (load.kind === "percentOfRow") {
      const target = to.get(load.ofOrder);
      load = target === undefined ? { kind: "rpe", rpe: 7 } : { ...load, ofOrder: target };
    }
    if (p.order !== i || load !== p.load) await ctx.db.patch(p._id, { order: i, load });
  }
}

export async function deleteRow(ctx: MutationCtx, row: Row) {
  const log = await ctx.db
    .query("logs")
    .withIndex("by_prescription", (q) => q.eq("prescriptionId", row._id))
    .unique();
  if (log) await ctx.db.delete(log._id);
  await ctx.db.delete(row._id);
}

export async function findOrCreateExercise(ctx: MutationCtx, rawName: string) {
  const name = rawName.trim() || "New exercise";
  const found = await ctx.db.query("exercises").withIndex("by_name", (q) => q.eq("name", name)).unique();
  if (found) return found._id;
  return ctx.db.insert("exercises", { name, group: "OTHER", isMainLift: false });
}
