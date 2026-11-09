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

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const consoleMessages = [];
const pageErrors = [];
let server;
let win;

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('background-throttling-disabled');

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (error, data) => {
        if (error) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shotsDir = path.join(__dirname, 'screenshots');

async function shot(name) {
  fs.mkdirSync(shotsDir, { recursive: true });
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(shotsDir, `${name}.png`), image.toPNG());
}

async function evaluate(code) {
  return win.webContents.executeJavaScript(code, true);
}

async function main() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: true,
    backgroundColor: '#080b0e',
    webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (!message.includes('Electron Security Warning')) consoleMessages.push({ level, message, line, sourceId });
  });
  win.webContents.on('render-process-gone', (event, details) => pageErrors.push(`render-process-gone ${JSON.stringify(details)}`));
  win.webContents.on('did-fail-load', (event, code, description, url) => pageErrors.push(`did-fail-load ${code} ${description} ${url}`));

  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await wait(3000);
  const checks = [];
  const record = (name, pass, details = '') => checks.push({ name, pass: Boolean(pass), details: String(details) });

  // Layout metrics at 1366 x 768
  let layout = await evaluate(`(() => {
    const app = document.getElementById('appShell').getBoundingClientRect();
    const dock = document.querySelector('.control-dock').getBoundingClientRect();
    const monitor = document.querySelector('.monitor-column').getBoundingClientRect();
    const vitals = document.querySelector('.vitals-rail').getBoundingClientRect();
    const defib = document.querySelector('.defib-column').getBoundingClientRect();
    const waves = [...document.querySelectorAll('.wave-card canvas')].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.id, w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      viewport: { w: innerWidth, h: innerHeight },
      app: { w: app.width, h: app.height },
      dock: { top: dock.top, h: dock.height },
      monitor: { w: monitor.width, h: monitor.height },
      vitals: { w: vitals.width, h: vitals.height },
      defib: { w: defib.width, h: defib.height },
      waves,
      bodyOverflowX: document.documentElement.scrollWidth - innerWidth,
      vitalOverlap: [...document.querySelectorAll('.vital-card')].some((a, i, all) => all.some((b, j) => i < j && a.getBoundingClientRect().top < b.getBoundingClientRect().bottom && a.getBoundingClientRect().left < b.getBoundingClientRect().right && a.getBoundingClientRect().right > b.getBoundingClientRect().left)),
    };
  })()`);
  record('1366x768 layout fills viewport without horizontal overflow', layout.bodyOverflowX <= 1 && layout.app.w <= layout.viewport.w && layout.app.h <= layout.viewport.h, JSON.stringify(layout.viewport) + ' overflow=' + layout.bodyOverflowX);
  record('Eight waveform canvases have non-zero dimensions', layout.waves.length === 8 && layout.waves.every((w) => w.w > 100 && w.h > 30), JSON.stringify(layout.waves));
  await shot('1366x768-initial');

  // Manual mode and charging through visible controls
  await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-defib-mode="manual"]').click();
    await wait(250);
    return true;
  })()`);
  const manualMode = await evaluate(`(() => ({
    energyButtons: [...document.querySelectorAll('#energyGrid .energy-button')].map((b) => b.textContent.trim()),
    chargeDisabled: document.getElementById('btnCharge').disabled,
    mode: document.getElementById('defibScreenMode').textContent,
    panel: document.getElementById('defibModeMonitorPanel').textContent.slice(0, 50),
  }))()`);
  record('Manual mode exposes energy presets and charge', manualMode.energyButtons.length >= 6 && manualMode.chargeDisabled === false && manualMode.mode.includes('MANUAL'), JSON.stringify(manualMode));
  await shot('1366x768-manual-mode');

  await evaluate(`(async () => {
    document.getElementById('btnCharge').click();
    await new Promise((r) => setTimeout(r, 1100));
    return true;
  })()`);
  const charging = await evaluate(`(() => ({
    state: document.getElementById('defibStateLabel').textContent,
    chargeText: document.getElementById('chargeStatusText').textContent,
    percent: document.getElementById('chargePercent').textContent,
  }))()`);
  record('Charge progress updates through UI', charging.state === 'CHARGING' && charging.percent !== '0%', JSON.stringify(charging));
  await shot('1366x768-charging');
  await evaluate(`(async () => {
    document.getElementById('btnDisarm').click();
    await new Promise((r) => setTimeout(r, 500));
    return true;
  })()`);

  // VF critical alarm visual state
  await evaluate(`(async () => {
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('ventricular-fibrillation');
    await new Promise((r) => setTimeout(r, 1300));
    return true;
  })()`);
  const critical = await evaluate(`(() => ({
    bannerVisible: !document.getElementById('alarmBanner').classList.contains('is-hidden'),
    title: document.getElementById('alarmBannerTitle').textContent,
    hr: document.getElementById('vitalHR').textContent,
    rhythmChip: document.getElementById('monitorRhythmChip').textContent,
    topAlarm: document.getElementById('topAlarmText').textContent,
  }))()`);
  record('Critical VF alarm banner and no fabricated HR', critical.bannerVisible && critical.title.includes('VENTRICULAR') && critical.hr === '---', JSON.stringify(critical));
  await shot('1366x768-critical-vf');

  // Patient creation through the visible form
  await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('btnPatients').click();
    await wait(250);
    document.getElementById('btnNewPatient').click();
    document.getElementById('patientName').value = 'Test Harness Patient';
    document.getElementById('patientId').value = 'PT-TEST99';
    document.getElementById('patientAge').value = '55';
    document.getElementById('patientHeight').value = '175';
    document.getElementById('patientWeight').value = '80';
    document.getElementById('patientRoom').value = 'SIM';
    document.getElementById('patientBed').value = '99';
    document.getElementById('patientHistory').value = 'Automated UI test.';
    document.getElementById('patientDiagnosis').value = 'Creation flow test.';
    document.getElementById('patientForm').requestSubmit();
    await wait(500);
    return true;
  })()`);
  const patientCreated = await evaluate(`(async () => {
    const { store } = await import('/js/state.js');
    return {
      exists: store.state.patients.some((p) => p.id === 'PT-TEST99'),
      active: store.state.activePatientId,
      topName: document.getElementById('topPatientName').textContent,
      feedback: document.getElementById('patientFormFeedback').textContent,
    };
  })()`);
  record('Patient creation form works', patientCreated.exists && patientCreated.active === 'PT-TEST99' && patientCreated.topName === 'Test Harness Patient', JSON.stringify(patientCreated));
  await shot('1366x768-patient-modal');

  // Delete test patient via confirm
  await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('btnDeletePatient').click();
    await wait(150);
    document.getElementById('confirmOk').click();
    await wait(400);
    return true;
  })()`);
  const patientDeleted = await evaluate(`(async () => {
    const { store } = await import('/js/state.js');
    return { exists: store.state.patients.some((p) => p.id === 'PT-TEST99'), modal: !document.getElementById('modalPatients').hidden };
  })()`);
  record('Patient deletion confirmation works', patientDeleted.exists === false, JSON.stringify(patientDeleted));
  await evaluate(`document.querySelector('#modalPatients .modal-close').click()`);

  // Alarm limit editing through UI
  await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('btnAlarms').click();
    await wait(200);
    const input = document.querySelector('[data-limit-high="heartRate"]');
    input.value = '155';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(300);
    return true;
  })()`);
  const alarmLimit = await evaluate(`(async () => {
    const { store } = await import('/js/state.js');
    return {
      limit: store.settings.alarmLimits.heartRate.high,
      rows: document.querySelectorAll('#alarmLimitRows tr').length,
      activeList: Boolean(document.getElementById('activeAlarmList')),
    };
  })()`);
  record('Alarm limit editable and persists', alarmLimit.limit === 155 && alarmLimit.rows === 8, JSON.stringify(alarmLimit));
  await shot('1366x768-alarms-modal');
  await evaluate(`document.querySelector('#modalAlarms .modal-close').click()`);

  // Sensors modal and SpO2 switch
  await evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('btnSensors').click();
    await wait(200);
    return true;
  })()`);
  const sensorsModal = await evaluate(`(() => ({
    cards: document.querySelectorAll('#sensorConfigGrid .sensor-config-card').length,
    nibpSelect: document.getElementById('nibpIntervalSelect').value,
  }))()`);
  record('Sensors configuration modal functional', sensorsModal.cards === 12 && sensorsModal.nibpSelect !== '', JSON.stringify(sensorsModal));
  await evaluate(`(async () => {
    const checkbox = document.querySelector('[data-sensor-toggle="spo2"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    return true;
  })()`);
  const spo2Off = await evaluate(`(async () => {
    const { store } = await import('/js/state.js');
    return { sensor: store.sim.sensors.spo2, display: document.getElementById('vitalSpO2').textContent };
  })()`);
  record('SpO2 toggle disconnects sensor and suppresses reading', spo2Off.sensor === false && spo2Off.display === '---', JSON.stringify(spo2Off));
  await shot('1366x768-sensors-modal');
  await evaluate(`(async () => {
    const checkbox = document.querySelector('[data-sensor-toggle="spo2"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    document.querySelector('#modalSensors .modal-close').click();
    return true;
  })()`);

  // 12 lead visual sanity
  await evaluate(`(async () => {
    document.getElementById('btn12Lead').click();
    await new Promise((r) => setTimeout(r, 800));
    return true;
  })()`);
  const twelve = await evaluate(`(() => {
    const canvases = [...document.querySelectorAll('#leadGrid canvas')];
    const sampled = canvases.map((c) => {
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let colored = 0;
      for (let i = 0; i < data.length; i += 64) {
        if (data[i + 1] > data[i] + 20 && data[i + 1] > 70) colored += 1;
      }
      return colored;
    });
    return { count: canvases.length, withSignal: sampled.filter((n) => n > 20).length, sizes: canvases.map((c) => [c.width, c.height]) };
  })()`);
  record('12-lead renders all channels with lead-specific signal', twelve.count === 12 && twelve.withSignal === 12, JSON.stringify({ ...twelve, sizes: twelve.sizes.slice(0, 3) }));
  await shot('1366x768-12lead');
  await evaluate(`document.querySelector('#modalTwelveLead .modal-close').click()`);

  // Instructor and CPR modals smoke
  await evaluate(`(async () => {
    document.getElementById('btnInstructor').click();
    await new Promise((r) => setTimeout(r, 300));
    return true;
  })()`);
  const instructor = await evaluate(`(() => ({
    open: !document.getElementById('modalInstructor').hidden,
    sliders: document.querySelectorAll('#modalInstructor input[type="range"]').length,
    rhythmOptions: document.querySelectorAll('#instructorRhythm option').length,
  }))()`);
  record('Instructor modal exposes complete controls', instructor.open && instructor.sliders >= 7 && instructor.rhythmOptions === 14, JSON.stringify(instructor));
  await shot('1366x768-instructor');
  await evaluate(`document.querySelector('#modalInstructor .modal-close').click()`);
  await evaluate(`(async () => {
    document.getElementById('btnCPR').click();
    await new Promise((r) => setTimeout(r, 250));
    document.getElementById('btnCprToggle').click();
    await new Promise((r) => setTimeout(r, 1200));
    return true;
  })()`);
  const cpr = await evaluate(`(() => ({
    active: !document.getElementById('modalCPR').hidden,
    compressions: document.getElementById('cprCompressionCount').textContent,
    quality: document.getElementById('cprQuality').textContent,
    strip: document.getElementById('cprStripCount').textContent,
  }))()`);
  record('CPR modal counts simulated compressions', Number(cpr.compressions) > 0 && cpr.quality !== '--' && Number(cpr.strip) > 0, JSON.stringify(cpr));
  await shot('1366x768-cpr');
  await evaluate(`(async () => {
    document.getElementById('btnCprToggle').click();
    document.querySelector('#modalCPR .modal-close').click();
    const { physiology } = await import('/js/physiology.js');
    physiology.startScenario('normal-healthy');
    const { store } = await import('/js/state.js');
    store.updateSettings({ alarmLimits: { ...store.settings.alarmLimits, heartRate: { ...store.settings.alarmLimits.heartRate, high: 120 } } });
    return true;
  })()`);

  // Each dock button must open its intended modal exactly once.
  const modalOpenings = await evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const pairs = [
      ['btnPatients', 'modalPatients'],
      ['btnScenarios', 'modalScenarios'],
      ['btnInstructor', 'modalInstructor'],
      ['btnCPR', 'modalCPR'],
      ['btnAlarms', 'modalAlarms'],
      ['btnECGSettings', 'modalECG'],
      ['btnSensors', 'modalSensors'],
      ['btnHistory', 'modalHistory'],
      ['btn12Lead', 'modalTwelveLead'],
      ['btnDeviceSettings', 'modalSettings'],
      ['btnDiagnostics', 'modalDiagnostics'],
    ];
    const results = {};
    for (const [buttonId, modalId] of pairs) {
      const button = document.getElementById(buttonId);
      button?.click();
      await wait(180);
      results[modalId] = Boolean(document.getElementById(modalId) && !document.getElementById(modalId).hidden);
      document.querySelector('#' + modalId + ' .modal-close')?.click();
      await wait(120);
    }
    return results;
  })()`);
  const failedModals = Object.entries(modalOpenings).filter(([, open]) => !open).map(([id]) => id);
  record('Every dock control opens its intended modal', failedModals.length === 0, 'failed=' + JSON.stringify(failedModals));

  // Responsive 1280 x 720
  win.setSize(1280, 720);
  await wait(800);
  layout = await evaluate(`(() => {
    const app = document.getElementById('appShell').getBoundingClientRect();
    const waves = [...document.querySelectorAll('.wave-card canvas')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    const vitalCards = [...document.querySelectorAll('.vital-card')];
    const anyOverflow = vitalCards.some((card) => card.scrollWidth > card.clientWidth + 2);
    return {
      viewport: [innerWidth, innerHeight],
      app: [app.width, app.height],
      overflowX: document.documentElement.scrollWidth - innerWidth,
      waveSizes: waves,
      vitalOverflow: anyOverflow,
      topbarOverflow: document.querySelector('.topbar').scrollWidth - document.querySelector('.topbar').clientWidth,
    };
  })()`);
  record('1280x720 responsive layout adapts', layout.app[0] <= layout.viewport[0] + 1 && layout.overflowX <= 1 && layout.waveSizes.every(([w, h]) => w > 50 && h > 20), JSON.stringify(layout));
  await shot('1280x720-initial');

  // Tablet width layout
  win.setSize(1024, 768);
  await wait(700);
  const tablet = await evaluate(`(() => {
    const app = document.getElementById('appShell').getBoundingClientRect();
    const defib = document.querySelector('.defib-column').getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], app: [app.width, app.height], overflowX: document.documentElement.scrollWidth - innerWidth, defibWidth: Math.round(defib.width) };
  })()`);
  record('Tablet layout reflows without document overflow', tablet.app[0] <= tablet.viewport[0] + 1 && tablet.overflowX <= 1, JSON.stringify(tablet));
  await shot('1024x768-tablet');

  // 1600x900 and 1920x1080 desktop adaptation
  win.setSize(1600, 900);
  await wait(700);
  const desktop1600 = await evaluate(`(() => {
    const app = document.getElementById('appShell').getBoundingClientRect();
    const topbar = document.querySelector('.topbar');
    return {
      viewport: [innerWidth, innerHeight], app: [app.width, app.height],
      overflowX: document.documentElement.scrollWidth - innerWidth,
      topbarOverflow: topbar.scrollWidth - topbar.clientWidth,
      columns: getComputedStyle(document.querySelector('.workstation')).gridTemplateColumns,
      dateVisible: getComputedStyle(document.querySelector('.date-readout')).display !== 'none',
      networkVisible: getComputedStyle(document.querySelector('.network-readout')).display !== 'none',
    };
  })()`);
  record('1600x900 layout and status items', desktop1600.app[0] <= desktop1600.viewport[0] + 1 && desktop1600.overflowX <= 1 && desktop1600.topbarOverflow <= 1 && desktop1600.dateVisible && desktop1600.networkVisible, JSON.stringify(desktop1600));
  await shot('1600x900-initial');

  win.setSize(1920, 1080);
  await wait(700);
  const desktop1920 = await evaluate(`(() => {
    const app = document.getElementById('appShell').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight], app: [app.width, app.height],
      overflowX: document.documentElement.scrollWidth - innerWidth,
      columns: getComputedStyle(document.querySelector('.workstation')).gridTemplateColumns,
      waveHeights: [...document.querySelectorAll('.wave-card canvas')].map((c) => Math.round(c.getBoundingClientRect().height)),
    };
  })()`);
  record('1920x1080 layout fills without overflow', desktop1920.app[0] <= desktop1920.viewport[0] + 1 && desktop1920.overflowX <= 1 && desktop1920.waveHeights.every((h) => h > 30), JSON.stringify(desktop1920));
  await shot('1920x1080-initial');

  const report = { checks, layout, tablet, desktop1600, desktop1920, consoleMessages, pageErrors, summary: { passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).length } };
  fs.writeFileSync(path.join(__dirname, 'ui-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    report.summary.failed > 0
    || pageErrors.length > 0
    || consoleMessages.some((entry) => entry.level >= 2)
  ) {
    process.exitCode = 1;
  }

  // restore normal window and settings
  win.setSize(1366, 768);
  await evaluate(`(async () => { const { store } = await import('/js/state.js'); store.resetSettings(); return true; })()`);
  const exitCode = process.exitCode || 0;
  if (win) win.destroy();
  if (server) server.close();
  app.exit(exitCode);
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  if (win) win.destroy();
  if (server) server.close();
  app.exit(1);
});
