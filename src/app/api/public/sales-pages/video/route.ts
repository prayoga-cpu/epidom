import { NextResponse } from "next/server";
import { salesVideoUrl } from "@/lib/storage/sales-video";

/**
 * GET /api/public/sales-pages/video
 *
 * The sales-page video: a redirect to a short-lived signed R2 link (see
 * src/lib/storage/sales-video.ts). The browser follows it with its Range
 * header, so seeking streams straight from R2. Only ever this one file.
 */
export async function GET() {
  try {
    const url = await salesVideoUrl();
    if (!url) return NextResponse.json({ error: "Video unavailable" }, { status: 404 });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[SALES_VIDEO]", error);
    return NextResponse.json({ error: "Video unavailable" }, { status: 503 });
  }
}
