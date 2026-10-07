"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pickerApi", {
  onDevices: (cb) => ipcRenderer.on("picker:devices", (_e, d) => cb(d)),
  onDone: (cb) => ipcRenderer.on("picker:scan-done", () => cb()),
  choose: (deviceId) => ipcRenderer.send("picker:choose", deviceId),
  cancel: () => ipcRenderer.send("picker:choose", ""),
});
