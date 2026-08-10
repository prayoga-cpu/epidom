/**
 * In-app notification sound for the NotificationBell (new order/reservation
 * items arriving while the tab is open). Built-in tones are synthesized via
 * Web Audio — no asset to host. "Custom" lets the operator upload their own
 * short clip, stored as a data URL in localStorage (device-only, like the
 * tone choice itself — no server upload, no DB field, nothing to sync).
 * Mirrors last-seen-version.ts's SSR-guarded, try/catch localStorage pattern.
 *
 * Deliberately does NOT cover the old OS-level web-push notifications sound
 * (src/lib/push/) or MagicBell's push/email/SMS channels — neither the Web
 * Notifications API nor MagicBell's own delivery channels support a custom
 * sound; that's a platform limitation on both, not something this app can
 * override. This only plays while the tab is actually open and focused on it.
 */

export type NotificationTone = "chime" | "ping" | "custom" | "none";

const TONE_KEY = "epidom:notificationTone";
const CUSTOM_SOUND_KEY = "epidom:notificationCustomSound";
const DEFAULT_TONE: NotificationTone = "chime";

/** Upload guardrails — short on purpose: this plays every time a new order/
 *  reservation/onboarding item lands, so it needs to be brief, not a song. */
export const MAX_CUSTOM_SOUND_SECONDS = 3;
export const MAX_CUSTOM_SOUND_BYTES = 1_000_000; // 1MB — plenty for a 3s clip, even uncompressed WAV

export function getNotificationTone(): NotificationTone {
  if (typeof window === "undefined") return DEFAULT_TONE;
  try {
    const raw = localStorage.getItem(TONE_KEY);
    return raw === "chime" || raw === "ping" || raw === "custom" || raw === "none"
      ? raw
      : DEFAULT_TONE;
  } catch {
    return DEFAULT_TONE;
  }
}

export function setNotificationTone(tone: NotificationTone): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TONE_KEY, tone);
  } catch {
    // Ignore quota/blocked storage — persistence is best-effort.
  }
}

export function getCustomSound(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CUSTOM_SOUND_KEY);
  } catch {
    return null;
  }
}

export function clearCustomSound(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CUSTOM_SOUND_KEY);
  } catch {
    // Ignore.
  }
}

export interface CustomSoundError {
  code: "type" | "size" | "duration" | "unreadable";
  message: string;
}

/**
 * Validates an uploaded file (type, size, then actual decoded duration) and,
 * if it passes, saves it as the custom sound and returns its data URL.
 * Duration can only be known by actually loading the audio, so this is async
 * and touches the DOM (`Audio`/`FileReader`) — browser-only.
 */
export async function validateAndSaveCustomSound(
  file: File
): Promise<{ dataUrl: string } | { error: CustomSoundError }> {
  if (!file.type.startsWith("audio/")) {
    return { error: { code: "type", message: "Unsupported file type — use MP3, WAV, OGG, or M4A." } };
  }
  if (file.size > MAX_CUSTOM_SOUND_BYTES) {
    return {
      error: {
        code: "size",
        message: `File is too large (${(file.size / 1_000_000).toFixed(1)}MB) — max ${MAX_CUSTOM_SOUND_BYTES / 1_000_000}MB.`,
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);
  let duration: number;
  try {
    duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error("decode failed"));
      audio.src = objectUrl;
    });
  } catch {
    return { error: { code: "unreadable", message: "Couldn't read this audio file." } };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  if (!Number.isFinite(duration)) {
    return { error: { code: "unreadable", message: "Couldn't read this audio file." } };
  }
  if (duration > MAX_CUSTOM_SOUND_SECONDS) {
    return {
      error: {
        code: "duration",
        message: `Clip is ${duration.toFixed(1)}s long — max ${MAX_CUSTOM_SOUND_SECONDS}s.`,
      },
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  try {
    localStorage.setItem(CUSTOM_SOUND_KEY, dataUrl);
  } catch {
    return { error: { code: "size", message: "Couldn't save this clip — device storage is full." } };
  }

  return { dataUrl };
}

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

/** One short oscillator tone: attack/decay envelope so it doesn't click. */
function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.2, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

/** Plays the selected tone. No-ops silently on "none", an unset custom sound,
 *  missing AudioContext, or a blocked/suspended context (autoplay policy) —
 *  a sound is a nice-to-have, never worth surfacing an error for. */
export function playNotificationSound(tone: NotificationTone = getNotificationTone()): void {
  if (tone === "none") return;

  if (tone === "custom") {
    const dataUrl = getCustomSound();
    if (!dataUrl) return;
    try {
      const audio = new Audio(dataUrl);
      void audio.play().catch(() => {});
    } catch {
      // Ignore — playback failures (autoplay policy, corrupt data) aren't worth surfacing.
    }
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    if (tone === "chime") {
      playTone(ctx, 880, now, 0.18); // A5
      playTone(ctx, 1318.5, now + 0.09, 0.22); // E6
    } else {
      playTone(ctx, 660, now, 0.15);
    }
  } catch {
    // Autoplay-blocked or otherwise unavailable — ignore.
  }
}
