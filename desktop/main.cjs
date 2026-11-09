/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Native Electron desktop shell. The existing simulation UI remains a static
 * browser application served through a restrictive custom protocol.
 */

'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  net,
  protocol,
  screen,
  session,
  shell,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const packageJson = require('../package.json');
const {
  isGitHubReleaseUrl,
  isOfficialRepository,
  validateRelease,
} = require('./update-utils.cjs');

const APP_NAME = 'GYTech PatientSim Pro';
const APP_ID = 'com.gytech.patientsimpro';
const APP_SCHEME = 'app';
const APP_HOST = 'gytech';
const IS_SMOKE = process.env.GYTECH_SMOKE_TEST === '1';
const IS_MAC = process.platform === 'darwin';
const CURRENT_VERSION = packageJson.version;
const COPYRIGHT = 'Copyright © 2026 GYTech. All Rights Reserved.';

let mainWindow = null;
let logFile = null;
let logDirectory = null;
let windowStatePath = null;
let updateConfigCache = null;

app.setName(APP_NAME);
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

// Keep the browser test environment and the installed application separate.
if (IS_SMOKE) {
  const smokeData = process.env.GYTECH_SMOKE_USER_DATA
    || path.join(app.getPath('temp'), `gytech-patientsim-smoke-${process.pid}`);
  app.setPath('userData', smokeData);
}

const APP_DATA = path.join(app.getPath('appData'), APP_NAME);
if (!IS_SMOKE) {
  app.setPath('userData', APP_DATA);
}
app.setAppLogsPath(path.join(app.getPath('userData'), 'logs'));

const APP_ROOT = app.getAppPath();
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const ICON_PATH = path.join(APP_ROOT, 'build', 'icon.png');
const UPDATE_CONFIG_PATH = path.join(APP_ROOT, 'desktop', 'update-config.json');
const ALLOWED_HOSTS = new Set(['github.com', 'www.github.com']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function appendLog(level, message) {
  const line = `${new Date().toISOString()} [${String(level).toUpperCase()}] ${String(message).replace(/[\r\n]+/g, ' ').slice(0, 4000)}\n`;
  try {
    if (logFile) {
      fs.mkdirSync(logDirectory, { recursive: true });
      fs.appendFileSync(logFile, line, 'utf8');
      return;
    }
  } catch {
    // Logging must never crash the application.
  }
  if (level === 'error') console.error(line.trim());
}

function initialiseLogging() {
  logDirectory = app.getPath('logs');
  logFile = path.join(logDirectory, 'patientsim-pro.log');
  appendLog('info', `Application starting: ${APP_NAME} ${CURRENT_VERSION} on ${process.platform}/${process.arch}; packaged=${app.isPackaged}`);
}

function isAllowedAssetPath(pathname) {
  return pathname === '/index.html'
    || pathname.startsWith('/css/')
    || pathname.startsWith('/js/')
    || pathname.startsWith('/assets/');
}

function mimeTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    default: return 'application/octet-stream';
  }
}

function securityHeaders(contentType, isDocument) {
  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=()',
  };
  if (isDocument) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join('; ');
  }
  return headers;
}

async function handleAppProtocol(request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.host !== APP_HOST) {
    return new Response('Not found', { status: 404 });
  }
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname || '/');
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (!isAllowedAssetPath(pathname)) {
    return new Response('Not found', { status: 404 });
  }
  const filePath = path.resolve(APP_ROOT, `.${pathname}`);
  if (!filePath.startsWith(`${APP_ROOT}${path.sep}`)) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const body = await fs.promises.readFile(filePath);
    const isDocument = pathname.endsWith('.html');
    return new Response(body, {
      status: 200,
      headers: securityHeaders(mimeTypeFor(filePath), isDocument),
    });
  } catch (error) {
    appendLog('warn', `Static asset not found: ${pathname} (${error.code || 'read error'})`);
    return new Response('Not found', { status: 404 });
  }
}

function getUpdateConfig() {
  if (updateConfigCache) return updateConfigCache;
  const fallback = {
    enabled: true,
    repository: '',
    configured: false,
    releasesUrl: '',
    checkIntervalHours: 6,
    remindLaterHours: 24,
    releaseNotesMaxLength: 2400,
    configError: null,
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'));
    const repository = typeof parsed.repository === 'string' ? parsed.repository.trim() : '';
    const configured = isOfficialRepository(repository);
    updateConfigCache = {
      enabled: parsed.enabled !== false,
      repository,
      configured,
      releasesUrl: configured ? `https://github.com/${repository}/releases` : '',
      checkIntervalHours: Number.isFinite(parsed.checkIntervalHours) && parsed.checkIntervalHours >= 1
        ? Math.min(parsed.checkIntervalHours, 168)
        : 6,
      remindLaterHours: Number.isFinite(parsed.remindLaterHours) && parsed.remindLaterHours >= 1
        ? Math.min(parsed.remindLaterHours, 168)
        : 24,
      releaseNotesMaxLength: Number.isFinite(parsed.releaseNotesMaxLength)
        ? Math.max(200, Math.min(parsed.releaseNotesMaxLength, 8000))
        : 2400,
      configError: null,
    };
  } catch (error) {
    updateConfigCache = { ...fallback, configError: 'The desktop update configuration could not be read.' };
    appendLog('warn', `Update configuration unavailable: ${error.code || error.message}`);
  }
  return updateConfigCache;
}

async function fetchLatestRelease() {
  const updateConfig = getUpdateConfig();
  if (!updateConfig.enabled) {
    return { status: 'disabled', currentVersion: CURRENT_VERSION, message: 'Update checks are disabled.' };
  }
  if (!updateConfig.configured) {
    return {
      status: 'unconfigured',
      currentVersion: CURRENT_VERSION,
      message: updateConfig.configError
        || 'The official update repository has not been configured. No release check was performed.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const apiUrl = `https://api.github.com/repos/${updateConfig.repository}/releases/latest`;
    const response = await net.fetch(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `GYTech-PatientSim-Pro/${CURRENT_VERSION}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      appendLog('warn', `Update API returned HTTP ${response.status}`);
      if (response.status === 404) {
        return {
          status: 'no-release',
          currentVersion: CURRENT_VERSION,
          message: 'No stable release has been published for GYTech PatientSim Pro yet. You can check the official Releases page manually.',
        };
      }
      return {
        status: 'error',
        currentVersion: CURRENT_VERSION,
        message: response.status === 403 || response.status === 429
          ? 'The update service is temporarily rate-limited. Please try again later.'
          : 'The update service could not be contacted. Please try again later.',
      };
    }
    const text = await response.text();
    if (text.length > 1024 * 1024) {
      return { status: 'error', currentVersion: CURRENT_VERSION, message: 'The update response was unexpectedly large.' };
    }
    let release;
    try {
      release = JSON.parse(text);
    } catch {
      return { status: 'error', currentVersion: CURRENT_VERSION, message: 'The update response was not valid JSON.' };
    }
    const validation = validateRelease(release, CURRENT_VERSION);
    if (!validation.ok) {
      appendLog('warn', `Rejected release metadata: ${validation.reason}`);
      return { status: 'error', currentVersion: CURRENT_VERSION, message: validation.reason };
    }
    if (!validation.updateAvailable) {
      return {
        status: 'up-to-date',
        currentVersion: CURRENT_VERSION,
        latestVersion: validation.latestVersion,
        message: `You are running the latest stable version (${CURRENT_VERSION}).`,
      };
    }
    return {
      status: 'update-available',
      currentVersion: CURRENT_VERSION,
      latestVersion: validation.latestVersion,
      releaseName: validation.releaseName,
      releaseUrl: validation.releaseUrl,
      notes: validation.notes.slice(0, updateConfig.releaseNotesMaxLength),
      publishedAt: validation.publishedAt,
      message: 'A newer stable version is available.',
    };
  } catch (error) {
    appendLog('warn', `Update check failed: ${error.name || 'network error'}`);
    return {
      status: 'error',
      currentVersion: CURRENT_VERSION,
      message: error.name === 'AbortError'
        ? 'The update check timed out. You can continue using the simulator.'
        : 'Unable to check for updates while offline or unavailable. You can continue using the simulator.',
    };
  } finally {
    clearTimeout(timer);
  }
}

function isSafeExternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function windowStateFile() {
  if (!windowStatePath) {
    windowStatePath = path.join(app.getPath('userData'), 'window-state.json');
  }
  return windowStatePath;
}

function restoreWindowState() {
  const fallback = { width: 1600, height: 950 };
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (!Number.isFinite(state.width) || !Number.isFinite(state.height)) return fallback;
    const width = Math.max(1024, Math.min(Math.round(state.width), 3840));
    const height = Math.max(700, Math.min(Math.round(state.height), 2160));
    const candidate = {
      width,
      height,
      x: Number.isFinite(state.x) ? Math.round(state.x) : undefined,
      y: Number.isFinite(state.y) ? Math.round(state.y) : undefined,
    };
    if (candidate.x !== undefined && candidate.y !== undefined) {
      const display = screen.getDisplayMatching({ x: candidate.x, y: candidate.y, width, height });
      const bounds = display.workArea;
      if (candidate.x > bounds.x + bounds.width - 80 || candidate.y > bounds.y + bounds.height - 80
        || candidate.x + width < bounds.x + 80 || candidate.y + height < bounds.y + 80) {
        delete candidate.x;
        delete candidate.y;
      }
    }
    return candidate;
  } catch {
    return fallback;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.isMaximized() || mainWindow.isFullScreen()
      ? mainWindow.getNormalBounds()
      : mainWindow.getBounds();
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(windowStateFile(), JSON.stringify(bounds, null, 2), 'utf8');
  } catch (error) {
    appendLog('warn', `Could not save window state: ${error.code || error.message}`);
  }
}

function showNativeAbout() {
  const options = {
    type: 'info',
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} ${CURRENT_VERSION}`,
    detail: [
      'Advanced Patient Vital Signs Monitor & Defibrillator Simulator',
      '',
      'Publisher: GYTech',
      COPYRIGHT,
      '',
      'Educational simulation only. This is not a medical device and must not be used for real patient monitoring, diagnosis, treatment, emergency response, or clinical decision-making.',
      '',
      'No physical electrical output. Never connect to real medical equipment.',
    ].join('\n'),
    buttons: ['Close'],
    noLink: true,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, options);
  } else {
    dialog.showMessageBox(options);
  }
}

function buildApplicationMenu() {
  const template = [];
  if (IS_MAC) {
    template.push({ role: 'appMenu' });
  }
  template.push({
    label: 'File',
    submenu: [
      { role: 'quit' },
    ],
  });
  template.push({
    label: 'View',
    submenu: [
      {
        label: 'Toggle Full Screen',
        accelerator: IS_MAC ? 'Ctrl+Command+F' : 'F11',
        click: () => {
          if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
        },
      },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
    ],
  });
  if (!app.isPackaged) {
    template.push({
      label: 'Development',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
    });
  }
  template.push({
    label: 'Help',
    submenu: [
      {
        label: `About ${APP_NAME}`,
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
            mainWindow.webContents.send('gytech:show-about');
          } else {
            showNativeAbout();
          }
        },
      },
      {
        label: 'Check for Updates',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('gytech:check-updates');
          }
        },
      },
      {
        label: 'Open Application Logs',
        click: async () => {
          try {
            fs.mkdirSync(logDirectory, { recursive: true });
            await shell.openPath(logDirectory);
          } catch (error) {
            appendLog('error', `Could not open log directory: ${error.message}`);
          }
        },
      },
    ],
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    appendLog('warn', `Denied renderer permission request: ${permission}`);
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setSpellCheckerEnabled(false);
}

function hardenWebContents(webContents) {
  webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((error) => appendLog('warn', `External link failed: ${error.message}`));
    }
  });
  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((error) => appendLog('warn', `External link failed: ${error.message}`));
    }
    return { action: 'deny' };
  });
  webContents.on('will-attach-webview', (event) => event.preventDefault());
  webContents.on('render-process-gone', (event, details) => {
    appendLog('error', `Renderer process ended: ${details.reason} (${details.exitCode})`);
  });
}

async function runSmokeTest(win) {
  const resultPath = process.env.GYTECH_SMOKE_RESULT
    || path.join(app.getPath('temp'), 'gytech-patientsim-smoke-result.json');
  try {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const result = await win.webContents.executeJavaScript(`(() => {
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
      const canvases = [...document.querySelectorAll('.wave-card canvas')];
      return {
        title: document.title,
        readyState: document.readyState,
        appShell: Boolean(document.getElementById('appShell')),
        appName: text('.brand-name'),
        productLine: text('.brand-sub'),
        heartRate: text('#vitalHR'),
        spo2: text('#vitalSpO2'),
        rr: text('#vitalRR'),
        canvasCount: canvases.length,
        renderableCanvases: canvases.filter((canvas) => canvas.width > 0 && canvas.height > 0).length,
        modalHidden: document.getElementById('modalLayer')?.hidden === true,
        aboutVersion: text('#aboutVersion'),
        updateStatus: text('#updateStatusText'),
        updateChecksDisabled: document.getElementById('settingUpdateChecks')?.disabled === true,
        bootError: window.__gytechBootError || null,
      };
    })()`);
    result.pass = result.readyState === 'complete'
      && result.appShell
      && result.title.includes('GYTech PatientSim Pro')
      && result.appName === 'GYTECH'
      && result.canvasCount >= 8
      && result.renderableCanvases >= 8
      && result.heartRate !== ''
      && result.heartRate !== '--'
      && result.aboutVersion === CURRENT_VERSION
      && !result.bootError;
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
    appendLog(result.pass ? 'info' : 'error', `Desktop smoke test ${result.pass ? 'passed' : 'failed'}`);
    if (result.pass) {
      app.quit();
    } else {
      app.exit(1);
    }
  } catch (error) {
    try {
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify({ pass: false, error: error.message }, null, 2), 'utf8');
    } catch {
      // Nothing else can be done in this path.
    }
    appendLog('error', `Desktop smoke test failed: ${error.message}`);
    app.exit(1);
  }
}

function createWindow() {
  const state = restoreWindowState();
  mainWindow = new BrowserWindow({
    ...state,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: APP_NAME,
    backgroundColor: '#07110f',
    icon: ICON_PATH,
    autoHideMenuBar: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  hardenWebContents(mainWindow.webContents);
  mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`).catch((error) => {
    appendLog('error', `Failed to load application page: ${error.message}`);
    dialog.showErrorBox('GYTech PatientSim Pro', 'The application interface could not be loaded. Please reinstall the application or check the application log.');
  });

  mainWindow.once('ready-to-show', () => {
    if (!IS_SMOKE) mainWindow.show();
  });
  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    appendLog('info', 'Application interface loaded.');
    if (IS_SMOKE) runSmokeTest(mainWindow);
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && typeof input.key === 'string'
      && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      event.preventDefault();
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('gytech:get-app-info', () => {
    const updateConfig = getUpdateConfig();
    return {
      name: APP_NAME,
      productName: packageJson.productName || APP_NAME,
      description: packageJson.description,
      version: CURRENT_VERSION,
      publisher: 'GYTech',
      copyright: COPYRIGHT,
      licenseStatus: 'Apache-2.0',
      platform: process.platform,
      arch: process.arch,
      packaged: app.isPackaged,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      userDataPath: app.getPath('userData'),
      logPath: logFile,
      updateConfig: {
        enabled: updateConfig.enabled,
        repository: updateConfig.repository,
        configured: updateConfig.configured,
        checkIntervalHours: updateConfig.checkIntervalHours,
        remindLaterHours: updateConfig.remindLaterHours,
        releasesUrl: updateConfig.releasesUrl,
      },
    };
  });

  // Single-flight guard: renderer controls and the menu item can request a
  // check concurrently, but only one GitHub API request may run at a time.
  let updateCheckInFlight = null;
  ipcMain.handle('gytech:check-updates', async () => {
    if (updateCheckInFlight) return updateCheckInFlight;
    updateCheckInFlight = (async () => {
      const result = await fetchLatestRelease();
      appendLog('info', `Update check completed with status: ${result.status}`);
      return result;
    })();
    try {
      return await updateCheckInFlight;
    } finally {
      updateCheckInFlight = null;
    }
  });

  ipcMain.handle('gytech:open-external', async (event, url) => {
    if (!isSafeExternalUrl(url)) {
      appendLog('warn', 'Rejected external URL not on the approved GitHub allowlist.');
      return { ok: false, message: 'This external link is not approved.' };
    }
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      appendLog('warn', `Could not open external URL: ${error.message}`);
      return { ok: false, message: 'The release page could not be opened.' };
    }
  });

  ipcMain.handle('gytech:open-logs', async () => {
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
      const result = await shell.openPath(logDirectory);
      return { ok: !result, message: result || '' };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('gytech:log', (event, payload) => {
    if (!payload || typeof payload.message !== 'string') return { ok: false };
    const level = ['info', 'warn', 'error'].includes(payload.level) ? payload.level : 'info';
    appendLog(level, payload.message);
    return { ok: true };
  });
}

async function bootstrap() {
  initialiseLogging();
  protocol.handle(APP_SCHEME, handleAppProtocol);
  configurePermissions();
  registerIpcHandlers();
  buildApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (!IS_MAC) app.quit();
});

app.on('before-quit', () => {
  saveWindowState();
  appendLog('info', 'Application shutting down.');
});

process.on('uncaughtException', (error) => {
  appendLog('error', `Uncaught main-process error: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  appendLog('error', `Unhandled main-process rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(bootstrap).catch((error) => {
    appendLog('error', `Startup failed: ${error.message}`);
    dialog.showErrorBox('GYTech PatientSim Pro', 'The application could not start. Please check the application log or contact technical support.');
    app.exit(1);
  });
}
