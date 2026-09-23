import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { isRealDateKey, scheduleImageSchema } from "@/lib/validation/scheduling.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireManagerOrOwnerApi } from "@/lib/auth/require-manager-or-owner";
import { businessDateKeyToDate } from "@/lib/attendance/business-date";
import { getStorageAdapter } from "@/lib/storage";
import { isOwnUpload } from "@/lib/utils/own-upload";

export const dynamic = "force-dynamic";

/** `@db.Date` columns come back as UTC-midnight Dates; the API speaks date keys. */
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

function serialize(image: {
  id: string;
  imageUrl: string;
  startDate: Date;
  endDate: Date;
  note: string | null;
}) {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    startDate: toDateKey(image.startDate),
    endDate: toDateKey(image.endDate),
    note: image.note,
  };
}

/**
 * GET /api/stores/[id]/schedule-images?from&to
 *
 * Roster images whose dates overlap [from, to] (either bound optional). Serves
 * the manager's Work Schedule page and every staff member's My Schedule from one
 * endpoint — unlike a person's own roster rows, an image is the same for the
 * whole team, so there is nothing to restrict per caller. Soonest first.
 */
export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    for (const value of [from, to]) {
      if (value && !isRealDateKey(value)) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INVALID_INPUT,
            "Use a real date as YYYY-MM-DD for from/to"
          ),
          { status: 400 }
        );
      }
    }

    const images = await prisma.scheduleImage.findMany({
      where: {
        storeId,
        // Overlap, not containment: an image for Mon–Sun is still "this week's"
        // on Wednesday, when someone asks from today.
        ...(from && { endDate: { gte: businessDateKeyToDate(from) } }),
        ...(to && { startDate: { lte: businessDateKeyToDate(to) } }),
      },
      orderBy: [{ startDate: "asc" }],
    });

    return NextResponse.json(createSuccessResponse({ images: images.map(serialize) }));
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-images", requireStoreAuth: true }
);

/**
 * POST /api/stores/[id]/schedule-images — publish an image for a date range.
 * Manager/owner only.
 *
 * An upsert on the range: uploading again for the SAME dates replaces the image
 * (and frees the old file) instead of stacking a second one staff would have to
 * choose between. Different ranges coexist, even when they overlap.
 */
export const POST = withApiHandler(
  async (request, { storeId, userId }) => {
    const guardResponse = await requireManagerOrOwnerApi(storeId!);
    if (guardResponse) return guardResponse;

    const body = await request.json();
    const parsed = scheduleImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Validation failed",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const { imageUrl, startDate, endDate, note } = parsed.data;
    if (!isOwnUpload(imageUrl, userId)) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "The image must be uploaded through the app by this account"
        ),
        { status: 400 }
      );
    }
    const range = {
      storeId: storeId!,
      startDate: businessDateKeyToDate(startDate),
      endDate: businessDateKeyToDate(endDate),
    };

    const existing = await prisma.scheduleImage.findUnique({
      where: { storeId_startDate_endDate: range },
    });

    const image = await prisma.scheduleImage.upsert({
      where: { storeId_startDate_endDate: range },
      create: { ...range, imageUrl, note: note || null },
      update: { imageUrl, note: note || null },
    });

    // Replaced: the old file is unreferenced now. Best-effort — a leaked blob is
    // a storage nuisance, a failed replace would be the manager's lost upload.
    if (existing && existing.imageUrl !== imageUrl && isOwnUpload(existing.imageUrl, userId)) {
      try {
        await getStorageAdapter().delete(existing.imageUrl);
      } catch {
        // ignore
      }
    }

    return NextResponse.json(createSuccessResponse({ image: serialize(image) }), {
      status: existing ? 200 : 201,
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/schedule-images", requireStoreAuth: true }
);
