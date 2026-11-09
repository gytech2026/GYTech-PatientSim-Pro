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

async function main() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: true,
    backgroundColor: '#080b0e',
    webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.webContents.on('console-message', (event, level, message) => {
    if (!message.includes('Electron Security Warning')) consoleMessages.push({ level, message });
  });
  win.webContents.on('render-process-gone', (event, details) => pageErrors.push(JSON.stringify(details)));
  win.webContents.on('did-fail-load', (event, code, description, url) => pageErrors.push(`${code} ${description} ${url}`));
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await new Promise((resolve) => setTimeout(resolve, 2200));

  const results = await win.webContents.executeJavaScript(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const { store, RHYTHMS } = await import('/js/state.js');
    const { physiology } = await import('/js/physiology.js');
    const { defibrillator } = await import('/js/defibrillator.js');
    const { waveformEngine } = await import('/js/waveform.js');
    const { alarmEngine } = await import('/js/alarms.js');
    const { SCENARIOS } = await import('/js/scenarios.js');
    const checks = [];
    const record = (name, pass, details = '') => checks.push({ name, pass: Boolean(pass), details: String(details) });

    const validVitals = (v) => ['hr','spo2','rr','etco2','tempC','temp2C','pr'].every((key) => v[key] === null || Number.isFinite(v[key]))
      && [store.sim.bpSys, store.sim.bpDia, store.sim.map].every((value) => Number.isFinite(value));

    // Every scenario starts with a coherent state and selectable rhythm.
    const scenarioFailures = [];
    for (const scenario of SCENARIOS) {
      const start = physiology.startScenario(scenario.id);
      await wait(160);
      const sim = store.sim;
      const v = physiology.getVitals();
      const lethal = sim.rhythm === 'VF' || sim.rhythm === 'ASYSTOLE';
      const bad = !start.ok
        || sim.rhythm !== scenario.initial.rhythm
        || !validVitals(v)
        || (lethal && (sim.pulse !== false || sim.bpSys !== 0))
        || !Number.isFinite(sim.tempC)
        || sim.heartRate < 0 || sim.heartRate > 300;
      if (bad) scenarioFailures.push({ id: scenario.id, rhythm: sim.rhythm, expected: scenario.initial.rhythm, pulse: sim.pulse, bp: sim.bpSys });
    }
    record('All 20 scenarios start with coherent physiology', SCENARIOS.length === 20 && scenarioFailures.length === 0, 'count=' + SCENARIOS.length + ' failures=' + JSON.stringify(scenarioFailures));

    // Every rhythm produces finite waveform data and respects lethal pulse rules.
    const rhythmFailures = [];
    physiology.startScenario('normal-healthy');
    for (const rhythm of RHYTHMS) {
      physiology.setRhythm(rhythm);
      await wait(360);
      const buffer = waveformEngine.traces.get('ecg').buffer.slice(-300);
      const allFinite = buffer.every((sample) => Number.isFinite(sample));
      const lethal = rhythm === 'VF' || rhythm === 'ASYSTOLE';
      const sim = store.sim;
      if (!allFinite || (lethal && sim.pulse !== false)) {
        rhythmFailures.push({ rhythm, allFinite, pulse: sim.pulse });
      }
    }
    record('All 14 rhythms generate finite waveforms and coherent pulse state', RHYTHMS.length === 14 && rhythmFailures.length === 0, 'failures=' + JSON.stringify(rhythmFailures));

    // Pacing failure to capture below threshold, then capture above threshold.
    physiology.startScenario('asystole');
    defibrillator.setMode('pacing');
    defibrillator.setPadsConnected(true);
    defibrillator.setPacingRate(70);
    defibrillator.setPacingOutput(20);
    defibrillator.setPacingActive(true);
    await wait(400);
    const noCapture = defibrillator.getStatus().pacing;
    defibrillator.setPacingOutput(90);
    await wait(400);
    const capture = defibrillator.getStatus().pacing;
    record('Pacing failure-to-capture and capture states are distinct', noCapture.mechanicalCapture === false && noCapture.electricalCapture === false && capture.mechanicalCapture === true && capture.electricalCapture === true, 'low=' + JSON.stringify(noCapture) + ' high=' + JSON.stringify(capture));
    defibrillator.setPacingActive(false);

    // Synchronized cardioversion full flow.
    physiology.startScenario('stable-vt');
    await wait(400);
    defibrillator.setMode('sync');
    defibrillator.setPadsConnected(true);
    defibrillator.setEnergy(100);
    await wait(350);
    const syncReadyBefore = defibrillator.getStatus().syncReady;
    const beforeSyncShock = store.sim.defib.shockCount;
    defibrillator.charge();
    await wait(3600);
    const syncShockResult = defibrillator.deliverShock();
    await wait(400);
    record('Synchronized cardioversion converts perfusing VT', syncReadyBefore && syncShockResult.ok === true && store.sim.rhythm === 'NSR' && store.sim.pulse === true && store.sim.defib.shockCount === beforeSyncShock + 1, 'rhythm=' + store.sim.rhythm + ' pulse=' + store.sim.pulse + ' shock=' + JSON.stringify(syncShockResult));

    // Charge and disarm transition through the FSM.
    physiology.startScenario('normal-healthy');
    await wait(250);
    defibrillator.setMode('manual');
    defibrillator.setPadsConnected(true);
    defibrillator.charge();
    await wait(3500);
    const stateCharged = defibrillator.getStatus().machineState;
    defibrillator.disarm('test');
    await wait(500);
    const stateAfterDisarm = defibrillator.getStatus().machineState;
    record('Charge and disarm FSM transitions valid', stateCharged === 'CHARGED' && stateAfterDisarm === 'READY' && store.sim.defib.charged === false, 'charged=' + stateCharged + ' after=' + stateAfterDisarm);

    // NIBP is intermittent and completes a measurement.
    defibrillator.reset({ preserveBattery: true, silent: true });
    physiology.startScenario('normal-healthy');
    await wait(300);
    const beforeMeasure = store.sim.nibp.lastTime;
    const nibpStart = physiology.requestNIBP();
    await wait(8600);
    const afterMeasure = store.sim.nibp.lastTime;
    record('Intermittent NIBP completes with fresh timestamp', nibpStart.ok && afterMeasure > beforeMeasure && Number.isFinite(store.sim.nibp.lastSystolic), 'start=' + nibpStart.ok + ' before=' + beforeMeasure + ' after=' + afterMeasure + ' value=' + store.sim.nibp.lastSystolic);

    // Deterministic scenario progression updates connected parameters and alarms.
    physiology.startScenario('sepsis');
    await wait(250);
    const bpBefore = store.sim.bpSys;
    store.sim.scenario.elapsed = 80;
    await wait(500);
    const bpAfter = store.sim.bpSys;
    const alarmTypes = alarmEngine.activeAlarms.map((a) => a.type);
    record('Sepsis scenario progression applies connected deterioration', bpAfter < bpBefore && store.sim.heartRate > 120 && store.sim.tempC > 38, 'bpBefore=' + bpBefore + ' bpAfter=' + bpAfter + ' hr=' + store.sim.heartRate + ' temp=' + store.sim.tempC + ' alarms=' + alarmTypes.join('|'));

    // CPR supplies partial simulated circulation during arrest but does not create ROSC.
    physiology.startScenario('ventricular-fibrillation');
    await wait(400);
    const bpNoCpr = store.sim.bpSys;
    physiology.startCPR();
    await wait(2600);
    const bpCpr = store.sim.bpSys;
    const pulseAfterCpr = store.sim.pulse;
    physiology.stopCPR({ silent: true });
    record('CPR creates partial simulated circulation without ROSC', bpCpr > bpNoCpr && pulseAfterCpr === false, 'bpNoCpr=' + bpNoCpr + ' bpCpr=' + Math.round(bpCpr) + ' pulse=' + pulseAfterCpr);

    // Non-lethal shock must not force ROSC.
    physiology.startScenario('ventricular-fibrillation');
    await wait(250);
    const shock = physiology.applyShock({ synchronized: false, mode: 'test' });
    record('Shock does not automatically establish ROSC', shock.ok === true && store.sim.pulse === false && store.sim.defib.shockCount > 0, 'rhythm=' + store.sim.rhythm + ' pulse=' + store.sim.pulse);

    // Alarm source remains after silence and acknowledges correctly.
    physiology.startScenario('asystole');
    await wait(500);
    const activeBefore = alarmEngine.activeAlarms.length;
    alarmEngine.silence(30);
    alarmEngine.acknowledgeAll();
    const activeAfter = alarmEngine.activeAlarms.length;
    const allAcknowledged = alarmEngine.activeAlarms.every((a) => a.acknowledged);
    record('Acknowledging keeps active visual alarm conditions', activeBefore > 0 && activeAfter === activeBefore && allAcknowledged, 'before=' + activeBefore + ' after=' + activeAfter + ' acked=' + allAcknowledged);

    // Warning escalation persists once triggered.
    alarmEngine.unsilence();
    physiology.startScenario('normal-healthy');
    await wait(300);
    physiology.setManualOverride('heartRate', 165);
    await wait(400);
    alarmEngine.evaluate(true);
    const warningAlarm = [...alarmEngine.active.values()].find((alarm) => alarm.type === 'hrHigh');
    if (warningAlarm) warningAlarm.since = Date.now() - 46000;
    alarmEngine.evaluate(true);
    const escalatedOnce = [...alarmEngine.active.values()].find((alarm) => alarm.type === 'hrHigh');
    alarmEngine.evaluate(true);
    const escalatedTwice = [...alarmEngine.active.values()].find((alarm) => alarm.type === 'hrHigh');
    record('Warning alarm escalation persists', Boolean(escalatedOnce?.escalated) && escalatedOnce.priority === 'critical' && escalatedTwice?.priority === 'critical' && escalatedTwice.title.startsWith('ESCALATED'), 'first=' + JSON.stringify(escalatedOnce && { p: escalatedOnce.priority, title: escalatedOnce.title, esc: escalatedOnce.escalated }) + ' second=' + JSON.stringify(escalatedTwice && { p: escalatedTwice.priority, title: escalatedTwice.title }));

    // AED classification must use rhythm and explicit pulse state together.
    physiology.startScenario('stable-vt');
    await wait(220);
    const stableVtRecommendation = physiology.getAEDRecommendation();
    physiology.startScenario('pulseless-vt');
    await wait(220);
    const pulselessVtRecommendation = physiology.getAEDRecommendation();
    physiology.startScenario('pea');
    await wait(220);
    const peaRecommendation = physiology.getAEDRecommendation();
    record(
      'AED classification respects rhythm and explicit pulse state',
      stableVtRecommendation.shockAdvise === false
        && pulselessVtRecommendation.shockAdvise === true
        && peaRecommendation.shockAdvise === false,
      'stableVT=' + stableVtRecommendation.shockAdvise
        + ' pulselessVT=' + pulselessVtRecommendation.shockAdvise
        + ' PEA=' + peaRecommendation.shockAdvise
    );

    // Restore normal state for screenshots.
    physiology.clearManualOverride('heartRate');
    physiology.startScenario('normal-healthy');
    await wait(700);

    return { checks, summary: { passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).length } };
  })()`);

  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'screenshots', 'deep-tests-final.png'), image.toPNG());

  const report = { results, consoleMessages, pageErrors };
  fs.writeFileSync(path.join(__dirname, 'deep-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    results?.summary?.failed > 0
    || results?.fatalError
    || pageErrors.length > 0
    || consoleMessages.some((entry) => entry.level >= 2)
  ) {
    process.exitCode = 1;
  }

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
