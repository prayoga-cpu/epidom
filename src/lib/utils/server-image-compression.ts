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
 * Pure JavaScript (jimp), not sharp: sharp's native linux-x64 binary gets
 * pruned from Vercel's deployed function bundle (loaded via a runtime
 * dlopen() that its output file tracer can't see), which crashed every
 * upload with ERR_DLOPEN_FAILED. jimp has no native/dlopen'd binary at all —
 * what passes locally behaves identically on Vercel.
 *
 * GIFs and WebP are both passed through unresized: re-encoding an animated
 * GIF frame-by-frame needs a codec path this library doesn't have, and the
 * only available WebP codec (@jimp/wasm-webp, wrapping @jsquash/webp) loads
 * its WASM binary via a `fetch()` call that isn't implemented for local
 * files under plain Node.js — the same runtime Vercel functions use — so it
 * would crash `/api/upload` on any real WebP upload exactly like sharp did.
 * Both formats are only checked against the target size, never recompressed.
 * GIF pass-through mirrors prior behavior (documented, not a regression);
 * WebP pass-through is a deliberate, narrower guarantee than before rather
 * than risk a third production crash on an unproven codec path.
 */

import { Jimp, JimpMime } from "jimp";
import { IMAGE_MAX_DIMENSION_PX } from "@/lib/constants/image";

export interface CompressedImage {
  buffer: Buffer;
  contentType: string;
}

/** Quality steps to retry at (highest first) until the output fits the target size. */
const QUALITY_STEPS = [82, 68, 54, 40] as const;

/** Color-count steps for PNG, which has no lossy "quality" — only palette size. */
const PNG_QUANTIZE_STEPS = [256, 128, 64, 32] as const;

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
        `GIF exceeds the ${(targetBytes / 1024 / 1024).toFixed(1)}MB limit and can't be auto-compressed. Please use a JPEG or PNG, or shrink the GIF manually.`
      );
    }
    return { buffer: input, contentType };
  }

  if (contentType === "image/webp") {
    if (input.length > targetBytes) {
      throw new Error(
        `WebP exceeds the ${(targetBytes / 1024 / 1024).toFixed(1)}MB limit and can't be auto-compressed. Please use a JPEG or PNG, or shrink the file manually.`
      );
    }
    return { buffer: input, contentType };
  }

  const image = await Jimp.read(input);

  if (image.bitmap.width > IMAGE_MAX_DIMENSION_PX || image.bitmap.height > IMAGE_MAX_DIMENSION_PX) {
    image.scaleToFit({ w: IMAGE_MAX_DIMENSION_PX, h: IMAGE_MAX_DIMENSION_PX });
  }

  if (contentType === "image/png") {
    const lossless = await image.getBuffer(JimpMime.png, { deflateLevel: 9 });
    if (lossless.length <= targetBytes) {
      return { buffer: lossless, contentType: "image/png" };
    }
    for (const colors of PNG_QUANTIZE_STEPS) {
      const buffer = await image.clone().quantize({ colors }).getBuffer(JimpMime.png, { deflateLevel: 9 });
      if (buffer.length <= targetBytes) {
        return { buffer, contentType: "image/png" };
      }
    }
  } else {
    for (const quality of QUALITY_STEPS) {
      const buffer = await image.getBuffer(JimpMime.jpeg, { quality });
      if (buffer.length <= targetBytes) {
        return { buffer, contentType: "image/jpeg" };
      }
    }
  }

  throw new Error(
    `Image could not be compressed under ${(targetBytes / 1024 / 1024).toFixed(1)}MB. Please try a smaller or simpler image.`
  );
}
