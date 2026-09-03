import { NextResponse } from "next/server";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { activityQuerySchema } from "@/lib/validation/audit.schemas";
import {
  queryActivity,
  queryActorSummary,
  queryEntitySummary,
  queryStats,
  getCoverageManifest,
} from "@/lib/services/audit-query.service";

/**
 * GET /api/admin/activity
 *
 * One endpoint, four views, selected by `?view=`:
 *   timeline   (default) cursor-paginated event stream
 *   actors     per-actor rollup  — the "sort by users" view
 *   entities   per-model rollup  — the "sort by table" view
 *   coverage   what is and is not recorded
 *
 * Stats accompany every view so the header cards stay in sync with the filters
 * rather than reporting a different population than the table below them.
 */
export const GET = withAdminApiHandler(async (request) => {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "timeline";

  if (view === "coverage") {
    return NextResponse.json({ coverage: getCoverageManifest() });
  }

  const parsed = activityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const q = parsed.data;

  if (view === "actors") {
    const [actors, stats] = await Promise.all([queryActorSummary(q), queryStats(q)]);
    return NextResponse.json({ actors, stats });
  }

  if (view === "entities") {
    const [entities, stats] = await Promise.all([queryEntitySummary(q), queryStats(q)]);
    return NextResponse.json({ entities, stats });
  }

  const [page, stats] = await Promise.all([queryActivity(q), queryStats(q)]);
  return NextResponse.json({ ...page, stats });
});
