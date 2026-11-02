/**
 * GET /api/stores/[id]/fiscal/archives/[archiveId]
 *
 * One signed monthly archive as a JSON file:
 *   {"archive": <signed header>, "document": <the archived month>}
 * `document` is spliced in as the exact stored text, so its sha256 is the
 * header's contentHash, and `archive.payload` verifies against `signature`
 * with the public key listed in `document.keys` (scripts/fiscal-verify.ts).
 */
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { canonicalJson } from "@/lib/fiscal/canonical";
import { readArchiveContent } from "@/lib/fiscal/archive";
import { requireFiscalAccessApi } from "@/lib/fiscal/summary";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request, { storeId, params }) => {
    const gate = await requireFiscalAccessApi(storeId!);
    if (gate) return gate;

    const archive = await prisma.fiscalArchive.findFirst({
      where: { id: params.archiveId, storeId: storeId! },
    });
    if (!archive) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Archive not found"), {
        status: 404,
      });
    }

    const header = canonicalJson({
      seq: archive.seq,
      period: archive.period,
      contentHash: archive.contentHash,
      payload: archive.payload,
      hash: archive.hash,
      signature: archive.signature,
      keyId: archive.keyId,
    });
    const body = `{"archive":${header},"document":${readArchiveContent(archive.content)}}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="epidom-fiscal-${archive.period}.json"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { rateLimitEndpoint: "/api/stores/[id]/fiscal/archives/[archiveId]", requireStoreAuth: true }
);
