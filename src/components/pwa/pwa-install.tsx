"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { useI18n } from "@/components/lang/i18n-provider";

/**
 * The single app-wide `<pwa-install>` instance.
 *
 * Every install affordance in the app is now just a button that force-opens
 * this element's own dialog — the library owns the whole install experience
 * (one-tap install where `beforeinstallprompt` is available, illustrated
 * per-platform steps everywhere else, including iOS Safari where no
 * programmatic install exists). Nothing hand-rolls platform detection or
 * install steps anymore.
 *
 * It is a module-level singleton rather than one element per button because
 * `isUnderStandaloneMode` and the captured `beforeinstallprompt` event are
 * per-document facts, not per-button ones: rendering three copies (topbar,
 * sidebar, mobile drawer) meant three custom-element upgrades and three
 * chances for the one-shot install event to land on the wrong instance.
 */
let installElement: PWAInstallElement | null = null;

/**
 * `null` means "not determined yet", and that third state is load-bearing now
 * that Install and Offline & Sync are mutually exclusive: exactly one of them
 * belongs on screen, decided entirely by this value. A boolean default would
 * have to guess, and either guess flashes the wrong icon for a frame on every
 * page load — an Install button on an installed launch, or the Offline & Sync
 * cloud in an ordinary browser tab.
 *
 * Consumers that only want a boolean still get the old pessimistic reading
 * (`?? true`, i.e. hide Install); the ones that render either icon check
 * `isInstallStateKnown` and render neither until it resolves. That window is a
 * single commit — `subscribe` detects synchronously on first mount.
 */
let isStandaloneSnapshot: boolean | null = null;

const subscribers = new Set<() => void>();

/**
 * What `isUnderStandaloneMode` checks, restated — used only as a fallback when
 * no `<PwaInstall>` element is mounted above the consumer.
 *
 * Without it, a subtree that renders an install button but sits outside the
 * layout holding the element would keep the pessimistic `true` default
 * forever, i.e. the button would silently never appear. Failing to a media
 * query is far better than failing to invisible.
 */
function detectStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari, which implements none of the above for home-screen launches.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function subscribe(onStoreChange: () => void) {
  subscribers.add(onStoreChange);

  // The element is the source of truth when it exists; the media query only
  // covers the window before it upgrades, and the case where it never mounts.
  //
  // The `=== null` arm matters as much as the `!installElement` one: a
  // consumer mounting *after* PwaInstall's effect but *before* its dynamic
  // import resolves would otherwise sit on the unknown state for as long as
  // that chunk takes to load, showing neither Install nor Offline & Sync. This
  // guarantees the state is known from the first subscribe onward.
  if (!installElement || isStandaloneSnapshot === null) setStandalone(detectStandalone());

  return () => {
    subscribers.delete(onStoreChange);
  };
}

function getSnapshot() {
  return isStandaloneSnapshot;
}

/**
 * SSR cannot know the display mode — there is no `window.matchMedia` — so it
 * reports the unknown state rather than guessing. Hydration then renders
 * exactly what the server did (neither icon) and resolves on the next commit,
 * instead of painting one icon and swapping it.
 */
function getServerSnapshot(): boolean | null {
  return null;
}

function setStandalone(next: boolean) {
  if (next === isStandaloneSnapshot) return;
  isStandaloneSnapshot = next;
  subscribers.forEach((fn) => fn());
}

/**
 * Loading the package is what defines the `pwa-install` custom element, so
 * anything touching the element's properties or methods has to await this
 * first — the tag renders as an inert unknown element until then.
 *
 * Deliberately a dynamic import, not a static top-level one: the package's
 * module body calls `customElements.define()` and reaches for `window` at
 * import time, so a static import pulls a browser-only bundle into the server
 * render path of every route that transitively touches it.
 */
let definitionPromise: Promise<void> | null = null;

function whenDefined() {
  definitionPromise ??= import("@khmyznikov/pwa-install")
    .then(() => customElements.whenDefined("pwa-install"))
    .then(() => undefined)
    .catch(() => {
      // Don't cache the failure. A chunk that 404s because the tab outlived a
      // deploy can load fine on the next attempt, and the next attempt is the
      // user pressing Install again.
      definitionPromise = null;
    });
  return definitionPromise;
}

/**
 * Force-open the installer dialog, from anywhere, regardless of what the
 * browser thinks it wants to do.
 *
 * `showDialog(true)` is the library's *forced* variant: it opens even when
 * there is no `beforeinstallprompt` to fire (iOS Safari, Firefox), and it
 * ignores a previously stored dismissal. That is the point — these dialogs
 * only ever open because someone deliberately tapped Install, so silently
 * doing nothing would read as a broken button.
 */
export function showPwaInstallDialog() {
  void whenDefined().then(() => installElement?.showDialog(true));
}

/**
 * `isStandalone` — already running as an installed app. Sourced from the
 * library's own `isUnderStandaloneMode` so there is exactly one answer to that
 * question in the app.
 *
 * `isInstallStateKnown` distinguishes "definitely a browser tab" from "haven't
 * found out yet". Anything that renders one UI for installed and a *different*
 * one for not-installed must gate on it, or it will show the wrong one for a
 * frame; anything that only hides itself when installed can ignore it.
 */
export function usePwaInstaller() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isStandalone: snapshot ?? true,
    isInstallStateKnown: snapshot !== null,
    showInstallDialog: showPwaInstallDialog,
  };
}

export function PwaInstall() {
  const ref = useRef<PWAInstallElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    installElement = ref.current;
    let cancelled = false;

    // `?? detectStandalone()` rather than `!!`: on a non-upgraded element (the
    // import failed) `isUnderStandaloneMode` is undefined, and coercing that to
    // false would show an install button whose dialog can never open.
    const check = () => {
      if (!cancelled) setStandalone(installElement?.isUnderStandaloneMode ?? detectStandalone());
    };

    // `isUnderStandaloneMode` is only populated once the custom element has
    // upgraded, and the definition arrives asynchronously — so wait on the
    // definition rather than guessing at a timeout.
    void whenDefined().then(check);

    // Installing through the browser's own menu while this tab is backgrounded
    // fires nothing here, so re-check on the way back in.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("appinstalled", check);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("appinstalled", check);
      installElement = null;
    };
  }, []);

  useEffect(() => {
    // `beforeinstallprompt` fires once per page load, often before this element
    // has upgraded. PwaProvider (mounted at the root, before any of this)
    // captures it on `window.__pwaPromptEvent`; hand that stash to the library
    // via `externalPromptEvent` — a property set imperatively, not a JSX
    // attribute — so a late upgrade still gets a one-tap install instead of
    // falling back to manual instructions.
    const feed = () => {
      const stashed = window.__pwaPromptEvent;
      if (!stashed) return;
      void whenDefined().then(() => {
        if (installElement) installElement.externalPromptEvent = stashed;
      });
    };

    feed();
    window.addEventListener("pwa-prompt-available", feed);
    return () => window.removeEventListener("pwa-prompt-available", feed);
  }, []);

  // NO `className="hidden"` here, and this is load-bearing. The dialog lives in
  // this element's own shadow root — the library never portals it to
  // document.body — so `display: none` on the host hid the very thing
  // showDialog() was opening, and the button looked dead. The element needs no
  // hiding of ours: its `.install-dialog` ships as
  // `position: fixed; opacity: 0; visibility: hidden`, so the host occupies no
  // space until the library makes it `.available`.
  //
  // `manual-chrome` / `manual-apple` stop the library from popping its dialog
  // on its own the moment the browser signals installability — every open is an
  // explicit showPwaInstallDialog() call from a button the user pressed.
  //
  // `use-local-storage` is deliberately NOT set: it persists a "don't ask
  // again" dismissal, which would mean a user who once closed this dialog could
  // never reopen it from the install button again.
  //
  // No `name` / `description` / `icon` either — the library's README is explicit
  // ("Make a good manifest file and don't use name/descr/icon params"), and
  // src/app/manifest.ts is that manifest. `install-description` is the one
  // string it can't read from there: the call-to-action line above the button.
  return (
    <pwa-install
      ref={ref}
      manifest-url="/manifest.webmanifest"
      install-description={t("common.pwa.installIntro")}
      manual-chrome="true"
      manual-apple="true"
    />
  );
}
