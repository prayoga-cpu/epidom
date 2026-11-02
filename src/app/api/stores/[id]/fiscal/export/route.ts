/**
 * GET /api/stores/[id]/fiscal/export?month=YYYY-MM
 *
 * A month's journal in the archive format, built now, for a month that has
 * no signed archive yet (the current one, typically). Every entry and closure
 * in it is still individually signed; only the envelope is unsigned, which
 * `"archive": null` says.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { canonicalJson } from "@/lib/fiscal/canonical";
import { buildArchiveDocument } from "@/lib/fiscal/archive";
import { requireFiscalAccessApi } from "@/lib/fiscal/summary";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
});

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const gate = await requireFiscalAccessApi(storeId!);
    if (gate) return gate;

    const parsed = exportQuerySchema.safeParse({
      month: new URL(request.url).searchParams.get("month") ?? undefined,
    });
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

    const { document } = await buildArchiveDocument(
      prisma,
      storeId!,
      parsed.data.month,
      new Date()
    );
    const body = `{"archive":null,"document":${canonicalJson(document)}}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="epidom-fiscal-${parsed.data.month}-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/fiscal/export", requireStoreAuth: true }
);
