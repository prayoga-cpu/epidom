/**
 * The Epidom desktop app (desktop/, Electron) loads this same web app in its own
 * window and exposes `window.epidomDesktop` from its preload script.
 *
 * It counts as "installed" for every purpose the PWA's standalone check serves:
 * Offline Mode is mandatory there, the Offline & Sync panel shows instead of an
 * Install button (there is nothing left to install), and the window has no
 * browser chrome. `display-mode: standalone` never matches inside Electron, so
 * without this the desktop app would offer to install itself.
 */
export interface EpidomDesktopBridge {
  readonly isDesktopApp: true;
  readonly version: string;
  readonly platform: string;
}

declare global {
  interface Window {
    epidomDesktop?: EpidomDesktopBridge;
  }
}

export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && window.epidomDesktop?.isDesktopApp === true;
}
