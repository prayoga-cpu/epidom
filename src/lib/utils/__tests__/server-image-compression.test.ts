import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { compressImageServer } from "../server-image-compression";
import { IMAGE_MAX_DIMENSION_PX } from "@/lib/constants/image";

const ONE_MB = 1024 * 1024;

/** Build a synthetic JPEG of the given pixel size, large enough to actually need compressing. */
async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#808080",
      // Random-ish noise compresses poorly, which is what forces the
      // quality-step loop to actually run instead of exiting on attempt 1.
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .jpeg({ quality: 100 })
    .toBuffer();
}

describe("compressImageServer", () => {
  it("resizes an oversized image down to the max dimension", async () => {
    const input = await makeJpeg(3000, 2000);
    const { buffer, contentType } = await compressImageServer(input, "image/jpeg", 2 * ONE_MB);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(IMAGE_MAX_DIMENSION_PX);
    expect(metadata.height).toBeLessThanOrEqual(IMAGE_MAX_DIMENSION_PX);
    expect(contentType).toBe("image/jpeg");
    expect(buffer.length).toBeLessThanOrEqual(2 * ONE_MB);
  });

  it("never enlarges an image smaller than the max dimension", async () => {
    const input = await makeJpeg(400, 300);
    const { buffer } = await compressImageServer(input, "image/jpeg", 2 * ONE_MB);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(300);
  });

  it("iterates quality down until the output fits the target size", async () => {
    // Noise that's compressible-but-not-trivially-so at high quality, so the
    // first quality step (82) doesn't fit and the loop has to step down.
    const input = await sharp({
      create: {
        width: 1600,
        height: 1600,
        channels: 3,
        background: "#808080",
        noise: { type: "gaussian", mean: 128, sigma: 25 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    const target = 0.4 * ONE_MB;
    const { buffer } = await compressImageServer(input, "image/jpeg", target);

    expect(buffer.length).toBeLessThanOrEqual(target);
  });

  it("throws when the image can't be compressed under the target", async () => {
    // Small on purpose — an impossible 1-byte target fails at every quality
    // step regardless of image size, so keep this fast rather than running
    // the full quality-step loop over a large noisy image four times.
    const input = await makeJpeg(200, 200);
    await expect(compressImageServer(input, "image/jpeg", 1)).rejects.toThrow(/could not be compressed/i);
  });

  it("passes GIFs through unmodified when already under the target", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#ff0000" },
    })
      .gif()
      .toBuffer();

    const { buffer, contentType } = await compressImageServer(input, "image/gif", 2 * ONE_MB);
    expect(buffer).toEqual(input);
    expect(contentType).toBe("image/gif");
  });

  it("rejects an oversized GIF instead of silently passing it through", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#00ff00" },
    })
      .gif()
      .toBuffer();

    await expect(compressImageServer(input, "image/gif", 1)).rejects.toThrow(/GIF exceeds/i);
  });
});
