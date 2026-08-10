/**
 * In-app notification sound for the NotificationBell (new order/reservation
 * items arriving while the tab is open). Synthesized via Web Audio — no audio
 * asset to host/upload, and it means there's nothing to keep in sync if a
 * tone is added later. Mirrors last-seen-version.ts's SSR-guarded, try/catch
 * localStorage pattern.
 *
 * Deliberately does NOT cover the old OS-level web-push notifications sound
 * (src/lib/push/) or MagicBell's push/email/SMS channels — neither the Web
 * Notifications API nor MagicBell's own delivery channels support a custom
 * sound; that's a platform limitation on both, not something this app can
 * override. This only plays while the tab is actually open and focused on it.
 */

export type NotificationTone = "chime" | "ping" | "none";

const TONE_KEY = "epidom:notificationTone";
const DEFAULT_TONE: NotificationTone = "chime";

export function getNotificationTone(): NotificationTone {
  if (typeof window === "undefined") return DEFAULT_TONE;
  try {
    const raw = localStorage.getItem(TONE_KEY);
    return raw === "chime" || raw === "ping" || raw === "none" ? raw : DEFAULT_TONE;
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

/** Plays the selected tone. No-ops silently on "none", missing AudioContext,
 *  or a blocked/suspended context (autoplay policy) — a sound is a nice-to-have,
 *  never worth surfacing an error for. */
export function playNotificationSound(tone: NotificationTone = getNotificationTone()): void {
  if (tone === "none") return;
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
