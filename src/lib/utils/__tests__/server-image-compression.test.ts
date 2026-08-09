import { describe, it, expect } from "vitest";
import { Jimp, JimpMime } from "jimp";
import { compressImageServer } from "../server-image-compression";
import { IMAGE_MAX_DIMENSION_PX } from "@/lib/constants/image";

const ONE_MB = 1024 * 1024;

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/** Box-Muller gaussian sample. */
function gaussian(mean: number, sigma: number): number {
  const u1 = Math.random() || Number.EPSILON;
  const u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Build a synthetic JPEG of the given pixel size, large enough to actually
 * need compressing. Gaussian (not uniform-random) noise: true per-pixel
 * white noise is near worst-case entropy for a DCT codec and never
 * compresses under any target, unlike a real photo — gaussian clustering
 * around a mean is what the quality-step loop is meant to be exercised by.
 */
async function makeJpeg(width: number, height: number, sigma = 60): Promise<Buffer> {
  const image = new Jimp({ width, height, color: 0x808080ff });
  image.scan(0, 0, width, height, (_x, _y, idx) => {
    const v = clamp255(gaussian(128, sigma));
    image.bitmap.data[idx] = v;
    image.bitmap.data[idx + 1] = v;
    image.bitmap.data[idx + 2] = v;
    image.bitmap.data[idx + 3] = 255;
  });
  return image.getBuffer(JimpMime.jpeg, { quality: 100 });
}

async function makeGif(width: number, height: number, color: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color });
  return image.getBuffer(JimpMime.gif);
}

/**
 * Diagonal gradient with a little noise on top — unlike flat noise, this has
 * enough spatial redundancy for palette quantization to actually shrink it
 * (fewer colors -> longer runs for deflate to exploit), which is the
 * realistic case quantization exists for.
 */
async function makeGradientPng(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: 0x808080ff });
  image.scan(0, 0, width, height, (x, y, idx) => {
    const base = ((x + y) / (width + height)) * 255;
    const v = clamp255(base + (Math.random() - 0.5) * 12);
    image.bitmap.data[idx] = v;
    image.bitmap.data[idx + 1] = v;
    image.bitmap.data[idx + 2] = v;
    image.bitmap.data[idx + 3] = 255;
  });
  return image.getBuffer(JimpMime.png);
}

describe("compressImageServer", () => {
  it("resizes an oversized image down to the max dimension", async () => {
    const input = await makeJpeg(3000, 2000);
    const { buffer, contentType } = await compressImageServer(input, "image/jpeg", 2 * ONE_MB);

    const image = await Jimp.read(buffer);
    expect(image.bitmap.width).toBeLessThanOrEqual(IMAGE_MAX_DIMENSION_PX);
    expect(image.bitmap.height).toBeLessThanOrEqual(IMAGE_MAX_DIMENSION_PX);
    expect(contentType).toBe("image/jpeg");
    expect(buffer.length).toBeLessThanOrEqual(2 * ONE_MB);
  });

  it("never enlarges an image smaller than the max dimension", async () => {
    const input = await makeJpeg(400, 300);
    const { buffer } = await compressImageServer(input, "image/jpeg", 2 * ONE_MB);

    const image = await Jimp.read(buffer);
    expect(image.bitmap.width).toBe(400);
    expect(image.bitmap.height).toBe(300);
  });

  it("iterates quality down until the output fits the target size", async () => {
    // Noise that's compressible-but-not-trivially-so at high quality, so the
    // first quality step (82) doesn't fit and the loop has to step down.
    const input = await makeJpeg(1600, 1600, 15);
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

  it("compresses PNGs via palette quantization when lossless doesn't fit", async () => {
    const input = await makeGradientPng(800, 800);

    const target = 0.9 * ONE_MB;
    const { buffer, contentType } = await compressImageServer(input, "image/png", target);

    expect(contentType).toBe("image/png");
    expect(buffer.length).toBeLessThanOrEqual(target);
  });

  it("passes WebP through unmodified when already under the target", async () => {
    // No real WebP codec is exercised here — pass-through never decodes the
    // bytes at all, so arbitrary content is enough to test the size gate.
    const input = Buffer.from("fake webp bytes");

    const { buffer, contentType } = await compressImageServer(input, "image/webp", 2 * ONE_MB);
    expect(buffer).toEqual(input);
    expect(contentType).toBe("image/webp");
  });

  it("rejects an oversized WebP instead of silently passing it through", async () => {
    const input = Buffer.from("fake webp bytes");

    await expect(compressImageServer(input, "image/webp", 1)).rejects.toThrow(/WebP exceeds/i);
  });

  it("passes GIFs through unmodified when already under the target", async () => {
    const input = await makeGif(100, 100, 0xff0000ff);

    const { buffer, contentType } = await compressImageServer(input, "image/gif", 2 * ONE_MB);
    expect(buffer).toEqual(input);
    expect(contentType).toBe("image/gif");
  });

  it("rejects an oversized GIF instead of silently passing it through", async () => {
    const input = await makeGif(100, 100, 0x00ff00ff);

    await expect(compressImageServer(input, "image/gif", 1)).rejects.toThrow(/GIF exceeds/i);
  });
});
