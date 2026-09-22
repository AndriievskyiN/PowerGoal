import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseHealthExport } from "./healthExport";

const http = httpRouter();

/**
 * Apple Health → PowerGoal. Point Health Auto Export's REST automation at
 * `<CONVEX_SITE_URL>/health` with header `Authorization: Bearer <HEALTH_TOKEN>`.
 */
http.route({
  path: "/health",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = process.env.HEALTH_TOKEN;
    const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("token");
    if (!token || given !== token) return new Response("unauthorized", { status: 401 });
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }
    const days = parseHealthExport(body);
    if (days.length) await ctx.runMutation(internal.dailyMetrics.ingest, { days });
    return Response.json({ ok: true, days: days.length });
  }),
});

export default http;
