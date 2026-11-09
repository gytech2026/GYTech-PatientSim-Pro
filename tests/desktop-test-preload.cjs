/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Test-only preload that emulates the least-privilege desktop bridge. It never
 * performs network access and uses clearly synthetic release metadata.
 */

'use strict';

const { contextBridge } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const scenarioArg = process.argv.find((argument) => argument.startsWith('--gytech-test-scenario='));
const scenario = scenarioArg ? scenarioArg.split('=')[1] : 'update-available';
const actionLog = process.env.GYTECH_TEST_ACTION_LOG || '';
const appInfo = {
  name: 'GYTech PatientSim Pro',
  productName: 'GYTech PatientSim Pro',
  description: 'Advanced Patient Vital Signs Monitor & Defibrillator Simulator',
  version: '1.0.1',
  publisher: 'GYTech',
  copyright: 'Copyright © 2026 GYTech. All Rights Reserved.',
  licenseStatus: 'Apache-2.0',
  platform: process.platform,
  arch: process.arch,
  packaged: true,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  userDataPath: path.join(process.env.TEMP || process.cwd(), 'gytech-test-user-data'),
  logPath: path.join(process.env.TEMP || process.cwd(), 'gytech-test-user-data', 'logs', 'patientsim-pro.log'),
  updateConfig: {
    enabled: true,
    repository: 'fixture-owner/fixture-repo',
    configured: true,
    releasesUrl: 'https://github.com/fixture-owner/fixture-repo/releases',
    checkIntervalHours: 6,
    remindLaterHours: 24,
  },
};

function record(action, detail = '') {
  if (!actionLog) return;
  try {
    fs.appendFileSync(actionLog, `${action}\t${detail}\n`, 'utf8');
  } catch {
    // Test diagnostics must not break the bridge.
  }
}

const updateResult = {
  'update-available': {
    status: 'update-available',
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    releaseName: 'Synthetic fixture release',
    releaseUrl: 'https://github.com/fixture-owner/fixture-repo/releases/tag/v1.1.0',
    notes: 'Synthetic release notes used only by the automated desktop test harness.',
    publishedAt: '2026-01-01T00:00:00Z',
    message: 'A newer stable version is available.',
  },
  'up-to-date': {
    status: 'up-to-date',
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    message: 'You are running the latest stable version (1.0.0).',
  },
  error: {
    status: 'error',
    currentVersion: '1.0.0',
    message: 'Unable to check for updates while offline or unavailable. You can continue using the simulator.',
  },
  'no-release': {
    status: 'no-release',
    currentVersion: '1.0.0',
    message: 'No stable release has been published for GYTech PatientSim Pro yet. You can check the official Releases page manually.',
  },
}[scenario] || {
  status: 'error',
  currentVersion: '1.0.0',
  message: 'Unknown synthetic test scenario.',
};

contextBridge.exposeInMainWorld('gytechDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  getAppInfo: async () => appInfo,
  checkForUpdates: async () => {
    record('check-for-updates', scenario);
    return updateResult;
  },
  openExternal: async (url) => {
    record('open-external', url);
    return { ok: true };
  },
  openLogs: async () => {
    record('open-logs');
    return { ok: true };
  },
  log: async (level, message) => {
    record('log', `${level}:${message}`);
    return { ok: true };
  },
  onShowAbout: () => () => {},
  onCheckUpdates: () => () => {},
});
