/**
 * Server-Side Image Compression
 *
 * The authoritative half of the image-compression rule (see AGENTS.md § 6,
 * "Images"): whatever a client sends — already compressed, uncompressed, or
 * from a caller that skips client-side compression entirely (e.g. a direct
 * API call) — this guarantees the file leaving `/api/upload` is resized to
 * at most `IMAGE_MAX_DIMENSION_PX` on its longest edge and re-encoded under
 * the requested target size.
 *
 * GIFs are passed through unresized: re-encoding an animated GIF frame-by-
 * frame needs a codec path sharp doesn't reliably ship, so a GIF is only
 * checked against the target size, never recompressed. This mirrors prior
 * behavior (GIFs were never processed) and is documented, not a regression.
 */

import sharp from "sharp";
import { IMAGE_MAX_DIMENSION_PX } from "@/lib/constants/image";

export interface CompressedImage {
  buffer: Buffer;
  contentType: string;
}

/** Quality steps to retry at (highest first) until the output fits the target size. */
const QUALITY_STEPS = [82, 68, 54, 40] as const;

async function encodeAtQuality(
  pixels: Buffer,
  format: "jpeg" | "webp" | "png",
  quality: number
): Promise<Buffer<ArrayBufferLike>> {
  const image = sharp(pixels);
  switch (format) {
    case "jpeg":
      return image.jpeg({ quality, mozjpeg: true }).toBuffer();
    case "webp":
      return image.webp({ quality }).toBuffer();
    case "png":
      // `palette: true` enables pngquant-style quantization so `quality`
      // actually shrinks output size — a plain lossless PNG ignores it.
      return image.png({ quality, palette: true, effort: 8 }).toBuffer();
  }
}

/**
 * Resize + re-encode an image buffer so it fits within `targetBytes`.
 * Throws if the image type is unsupported or can't be brought under target.
 */
export async function compressImageServer(
  input: Buffer,
  contentType: string,
  targetBytes: number
): Promise<CompressedImage> {
  if (contentType === "image/gif") {
    if (input.length > targetBytes) {
      throw new Error(
        `GIF exceeds the ${(targetBytes / 1024 / 1024).toFixed(1)}MB limit and can't be auto-compressed. Please use a JPEG, PNG, or WebP, or shrink the GIF manually.`
      );
    }
    return { buffer: input, contentType };
  }

  const format = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpeg";

  const resized: Buffer<ArrayBufferLike> = await sharp(input, { failOn: "none" })
    .rotate() // normalize EXIF orientation before it's stripped
    .resize({
      width: IMAGE_MAX_DIMENSION_PX,
      height: IMAGE_MAX_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  let output: Buffer<ArrayBufferLike> = resized;
  for (const quality of QUALITY_STEPS) {
    output = await encodeAtQuality(resized, format, quality);
    if (output.length <= targetBytes) {
      return { buffer: output, contentType };
    }
  }

  throw new Error(
    `Image could not be compressed under ${(targetBytes / 1024 / 1024).toFixed(1)}MB. Please try a smaller or simpler image.`
  );
}
