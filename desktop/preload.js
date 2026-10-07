"use strict";
// The one thing the web app learns from the shell: that it is running inside
// it. Epidom treats `window.epidomDesktop` like an installed PWA (Offline Mode
// always on, no Install button) — see src/lib/pwa/desktop-shell.ts. Nothing
// else crosses this bridge: no Node, no IPC.
const { contextBridge } = require("electron");

const versionArg = process.argv.find((a) => a.startsWith("--epidom-version="));

contextBridge.exposeInMainWorld(
  "epidomDesktop",
  Object.freeze({
    isDesktopApp: true,
    version: versionArg ? versionArg.slice("--epidom-version=".length) : "",
    platform: process.platform,
  })
);
