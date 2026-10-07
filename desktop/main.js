"use strict";
const {
  app, BrowserWindow, Menu, shell, session, ipcMain, dialog, net,
} = require("electron");
const fs = require("fs");
const path = require("path");

const DEFAULT_URL = "https://epidom.fr";
const START_PATH = "/go/dashboard";
const SMOKE_ARG = [...process.argv].reverse().find((a) => a.startsWith("--smoke-test="));
const SMOKE_PNG = SMOKE_ARG ? SMOKE_ARG.slice("--smoke-test=".length) : null;
const DEBUG = process.env.EPIDOM_DEBUG === "1";

// ---------- settings (atomic JSON in userData) ----------
let settings = {};
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(settingsFile(), "utf8")) || {}; }
  catch { settings = {}; }
}
function saveSettings(patch) {
  Object.assign(settings, patch);
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    const tmp = settingsFile() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
    fs.renameSync(tmp, settingsFile());
  } catch (e) { console.error("settings save failed", e); }
}

// ---------- app URL ----------
function readConfigUrl() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "config.json"), "utf8"));
    if (c && typeof c.appUrl === "string") return c.appUrl;
  } catch {}
  return null;
}
let APP_ORIGIN = "";
function appBase() {
  const raw = process.env.EPIDOM_APP_URL || readConfigUrl() || DEFAULT_URL;
  try { return new URL(raw).origin; } catch { return DEFAULT_URL; }
}

const isAppUrl = (u) => { try { return new URL(u).origin === APP_ORIGIN; } catch { return false; } };
function isGoogleAuth(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && (x.hostname === "accounts.google.com" || x.hostname.endsWith(".google.com"));
  } catch { return false; }
}
const allowedInWindow = (u) => isAppUrl(u) || isGoogleAuth(u);

function initialUrl() {
  const last = settings.lastUrl;
  if (last && isAppUrl(last)) {
    const p = new URL(last).pathname;
    if (!p.startsWith("/api/")) return last;
  }
  return APP_ORIGIN + START_PATH;
}

// ---------- single instance ----------
// One till window per machine: a second launch focuses the first. (Two windows
// would flush the same offline sale queue side by side.)
let win = null;
const GOT_LOCK = !!SMOKE_PNG || app.requestSingleInstanceLock();
if (!GOT_LOCK) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

// ---------- window ----------
function openExternal(u) {
  try {
    const p = new URL(u).protocol;
    if (["http:", "https:", "mailto:", "tel:", "whatsapp:"].includes(p)) shell.openExternal(u);
  } catch {}
}

function retryLoad() {
  if (win) win.loadURL(initialUrl());
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, 
    kiosk: !!settings.kiosk && !SMOKE_PNG,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: [`--epidom-version=${app.getVersion()}`],
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
    },
  });
  const wc = win.webContents;
  wc.setZoomFactor(typeof settings.zoom === "number" ? settings.zoom : 1);

  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("epidom-retry:")) { retryLoad(); return { action: "deny" }; }
    if (allowedInWindow(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (url.startsWith("epidom-retry:")) { e.preventDefault(); retryLoad(); return; }
    if (url.startsWith("file:")) return; // bundled offline page only (nothing else links to file:)
    if (!allowedInWindow(url)) { e.preventDefault(); openExternal(url); }
  });
  const remember = (_e, url) => {
    if (isAppUrl(url)) saveSettings({ lastUrl: url });
  };
  wc.on("did-navigate", remember);
  wc.on("did-navigate-in-page", remember);

  // Only reachable before the web app's service worker is installed — the very
  // first launch, or after its storage was cleared. Once it is, an offline
  // launch is served from the device and never fails here.
  let retryTimer = null;
  const stopRetrying = () => { if (retryTimer) { clearInterval(retryTimer); retryTimer = null; } };
  wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    if (SMOKE_PNG) { console.error(`LOAD FAILED ${code} ${desc} ${url}`); finishSmoke(1); return; }
    if (url.startsWith("file:")) return;
    win.loadFile(path.join(__dirname, "offline.html"));
    // Come back by itself once there is a network, rather than waiting for
    // someone to find the Retry button.
    stopRetrying();
    retryTimer = setInterval(() => {
      if (net.isOnline()) { stopRetrying(); retryLoad(); }
    }, 10000);
  });
  wc.on("did-finish-load", () => {
    if (isAppUrl(wc.getURL())) stopRetrying();
  });

  wc.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    handleBluetooth(devices, callback);
  });

  win.on("closed", () => { win = null; });
  win.loadURL(initialUrl());
}

// ---------- Bluetooth chooser ----------
let btState = null; // { callback, devices: Map, picker, timer, done }
function finishBt(deviceId) {
  const s = btState;
  if (!s || s.done) return;
  s.done = true;
  btState = null;
  clearTimeout(s.timer);
  try { s.callback(deviceId || ""); } catch (e) { console.error(e); }
  if (s.picker && !s.picker.isDestroyed()) s.picker.destroy();
}
function pushDevices() {
  const p = btState && btState.picker;
  if (p && !p.isDestroyed() && p.webContents && !p.webContents.isLoading()) {
    p.webContents.send("picker:devices", [...btState.devices.values()]);
  }
}
function handleBluetooth(devices, callback) {
  if (!btState) {
    const picker = new BrowserWindow({
      parent: win, modal: true, width: 420, height: 520, resizable: false,
      minimizable: false, maximizable: false, title: "Select a printer", autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "picker-preload.js"),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
      },
    });
    btState = { callback, devices: new Map(), picker, done: false, timer: null };
    const state = btState;
    picker.setMenuBarVisibility(false);
    picker.loadFile(path.join(__dirname, "bluetooth-picker.html"));
    picker.webContents.on("did-finish-load", pushDevices);
    // closing the picker window == cancel
    picker.on("closed", () => { if (btState === state) finishBt(""); });
    state.timer = setTimeout(() => {
      if (btState !== state) return;
      if (picker && !picker.isDestroyed()) {
        picker.webContents.send("picker:scan-done");
        // keep listening for late devices; the picker stays open until user acts
      }
    }, 4000);
  } else {
    // Chromium may re-issue the request with a fresh callback; use the latest one.
    btState.callback = callback;
  }
  for (const d of devices) btState.devices.set(d.deviceId, d);
  pushDevices();
}
ipcMain.on("picker:choose", (e, deviceId) => {
  if (btState && btState.picker && e.sender === btState.picker.webContents) {
    finishBt(typeof deviceId === "string" ? deviceId : "");
  }
});

// ---------- permissions ----------
// What the web app actually uses: push notifications, the camera (staff selfie
// clock-in), location (clock-in), durable storage (Offline Mode asks for it),
// copy buttons and fullscreen. Everything else is denied.
const ALLOWED_PERMS = new Set([
  "notifications", "media", "geolocation", "persistent-storage",
  "clipboard-sanitized-write", "fullscreen",
]);
function setupPermissions(ses) {
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    const url = (details && details.requestingUrl) || (wc && wc.getURL()) || "";
    cb(ALLOWED_PERMS.has(permission) && isAppUrl(url));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    ALLOWED_PERMS.has(permission) && isAppUrl(requestingOrigin));
}

// ---------- menu ----------
function setZoom(f) {
  const z = Math.min(3, Math.max(0.5, f));
  if (win) win.webContents.setZoomFactor(z);
  saveSettings({ zoom: z });
}
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win && win.webContents.reload() },
        { label: "Toggle Full Screen", accelerator: isMac ? "Ctrl+Cmd+F" : "F11",
          click: () => win && win.setFullScreen(!win.isFullScreen()) },
        { label: "Kiosk Mode", type: "checkbox", checked: !!settings.kiosk,
          click: (item) => { saveSettings({ kiosk: item.checked }); if (win) win.setKiosk(item.checked); } },
        { type: "separator" },
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", click: () => setZoom((win ? win.webContents.getZoomFactor() : 1) + 0.1) },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => setZoom((win ? win.webContents.getZoomFactor() : 1) - 0.1) },
        { label: "Reset Zoom", accelerator: "CmdOrCtrl+0", click: () => setZoom(1) },
        ...(DEBUG ? [{ type: "separator" }, { role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "App",
      submenu: [
        { label: "Open at Login", type: "checkbox", checked: !!settings.openAtLogin,
          click: (item) => { saveSettings({ openAtLogin: item.checked }); applyLoginItem(); } },
        { label: "Open in Browser", click: () => { if (win) openExternal(isAppUrl(win.webContents.getURL()) ? win.webContents.getURL() : APP_ORIGIN + START_PATH); } },
        { type: "separator" },
        { label: "About Epidom POS", click: () => dialog.showMessageBox(win, {
            type: "info", title: "About Epidom POS", message: "Epidom POS",
            detail: `Desktop shell ${app.getVersion()}\nElectron ${process.versions.electron}\nLoads: ${APP_ORIGIN}` }) },
        ...(isMac ? [] : [{ role: "quit" }]),
      ],
    },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function applyLoginItem() {
  try { app.setLoginItemSettings({ openAtLogin: !!settings.openAtLogin }); } catch {}
}

// ---------- smoke test ----------
let smokeDone = false;
function finishSmoke(code) {
  if (smokeDone) return;
  smokeDone = true;
  app.exit(code);
}
function runSmoke() {
  setTimeout(() => { console.error("SMOKE TIMEOUT"); finishSmoke(2); }, 45000);
  // The start page is a launcher that redirects (to the store, or to sign-in),
  // so give it time to land before capturing.
  win.webContents.once("did-finish-load", () => {
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(SMOKE_PNG, img.toPNG());
        console.log("URL: " + win.webContents.getURL());
        console.log("TITLE: " + win.webContents.getTitle());
        finishSmoke(0);
      } catch (e) { console.error("capture failed", e); finishSmoke(3); }
    }, 8000);
  });
}

// ---------- boot ----------
if (GOT_LOCK) {
  app.whenReady().then(() => {
    loadSettings();
    APP_ORIGIN = appBase();
    const ses = session.defaultSession;
    ses.setUserAgent(`${ses.getUserAgent()} EpidomDesktop/${app.getVersion()}`);
    setupPermissions(ses);
    buildMenu();
    if (!SMOKE_PNG) applyLoginItem();
    createWindow();
    if (SMOKE_PNG) runSmoke();
    app.on("activate", () => { if (!win) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin" || SMOKE_PNG) app.quit(); });
}
