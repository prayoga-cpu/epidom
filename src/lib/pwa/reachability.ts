/**
 * Reachability: the only trustworthy answer to "can we actually talk to the
 * server right now?".
 *
 * `navigator.onLine` and the window `online`/`offline` events report the
 * network *interface*, not the network. They stay `true` behind a café
 * captive portal, on a router whose upstream is down, and on in-store wifi
 * that has silently stopped forwarding packets — and they never fire at all
 * when a flaky link quietly recovers while the radio was never marked down.
 * Those are precisely the conditions this app has to survive, so anything
 * that needs a real answer has to pay for a round-trip to our own origin.
 *
 * This module owns exactly one probe loop for the whole tab, no matter how
 * many components subscribe. Every hook instance sharing a single timer is
 * not just tidy: one timer per mounted consumer would multiply the request
 * rate by the number of components on screen.
 *
 * ── Why the cadence is asymmetric ────────────────────────────────────────
 * The naive reading of "check connectivity every second" is a 1s timer at
 * all times. That is the one version that cannot ship: this project is on
 * Vercel's Hobby plan, and a 1s poll is ~2.6M requests/month per always-open
 * tab — a single cashier tablet blows the whole account's budget on its own.
 *
 * The fix comes from noticing the two states have opposite economics:
 *
 *  - ONLINE: a probe costs a real network round-trip, and there is nothing
 *    to do with the answer — no queued orders to flush, no stale mirror to
 *    refresh. Polling fast here buys nothing and costs everything. So it
 *    heartbeats slowly, and leans on the `offline` event (trustworthy in the
 *    negative direction) plus `reportNetworkFailure()` for instant reaction.
 *  - OFFLINE: a probe is exactly what the user is waiting on, and it costs
 *    nothing — the request fails at the local network layer and never leaves
 *    the device, so it never reaches Vercel and never bills. So it polls at
 *    the full 1s.
 *
 * The result is the behaviour that was actually asked for — reconnect is
 * noticed within about a second — while the expensive state is the quiet one.
 */

/**
 * Probe target: a static file, deliberately NOT an API route.
 *
 * `/api/health` was the obvious target (and still exists, answering HEAD with
 * a body-less 204 for uptime monitors), but every hit on it is a Vercel
 * Function invocation. A file in `public/` is served straight off the CDN
 * instead — it does not invoke a function at all, which is what makes probing
 * affordable on Hobby.
 *
 * It is reachable with no session: `src/proxy.ts`'s matcher already excludes
 * `.txt` from the auth redirect, and `public/sw.js`'s cache allowlist does not
 * cover it, so no service worker can answer on the network's behalf and
 * fake a healthy reply.
 */
export const REACHABILITY_PATH = "/reachability.txt";

/**
 * Exact body of the probe target. The check is content equality, not a 2xx
 * status: a captive portal answers *every* request with its own 200 login
 * page, which would otherwise read as "server is up" and let the app pull-sync
 * against a hotel wifi splash screen. Only our own file contains this token.
 */
export const REACHABILITY_TOKEN = "epidom-reachable-v1";

/**
 * Header `/api/health` stamps on its HEAD reply. No longer used by the probe
 * (see REACHABILITY_PATH) but kept as the contract for that endpoint, which
 * external uptime checks can still use to confirm they reached the real app
 * rather than an intermediary.
 */
export const REACHABILITY_HEADER = "x-epidom-reachable";

/**
 * Heartbeat while the server is answering. Slow on purpose — see the
 * asymmetric-cadence note above. This only has to catch the one failure mode
 * the `offline` event misses: a link that stays "up" but stops forwarding
 * (captive portal, dead upstream).
 */
export const ONLINE_PROBE_INTERVAL_MS = 30_000;

/**
 * Cadence while offline — the "every second" the feature is really about.
 * Free to run: these requests fail locally without touching the network.
 */
export const OFFLINE_PROBE_INTERVAL_MS = 1_000;

/**
 * Ceiling the offline backoff climbs to. A tablet left offline in a stockroom
 * overnight shouldn't spend the night waking the radio once a second, so the
 * fast cadence decays once a drop-out stops looking momentary.
 */
export const MAX_OFFLINE_PROBE_INTERVAL_MS = 30_000;

/**
 * How many consecutive failures stay at the full 1s cadence before backing
 * off. 120 failures ≈ the first two minutes offline, which covers the cases
 * a human is actually standing there waiting through (walking out of wifi
 * range, a router reboot, a flaky link flapping).
 */
export const FAST_OFFLINE_PROBE_ATTEMPTS = 120;

/**
 * Per-probe deadline. Long enough that a slow-but-alive 3G link still counts
 * as reachable, short enough that it can't outlive the 1s cadence by much —
 * a hung request must not stall the loop for a browser-default 30s+.
 */
export const PROBE_TIMEOUT_MS = 4_000;

export interface ReachabilitySnapshot {
  /** Confirmed by a real round-trip, not by `navigator.onLine`. */
  isOnline: boolean;
  /** When the last probe completed — `null` until the first one lands. */
  lastCheckedAt: Date | null;
  /** Consecutive failed probes. Drives the backoff schedule. */
  consecutiveFailures: number;
}

type Listener = (snapshot: ReachabilitySnapshot) => void;

/**
 * Starts optimistic. Seeding `isOnline: false` would make the very first
 * successful probe look like an offline -> online transition and fire a full
 * cache refetch on every single app load, which is exactly the expensive
 * work the transition trigger exists to avoid.
 */
let snapshot: ReachabilitySnapshot = {
  isOnline: true,
  lastCheckedAt: null,
  consecutiveFailures: 0,
};

/**
 * Frozen, never-changing snapshot for `useSyncExternalStore`'s server render.
 * It must be referentially stable across calls or React throws.
 */
const SERVER_SNAPSHOT: ReachabilitySnapshot = Object.freeze({
  isOnline: true,
  lastCheckedAt: null,
  consecutiveFailures: 0,
});

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<boolean> | null = null;

/**
 * `AbortSignal.timeout` is the tidy form, but it only landed in Safari 16.
 * iPad is this app's primary cashier device and plenty of them are still on
 * 15.x, so fall back to a hand-rolled controller there rather than throwing
 * a TypeError on every probe.
 */
function abortAfter(ms: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), cleanup: () => {} };
  }
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cleanup: () => clearTimeout(handle) };
}

/**
 * One round-trip. Resolves `true` only when our own server answered.
 *
 * Deliberately never throws: callers treat every failure mode (timeout, DNS,
 * TLS, abort, CORS, 5xx) as the same fact — "not reachable right now".
 */
export async function probeReachability(timeoutMs: number = PROBE_TIMEOUT_MS): Promise<boolean> {
  if (typeof window === "undefined" || typeof fetch !== "function") return false;

  // `navigator.onLine` lies when it says `true`, but it is trustworthy when
  // it says `false` — the browser knows for certain there is no interface.
  // Skip the doomed round-trip in that one direction only.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  const { signal, cleanup } = abortAfter(timeoutMs);
  try {
    // No cache-busting query param. `cache: "no-store"` already forces a real
    // network request, and appending `?probe=<now>` would make every single
    // probe a unique URL — a guaranteed CDN miss that drags the origin into
    // a request that should never leave the edge.
    const response = await fetch(REACHABILITY_PATH, {
      cache: "no-store",
      // No cookies: the probe needs no identity, and shipping the session
      // cookie on a static asset request is pure waste.
      credentials: "omit",
      signal,
    });
    if (!response.ok) return false;

    // Content equality, not status — see REACHABILITY_TOKEN for why a 200 is
    // not evidence of anything when a captive portal is in the path.
    const body = await response.text();
    return body.trim() === REACHABILITY_TOKEN;
  } catch {
    return false;
  } finally {
    cleanup();
  }
}

/**
 * Cadence schedule. `consecutiveFailures === 0` means the last probe
 * succeeded, so this is the slow online heartbeat; anything above zero is the
 * offline path, which runs at the full 1s for the first couple of minutes and
 * then decays toward the 30s ceiling.
 *
 * The decay is deliberately not exponential-from-the-first-failure: a link
 * that flaps for three seconds should be caught at 1s resolution, not pushed
 * straight into a 4s wait because it missed twice.
 */
export function nextProbeDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return ONLINE_PROBE_INTERVAL_MS;
  if (consecutiveFailures <= FAST_OFFLINE_PROBE_ATTEMPTS) return OFFLINE_PROBE_INTERVAL_MS;
  const decayStep = consecutiveFailures - FAST_OFFLINE_PROBE_ATTEMPTS;
  const backoff = OFFLINE_PROBE_INTERVAL_MS * 2 ** (decayStep - 1);
  return Math.min(backoff, MAX_OFFLINE_PROBE_INTERVAL_MS);
}

/**
 * Tell the probe loop that a real application request just failed in a way
 * that looks like a connectivity problem (a thrown fetch, not a 4xx/5xx the
 * server actually produced).
 *
 * This is what keeps the slow online heartbeat honest. Rather than polling
 * fast on the off-chance the network died, the app's own traffic — which is
 * already hitting the server constantly — acts as the detector, and this
 * function converts that signal into an immediate probe. Cheap, and far more
 * responsive than any timer, because a user who is actively working generates
 * the evidence themselves.
 */
export function reportNetworkFailure(): void {
  if (snapshot.isOnline) kick();
}

function publish(patch: Partial<ReachabilitySnapshot>): void {
  const next: ReachabilitySnapshot = { ...snapshot, ...patch };
  if (
    next.isOnline === snapshot.isOnline &&
    next.lastCheckedAt === snapshot.lastCheckedAt &&
    next.consecutiveFailures === snapshot.consecutiveFailures
  ) {
    return;
  }
  snapshot = next;
  // Copy first: a listener is free to unsubscribe from inside its own
  // callback (a recovery handler that only wants to fire once, say), and
  // mutating the Set mid-iteration would skip the next listener in line.
  for (const listener of [...listeners]) listener(snapshot);
}

/**
 * Runs a probe now and folds the result into the shared snapshot.
 * Concurrent callers share the in-flight request rather than stacking up
 * duplicate round-trips — the loop, the `online` event and an explicit
 * user-triggered sync can all land in the same tick.
 */
export function checkReachabilityNow(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = probeReachability()
    .then((ok) => {
      publish({
        isOnline: ok,
        lastCheckedAt: new Date(),
        consecutiveFailures: ok ? 0 : snapshot.consecutiveFailures + 1,
      });
      return ok;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

async function runProbe(): Promise<void> {
  timer = null;
  if (listeners.size === 0) return;

  // Paused while backgrounded. A POS tablet sitting on a locked home screen
  // has nothing to sync into and no user to inform, and mobile browsers
  // throttle background timers unpredictably anyway. The `visibilitychange`
  // handler restarts the loop with an immediate probe on the way back, so
  // the app is never more than one round-trip stale when it's looked at.
  if (isHidden()) return;

  const ok = await checkReachabilityNow();
  if (listeners.size === 0 || isHidden()) return;
  scheduleNext(nextProbeDelayMs(ok ? 0 : snapshot.consecutiveFailures));
}

function scheduleNext(delayMs: number): void {
  clearTimer();
  if (listeners.size === 0) return;
  timer = setTimeout(() => void runProbe(), delayMs);
}

/** Cancel whatever is pending and probe immediately. */
function kick(): void {
  clearTimer();
  void runProbe();
}

function handleOnline(): void {
  // Accelerant, not evidence. The interface came back, which is a good
  // reason to look right now — but the answer still comes from the probe.
  kick();
}

function handleOffline(): void {
  // The negative direction is believable, so short-circuit to offline
  // instead of waiting up to a full interval for a probe to confirm it.
  // `consecutiveFailures` is left alone on purpose — it counts failed
  // probes, and keeping it honest means a drop-out that lasts two seconds
  // is still polled at the fast cadence rather than jumping into backoff.
  publish({ isOnline: false });
  // Floor of 1 so this schedules the *offline* cadence. Passing a genuine 0
  // (the interface dropped while the last probe was still a success) would
  // read as "healthy" and book the 30s online heartbeat instead — leaving the
  // app up to half a minute behind a reconnect it is supposed to catch in one.
  scheduleNext(nextProbeDelayMs(Math.max(1, snapshot.consecutiveFailures)));
}

function handleVisibilityChange(): void {
  if (isHidden()) {
    clearTimer();
    return;
  }
  kick();
}

function start(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    publish({ isOnline: false });
  }
  kick();
}

function stop(): void {
  clearTimer();
  if (typeof window === "undefined") return;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }
}

/**
 * Subscribe to reachability changes. The shared probe loop starts on the
 * first subscriber and stops on the last, so nothing polls in a tab that
 * has no interested consumer left mounted.
 */
export function subscribeToReachability(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Current snapshot. Referentially stable until something actually changes. */
export function getReachabilitySnapshot(): ReachabilitySnapshot {
  return snapshot;
}

/** Server-render snapshot for `useSyncExternalStore`. */
export function getServerReachabilitySnapshot(): ReachabilitySnapshot {
  return SERVER_SNAPSHOT;
}
