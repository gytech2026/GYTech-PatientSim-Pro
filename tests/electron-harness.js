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
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('background-throttling-disabled');

let server;
let win;
const consoleMessages = [];
const pageErrors = [];
const failedRequests = [];

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
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
    width: 1920,
    height: 1080,
    show: true,
    backgroundColor: '#080b0e',
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    consoleMessages.push({ level, message, line, sourceId });
  });
  win.webContents.on('render-process-gone', (event, details) => {
    pageErrors.push(`render-process-gone: ${JSON.stringify(details)}`);
  });
  win.webContents.on('did-fail-load', (event, code, description, url) => {
    pageErrors.push(`did-fail-load: ${code} ${description} ${url}`);
  });
  win.webContents.session.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    failedRequests.push(`${details.url} ${details.error}`);
  });

  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const diagnostics = await win.webContents.executeJavaScript(`(() => {
    const ids = ['topPatientName','vitalHR','vitalSpO2','vitalRR','defibWaveCanvas','waveECG','patientList','scenarioList','alarmLimitRows'];
    const elementStatus = {};
    for (const id of ids) elementStatus[id] = Boolean(document.getElementById(id));
    return {
      title: document.title,
      readyState: document.readyState,
      elementStatus,
      appShell: Boolean(document.getElementById('appShell')),
      modalLayerHidden: document.getElementById('modalLayer')?.hidden,
      vitalHR: document.getElementById('vitalHR')?.textContent,
      vitalSpO2: document.getElementById('vitalSpO2')?.textContent,
      defibState: document.getElementById('defibStateLabel')?.textContent,
      waveCanvases: [...document.querySelectorAll('.wave-card canvas')].map((c) => ({ id: c.id, w: c.width, h: c.height })),
      bootError: window.__gytechBootError || null,
    };
  })()`);

  fs.mkdirSync(path.join(__dirname, 'screenshots'), { recursive: true });
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'screenshots', 'initial-1920.png'), image.toPNG());

  const report = {
    diagnostics,
    consoleMessages,
    pageErrors,
    failedRequests,
  };
  fs.writeFileSync(path.join(__dirname, 'load-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const actionableConsoleErrors = consoleMessages.filter((entry) => entry.level >= 2 && !entry.message.includes('Electron Security Warning'));
  if (pageErrors.length > 0 || failedRequests.length > 0 || actionableConsoleErrors.length > 0) {
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
