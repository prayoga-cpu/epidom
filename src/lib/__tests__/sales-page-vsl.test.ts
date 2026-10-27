// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// public/sales-pages/vsl.js is a plain browser script: run its source the way the page does.
const SOURCE = readFileSync(join(process.cwd(), "public", "sales-pages", "vsl.js"), "utf8");
const run = () => new Function(SOURCE)();

beforeEach(() => {
  document.head.innerHTML = "";
  document.documentElement.setAttribute("lang", "fr");
  // jsdom has no media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});

describe("sales-page video (vsl.js)", () => {
  it("downloads nothing until play is tapped, then plays the R2 video inside the box", () => {
    document.body.innerHTML =
      '<div class="video"><button class="play" type="button" aria-label="Lire la vidéo"></button><p>5 minutes pour découvrir Epidom</p></div>';
    run();
    const box = document.querySelector(".video")!;
    expect(box.querySelector("video")).toBeNull();

    (box.querySelector(".play") as HTMLButtonElement).click();

    const video = box.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/api/public/sales-pages/video");
    expect(video.getAttribute("poster")).toBe("/sales-pages/vsl-thumbnail.jpg");
    expect(video.controls).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(box.classList.contains("epi-vsl-on")).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // A second tap doesn't add a second player.
    (box.querySelector(".play") as HTMLButtonElement).click();
    expect(box.querySelectorAll("video")).toHaveLength(1);
  });

  it("shows the thumbnail as the box's cover, and a tap anywhere on it plays", () => {
    document.body.innerHTML =
      '<div class="video"><button class="play" type="button" aria-label="Lire la vidéo"></button><p>5 minutes</p></div>';
    run();
    const box = document.querySelector(".video") as HTMLElement;
    expect(box.classList.contains("epi-vsl-cover")).toBe(true);
    expect(document.head.textContent).toContain("/sales-pages/vsl-thumbnail.webp");
    box.click();
    expect(box.querySelector("video")).not.toBeNull();
  });

  it.each([
    ["fr", "Lire la vidéo"],
    ["en", "Play video"],
    ["id", "Putar video"],
  ])("adds a play button in the page's language where the design has none (%s)", (lang, label) => {
    document.documentElement.setAttribute("lang", lang);
    document.body.innerHTML =
      '<div class="video" aria-label="x"><span class="corner tl"></span></div>';
    run();
    const button = document.querySelector(".video .epi-vsl-play") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe(label);
    button.click();
    expect(document.querySelector(".video video")).not.toBeNull();
  });

  it("does nothing on a page without a video box", () => {
    document.body.innerHTML = "<main></main>";
    expect(run).not.toThrow();
    expect(document.querySelector("video")).toBeNull();
  });

  it("every sales page, in every language, loads it", () => {
    const dir = join(process.cwd(), "public", "sales-pages");
    for (const n of [1, 2, 3, 4]) {
      for (const suffix of ["", ".en", ".id"]) {
        const html = readFileSync(join(dir, `sales-page-${n}${suffix}.html`), "utf8");
        expect(html, `sales-page-${n}${suffix}`).toContain(
          '<script src="/sales-pages/vsl.js" defer></script>'
        );
        expect(html, `sales-page-${n}${suffix}`).toContain('class="video"');
        expect(html, `sales-page-${n}${suffix}`).toContain(
          '<link rel="preload" as="image" href="/sales-pages/vsl-thumbnail.webp"'
        );
        expect(html, `sales-page-${n}${suffix}`).not.toMatch(/\[X min|X minutes|X menit/);
      }
    }
  });
});

describe("sales-page video thumbnail files", () => {
  it("ship next to the pages, light enough for an ad landing page", () => {
    const { statSync } = require("fs") as typeof import("fs");
    const dir = join(process.cwd(), "public", "sales-pages");
    expect(statSync(join(dir, "vsl-thumbnail.webp")).size).toBeLessThan(150 * 1024);
    expect(statSync(join(dir, "vsl-thumbnail.jpg")).size).toBeLessThan(200 * 1024);
  });

  it("are the same 16:9 picture in both formats (vsl.js places the play button and caption on it)", () => {
    const dir = join(process.cwd(), "public", "sales-pages");
    const jpg = jpegSize(readFileSync(join(dir, "vsl-thumbnail.jpg")));
    const webp = webpSize(readFileSync(join(dir, "vsl-thumbnail.webp")));
    expect(webp).toEqual(jpg);
    expect(jpg.width * 9).toBe(jpg.height * 16);
  });
});

// Image sizes straight from the file headers (no image library in the test run).
function jpegSize(buf: Buffer) {
  for (let i = 2; i < buf.length; i += 2 + buf.readUInt16BE(i + 2)) {
    const marker = buf[i + 1];
    // SOF0-SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
  }
  throw new Error("no JPEG frame header");
}

function webpSize(buf: Buffer) {
  // Lossy WebP: "RIFF" size "WEBP" "VP8 " ... 14-bit width/height after the start code.
  if (buf.toString("ascii", 12, 16) !== "VP8 ") throw new Error("not a lossy WebP");
  return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
}
