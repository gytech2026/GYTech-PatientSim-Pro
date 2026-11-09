/**
 * GYTech PatientSim Pro — repository validation.
 * Zero-dependency structural, syntax, link, branding and screenshot checks.
 *
 * Usage: node scripts/validate-repository.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];
const passes = [];

const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const pass = (message) => passes.push(message);
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const requireFiles = (files) => {
  for (const file of files) {
    if (!exists(file)) fail(`Missing required file: ${file}`);
  }
};

const requiredRootFiles = [
  'README.md', 'LICENSE', 'LICENSE-FAQ.md', 'NOTICE', 'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'CHANGELOG.md', 'CITATION.cff',
  'AUTHORS.md', 'ACKNOWLEDGMENTS.md', 'ROADMAP.md', 'INSTALLATION.md', 'PRIVACY.md',
  'DISCLAIMER.md', 'THIRD_PARTY_NOTICES.md', '.gitignore', '.gitattributes',
  '.editorconfig', 'DEVELOPER_GUIDE.md', 'TESTING_REPORT.md',
  'PROJECT_AUDIT_REPORT.md', 'index.html',
  'package.json', 'package-lock.json', 'serve.js', 'electron-builder.yml',
  'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/update-utils.cjs',
  'desktop/update-config.json',
  'build/icon.ico', 'build/icon.icns', 'build/icon.png',
  'build/icons/16x16.png', 'build/icons/32x32.png', 'build/icons/48x48.png',
  'build/icons/64x64.png', 'build/icons/128x128.png', 'build/icons/256x256.png',
  'build/icons/512x512.png', 'build/icons/1024x1024.png',
  'build/PORTABLE-README.txt',
  'scripts/generate-checksums.mjs', 'scripts/desktop-smoke.mjs',
  'tests/desktop-harness.js', 'tests/desktop-test-preload.cjs',
  'legal/LICENSE-APACHE-2.0-PROPOSED.txt',
  'legal/electron-LICENSE.txt',
];
const requiredDocs = [
  'docs/ARCHITECTURE.md', 'docs/USER_GUIDE.md', 'docs/SIMULATION_GUIDE.md',
  'docs/DEFIBRILLATOR_GUIDE.md', 'docs/ECG_GUIDE.md', 'docs/ALARM_GUIDE.md',
  'docs/TROUBLESHOOTING.md', 'docs/GITHUB_REPOSITORY_SETUP.md',
  'docs/RELEASE_NOTES_v1.0.0.md', 'docs/RELEASE_NOTES_TEMPLATE.md',
  'docs/SCREENSHOT_GUIDE.md', 'docs/DESKTOP_APPLICATION.md',
  'docs/CROSS_PLATFORM_BUILD.md', 'docs/UPDATE_SYSTEM.md',
];
const requiredGithub = [
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/documentation.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ci.yml',
  '.github/workflows/code-quality.yml',
  '.github/workflows/security.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/desktop-release.yml',
  '.github/dependabot.yml',
];
const requiredAppFiles = [
  'css/main.css', 'css/dashboard.css', 'css/monitor.css', 'css/waveform.css',
  'css/defibrillator.css', 'css/alarms.css', 'css/modal.css', 'css/responsive.css',
  'js/app.js', 'js/state.js', 'js/patient.js', 'js/physiology.js', 'js/vitals.js',
  'js/ecg.js', 'js/ecg12lead.js', 'js/spo2.js', 'js/respiration.js',
  'js/capnography.js', 'js/bloodpressure.js', 'js/temperature.js', 'js/pacing.js',
  'js/alarms.js', 'js/defibrillator.js', 'js/aed.js', 'js/scenarios.js',
  'js/simulation.js', 'js/waveform.js', 'js/history.js', 'js/audio.js',
  'js/settings.js', 'js/utilities.js', 'js/desktop.js',
];
const requiredScreenshots = [
  'main-dashboard.png', 'ecg-monitoring.png', 'ecg-12-lead.png',
  'spo2-monitoring.png', 'capnography.png', 'vital-signs.png',
  'alarm-management.png', 'manual-defibrillator.png', 'aed-mode.png',
  'synchronized-cardioversion.png', 'pacing-mode.png', 'cpr-simulation.png',
  'patient-management.png', 'scenario-selection.png', 'event-history.png',
  'system-settings.png',
].map((name) => `assets/screenshots/${name}`);
const requiredBranding = [
  'assets/branding/gytech-logo.svg',
  'assets/branding/gytech-banner.svg',
  'assets/branding/gytech-banner.png',
  'assets/branding/social-preview.png',
  'assets/branding/social-preview.svg',
  'assets/icons/gytech-patientsim-mark.svg',
];

requireFiles(requiredRootFiles);
requireFiles(requiredDocs);
requireFiles(requiredGithub);
requireFiles(requiredAppFiles);
requireFiles(requiredScreenshots);
requireFiles(requiredBranding);
if (failures.length === 0) pass('Required repository, application, documentation and branding files exist.');

// JSON files parse.
for (const file of ['package.json', 'desktop/update-config.json']) {
  try {
    JSON.parse(read(file));
    pass(`${file} is valid JSON.`);
  } catch (error) {
    fail(`${file} is invalid JSON: ${error.message}`);
  }
}

// Desktop update configuration must remain honest until the owner sets a real
// repository. An empty value is valid and is the current intentional state.
try {
  const updateConfig = JSON.parse(read('desktop/update-config.json'));
  if (typeof updateConfig.repository !== 'string') {
    fail('desktop/update-config.json repository must be a string.');
  } else if (updateConfig.repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(updateConfig.repository)) {
    fail('desktop/update-config.json repository is not in owner/repository form.');
  } else {
    pass('Desktop update configuration is syntactically valid and contains no fabricated repository when blank.');
  }
} catch (error) {
  fail(`desktop/update-config.json could not be checked: ${error.message}`);
}

// Package and renderer version must agree; file version is not fabricated.
try {
  const packageVersion = JSON.parse(read('package.json')).version;
  const stateVersion = read('js/state.js').match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
  if (!stateVersion || packageVersion !== stateVersion) {
    fail(`Version mismatch between package.json (${packageVersion}) and js/state.js (${stateVersion || 'missing'}).`);
  } else {
    pass(`Application and package version agree: ${packageVersion}.`);
  }
} catch (error) {
  fail(`Could not verify version consistency: ${error.message}`);
}

// JavaScript syntax across application and repository scripts.
const jsFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'release', 'screenshots'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) jsFiles.push(full);
  }
};
for (const folder of ['js', 'tests', 'scripts']) {
  if (fs.existsSync(path.join(ROOT, folder))) walk(path.join(ROOT, folder));
}
if (exists('serve.js')) jsFiles.push(path.join(ROOT, 'serve.js'));
let syntaxFailures = 0;
for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const inputType = path.extname(file) === '.cjs' ? 'commonjs' : 'module';
  const result = spawnSync(process.execPath, ['--input-type', inputType, '--check'], {
    input: source,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    syntaxFailures += 1;
    fail(`JavaScript syntax error in ${path.relative(ROOT, file)}: ${(result.stderr || '').trim().split('\n')[0]}`);
  }
}
if (syntaxFailures === 0) pass(`JavaScript syntax check passed for ${jsFiles.length} files.`);

// HTML duplicate IDs and direct element references.
const html = read('index.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicates.length) fail(`Duplicate HTML element IDs: ${duplicates.join(', ')}`);
else pass('No duplicate HTML element IDs.');

const appSource = read('js/app.js');
const literalRefs = [...appSource.matchAll(/(?:\$|bind)\('([A-Za-z0-9_-]+)'/g)].map((match) => match[1]);
const missingRefs = [...new Set(literalRefs.filter((id) => !ids.includes(id)))];
if (missingRefs.length) fail(`JavaScript references missing HTML IDs: ${missingRefs.join(', ')}`);
else pass('All literal JavaScript DOM ID references resolve to index.html.');

// Every static button ID should be referenced by application wiring (or be a
// deliberate submit button handled by its parent form).
const buttonIds = [...html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
const allowedUnreferencedButtons = new Set(['btnSavePatient']);
const wiringSource = `${appSource}\n${read('js/desktop.js')}`;
const unreferencedButtons = buttonIds.filter((id) => !wiringSource.includes(`'${id}'`) && !allowedUnreferencedButtons.has(id));
if (unreferencedButtons.length) fail(`Static buttons with no apparent application wiring: ${unreferencedButtons.join(', ')}`);
else pass(`All ${buttonIds.length} static button IDs have application wiring or an intentional form-submit handler.`);

// Duplicate bind('<id>', '<event>') registrations can cause a modal to open and
// immediately close when one user action runs the handler twice.
const bindings = [...appSource.matchAll(/\bbind\('([^']+)',\s*'([^']+)'/g)].map((match) => `${match[1]}:${match[2]}`);
const duplicateBindings = [...new Set(bindings.filter((key, index) => bindings.indexOf(key) !== index))];
if (duplicateBindings.length) fail(`Duplicate event bindings: ${duplicateBindings.join(', ')}`);
else pass('No duplicate bind(id, event) UI registrations found.');

// The static browser app must not silently load remote runtime assets.
const remoteAssetRefs = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
if (remoteAssetRefs.length) fail(`Application HTML contains remote runtime asset references: ${remoteAssetRefs.join(', ')}`);
else pass('No remote runtime asset references in index.html.');

// Desktop security invariants.
const mainSource = read('desktop/main.cjs');
const preloadSource = read('desktop/preload.cjs');
const desktopSecurityFailures = [];
if (!/contextIsolation:\s*true/.test(mainSource)) desktopSecurityFailures.push('contextIsolation is not enabled');
if (!/nodeIntegration:\s*false/.test(mainSource)) desktopSecurityFailures.push('nodeIntegration is not disabled');
if (!/sandbox:\s*true/.test(mainSource)) desktopSecurityFailures.push('renderer sandbox is not enabled');
if (/webSecurity:\s*false/.test(mainSource)) desktopSecurityFailures.push('webSecurity is disabled');
if (!/ALLOWED_HOSTS/.test(mainSource) || !/api\.github\.com/.test(mainSource)) desktopSecurityFailures.push('GitHub/update host allowlist is missing');
if (!/will-navigate/.test(mainSource) || !/setWindowOpenHandler/.test(mainSource)) desktopSecurityFailures.push('navigation/window controls are missing');
if (!/contextBridge\.exposeInMainWorld\('gytechDesktop'/.test(preloadSource)) desktopSecurityFailures.push('least-privilege preload bridge is missing');
if (desktopSecurityFailures.length) fail(`Desktop security configuration issue: ${desktopSecurityFailures.join('; ')}`);
else pass('Desktop security invariants are present (isolated, sandboxed renderer with allowlisted bridge/navigation).');

// Source copyright headers.
const sourceFiles = [
  'index.html', 'serve.js',
  ...fs.readdirSync(path.join(ROOT, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`),
  ...fs.readdirSync(path.join(ROOT, 'css')).filter((name) => name.endsWith('.css')).map((name) => `css/${name}`),
  ...fs.readdirSync(path.join(ROOT, 'desktop')).filter((name) => name.endsWith('.cjs')).map((name) => `desktop/${name}`),
];
const copyrightPattern = /Copyright (?:© )?2026 GYTech(?:\. All Rights Reserved\.| All Right Reserved\.)/;
const missingHeaders = sourceFiles.filter((file) => !copyrightPattern.test(read(file)));
if (missingHeaders.length) fail(`Missing GYTech source copyright header: ${missingHeaders.join(', ')}`);
else pass('GYTech copyright headers are present on all application and desktop source files.');

// Old brand identity should not remain in shipping files.
const shippingFiles = ['index.html', 'serve.js', ...sourceFiles.filter((file) => file.startsWith('js/') || file.startsWith('css/'))];
const staleBrand = shippingFiles.filter((file) => /simuvitals/i.test(read(file)));
if (staleBrand.length) fail(`Legacy SimuVitals branding remains in: ${staleBrand.join(', ')}`);
else pass('No legacy SimuVitals branding remains in application source.');

// Markdown internal links and images.
const markdownFiles = [];
const walkMarkdown = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'screenshots'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walkMarkdown(full);
    else if (entry.name.endsWith('.md')) markdownFiles.push(full);
  }
};
walkMarkdown(ROOT);
let brokenLinks = 0;
for (const file of markdownFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(clean));
    if (!fs.existsSync(resolved)) {
      brokenLinks += 1;
      fail(`Broken local Markdown link in ${path.relative(ROOT, file)}: ${target}`);
    }
  }
}
if (brokenLinks === 0) pass(`Local Markdown links validated across ${markdownFiles.length} documents.`);

// Screenshot integrity and dimensions from PNG IHDR.
let badScreenshots = 0;
for (const relative of requiredScreenshots) {
  if (!exists(relative)) continue;
  const buffer = fs.readFileSync(path.join(ROOT, relative));
  if (buffer.length < 10000 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    badScreenshots += 1;
    fail(`Screenshot is empty or not a valid PNG: ${relative}`);
    continue;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1200 || height < 650) {
    badScreenshots += 1;
    fail(`Screenshot dimensions are too small for release documentation: ${relative} (${width}x${height})`);
  }
}
if (badScreenshots === 0) pass(`All ${requiredScreenshots.length} required screenshots are valid, non-empty PNG files at release dimensions.`);

const readmeText = read('README.md');
const unreferencedScreenshots = requiredScreenshots.filter((relative) => !readmeText.includes(relative));
if (unreferencedScreenshots.length) fail(`Screenshots not referenced by README.md: ${unreferencedScreenshots.join(', ')}`);
else pass('All required application screenshots are referenced by README.md.');

// Basic CFF integrity after license approval fields.
if (exists('CITATION.cff')) {
  const cff = read('CITATION.cff');
  for (const field of ['cff-version:', 'title:', 'authors:', 'version:', 'message:']) {
    if (!cff.includes(field)) fail(`CITATION.cff is missing required field: ${field}`);
  }
  if (!failures.some((message) => message.includes('CITATION.cff'))) pass('CITATION.cff contains the required core fields.');
}

// No hard-coded local workstation paths in public documentation.
const publicDocs = markdownFiles.filter((file) => !file.includes(`${path.sep}tests${path.sep}`));
const hardcodedPath = publicDocs.filter((file) => /D:\\\\Storage Space|D:\\Storage Space/.test(fs.readFileSync(file, 'utf8')));
if (hardcodedPath.length) fail(`Hard-coded local filesystem path found in: ${hardcodedPath.map((file) => path.relative(ROOT, file)).join(', ')}`);
else pass('No hard-coded local workstation paths in public documentation.');

// Result summary.
console.log('');
console.log('GYTech PatientSim Pro — repository validation');
console.log('================================================');
for (const message of passes) console.log(`PASS  ${message}`);
for (const message of warnings) console.log(`WARN  ${message}`);
for (const message of failures) console.log(`FAIL  ${message}`);
console.log('');
console.log(`${passes.length} checks passed, ${failures.length} failed, ${warnings.length} warnings.`);
if (failures.length) process.exitCode = 1;
