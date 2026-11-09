/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Applies the documented portable ZIP name without fabricating missing files.
 */

import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const releaseDirectory = path.resolve('release');
const source = path.join(releaseDirectory, `GYTech-PatientSim-Pro-x64-v${pkg.version}.zip`);
const target = path.join(releaseDirectory, `GYTech-PatientSim-Pro-Portable-v${pkg.version}.zip`);

if (!fs.existsSync(source)) {
  if (fs.existsSync(target)) {
    console.log(`Portable package already named correctly: ${path.basename(target)}`);
    process.exit(0);
  }
  console.error('No portable ZIP artifact was found. Build the Windows ZIP target first.');
  process.exit(1);
}

fs.renameSync(source, target);
console.log(`Renamed portable package: ${path.basename(target)}`);
