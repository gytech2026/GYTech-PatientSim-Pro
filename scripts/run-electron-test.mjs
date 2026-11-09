/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Development-only Electron test launcher.
 *
 * Chromium resolves its Linux process sandbox (SUID helper or unprivileged
 * user namespaces) in the browser process *before* the harness JavaScript is
 * evaluated. Calling app.commandLine.appendSwitch('no-sandbox') inside a
 * harness therefore runs too late to affect the sandbox bootstrap, and a
 * GitHub-hosted runner has no root-owned chrome-sandbox helper. The switch has
 * to be on the actual Electron command line, which is what this launcher
 * provides — for test processes only, on Linux, and only when CI is detected
 * (or when a developer explicitly opts in with ELECTRON_TEST_NO_SANDBOX=1).
 *
 * Production is untouched: desktop/main.cjs keeps sandbox: true, and
 * electron-builder never packages tests/ or scripts/.
 *
 * Usage: node scripts/run-electron-test.mjs <harness.js> [extra electron args...]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import electronPath from 'electron';

export const NO_SANDBOX_ENV = 'ELECTRON_TEST_NO_SANDBOX';

/** GitHub Actions (and most CI systems) export CI=true. */
export function isCiEnvironment(env = process.env) {
  return env.CI === 'true' || env.CI === '1' || env.GITHUB_ACTIONS === 'true';
}

/**
 * Build the Electron argv for a harness launch.
 *
 * --no-sandbox is scoped as narrowly as the failure allows:
 *   - only on Linux, where Chromium's SUID/namespace sandbox is the problem;
 *   - only for CI runs, or when a developer explicitly opts in locally;
 *   - only for the test process started by this launcher.
 */
export function buildElectronArgs({
  harness,
  extraArgs = [],
  platform = process.platform,
  env = process.env,
} = {}) {
  const args = [];
  const sandboxUnavailable = platform === 'linux'
    && (isCiEnvironment(env) || env[NO_SANDBOX_ENV] === '1');
  if (sandboxUnavailable) args.push('--no-sandbox');
  args.push(harness, ...extraArgs);
  return args;
}

function launch() {
  const [harness, ...extraArgs] = process.argv.slice(2);
  if (!harness) {
    console.error('Usage: node scripts/run-electron-test.mjs <harness.js> [extra electron args...]');
    process.exit(2);
  }
  const harnessPath = path.resolve(harness);
  if (!fs.existsSync(harnessPath)) {
    console.error(`Electron test harness not found: ${harnessPath}`);
    process.exit(2);
  }

  const env = { ...process.env };
  // ELECTRON_RUN_AS_NODE turns Electron into plain Node and prevents any window.
  delete env.ELECTRON_RUN_AS_NODE;

  const args = buildElectronArgs({ harness: harnessPath, extraArgs, env });
  if (args[0] === '--no-sandbox') {
    console.log('[electron-test] Linux CI detected: starting the test process with --no-sandbox '
      + '(test process only; production sandboxing is unchanged).');
  }

  const child = spawn(electronPath, args, { env, stdio: 'inherit', windowsHide: true });

  const forward = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // The test process already exited; nothing to forward.
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => forward(signal));

  child.on('error', (error) => {
    console.error(`Could not launch the Electron test process: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`The Electron test process was terminated by ${signal}.`);
      process.exit(1);
    }
    process.exit(code === null ? 1 : code);
  });
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entry && entry === import.meta.url) launch();
