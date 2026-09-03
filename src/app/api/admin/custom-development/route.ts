import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { customDevelopmentService } from "@/lib/services/custom-development.service";
import { updateCustomDevelopmentTriageSchema } from "@/lib/validation/custom-development.schemas";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { recordAction } from "@/lib/audit/record";

/**
 * GET /api/admin/custom-development
 * List all custom development requests.
 */
export const GET = withAdminApiHandler(async () => {
  const requests = await customDevelopmentService.getAllRequests();

  return NextResponse.json({ requests });
});

/**
 * PATCH /api/admin/custom-development
 * Update the status and/or dev note of a custom development request.
 */
export const PATCH = withAdminApiHandler(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateCustomDevelopmentTriageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await prisma.customDevelopmentRequest.findUnique({
    where: { id: parsed.data.id },
    select: { status: true, devNote: true },
  });

  if (!before) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const request_ = await customDevelopmentService.updateTriage(parsed.data.id, {
    status: parsed.data.status,
    devNote: parsed.data.devNote,
  });

  await recordAction({
    actionType: "admin.custom_development.triage",
    targetId: parsed.data.id,
    payload: {
      requestId: parsed.data.id,
      before,
      after: { status: parsed.data.status, devNote: parsed.data.devNote },
    },
  });

  return NextResponse.json({ request: request_ });
});
