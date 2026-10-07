# Epidom POS for Windows, macOS and Linux

A small Electron app that opens the hosted Epidom web app (https://epidom.fr) in
its own window. It is a **thin shell**: it doesn't bundle Epidom's screens. Every
web deploy reaches it immediately, and the shell itself rarely needs a new
release.

What it adds over a browser tab:

- a real installer (`.exe`, `.dmg`, `.AppImage`) and a desktop icon;
- its **own storage profile**, so clearing the browser doesn't touch the till's
  offline copy or its unsynced sales;
- **Open at login** and **Kiosk mode** (full-screen, no way out to the desktop),
  both in the menu and remembered;
- reopens on the last screen it was on;
- a touch-friendly picker for **Bluetooth receipt printers** (Electron has no
  built-in one);
- the web app sees `window.epidomDesktop` and treats the window like an
  installed app: Offline Mode is always on, and Offline & Sync replaces the
  Install button.

Offline itself is the web app's own (`docs/OFFLINE_POS.md`): the service worker
keeps the screens on the machine, Offline Mode mirrors the menu, orders, staff
and stock, and sales made without a connection wait on the machine and sync on
reconnect. **The first launch needs internet once**, to download the app and
sign in. Until then the shell shows a "connect once" page that retries by itself.

## Run it in development

```bash
cd desktop
npm install          # npm, not pnpm: this folder is not part of the pnpm workspace
npm start            # opens https://epidom.fr
EPIDOM_APP_URL=https://dev.epidom.fr npm start   # another deployment
EPIDOM_DEBUG=1 npm start                          # adds DevTools to the View menu
```

`EPIDOM_APP_URL=http://localhost:3000` works for screens, but offline doesn't:
the service worker is switched off on localhost on purpose.

> Running from VS Code's terminal (or any tool that sets `ELECTRON_RUN_AS_NODE`)
> starts Electron as plain Node and fails with `Cannot read properties of
undefined (reading 'on')`. Use `env -u ELECTRON_RUN_AS_NODE npm start`.

A deployed copy can be pointed elsewhere without rebuilding: put
`{ "appUrl": "https://dev.epidom.fr" }` in `config.json` inside the app's data
folder (`%APPDATA%\epidom-desktop` on Windows,
`~/Library/Application Support/epidom-desktop` on macOS).

`npm run smoke` loads the site, saves a screenshot to `smoke.png`, prints the
final URL and title, and quits. It's a quick check that a build boots.

## Build the installers

```bash
npm run dist:win     # NSIS installer → dist/Epidom POS Setup <version>.exe
npm run dist:mac     # dist/*.dmg and *.zip
npm run dist:linux   # dist/*.AppImage
npm run pack         # unpacked app for this machine, for a quick look
```

Build each OS on that OS (or in CI). Cross-building Windows from macOS needs
Wine for the installer step.

### Code signing

Unsigned builds work, but Windows SmartScreen and macOS Gatekeeper warn about
them ("unknown publisher", "can't be opened"). For builds you hand to clients,
sign them. electron-builder reads these environment variables:

| OS      | Variables                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows | `WIN_CSC_LINK` (path or base64 of the `.pfx`), `WIN_CSC_KEY_PASSWORD`                                                                            |
| macOS   | `CSC_LINK`, `CSC_KEY_PASSWORD` (Developer ID Application cert), plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization |

### Publishing

Host the installers anywhere downloadable, for example GitHub Releases or Vercel
Blob, and link them from the website. Because the shell loads the live site,
existing installs never need updating for normal Epidom releases. Ship a new
shell only when this folder changes.

## Bluetooth printers

The web app pairs printers through Web Bluetooth (`src/lib/pwa/printer-connection.ts`).
Electron leaves the device chooser to the app, so this shell opens its own
picker (`bluetooth-picker.html`): it lists printers as they're found, with large
rows for touch screens. On Windows and Linux, a printer that asks for a PIN
during pairing is cancelled (no pairing handler is set); pair those once in the
OS Bluetooth settings first.

Electron can't keep a Bluetooth permission across restarts: its device-permission
API covers USB, serial and HID only. So, exactly as in Chrome, printers are
picked again after the app restarts.

## Files

| File                                         | What it is                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `main.js`                                    | Window, navigation rules, permissions, menu, settings, Bluetooth picker, smoke test |
| `preload.js`                                 | Exposes `window.epidomDesktop` (nothing else)                                       |
| `bluetooth-picker.html`, `picker-preload.js` | The printer chooser                                                                 |
| `offline.html`                               | "Internet needed once" page for a first launch with no connection                   |
| `build/icon.png`                             | App icon (electron-builder derives `.ico` / `.icns` from it)                        |

Security: context isolation, sandboxed renderers, no Node in the page. Only the
app's own origin and Google sign-in open inside the window. Other links open in
the system browser. Permissions are limited to what Epidom uses: notifications,
camera, location, persistent storage, clipboard write and fullscreen.
