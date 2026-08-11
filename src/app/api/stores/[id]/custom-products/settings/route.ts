import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnershipWithResponse } from "@/lib/utils/store-verification";
import { getActiveStaffSession } from "@/lib/staff-session";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

const updateCustomProductsSettingsSchema = z.object({
  customProductsEnabled: z.boolean().optional(),
  customProductsLabel: z.string().min(1).max(50).optional(),
  // Independent of customProductsEnabled — whether custom-line items also
  // publish to the public storefront menu. Settable on its own from
  // Storefront Settings without touching the master enable state.
  customProductsShowOnStorefront: z.boolean().optional(),
});

/**
 * GET /api/stores/[id]/custom-products/settings
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  return NextResponse.json(
    createSuccessResponse({
      customProductsEnabled: verification.customProductsEnabled,
      customProductsLabel: verification.customProductsLabel,
      customProductsShowOnStorefront: verification.customProductsShowOnStorefront,
    })
  );
}

/**
 * PATCH /api/stores/[id]/custom-products/settings
 * Owner-only, even if a staff PIN session has the Data page in its
 * allowedPages — the toggle itself is a store-wide operational mode, not a
 * page visibility rule (same convention as production/settings).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const verification = await verifyStoreOwnershipWithResponse(storeId, session.user.id);
  if (verification instanceof NextResponse) return verification;

  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only the store owner can change this setting"),
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateCustomProductsSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid settings", parsed.error.flatten()),
      { status: 400 }
    );
  }

  // Enabling always requires a label — either already stored, or supplied in
  // this same request — so the tab is never turned on unnamed.
  if (parsed.data.customProductsEnabled) {
    const label = parsed.data.customProductsLabel ?? verification.customProductsLabel;
    if (!label) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Name this product line before enabling it"
        ),
        { status: 422 }
      );
    }
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(parsed.data.customProductsEnabled !== undefined && {
        customProductsEnabled: parsed.data.customProductsEnabled,
      }),
      ...(parsed.data.customProductsLabel !== undefined && {
        customProductsLabel: parsed.data.customProductsLabel,
      }),
      ...(parsed.data.customProductsShowOnStorefront !== undefined && {
        customProductsShowOnStorefront: parsed.data.customProductsShowOnStorefront,
      }),
    },
    select: {
      customProductsEnabled: true,
      customProductsLabel: true,
      customProductsShowOnStorefront: true,
    },
  });

  return NextResponse.json(createSuccessResponse(updated));
}
