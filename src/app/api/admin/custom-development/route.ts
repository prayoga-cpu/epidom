import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { customDevelopmentService } from "@/lib/services/custom-development.service";
import { updateCustomDevelopmentTriageSchema } from "@/lib/validation/custom-development.schemas";

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

/**
 * GET /api/admin/custom-development
 * List all custom development requests.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await customDevelopmentService.getAllRequests();

  return NextResponse.json({ requests });
}

/**
 * PATCH /api/admin/custom-development
 * Update the status and/or dev note of a custom development request.
 */
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const request_ = await customDevelopmentService.updateTriage(parsed.data.id, {
    status: parsed.data.status,
    devNote: parsed.data.devNote,
  });

  return NextResponse.json({ request: request_ });
}
