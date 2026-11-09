/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/* eslint-disable no-console */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'assets', 'screenshots');
const BRANDING = path.join(ROOT, 'assets', 'branding');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('background-throttling-disabled');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

// Keep the application process alive while short-lived branding capture windows
// open and close before the main application window is created.
app.on('window-all-closed', () => {});

let server;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const urlPath = decodeURIComponent(request.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) {
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
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureWindow({ width, height, html, output, waitMs = 300 }) {
  const captureWin = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    show: true,
    backgroundColor: '#05090b',
    webPreferences: { backgroundThrottling: false, sandbox: false },
  });
  captureWin.setMenuBarVisibility(false);
  const tempFile = path.join(__dirname, `.capture-${width}x${height}-${Date.now()}.html`);
  try {
    fs.writeFileSync(tempFile, html, 'utf8');
    await captureWin.loadURL(pathToFileURL(tempFile).href);
    await wait(waitMs);
    // Crop to the intended artwork dimensions; the native window may reserve a
    // few device-independent pixels for the window menu/frame on some hosts.
    const image = await captureWin.webContents.capturePage({ x: 0, y: 0, width, height });
    const size = image.getSize();
    if (size.width !== width || size.height !== height) {
      throw new Error(`Unexpected capture size ${size.width}x${size.height}; expected ${width}x${height}`);
    }
    fs.writeFileSync(output, image.toPNG());
    console.log(`Captured ${path.relative(ROOT, output)} (${size.width}x${size.height})`);
  } finally {
    try { fs.unlinkSync(tempFile); } catch { /* best effort cleanup */ }
    captureWin.destroy();
  }
}

function buildBannerHtml() {
  const svg = fs.readFileSync(path.join(BRANDING, 'gytech-banner.svg'), 'utf8');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1600px;height:520px;overflow:hidden;background:#05090b}
    svg{display:block;width:1600px;height:520px}
  </style></head><body>${svg}</body></html>`;
}

function buildSocialHtml() {
  const svg = fs.readFileSync(path.join(BRANDING, 'social-preview.svg'), 'utf8');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1280px;height:640px;overflow:hidden;background:#05090b}
    svg{display:block;width:1280px;height:640px}
  </style></head><body>${svg}</body></html>`;
}

async function evaluate(win, code) {
  return win.webContents.executeJavaScript(code, true);
}

async function waitFor(win, expression, timeoutMs = 7000, interval = 150) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(win, expression)) return true;
    await wait(interval);
  }
  return false;
}

async function cleanShot(win, name) {
  win.show();
  win.focus();
  await evaluate(win, `document.getElementById('toastStack')?.replaceChildren(); true;`);
  await evaluate(win, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 120)))); true;`);
  await wait(220);
  // A warm-up capture encourages the compositor to present the latest modal
  // and waveform frame before the image that is written to disk.
  await win.webContents.capturePage();
  await wait(180);
  const image = await win.webContents.capturePage();
  const size = image.getSize();
  if (!size.width || !size.height) throw new Error(`Blank screenshot: ${name}`);
  const output = path.join(SHOTS, name);
  fs.writeFileSync(output, image.toPNG());
  console.log(`Captured ${path.relative(ROOT, output)} (${size.width}x${size.height})`);
}

async function closeModal(win) {
  await evaluate(win, `(() => {
    const modal = [...document.querySelectorAll('#modalLayer .modal')].find((m) => !m.hidden);
    modal?.querySelector('.modal-close')?.click();
    return true;
  })()`);
  await wait(650);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(BRANDING, { recursive: true });

  // 1. Brand assets, generated from original GYTech SVG/CSS artwork.
  await captureWindow({
    width: 1280,
    height: 640,
    html: buildSocialHtml(),
    output: path.join(BRANDING, 'social-preview.png'),
  });
  await wait(1000);
  await captureWindow({
    width: 1600,
    height: 520,
    html: buildBannerHtml(),
    output: path.join(BRANDING, 'gytech-banner.png'),
  });

  // 2. Application screenshots from the running application.
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    useContentSize: true,
    show: true,
    backgroundColor: '#080b0e',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
  win.focus();
  win.moveTop();
  win.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) console.log(`[page ${level}] ${message}`);
  });
  win.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer gone:', details);
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await win.webContents.session.clearStorageData();
  await wait(250);
  await win.reload();
  await wait(2600);

  // Main dashboard
  await cleanShot(win, 'main-dashboard.png');

  // ECG monitoring: atrial fibrillation demonstrates irregular morphology.
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('atrial-fibrillation');
    return true;
  })()`);
  await wait(1500);
  await cleanShot(win, 'ecg-monitoring.png');

  // 12-lead view
  await evaluate(win, `document.getElementById('btn12Lead').click(); true;`);
  await wait(1100);
  await cleanShot(win, 'ecg-12-lead.png');
  await closeModal(win);

  // SpO2 / pleth in a hypoxic scenario
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('hypoxia');
    return true;
  })()`);
  await wait(1500);
  await cleanShot(win, 'spo2-monitoring.png');

  // Capnography
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('hyperventilation');
    await new Promise((resolve) => setTimeout(resolve, 200));
    physiology.setCapnoPattern('obstruction');
    return true;
  })()`);
  await wait(1500);
  await cleanShot(win, 'capnography.png');

  // Vital signs overview with invasive channels enabled
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('normal-healthy');
    for (const key of ['ibp','cvp','pa','icp','bis']) physiology.setSensor(key, true);
    return true;
  })()`);
  await wait(1900);
  await cleanShot(win, 'vital-signs.png');

  // Alarm management with an active critical alarm
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('ventricular-fibrillation');
    await new Promise((resolve) => setTimeout(resolve, 500));
    document.getElementById('btnAlarms').click();
    return true;
  })()`);
  await wait(1400);
  await cleanShot(win, 'alarm-management.png');
  await closeModal(win);

  // Manual defibrillator UI, charged state
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    const { defibrillator } = await import('/js/defibrillator.js');
    physiology.startScenario('normal-healthy');
    await new Promise((resolve) => setTimeout(resolve, 250));
    defibrillator.setMode('manual');
    defibrillator.setPadsConnected(true);
    defibrillator.setEnergy(200);
    defibrillator.charge();
    return true;
  })()`);
  await waitFor(win, `(async () => {
    const { defibrillator } = await import('/js/defibrillator.js');
    return defibrillator.getStatus().machineState === 'CHARGED';
  })()`, 7000);
  await cleanShot(win, 'manual-defibrillator.png');

  // AED analysis result on a shockable rhythm
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    const { defibrillator } = await import('/js/defibrillator.js');
    physiology.startScenario('ventricular-fibrillation');
    await new Promise((resolve) => setTimeout(resolve, 600));
    defibrillator.setMode('aed');
    defibrillator.setPadsConnected(true);
    defibrillator.startAEDAnalysis();
    return true;
  })()`);
  await waitFor(win, `(async () => {
    const { defibrillator } = await import('/js/defibrillator.js');
    const s = defibrillator.getStatus();
    return s.aed && s.aed.recommendation !== null;
  })()`, 8000);
  await cleanShot(win, 'aed-mode.png');

  // Synchronized cardioversion, perfusing VT
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    const { defibrillator } = await import('/js/defibrillator.js');
    physiology.startScenario('stable-vt');
    await new Promise((resolve) => setTimeout(resolve, 450));
    defibrillator.setMode('sync');
    defibrillator.setPadsConnected(true);
    defibrillator.setSyncEnabled(true);
    return true;
  })()`);
  await wait(1100);
  await cleanShot(win, 'synchronized-cardioversion.png');

  // Pacing with capture on asystole
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    const { defibrillator } = await import('/js/defibrillator.js');
    physiology.startScenario('asystole');
    await new Promise((resolve) => setTimeout(resolve, 300));
    defibrillator.setMode('pacing');
    defibrillator.setPadsConnected(true);
    defibrillator.setPacingRate(70);
    defibrillator.setPacingOutput(90);
    defibrillator.setPacingActive(true);
    return true;
  })()`);
  await wait(1300);
  await cleanShot(win, 'pacing-mode.png');

  // CPR modal
  await evaluate(win, `(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('ventricular-fibrillation');
    await new Promise((resolve) => setTimeout(resolve, 500));
    document.getElementById('btnCPR').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    document.getElementById('btnCprToggle').click();
    return true;
  })()`);
  await wait(1700);
  await cleanShot(win, 'cpr-simulation.png');
  await closeModal(win);

  // Patient management
  await evaluate(win, `document.getElementById('btnPatients').click(); true;`);
  await wait(500);
  await cleanShot(win, 'patient-management.png');
  await closeModal(win);

  // Scenario selection
  await evaluate(win, `document.getElementById('btnScenarios').click(); true;`);
  await wait(400);
  await evaluate(win, `document.querySelector('[data-scenario-id="sepsis"]')?.click(); true;`);
  await wait(500);
  await cleanShot(win, 'scenario-selection.png');
  await closeModal(win);

  // Reload to a clean compositor state before capturing the reference-library
  // modals. Persisted simulation history remains available to the history view.
  await win.webContents.reload();
  await wait(2800);
  win.show();
  win.focus();
  win.moveTop();

  // Event history
  await evaluate(win, `document.getElementById('btnHistory').click(); true;`);
  await wait(900);
  const historyOpen = await evaluate(win, `!document.getElementById('modalHistory').hidden && !document.getElementById('modalLayer').hidden;`);
  if (!historyOpen) throw new Error('History modal did not open for capture.');
  await cleanShot(win, 'event-history.png');
  await closeModal(win);

  // Settings
  await evaluate(win, `document.getElementById('btnDeviceSettings').click(); true;`);
  await wait(900);
  const settingsOpen = await evaluate(win, `!document.getElementById('modalSettings').hidden && !document.getElementById('modalLayer').hidden;`);
  if (!settingsOpen) throw new Error('Settings modal did not open for capture.');
  await cleanShot(win, 'system-settings.png');
  await closeModal(win);

  await new Promise((resolve) => setTimeout(resolve, 300));
  win.destroy();
  server.close();
  app.quit();
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  if (server) server.close();
  app.exit(1);
});
