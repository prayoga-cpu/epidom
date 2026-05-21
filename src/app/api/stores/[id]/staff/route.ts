import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStaffSchema } from "@/lib/validation/operations.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_req, { storeId }) => {
    const staff = await prisma.staffMember.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Never return pin hash
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(createSuccessResponse({ staff }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff", requireStoreAuth: true }
);

export const POST = withApiHandler(
  async (request, { storeId }) => {
    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Validation failed", parsed.error.flatten()),
        { status: 400 }
      );
    }

    const { name, role, pin } = parsed.data;
    const pinHash = await hash(pin, 10);

    const staff = await prisma.staffMember.create({
      data: { storeId: storeId!, name, role, pin: pinHash },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    });

    return NextResponse.json(createSuccessResponse({ staff }), { status: 201 });
  },
  { rateLimitEndpoint: "/api/stores/[id]/staff", requireStoreAuth: true }
);
