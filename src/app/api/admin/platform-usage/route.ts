import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";

// Calls slow external APIs — never cache.
export const dynamic = "force-dynamic";

/** Safety cap on JSONL lines parsed from the Vercel billing-charges stream. */
const MAX_CHARGE_LINES = 20000;

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user || !isAdminUser(user.email, user.isAdmin)) return null;
  return user;
}

interface VercelUsage {
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  byService: Array<{
    serviceName: string;
    consumedQuantity: number;
    consumedUnit: string;
    costUsd: number;
  }>;
}

/** Vercel exposes no per-account plan-limit API — this reports current-period
 *  consumption via the FOCUS billing-charges feed; compare against vercel.com/docs/limits. */
async function getVercelUsage(): Promise<{ data: VercelUsage | null; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !teamId) return { data: null };

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("from", periodStart.toISOString());
  url.searchParams.set("to", now.toISOString());
  url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // Vercel returns 404 costs_not_found for a period with zero billable
      // usage (e.g. a Hobby-plan team) — that's real, honest zero-usage data,
      // not a broken integration, so don't surface it as an error.
      if (res.status === 404) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "costs_not_found") {
          return {
            data: {
              periodStart: periodStart.toISOString(),
              periodEnd: now.toISOString(),
              totalCostUsd: 0,
              byService: [],
            },
          };
        }
      }
      return { data: null, error: `Vercel billing API returned ${res.status}` };
    }
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean).slice(0, MAX_CHARGE_LINES);

    const byServiceMap = new Map<string, { consumedQuantity: number; costUsd: number; unit: string }>();
    let totalCostUsd = 0;

    for (const line of lines) {
      try {
        const charge = JSON.parse(line) as {
          ServiceName?: string;
          ConsumedQuantity?: number | null;
          ConsumedUnit?: string | null;
          EffectiveCost?: number;
        };
        const service = charge.ServiceName || "Other";
        const cost = charge.EffectiveCost ?? 0;
        totalCostUsd += cost;

        const key = `${service}::${charge.ConsumedUnit ?? ""}`;
        const entry = byServiceMap.get(key) ?? {
          consumedQuantity: 0,
          costUsd: 0,
          unit: charge.ConsumedUnit ?? "",
        };
        entry.consumedQuantity += charge.ConsumedQuantity ?? 0;
        entry.costUsd += cost;
        byServiceMap.set(key, entry);
      } catch {
        // Skip malformed lines rather than failing the whole report.
      }
    }

    const byService = [...byServiceMap.entries()]
      .map(([key, v]) => ({
        serviceName: key.split("::")[0],
        consumedQuantity: Math.round(v.consumedQuantity * 100) / 100,
        consumedUnit: v.unit,
        costUsd: Math.round(v.costUsd * 100) / 100,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      data: {
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        totalCostUsd: Math.round(totalCostUsd * 100) / 100,
        byService,
      },
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to reach Vercel API" };
  }
}

interface NeonUsage {
  storageBytes: number;
  storageLimitBytes: number | null;
  computeTimeSeconds: number;
  computeLimitSeconds: number | null;
  activeTimeSeconds: number;
  activeLimitSeconds: number | null;
  dataTransferBytes: number;
  dataTransferLimitBytes: number | null;
}

async function getNeonUsage(): Promise<{ data: NeonUsage | null; error?: string }> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) return { data: null };

  try {
    const res = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return { data: null, error: `Neon API returned ${res.status}` };
    }
    const json = (await res.json()) as {
      project?: {
        synthetic_storage_size?: number;
        compute_time_seconds?: number;
        active_time_seconds?: number;
        data_transfer_bytes?: number;
        settings?: {
          quota?: {
            logical_size_bytes?: number;
            compute_time_seconds?: number;
            active_time_seconds?: number;
            data_transfer_bytes?: number;
          };
        };
      };
    };
    const project = json.project;
    if (!project) return { data: null, error: "Unexpected Neon API response shape" };

    const quota = project.settings?.quota;
    // Neon returns 0 for an unset quota field, which means "plan default", not zero.
    const limitOrNull = (v: number | undefined) => (v && v > 0 ? v : null);

    return {
      data: {
        storageBytes: project.synthetic_storage_size ?? 0,
        storageLimitBytes: limitOrNull(quota?.logical_size_bytes),
        computeTimeSeconds: project.compute_time_seconds ?? 0,
        computeLimitSeconds: limitOrNull(quota?.compute_time_seconds),
        activeTimeSeconds: project.active_time_seconds ?? 0,
        activeLimitSeconds: limitOrNull(quota?.active_time_seconds),
        dataTransferBytes: project.data_transfer_bytes ?? 0,
        dataTransferLimitBytes: limitOrNull(quota?.data_transfer_bytes),
      },
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to reach Neon API" };
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [vercel, neon] = await Promise.all([getVercelUsage(), getNeonUsage()]);

  return NextResponse.json({
    data: {
      vercel: vercel.data,
      vercelError: vercel.error,
      neon: neon.data,
      neonError: neon.error,
    },
  });
}
