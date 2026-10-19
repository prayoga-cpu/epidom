import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, isR2Configured } from "@/lib/backup/r2-client";

/**
 * The sales-page video (VSL): one file in Cloudflare R2 shown on all four
 * /sales-page-N pages, in every language (public/sales-pages/vsl.js).
 *
 * The bucket stays private (it also holds the nightly database backups), so
 * the video is never served from a public bucket URL: visitors get a
 * short-lived signed link to this one object only.
 */
export const SALES_VIDEO_KEY = "videos/VSL.mp4";

/** The R2 bucket holding it: R2_MEDIA_BUCKET when set, else "epidom". */
export function salesVideoBucket(): string {
  return process.env.R2_MEDIA_BUCKET || "epidom";
}

/** How long a signed link works: long enough to watch, pause and resume. */
export const SALES_VIDEO_LINK_SECONDS = 6 * 60 * 60;

/** A signed GET link to the video, or null when R2 isn't configured. */
export async function salesVideoUrl(): Promise<string | null> {
  if (!isR2Configured()) return null;
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: salesVideoBucket(), Key: SALES_VIDEO_KEY }),
    { expiresIn: SALES_VIDEO_LINK_SECONDS }
  );
}
