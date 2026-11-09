/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Desktop integration: About information, user-controlled update notifications,
 * local-data export/import and renderer-side diagnostic logging.
 *
 * This module is intentionally browser-safe. All privileged work is delegated to
 * the least-privilege Electron preload bridge.
 */

import {
  ACTIVE_PATIENT_KEY,
  APP_COPYRIGHT_STANDARD,
  APP_NAME,
  APP_VERSION,
  HISTORY_KEY,
  PATIENTS_KEY,
  SETTINGS_KEY,
  UI_STATE_KEY,
} from './state.js';
import { downloadFile } from './utilities.js';

const UPDATE_PREFS_KEY = 'gytech.patientsim.desktop-updates.v1';
const LOCAL_DATA_SCHEMA = 'gytech-patientsim-local-data.v1';
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const EXPORTABLE_KEYS = [
  SETTINGS_KEY,
  UI_STATE_KEY,
  PATIENTS_KEY,
  ACTIVE_PATIENT_KEY,
  HISTORY_KEY,
];

const setText = (element, value) => {
  if (element) element.textContent = String(value ?? '');
};

const platformLabel = (platform) => ({
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
}[platform] || platform || 'Desktop');

const isGitHubReleaseUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname === 'www.github.com');
  } catch {
    return false;
  }
};

export function collectLocalData(storage = localStorage) {
  const data = {};
  for (const key of EXPORTABLE_KEYS) {
    const value = storage.getItem(key);
    if (typeof value === 'string') data[key] = value;
  }
  return {
    schema: LOCAL_DATA_SCHEMA,
    app: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function validateLocalData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The selected file is not a valid GYTech local data export.');
  }
  if (payload.schema !== LOCAL_DATA_SCHEMA || payload.app !== APP_NAME) {
    throw new Error('The selected file does not use the supported GYTech PatientSim Pro data format.');
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('The selected file contains no importable local data.');
  }
  const result = {};
  let totalLength = 0;
  for (const key of EXPORTABLE_KEYS) {
    if (payload.data[key] === undefined) continue;
    if (typeof payload.data[key] !== 'string') {
      throw new Error('The selected file contains an unsupported value type.');
    }
    if (payload.data[key].length > MAX_IMPORT_BYTES) {
      throw new Error('The selected file contains an oversized local data value.');
    }
    try {
      JSON.parse(payload.data[key]);
    } catch {
      throw new Error('The selected file contains invalid simulation data.');
    }
    result[key] = payload.data[key];
    totalLength += payload.data[key].length;
  }
  if (totalLength === 0) {
    throw new Error('The selected file contains no supported local data.');
  }
  if (totalLength > MAX_IMPORT_BYTES) {
    throw new Error('The selected file is too large to import.');
  }
  return result;
}

export class DesktopManager {
  constructor({
    bridge = (typeof window !== 'undefined' ? window.gytechDesktop : null),
    storage = (typeof localStorage !== 'undefined' ? localStorage : null),
    documentRef = (typeof document !== 'undefined' ? document : null),
    currentVersion = APP_VERSION,
  } = {}) {
    this.bridge = bridge || null;
    this.storage = storage;
    this.document = documentRef;
    this.currentVersion = currentVersion;
    this.appInfo = null;
    this.prefs = this.loadPrefs();
    this.ui = {};
    this.initialised = false;
    this.checking = false;
    this.currentUpdate = null;
    this.lastCheckAt = 0;
    this.initialTimer = null;
    this.periodicTimer = null;
  }

  element(id) {
    return this.document ? this.document.getElementById(id) : null;
  }

  loadPrefs() {
    const fallback = { enabled: true, lastCheckedAt: 0, snoozeUntil: 0, dismissedVersion: '' };
    try {
      const parsed = JSON.parse(this.storage?.getItem(UPDATE_PREFS_KEY) || '{}');
      return {
        enabled: parsed.enabled !== false,
        lastCheckedAt: Number.isFinite(parsed.lastCheckedAt) ? parsed.lastCheckedAt : 0,
        snoozeUntil: Number.isFinite(parsed.snoozeUntil) ? parsed.snoozeUntil : 0,
        dismissedVersion: typeof parsed.dismissedVersion === 'string' ? parsed.dismissedVersion : '',
      };
    } catch {
      return fallback;
    }
  }

  savePrefs() {
    try {
      this.storage?.setItem(UPDATE_PREFS_KEY, JSON.stringify(this.prefs));
    } catch (error) {
      this.log('warn', `Could not save desktop update preferences: ${error.message}`);
    }
  }

  log(level, message) {
    if (this.bridge?.log) {
      this.bridge.log(level, message).catch(() => {});
    } else if (level === 'error') {
      console.error(`[GYTech PatientSim Pro] ${message}`);
    }
  }

  installErrorLogging() {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      this.log('error', `Renderer error: ${event.message || 'unknown error'} (${event.filename || 'inline'}:${event.lineno || 0})`);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'unknown rejection');
      this.log('error', `Unhandled renderer rejection: ${reason}`);
    });
  }

  setStatus(message, tone = 'info') {
    const target = this.element('updateStatusText');
    if (target) {
      target.textContent = message;
      target.dataset.tone = tone;
    }
  }

  get updateConfig() {
    return this.appInfo?.updateConfig || null;
  }

  get updateAvailableForThisBuild() {
    return Boolean(this.bridge && this.updateConfig?.enabled && this.updateConfig?.configured);
  }

  async initialize(ui = {}) {
    if (this.initialised) return;
    this.initialised = true;
    this.ui = {
      openModal: typeof ui.openModal === 'function' ? ui.openModal : () => {},
      closeModal: typeof ui.closeModal === 'function' ? ui.closeModal : () => {},
      confirmAction: typeof ui.confirmAction === 'function' ? ui.confirmAction : null,
      toast: typeof ui.toast === 'function' ? ui.toast : () => {},
    };
    this.installErrorLogging();
    this.bindControls();

    if (this.bridge) {
      try {
        this.appInfo = await this.bridge.getAppInfo();
      } catch (error) {
        this.log('error', `Could not read desktop application information: ${error.message}`);
      }
    }

    this.syncAbout();
    this.syncControls();
    this.configureSchedule();
    this.log('info', `Desktop renderer initialised. packaged=${Boolean(this.appInfo?.packaged)}`);
  }

  bindControls() {
    const bind = (id, event, handler) => {
      const element = this.element(id);
      if (element) element.addEventListener(event, handler);
    };
    bind('btnOpenAbout', 'click', () => this.openAbout());
    bind('btnAboutCheckUpdates', 'click', () => this.checkForUpdates({ manual: true }));
    bind('btnAboutOpenLogs', 'click', () => this.openLogs());
    bind('btnCheckUpdates', 'click', () => this.checkForUpdates({ manual: true }));
    bind('btnOpenReleases', 'click', () => this.openReleasesPage());
    bind('settingUpdateChecks', 'change', (event) => {
      this.prefs.enabled = Boolean(event.target.checked);
      this.savePrefs();
      this.configureSchedule();
      this.setStatus(this.prefs.enabled
        ? 'Automatic stable-release checks are enabled.'
        : 'Automatic update checks are disabled. You can still check manually.');
      this.ui.toast(this.prefs.enabled ? 'Automatic update checks enabled.' : 'Automatic update checks disabled.', 'info');
    });
    bind('btnUpdateDownload', 'click', () => this.openReleasePage('download'));
    bind('btnUpdateReleaseNotes', 'click', () => this.openReleasePage('notes'));
    bind('btnUpdateRemind', 'click', () => this.remindLater());
    bind('btnUpdateDismiss', 'click', () => this.dismiss());
    bind('btnExportData', 'click', () => this.exportData());
    bind('btnImportData', 'click', () => this.element('importDataFile')?.click());
    bind('importDataFile', 'change', (event) => this.importFile(event));
    if (this.bridge?.onShowAbout) this.bridge.onShowAbout(() => this.openAbout());
    if (this.bridge?.onCheckUpdates) this.bridge.onCheckUpdates(() => this.checkForUpdates({ manual: true }));
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.clearSchedule());
    }
  }

  syncControls() {
    const configured = this.updateAvailableForThisBuild;
    const modeLabel = this.element('desktopModeLabel');
    setText(modeLabel, this.bridge
      ? `${this.appInfo?.productName || APP_NAME} ${this.appInfo?.version || this.currentVersion} · ${platformLabel(this.appInfo?.platform)}`
      : 'Browser edition — desktop update checks unavailable');
    const toggle = this.element('settingUpdateChecks');
    if (toggle) {
      toggle.checked = this.prefs.enabled;
      toggle.disabled = !configured || !this.updateConfig?.enabled;
    }
    for (const id of ['btnCheckUpdates', 'btnAboutCheckUpdates']) {
      const button = this.element(id);
      if (button) button.disabled = !configured;
    }
    const releasesButton = this.element('btnOpenReleases');
    if (releasesButton) releasesButton.disabled = !this.bridge || !this.updateConfig?.releasesUrl;
    const logsButton = this.element('btnAboutOpenLogs');
    if (logsButton) logsButton.hidden = !this.bridge;

    if (!this.bridge) {
      this.setStatus('Desktop update checks and application logs are available in the installed desktop application.');
    } else if (this.updateConfig?.enabled === false) {
      this.setStatus('Update checks are disabled by this build configuration.');
    } else if (!this.updateConfig?.configured) {
      this.setStatus('The official update repository has not been configured by the publisher. No release information is fabricated.', 'warning');
    } else if (!this.prefs.enabled) {
      this.setStatus('Automatic update checks are disabled. Manual checks remain available.');
    } else {
      this.setStatus('Stable-release update checks are enabled. No automatic installation will occur.');
    }
  }

  syncAbout() {
    const info = this.appInfo;
    setText(this.element('aboutVersion'), info?.version || this.currentVersion);
    setText(this.element('aboutPublisher'), info?.publisher || 'GYTech');
    setText(this.element('aboutPlatform'), info
      ? `${platformLabel(info.platform)} ${info.arch || ''}`.trim()
      : 'Browser');
    setText(this.element('aboutRuntime'), info
      ? `Electron ${info.electronVersion} · Chromium ${info.chromeVersion}`
      : `Browser · ${navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Chromium-based'}`);
    setText(this.element('aboutLicenseStatus'), info?.licenseStatus || 'Apache-2.0');
    setText(this.element('aboutCopyright'), APP_COPYRIGHT_STANDARD);
    setText(this.element('aboutDataPath'), info?.userDataPath
      ? `Local data: ${info.userDataPath}`
      : 'Local data: browser origin storage');
    setText(this.element('aboutLogPath'), info?.logPath
      ? `Application logs: ${info.logPath}`
      : 'Application logs: not available in browser mode');
    if (info) {
      setText(this.element('aboutUpdateStatus'), info.updateConfig?.configured
        ? `GitHub Releases · ${info.updateConfig.repository}`
        : 'Not configured by publisher');
    } else {
      setText(this.element('aboutUpdateStatus'), 'Desktop update checks unavailable');
    }
  }

  openAbout() {
    this.syncAbout();
    this.ui.openModal('about');
  }

  configureSchedule() {
    this.clearSchedule();
    if (!this.updateAvailableForThisBuild || !this.prefs.enabled) return;
    const intervalHours = Number(this.updateConfig.checkIntervalHours) || 6;
    this.initialTimer = setTimeout(() => {
      this.checkForUpdates({ automatic: true });
    }, 6000);
    this.periodicTimer = setInterval(() => {
      this.checkForUpdates({ automatic: true });
    }, Math.max(1, intervalHours) * 60 * 60 * 1000);
  }

  clearSchedule() {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    this.initialTimer = null;
    this.periodicTimer = null;
  }

  isSuppressed(version) {
    if (this.prefs.dismissedVersion === version) return true;
    return this.prefs.snoozeUntil > Date.now();
  }

  async checkForUpdates({ manual = false, automatic = false } = {}) {
    if (this.checking) {
      if (manual) this.ui.toast('An update check is already in progress.', 'info');
      return null;
    }
    if (!this.bridge) {
      if (manual) this.ui.toast('Update checks are available in the installed desktop application.', 'warning');
      return null;
    }
    if (!this.updateConfig?.enabled) {
      this.setStatus('Update checks are disabled by this build configuration.', 'warning');
      if (manual) this.ui.toast('Update checks are disabled in this build.', 'warning');
      return null;
    }
    if (!this.updateConfig?.configured) {
      this.setStatus('The official update repository has not been configured by the publisher. No release information is fabricated.', 'warning');
      if (manual) this.ui.toast('The official update repository has not been configured.', 'warning');
      return null;
    }
    if (!this.prefs.enabled && !manual) return null;
    const intervalHours = Number(this.updateConfig.checkIntervalHours) || 6;
    if (automatic && this.prefs.lastCheckedAt
      && Date.now() - this.prefs.lastCheckedAt < intervalHours * 60 * 60 * 1000) {
      return null;
    }

    this.checking = true;
    this.lastCheckAt = Date.now();
    this.setStatus('Checking the official stable-release channel…');
    try {
      const result = await this.bridge.checkForUpdates();
      this.prefs.lastCheckedAt = Date.now();
      this.savePrefs();
      if (!result || typeof result.status !== 'string') {
        throw new Error('The update service returned an unexpected response.');
      }
      if (result.status === 'update-available') {
        this.currentUpdate = result;
        this.setStatus(`Version ${result.latestVersion} is available. Download and installation remain under your control.`, 'success');
        setText(this.element('aboutUpdateStatus'), `Update available · ${result.latestVersion}`);
        if (manual || !this.isSuppressed(result.latestVersion)) {
          this.showUpdate(result);
          if (manual) this.ui.toast(`Version ${result.latestVersion} is available.`, 'success');
        } else if (manual) {
          this.ui.toast(`Version ${result.latestVersion} is available.`, 'info');
        }
      } else if (result.status === 'up-to-date') {
        this.currentUpdate = null;
        this.setStatus(result.message || `You are running the latest stable version (${this.currentVersion}).`, 'success');
        setText(this.element('aboutUpdateStatus'), `Up to date · ${this.currentVersion}`);
        if (manual) this.ui.toast('You are running the latest stable version.', 'success');
      } else if (result.status === 'unconfigured') {
        this.setStatus(result.message || 'The official update repository has not been configured.', 'warning');
        if (manual) this.ui.toast('The official update repository has not been configured.', 'warning');
      } else if (result.status === 'disabled') {
        this.setStatus(result.message || 'Update checks are disabled by this build configuration.', 'warning');
        if (manual) this.ui.toast(result.message || 'Update checks are disabled.', 'warning');
      } else if (result.status === 'no-release') {
        this.currentUpdate = null;
        this.setStatus(result.message || 'No stable release has been published yet.', 'info');
        setText(this.element('aboutUpdateStatus'), 'No published release yet');
        if (manual) this.ui.toast('No stable release has been published yet.', 'info');
      } else {
        this.setStatus(result.message || 'The update service is unavailable. You can continue using the simulator.', 'warning');
        if (manual) this.ui.toast(result.message || 'Update check unavailable.', 'warning');
      }
      return result;
    } catch (error) {
      this.log('warn', `Renderer update check failed: ${error.message}`);
      this.setStatus('The update service is unavailable. You can continue using the simulator.', 'warning');
      if (manual) this.ui.toast('Update check unavailable. The simulator remains usable offline.', 'warning');
      return null;
    } finally {
      this.checking = false;
    }
  }

  showUpdate(result) {
    setText(this.element('updateInstalledVersion'), result.currentVersion || this.currentVersion);
    setText(this.element('updateLatestVersion'), result.latestVersion || '—');
    setText(this.element('updateHeading'), 'A New Version of GYTech PatientSim Pro Is Available');
    setText(this.element('updateSummary'), result.releaseName || 'A newer stable version is available.');
    setText(this.element('updateNotes'), result.notes || 'Release notes are available on the official GitHub Release page.');
    setText(this.element('updateDialogStatus'), '');
    this.ui.openModal('update');
  }

  async openReleasesPage() {
    const url = this.updateConfig?.releasesUrl;
    if (!url || !isGitHubReleaseUrl(url)) {
      this.setStatus('The official Releases page is not available in this build.', 'warning');
      if (this.ui?.toast) this.ui.toast('No official Releases page is configured.', 'warning');
      return;
    }
    if (!this.bridge?.openExternal) {
      if (this.ui?.toast) this.ui.toast('Opening the Releases page is available in the installed desktop application.', 'warning');
      return;
    }
    const response = await this.bridge.openExternal(url);
    if (response?.ok) {
      this.ui.toast('Official GitHub Releases page opened in your browser.', 'info');
    } else {
      this.ui.toast(response?.message || 'The Releases page could not be opened.', 'warning');
    }
  }

  async openReleasePage(kind) {
    if (!this.currentUpdate?.releaseUrl || !isGitHubReleaseUrl(this.currentUpdate.releaseUrl)) {
      setText(this.element('updateDialogStatus'), 'No verified GitHub Release page is available.');
      return;
    }
    if (!this.bridge?.openExternal) {
      setText(this.element('updateDialogStatus'), 'Opening release pages is available in the desktop application.');
      return;
    }
    const response = await this.bridge.openExternal(this.currentUpdate.releaseUrl);
    if (response?.ok) {
      setText(this.element('updateDialogStatus'), kind === 'download'
        ? 'Official release page opened in your browser. Download and install manually.'
        : 'Official release notes opened in your browser.');
    } else {
      setText(this.element('updateDialogStatus'), response?.message || 'The release page could not be opened.');
    }
  }

  remindLater() {
    const hours = Number(this.updateConfig?.remindLaterHours) || 24;
    this.prefs.snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
    this.savePrefs();
    this.ui.closeModal();
    this.setStatus(`Update reminder snoozed for ${hours} hours.`);
    this.ui.toast(`Reminder set for ${hours} hours.`, 'info');
  }

  dismiss() {
    if (this.currentUpdate?.latestVersion) {
      this.prefs.dismissedVersion = this.currentUpdate.latestVersion;
      this.savePrefs();
    }
    this.ui.closeModal();
    this.setStatus('This update notification has been dismissed. You can check manually at any time.');
  }

  async openLogs() {
    if (!this.bridge?.openLogs) {
      this.ui.toast('Application logs are available in the installed desktop application.', 'info');
      return;
    }
    const response = await this.bridge.openLogs();
    if (!response?.ok) this.ui.toast(response?.message || 'The log folder could not be opened.', 'warning');
  }

  exportData() {
    try {
      const payload = collectLocalData(this.storage);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadFile(
        `GYTech-PatientSim-Pro-LocalData-${stamp}.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      this.ui.toast('Local simulation data exported. Review the file before sharing it.', 'success');
      this.log('info', 'Local simulation data exported by the user.');
    } catch (error) {
      this.ui.toast(`Could not export local data: ${error.message}`, 'critical');
      this.log('error', `Local data export failed: ${error.message}`);
    }
  }

  async importFile(event) {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('The selected file is larger than the 5 MB import limit.');
      const text = await file.text();
      const payload = JSON.parse(text);
      const imported = validateLocalData(payload);
      const apply = () => {
        try {
          for (const key of EXPORTABLE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(imported, key)) {
              this.storage.setItem(key, imported[key]);
            } else {
              this.storage.removeItem(key);
            }
          }
          this.ui.toast('Local simulation data imported. Reloading…', 'success');
          setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          this.ui.toast(`Could not import local data: ${error.message}`, 'critical');
          this.log('error', `Local data import failed: ${error.message}`);
        }
      };
      if (this.ui.confirmAction) {
        this.ui.confirmAction(
          'Replace local simulation data',
          'This replaces supported local settings, patients, active context, and event history with the selected file. Current local simulation data will be overwritten. Continue?',
          apply,
          'IMPORT DATA',
        );
      } else {
        apply();
      }
    } catch (error) {
      this.ui.toast(`Import rejected: ${error.message}`, 'critical');
      this.log('warn', `Local data import rejected: ${error.message}`);
    } finally {
      input.value = '';
    }
  }
}

export const desktopManager = new DesktopManager();
