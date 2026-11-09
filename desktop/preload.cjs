/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Least-privilege preload bridge. No Node.js objects or unrestricted IPC are
 * exposed to the renderer.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const bridge = Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }),
  getAppInfo: () => ipcRenderer.invoke('gytech:get-app-info'),
  checkForUpdates: () => ipcRenderer.invoke('gytech:check-updates'),
  openExternal: (url) => ipcRenderer.invoke('gytech:open-external', String(url)),
  openLogs: () => ipcRenderer.invoke('gytech:open-logs'),
  log: (level, message) => ipcRenderer.invoke('gytech:log', {
    level: String(level),
    message: String(message).slice(0, 4000),
  }),
  onShowAbout: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('gytech:show-about', listener);
    return () => ipcRenderer.removeListener('gytech:show-about', listener);
  },
  onCheckUpdates: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('gytech:check-updates', listener);
    return () => ipcRenderer.removeListener('gytech:check-updates', listener);
  },
});

contextBridge.exposeInMainWorld('gytechDesktop', bridge);
