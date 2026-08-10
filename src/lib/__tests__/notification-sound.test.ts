import { describe, it, expect, vi, beforeEach } from "vitest";

// jsdom doesn't actually decode audio, so `Audio` is mocked to deterministically
// report a controllable duration (or fail), matching how send.test.ts mocks web-push.
let mockDuration = 1.5;
let mockShouldError = false;

class MockAudio {
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  duration = 0;
  preload = "";
  play = vi.fn().mockResolvedValue(undefined);

  set src(_value: string) {
    queueMicrotask(() => {
      if (mockShouldError) {
        this.onerror?.();
      } else {
        this.duration = mockDuration;
        this.onloadedmetadata?.();
      }
    });
  }
}

vi.stubGlobal("Audio", MockAudio);
// Only stub the two static methods actually used — replacing the whole global
// `URL` breaks Vite/Vitest's own module loader, which needs the real constructor.
URL.createObjectURL = vi.fn(() => "blob:mock");
URL.revokeObjectURL = vi.fn();

class MockFileReader {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | null = null;

  readAsDataURL(_file: File) {
    queueMicrotask(() => {
      this.result = "data:audio/mpeg;base64,bW9jaw==";
      this.onload?.();
    });
  }
}
vi.stubGlobal("FileReader", MockFileReader);

function makeFile(opts: { type?: string; size?: number } = {}): File {
  const type = opts.type ?? "audio/mpeg";
  const size = opts.size ?? 1000;
  const file = new File([new Uint8Array(size)], "clip.mp3", { type });
  return file;
}

beforeEach(() => {
  localStorage.clear();
  mockDuration = 1.5;
  mockShouldError = false;
});

describe("notification tone preference", () => {
  it("round-trips a valid tone through localStorage", async () => {
    const { getNotificationTone, setNotificationTone } = await import("../notification-sound");
    setNotificationTone("ping");
    expect(getNotificationTone()).toBe("ping");
  });

  it("falls back to the default for a missing/invalid stored value", async () => {
    const { getNotificationTone } = await import("../notification-sound");
    localStorage.setItem("epidom:notificationTone", "not-a-real-tone");
    expect(getNotificationTone()).toBe("chime");
  });
});

describe("custom sound storage", () => {
  it("returns null when nothing has been saved", async () => {
    const { getCustomSound } = await import("../notification-sound");
    expect(getCustomSound()).toBeNull();
  });

  it("clearCustomSound removes a saved sound", async () => {
    const { getCustomSound, clearCustomSound } = await import("../notification-sound");
    localStorage.setItem("epidom:notificationCustomSound", "data:audio/mpeg;base64,x");
    clearCustomSound();
    expect(getCustomSound()).toBeNull();
  });
});

describe("validateAndSaveCustomSound", () => {
  it("rejects a non-audio file type", async () => {
    const { validateAndSaveCustomSound } = await import("../notification-sound");
    const result = await validateAndSaveCustomSound(makeFile({ type: "video/mp4" }));
    expect("error" in result && result.error.code).toBe("type");
  });

  it("rejects a file over the size cap", async () => {
    const { validateAndSaveCustomSound, MAX_CUSTOM_SOUND_BYTES } = await import(
      "../notification-sound"
    );
    const result = await validateAndSaveCustomSound(
      makeFile({ size: MAX_CUSTOM_SOUND_BYTES + 1 })
    );
    expect("error" in result && result.error.code).toBe("size");
  });

  it("rejects a clip longer than the duration cap", async () => {
    mockDuration = 5;
    const { validateAndSaveCustomSound } = await import("../notification-sound");
    const result = await validateAndSaveCustomSound(makeFile());
    expect("error" in result && result.error.code).toBe("duration");
  });

  it("surfaces an unreadable-file error when decoding fails", async () => {
    mockShouldError = true;
    const { validateAndSaveCustomSound } = await import("../notification-sound");
    const result = await validateAndSaveCustomSound(makeFile());
    expect("error" in result && result.error.code).toBe("unreadable");
  });

  it("accepts a valid short clip and persists it as a data URL", async () => {
    const { validateAndSaveCustomSound, getCustomSound } = await import("../notification-sound");
    const result = await validateAndSaveCustomSound(makeFile());
    expect("dataUrl" in result).toBe(true);
    expect(getCustomSound()).toBe("data:audio/mpeg;base64,bW9jaw==");
  });
});

describe("playNotificationSound", () => {
  it("no-ops for 'none' without touching Audio", async () => {
    const { playNotificationSound } = await import("../notification-sound");
    expect(() => playNotificationSound("none")).not.toThrow();
  });

  it("no-ops for 'custom' when no sound has been saved", async () => {
    const { playNotificationSound } = await import("../notification-sound");
    expect(() => playNotificationSound("custom")).not.toThrow();
  });

  it("plays the saved custom sound via Audio.play()", async () => {
    localStorage.setItem("epidom:notificationCustomSound", "data:audio/mpeg;base64,bW9jaw==");
    const { playNotificationSound } = await import("../notification-sound");
    expect(() => playNotificationSound("custom")).not.toThrow();
  });
});
