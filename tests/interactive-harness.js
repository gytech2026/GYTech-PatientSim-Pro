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
app.commandLine.appendSwitch('no-sandbox');
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

async function evaluate(code) {
  return win.webContents.executeJavaScript(code, true);
}

async function main() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
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
  await new Promise((resolve) => setTimeout(resolve, 1800));

  const results = await evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const mod = (path) => import(path + '?t=' + Date.now());
    // Query-string imports create a second module graph, so use the canonical
    // paths to access the already-running application modules.
    const state = await import('/js/state.js');
    const store = state.store;
    const phys = (await import('/js/physiology.js')).physiology;
    const alarms = (await import('/js/alarms.js')).alarmEngine;
    const defib = (await import('/js/defibrillator.js')).defibrillator;
    const wave = (await import('/js/waveform.js')).waveformEngine;
    const history = (await import('/js/history.js')).historyManager;
    const patients = (await import('/js/patient.js')).patientManager;
    const sim = (await import('/js/simulation.js')).simulation;
    const tests = [];
    const record = (name, pass, details = '') => tests.push({ name, pass: Boolean(pass), details: String(details) });
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const click = (selector) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error('Missing element ' + selector);
      el.click();
    };
    const closeModal = () => {
      const layer = document.getElementById('modalLayer');
      if (!layer.hidden) document.querySelector('#modalLayer .modal-close')?.click();
    };
    const activeModalId = () => [...document.querySelectorAll('#modalLayer .modal')].find((m) => !m.hidden)?.id || null;

    try {
      // TEST 1 — normal startup and numeric values
      const hrText = document.getElementById('vitalHR').textContent.trim();
      const spo2Text = document.getElementById('vitalSpO2').textContent.trim();
      record('TEST 1 Normal startup vitals', hrText !== '---' && spo2Text !== '---', 'HR=' + hrText + ' SpO2=' + spo2Text);

      // TEST 2 — HR changes alter ECG timing
      phys.setManualOverride('heartRate', 150);
      await wait(2100);
      const beforePeriod = 60 / 75;
      const ecgEvents = wave.ecgSource.ventricularEvents.map((e) => e.r).slice(-8);
      const intervals = ecgEvents.slice(1).map((t, i) => t - ecgEvents[i]);
      const avg = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
      record('TEST 2 HR influences ECG cycle timing', avg > 0 && avg < 0.55, 'avgRR=' + avg.toFixed(3) + 's at HR=' + Math.round(store.sim.heartRate));
      phys.clearManualOverride('heartRate');

      // TEST 3 — Asystole flat ECG + critical alarm
      phys.startScenario('asystole');
      await wait(900);
      const ecgTrace = wave.traces.get('ecg').buffer.slice(-300);
      const ecgRange = Math.max(...ecgTrace) - Math.min(...ecgTrace);
      const alarmTitles = alarms.activeAlarms.map((a) => a.title);
      record('TEST 3 Asystole flat trace + critical alarm', store.sim.rhythm === 'ASYSTOLE' && ecgRange < 0.05 && alarms.activeAlarms.some((a) => a.type === 'asystole'), 'range=' + ecgRange.toFixed(4) + ' alarms=' + alarmTitles.join('|'));

      // TEST 4 — VF chaotic waveform
      phys.startScenario('ventricular-fibrillation');
      await wait(900);
      const vfTrace = wave.traces.get('ecg').buffer.slice(-500);
      const vfMean = vfTrace.reduce((a, b) => a + b, 0) / vfTrace.length;
      const vfStd = Math.sqrt(vfTrace.reduce((a, b) => a + (b - vfMean) ** 2, 0) / vfTrace.length);
      record('TEST 4 VF chaotic ECG + critical alarm', store.sim.rhythm === 'VF' && vfStd > 0.08 && alarms.activeAlarms.some((a) => a.type === 'vf'), 'std=' + vfStd.toFixed(3));

      // TEST 5 — SpO2 sensor off removes reading
      phys.setSensor('spo2', false);
      await wait(400);
      const spo2OffText = document.getElementById('vitalSpO2').textContent.trim();
      const spo2Alarm = alarms.activeAlarms.some((a) => a.type === 'spo2Off');
      record('TEST 5 SpO2 disconnect shows unavailable + technical alarm', (spo2OffText === '---' || spo2OffText === '--') && spo2Alarm, 'display=' + spo2OffText + ' alarm=' + spo2Alarm);
      phys.setSensor('spo2', true);

      // TEST 6 — lead-off technical alarm
      phys.setLeadOff(true);
      await wait(350);
      const leadAlarm = alarms.activeAlarms.some((a) => a.type === 'leadsOff');
      record('TEST 6 ECG lead-off technical alarm', leadAlarm, 'alarm=' + leadAlarm);
      phys.setLeadOff(false);

      // TEST 7 — AED shockable analysis
      phys.startScenario('ventricular-fibrillation');
      defib.setMode('aed');
      defib.setPadsConnected(true);
      defib.startAEDAnalysis();
      await wait(4800);
      const aedShockable = defib.getStatus().aed.recommendation;
      record('TEST 7 AED shockable analysis', aedShockable && aedShockable.shockAdvise === true, 'recommendation=' + JSON.stringify(aedShockable));

      // TEST 9 — no shock while not charged
      const beforeShockCount = store.sim.defib.shockCount;
      const unchargedResult = defib.deliverShock();
      record('TEST 9 Shock unavailable before charging', unchargedResult.ok === false && store.sim.defib.shockCount === beforeShockCount, unchargedResult.reason);

      // Charge + deliver AED shock, verify no automatic ROSC
      const chargeResult = defib.charge();
      await wait(3700);
      const chargedState = defib.getStatus();
      defib.setAEDSafelyConfirmed(true);
      const shockResult = defib.deliverShock();
      await wait(1600);
      record('AED full workflow with no automatic ROSC', shockResult.ok === true && store.sim.defib.shockCount === beforeShockCount + 1 && store.sim.pulse === false, 'charge=' + chargeResult.ok + ' charged=' + chargedState.charged + ' pulse=' + store.sim.pulse + ' rhythm=' + store.sim.rhythm);

      // TEST 8 — AED non-shockable
      phys.startScenario('asystole');
      defib.setMode('aed');
      defib.setPadsConnected(true);
      defib.startAEDAnalysis();
      await wait(4700);
      const aedNonShock = defib.getStatus().aed.recommendation;
      record('TEST 8 AED non-shockable analysis', aedNonShock && aedNonShock.shockAdvise === false, 'recommendation=' + JSON.stringify(aedNonShock));

      // TEST 10 — pads disconnected prevents charging
      defib.setMode('manual');
      defib.setPadsConnected(false);
      const padCharge = defib.charge();
      record('TEST 10 Pads disconnected blocks charge', padCharge.ok === false && defib.canCharge() === false, padCharge.reason || '');
      defib.setPadsConnected(true);

      // TEST 11 — synchronized cardioversion markers
      phys.startScenario('stable-vt');
      defib.setMode('sync');
      defib.setSyncEnabled(true);
      await wait(600);
      const syncStatus = defib.getStatus();
      const syncMarkersVisible = syncStatus.mode === 'sync' && syncStatus.syncReady === true;
      record('TEST 11 Synchronized mode has valid marker state', syncMarkersVisible, 'mode=' + syncStatus.mode + ' syncReady=' + syncStatus.syncReady);

      // TEST 12 — pacing independent from defibrillation
      phys.startScenario('asystole');
      defib.setMode('pacing');
      defib.setPadsConnected(true);
      defib.setPacingRate(80);
      defib.setPacingOutput(80);
      const pacingStart = defib.setPacingActive(true);
      await wait(900);
      const pacingStatus = defib.getStatus();
      const pacingIndependent = pacingStatus.pacing.active && pacingStatus.pacing.electricalCapture && !pacingStatus.charged && pacingStatus.mode === 'pacing' && pacingStatus.machineState !== 'CHARGING';
      record('TEST 12 Pacing independent of defibrillation', pacingIndependent, 'active=' + pacingStatus.pacing.active + ' capture=' + pacingStatus.pacing.electricalCapture + ' state=' + pacingStatus.machineState);
      defib.setPacingActive(false);

      // TEST 13 — CPR compression counter
      phys.startScenario('ventricular-fibrillation');
      phys.startCPR();
      await wait(2200);
      const compressionCount = store.sim.cpr.compressions;
      record('TEST 13 CPR counter updates', compressionCount > 0, 'compressions=' + compressionCount + ' quality=' + store.sim.cpr.quality);
      phys.stopCPR();

      // TEST 14 — ROSC requires explicit recovery transition
      const roscBefore = phys.applyRosc({ trigger: 'test' });
      // Current VF should refuse explicit ROSC.
      const refusedOnVf = roscBefore.ok === false;
      phys.startScenario('rosc');
      phys.stopCPR({ silent: true });
      await wait(200);
      // Scenario ROSC is a configured progression at 25 s; force it by applying the documented recovery event through the scenario timer is slow.
      const beforeRosc = store.sim.pulse;
      const roscResult = phys.applyRosc({ trigger: 'test-explicit' });
      record('TEST 14 ROSC requires explicit valid recovery', refusedOnVf && roscResult.ok === true && beforeRosc === false && store.sim.pulse === true, 'refusedOnVF=' + refusedOnVf + ' rosc=' + JSON.stringify(roscResult));

      // TEST 15 — alarm silence retains active visual alarm
      phys.startScenario('asystole');
      await wait(500);
      const alarmCountBeforeSilence = alarms.activeAlarms.length;
      alarms.silence(120);
      await wait(300);
      const alarmCountAfterSilence = alarms.activeAlarms.length;
      record('TEST 15 Silence does not remove alarm condition', alarmCountBeforeSilence > 0 && alarmCountAfterSilence === alarmCountBeforeSilence && alarms.isSilenced() === true, 'before=' + alarmCountBeforeSilence + ' after=' + alarmCountAfterSilence);
      alarms.unsilence();

      // TEST 16 — patient switching resets transient device states
      defib.setMode('manual');
      defib.setPadsConnected(true);
      defib.charge();
      await wait(3500);
      const chargedBeforeSwitch = store.sim.defib.machineState === 'CHARGED';
      const other = patients.all.find((p) => p.id !== store.state.activePatientId);
      patients.select(other.id);
      await wait(600);
      const afterSwitch = defib.getStatus();
      record('TEST 16 Patient switch resets device state', chargedBeforeSwitch && afterSwitch.mode === 'monitor' && afterSwitch.machineState === 'MONITORING' && afterSwitch.charged === false, 'chargedBefore=' + chargedBeforeSwitch + ' afterMode=' + afterSwitch.mode + ' afterState=' + afterSwitch.machineState);

      // TEST 18 — event history records and CSV structure
      const sampleCsv = history.exportCSV();
      const eventCount = history.entries.length;
      record('TEST 18 Event history records timestamps', eventCount > 5 && history.entries.every((e) => e.timestamp && e.type && e.description), 'entries=' + eventCount);
      record('TEST 19 CSV export valid', sampleCsv.startsWith('GYTech PatientSim Pro — SIMULATION RECORD') && sampleCsv.includes('Copyright 2026 GYTech All Right Reserved.') && sampleCsv.includes('Timestamp') && sampleCsv.includes('\\r\\n'), 'length=' + sampleCsv.length);

      // Patient/Scenario modals and 12 lead render smoke tests
      click('#btnPatients');
      await wait(200);
      const patientModalOpen = !document.getElementById('modalPatients').hidden;
      document.querySelector('#modalPatients .modal-close').click();
      click('#btnScenarios');
      await wait(200);
      const scenarioModalOpen = !document.getElementById('modalScenarios').hidden;
      document.querySelector('#modalScenarios .modal-close').click();
      click('#btn12Lead');
      await wait(700);
      const twelveOpen = !document.getElementById('modalTwelveLead').hidden;
      const leadCanvases = [...document.querySelectorAll('.lead-cell canvas')].filter((c) => c.width > 0 && c.height > 0).length;
      document.querySelector('#modalTwelveLead .modal-close').click();
      record('Modal and 12-lead smoke tests', patientModalOpen && scenarioModalOpen && twelveOpen && leadCanvases === 12, 'patient=' + patientModalOpen + ' scenario=' + scenarioModalOpen + ' 12lead=' + twelveOpen + ' canvases=' + leadCanvases);

      // Persistence test flag set. The reload is performed by the parent harness.
      store.updateSettings({ screenTheme: 'high-contrast', tempUnit: 'F', pressureUnit: 'kPa' });
      store.sim.defib.mode = 'monitor';
      record('Persistence payload staged', true, 'theme/high-contrast temp/F pressure/kPa');

      // Clean up simulation but keep a screenshot-friendly state.
      phys.startScenario('normal-healthy');
      await wait(500);
      return { tests, consoleErrors: [], summary: { passed: tests.filter((t) => t.pass).length, failed: tests.filter((t) => !t.pass).length } };
    } catch (error) {
      return { tests, fatalError: String(error && error.stack || error), summary: { passed: tests.filter((t) => t.pass).length, failed: tests.filter((t) => !t.pass).length } };
    }
  })()`);

  await new Promise((resolve) => setTimeout(resolve, 700));
  try {
    const image = await win.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'screenshots', 'after-tests.png'), image.toPNG());
  } catch (error) {
    console.warn('Post-test screenshot skipped:', error.message);
  }

  // Reload test for persisted safe settings.
  await win.reload();
  await new Promise((resolve) => setTimeout(resolve, 1600));
  const reloadState = await evaluate(`(() => {
    const settings = JSON.parse(localStorage.getItem('gytech.patientsim.settings.v1') || '{}');
    return {
      theme: document.documentElement.dataset.theme,
      tempUnit: document.querySelector('#vitalTempUnit')?.textContent,
      pressureUnit: document.querySelector('.vital-nibp .vital-unit')?.textContent,
      defibMode: document.getElementById('defibScreenMode')?.textContent,
      defibState: document.getElementById('defibStateLabel')?.textContent,
      storedTheme: settings.screenTheme,
      storedTempUnit: settings.tempUnit,
      storedPressureUnit: settings.pressureUnit,
    };
  })()`);
  reloadState.pass = reloadState.theme === 'high-contrast' && reloadState.tempUnit === '°F' && reloadState.pressureUnit === 'kPa' && reloadState.defibMode.includes('MONITOR') && reloadState.defibState === 'MONITORING';
  try {
    const reloadImage = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'screenshots', 'reloaded-1920.png'), reloadImage.toPNG());
  } catch (error) {
    console.warn('Reload screenshot skipped:', error.message);
  }

  const report = {
    results,
    reloadPersistence: reloadState,
    consoleMessages,
    pageErrors,
  };
  fs.writeFileSync(path.join(__dirname, 'interactive-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    results?.summary?.failed > 0
    || results?.fatalError
    || pageErrors.length > 0
    || consoleMessages.some((entry) => entry.level >= 2)
    || !reloadState.pass
  ) {
    process.exitCode = 1;
  }

  // Reset persisted display settings for subsequent manual use.
  await evaluate(`(async () => {
    const { store } = await import('/js/state.js');
    store.resetSettings();
    return true;
  })()`);

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
