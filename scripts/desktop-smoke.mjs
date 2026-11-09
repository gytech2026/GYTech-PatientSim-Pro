/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Launches a built or installed desktop executable with the hidden smoke-test
 * switch, waits for its JSON result, and propagates a non-zero exit on failure.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const executable = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(executable)) {
  console.error('Usage: npm run desktop:smoke -- <path-to-built-executable>');
  console.error('The executable was not found. Build the desktop application first.');
  process.exit(1);
}

const resultPath = path.join(os.tmpdir(), `gytech-patientsim-smoke-${process.pid}.json`);
const env = {
  ...process.env,
  GYTECH_SMOKE_TEST: '1',
  GYTECH_SMOKE_RESULT: resultPath,
};
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(executable, process.platform === 'linux' ? ['--no-sandbox'] : [], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});

const timeout = setTimeout(() => {
  console.error('Desktop smoke test timed out.');
  child.kill();
  process.exitCode = 1;
}, 90000);

child.on('error', (error) => {
  clearTimeout(timeout);
  console.error(`Could not launch desktop application: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  clearTimeout(timeout);
  let result = null;
  try {
    result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    fs.unlinkSync(resultPath);
  } catch (error) {
    console.error(`No readable smoke-test result was produced: ${error.message}`);
  }
  if (result) {
    console.log(JSON.stringify(result, null, 2));
  }
  if (code !== 0 || !result?.pass) {
    console.error(`Desktop smoke test failed (child exit ${code}).`);
    process.exitCode = 1;
  } else {
    console.log('Desktop smoke test passed.');
  }
});
