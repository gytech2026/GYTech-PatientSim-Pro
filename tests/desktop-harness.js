/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Desktop integration harness: About dialog, user-controlled update UI,
 * offline/error handling, local-data portability, window resizing and fullscreen.
 * The update bridge is a synthetic test double; no real release is contacted.
 */

'use strict';

const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { compareVersions, validateRelease } = require('../desktop/update-utils.cjs');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('background-throttling-disabled');

let server;
let win;
let testSession;
const checks = [];
const consoleMessages = [];
const pageErrors = [];
const actionLog = path.join(__dirname, 'desktop-actions.log');
process.env.GYTECH_TEST_ACTION_LOG = actionLog;

app.on('window-all-closed', () => {});

function record(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${details ? ` — ${details}` : ''}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((request, response) => {
      const rawPath = decodeURIComponent((request.url || '/').split('?')[0]);
      const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
      const filePath = path.resolve(ROOT, relative);
      if (!filePath.startsWith(`${ROOT}${path.sep}`) && filePath !== path.join(ROOT, 'index.html')) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        response.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        response.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function evaluate(script) {
  return win.webContents.executeJavaScript(script, true);
}

async function waitFor(script, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(script)) return true;
    } catch {
      // Page may still be navigating.
    }
    await wait(100);
  }
  return false;
}

async function createWindow(port, scenario) {
  if (win && !win.isDestroyed()) win.destroy();
  actionLogCleanup();
  win = new BrowserWindow({
    width: 1600,
    height: 950,
    show: true,
    title: 'GYTech PatientSim Pro',
    backgroundColor: '#07110f',
    webPreferences: {
      preload: path.join(__dirname, 'desktop-test-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--gytech-test-scenario=${scenario}`],
      session: testSession,
      backgroundThrottling: false,
      devTools: true,
    },
  });
  win.webContents.on('console-message', (event, level, message) => {
    consoleMessages.push({ level, message });
  });
  win.webContents.on('preload-error', (event, preloadPath, error) => {
    pageErrors.push(`Preload error ${preloadPath}: ${error.message}`);
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  await waitFor("document.readyState === 'complete' && Boolean(document.getElementById('vitalHR'))", 10000);
  await wait(900);
}

function actionLogCleanup() {
  try { fs.unlinkSync(actionLog); } catch { /* no log yet */ }
}

function readActions() {
  try {
    return fs.readFileSync(actionLog, 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  const port = await startServer();
  testSession = session.fromPartition('persist:gytech-desktop-test');
  await testSession.clearStorageData();

  await createWindow(port, 'update-available');
  const base = await evaluate(`(() => ({
    title: document.title,
    appName: document.querySelector('.brand-name')?.textContent?.trim(),
    heartRate: document.getElementById('vitalHR')?.textContent?.trim(),
    canvasCount: document.querySelectorAll('.wave-card canvas').length,
    aboutVersion: document.getElementById('aboutVersion')?.textContent?.trim(),
    desktopMode: document.getElementById('desktopModeLabel')?.textContent?.trim(),
    updateChecksDisabled: document.getElementById('settingUpdateChecks')?.disabled,
    checkButtonDisabled: document.getElementById('btnCheckUpdates')?.disabled,
    updateStatus: document.getElementById('updateStatusText')?.textContent?.trim(),
  }))()`);
  record('Desktop app name and title', base.title.includes('GYTech PatientSim Pro') && base.appName === 'GYTECH', JSON.stringify(base));
  record('Simulation engine renders in desktop bridge context', base.heartRate === '74' && base.canvasCount >= 8, JSON.stringify(base));
  record('Desktop app info exposes configured update channel and version', base.aboutVersion === '1.0.1' && base.updateChecksDisabled === false && base.checkButtonDisabled === false, JSON.stringify(base));
  record('Configured update channel shows no repository-not-configured warning', !/not been configured/i.test(base.updateStatus) && /stable-releases?|check/i.test(base.updateStatus), base.updateStatus);

  await evaluate("document.getElementById('btnOpenReleases').click()");
  await wait(300);
  record('Releases button opens only the configured official GitHub Releases page', readActions().includes('open-external\thttps://github.com/fixture-owner/fixture-repo/releases'), readActions().slice(-220));

  await evaluate("document.getElementById('btnOpenAbout').click()");
  const about = await evaluate(`(() => ({
    visible: !document.getElementById('modalAbout').hidden,
    version: document.getElementById('aboutVersion')?.textContent,
    publisher: document.getElementById('aboutPublisher')?.textContent,
    platform: document.getElementById('aboutPlatform')?.textContent,
    runtime: document.getElementById('aboutRuntime')?.textContent,
    license: document.getElementById('aboutLicenseStatus')?.textContent,
    copyright: document.getElementById('aboutCopyright')?.textContent,
    dataPath: document.getElementById('aboutDataPath')?.textContent,
    disclaimer: document.querySelector('.about-disclaimer')?.textContent,
  }))()`);
  record('About dialog opens with version, publisher and runtime', about.visible && about.version === '1.0.1' && about.publisher === 'GYTech' && /Electron/.test(about.runtime), JSON.stringify(about));
  record('About dialog shows Apache-2.0 license and medical disclaimer', about.license === 'Apache-2.0' && /not a medical device/i.test(about.disclaimer), about.license);
  record('About dialog uses standardized copyright', about.copyright === 'Copyright © 2026 GYTech. All Rights Reserved.', about.copyright);
  await evaluate("document.querySelector('#modalAbout [data-close-modal]').click()");
  await wait(250);

  await evaluate("document.getElementById('btnCheckUpdates').click()");
  const updateShown = await waitFor("!document.getElementById('modalUpdate').hidden", 5000);
  const update = await evaluate(`(() => ({
    visible: !document.getElementById('modalUpdate').hidden,
    installed: document.getElementById('updateInstalledVersion')?.textContent,
    latest: document.getElementById('updateLatestVersion')?.textContent,
    notes: document.getElementById('updateNotes')?.textContent,
    summary: document.getElementById('updateSummary')?.textContent,
  }))()`);
  record('Update notification displays installed and latest versions', updateShown && update.visible && update.installed === '1.0.0' && update.latest === '1.1.0', JSON.stringify(update));
  record('Update notification presents release notes and summary', /synthetic release notes/i.test(update.notes) && /synthetic fixture/i.test(update.summary), update.summary);

  // Regression: a second update-available result (automatic or repeated manual
  // check) must refresh the notification, not toggle it closed.
  const repeatBefore = (readActions().match(/^check-for-updates\t/gm) || []).length;
  await evaluate("document.getElementById('btnCheckUpdates').click()");
  const repeatDeadline = Date.now() + 5000;
  while (Date.now() < repeatDeadline
    && (readActions().match(/^check-for-updates\t/gm) || []).length <= repeatBefore) {
    await wait(50);
  }
  await wait(150);
  const repeatAfter = (readActions().match(/^check-for-updates\t/gm) || []).length;
  const repeatVisible = await evaluate("!document.getElementById('modalUpdate').hidden");
  record('Repeated update-check results keep the notification visible', repeatAfter > repeatBefore && repeatVisible, `checks=${repeatBefore}->${repeatAfter} visible=${repeatVisible}`);

  await evaluate("document.getElementById('btnUpdateDownload').click()");
  await wait(350);
  const actionsAfterDownload = readActions();
  record('Download Update opens only the verified GitHub release URL', actionsAfterDownload.includes('open-external\thttps://github.com/fixture-owner/fixture-repo/releases/tag/v1.1.0'), actionsAfterDownload.trim());

  await evaluate("document.getElementById('btnUpdateRemind').click()");
  await wait(250);
  const snooze = await evaluate(`(() => ({
    hidden: document.getElementById('modalUpdate').hidden,
    prefs: JSON.parse(localStorage.getItem('gytech.patientsim.desktop-updates.v1') || '{}'),
  }))()`);
  record('Remind Me Later closes the dialog and records a future snooze', snooze.hidden && snooze.prefs.snoozeUntil > Date.now(), JSON.stringify(snooze.prefs));

  await evaluate("document.getElementById('btnCheckUpdates').click()");
  await waitFor("!document.getElementById('modalUpdate').hidden", 5000);
  await evaluate("document.getElementById('btnUpdateDismiss').click()");
  await wait(250);
  const dismissed = await evaluate("JSON.parse(localStorage.getItem('gytech.patientsim.desktop-updates.v1') || '{}').dismissedVersion");
  record('Dismiss records the exact dismissed release version', dismissed === '1.1.0', String(dismissed));

  const checksBefore = (readActions().match(/^check-for-updates\t/gm) || []).length;
  await evaluate(`(() => {
    const button = document.getElementById('btnCheckUpdates');
    button.click();
    button.click();
  })()`);
  await wait(600);
  const checksAfter = (readActions().match(/^check-for-updates\t/gm) || []).length;
  record('Overlapping manual update checks are de-duplicated', checksAfter - checksBefore === 1, `before=${checksBefore} after=${checksAfter}`);
  await evaluate("document.querySelector('#modalUpdate [data-close-modal]')?.click()");

  const dataTools = await evaluate(`(async () => {
    const { collectLocalData, validateLocalData } = await import('/js/desktop.js');
    const payload = collectLocalData(localStorage);
    const keys = Object.keys(payload.data);
    const accepted = validateLocalData(payload);
    let rejected = false;
    try { validateLocalData({ schema: 'wrong', app: 'wrong', data: {} }); } catch { rejected = true; }
    return { schema: payload.schema, app: payload.app, keyCount: keys.length, acceptedCount: Object.keys(accepted).length, rejected };
  })()`);
  record('Local-data export schema and import validation work', dataTools.schema === 'gytech-patientsim-local-data.v1' && dataTools.app === 'GYTech PatientSim Pro' && dataTools.keyCount >= 3 && dataTools.acceptedCount >= 3 && dataTools.rejected, JSON.stringify(dataTools));

  win.setSize(1280, 720);
  await wait(500);
  const responsive = await evaluate(`(() => ({
    width: innerWidth,
    height: innerHeight,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    canvases: [...document.querySelectorAll('.wave-card canvas')].filter((canvas) => canvas.width > 0 && canvas.height > 0).length,
  }))()`);
  record('Native window resizing keeps the interface usable', responsive.overflowX <= 1 && responsive.canvases >= 8, JSON.stringify(responsive));

  win.setFullScreen(true);
  await wait(700);
  const fullscreenOn = win.isFullScreen() && await evaluate('innerWidth > 1000');
  win.setFullScreen(false);
  await wait(400);
  record('Fullscreen mode is supported and can be exited', fullscreenOn && !win.isFullScreen(), `fullscreenOn=${fullscreenOn}`);

  await evaluate(`(() => {
    const select = document.getElementById('settingTheme');
    select.value = 'high-contrast';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(350);
  win.webContents.reload();
  await waitFor("document.readyState === 'complete' && Boolean(document.getElementById('vitalHR'))", 10000);
  await wait(700);
  const restarted = await evaluate(`(() => ({
    heartRate: document.getElementById('vitalHR')?.textContent?.trim(),
    theme: document.documentElement.dataset.theme,
    aboutVersion: document.getElementById('aboutVersion')?.textContent?.trim(),
  }))()`);
  record('Desktop window reload retains local settings and simulation data', restarted.heartRate !== '--' && restarted.aboutVersion === '1.0.1' && restarted.theme === 'high-contrast', JSON.stringify(restarted));

  await createWindow(port, 'error');
  await evaluate("document.getElementById('btnCheckUpdates').click()");
  await wait(600);
  const offline = await evaluate(`(() => ({
    updateModalHidden: document.getElementById('modalUpdate').hidden,
    status: document.getElementById('updateStatusText')?.textContent?.trim(),
    heartRate: document.getElementById('vitalHR')?.textContent?.trim(),
  }))()`);
  record('Update checker network failure is non-blocking and shows a status', offline.updateModalHidden && /unavailable|offline|unable/i.test(offline.status) && offline.heartRate !== '--', JSON.stringify(offline));

  await createWindow(port, 'up-to-date');
  await evaluate("document.getElementById('btnCheckUpdates').click()");
  await wait(600);
  const current = await evaluate(`(() => ({
    updateModalHidden: document.getElementById('modalUpdate').hidden,
    status: document.getElementById('updateStatusText')?.textContent?.trim(),
  }))()`);
  record('Up-to-date check does not display a false update', current.updateModalHidden && /latest stable/i.test(current.status), JSON.stringify(current));

  await createWindow(port, 'no-release');
  await evaluate("document.getElementById('btnCheckUpdates').click()");
  await wait(600);
  const noRelease = await evaluate(`(() => ({
    updateModalHidden: document.getElementById('modalUpdate').hidden,
    status: document.getElementById('updateStatusText')?.textContent?.trim(),
    heartRate: document.getElementById('vitalHR')?.textContent?.trim(),
  }))()`);
  record('Missing stable release is reported without a false update', noRelease.updateModalHidden && /no stable release/i.test(noRelease.status) && noRelease.heartRate !== '--', JSON.stringify(noRelease));

  await evaluate("localStorage.setItem('gytech.patientsim.settings.v1', '{corrupted-json'); location.reload(); true");
  await waitFor("document.readyState === 'complete' && Boolean(document.getElementById('vitalHR'))", 10000);
  await wait(800);
  const corrupted = await evaluate(`(() => ({
    appShell: Boolean(document.getElementById('appShell')),
    heartRate: document.getElementById('vitalHR')?.textContent?.trim(),
    bootError: window.__gytechBootError || null,
  }))()`);
  record('Corrupted local settings are handled without blocking startup', corrupted.appShell && corrupted.heartRate !== '--' && !corrupted.bootError, JSON.stringify(corrupted));

  const versionChecks = [
    compareVersions('1.2.3', '1.2.2') === 1,
    compareVersions('1.2.3', '1.2.3') === 0,
    compareVersions('1.0.0', '1.0.1') === -1,
    validateRelease({
      tag_name: 'v1.1.0',
      draft: false,
      prerelease: false,
      html_url: 'https://github.com/fixture-owner/fixture-repo/releases/tag/v1.1.0',
      body: 'notes',
    }, '1.0.0').updateAvailable === true,
    validateRelease({
      tag_name: 'v1.1.0',
      draft: false,
      prerelease: false,
      html_url: 'http://example.invalid/release',
    }, '1.0.0').ok === false,
  ];
  record('Release version and trusted-URL validation reject unsafe metadata', versionChecks.every(Boolean), JSON.stringify(versionChecks));

  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  try {
    win.webContents.reload();
    await waitFor("document.readyState === 'complete' && Boolean(document.getElementById('vitalHR'))", 10000);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'screenshots', 'desktop-harness-final.png'), image.toPNG());
  } catch (error) {
    console.warn('Desktop screenshot skipped:', error.message);
  }

  const report = {
    checks,
    summary: { passed: checks.filter((entry) => entry.pass).length, failed: checks.filter((entry) => !entry.pass).length },
    consoleMessages,
    pageErrors,
    syntheticUpdateBridge: true,
  };
  fs.writeFileSync(path.join(__dirname, 'desktop-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed > 0 || pageErrors.length > 0 || consoleMessages.some((entry) => entry.level >= 3)) {
    process.exitCode = 1;
  }
  const exitCode = process.exitCode || 0;
  if (win && !win.isDestroyed()) win.destroy();
  if (server) server.close();
  app.exit(exitCode);
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  if (win && !win.isDestroyed()) win.destroy();
  if (server) server.close();
  app.exit(1);
});
