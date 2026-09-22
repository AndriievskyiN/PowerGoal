import { mutation } from "./_generated/server";
import { v } from "convex/values";

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fill dailyMetrics with plausible history so the dashboard isn't empty on day one. Idempotent. */
export const dailyMetrics = mutation({
  args: { today: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { today, days = 42 }) => {
    const existing = await ctx.db.query("dailyMetrics").take(1);
    if (existing.length) return { inserted: 0, reason: "table not empty" };
    const r = prng(11);
    let weight = 92.2;
    let inserted = 0;
    for (let i = days - 1; i >= 1; i--) {
      weight += (r() - 0.44) * 0.35;
      const sleep = Math.round((6.4 + r() * 2.1) * 4) / 4;
      const recovery = Math.max(1, Math.min(10, Math.round(4.5 + sleep * 0.5 + (r() - 0.5) * 3)));
      const steps = Math.round((5500 + r() * 7000 + (recovery - 5) * 300) / 100) * 100;
      if (r() < 0.08) continue;
      await ctx.db.insert("dailyMetrics", { date: addDays(today, -i), weight: Math.round(weight * 10) / 10, sleep, recovery, steps, source: "seed" });
      inserted++;
    }
    return { inserted };
  },
});
