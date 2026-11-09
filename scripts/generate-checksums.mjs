/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Generates SHA-256 checksums for the desktop release artefacts that actually
 * exist. Never invents an installer or checksum.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const releaseDirectory = path.resolve(process.argv[2] || 'release');
const extensions = new Set(['.exe', '.msi', '.zip', '.appimage', '.deb', '.rpm', '.dmg']);
const excludedSuffixes = ['uninstaller.exe', '.blockmap'];

if (!fs.existsSync(releaseDirectory)) {
  console.error(`Release directory not found: ${releaseDirectory}`);
  process.exit(1);
}

const files = fs.readdirSync(releaseDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => {
    const lower = name.toLowerCase();
    return extensions.has(path.extname(lower)) && !excludedSuffixes.some((suffix) => lower.endsWith(suffix));
  })
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error('No supported desktop release artefacts were found.');
  process.exit(1);
}

const lines = [];
for (const name of files) {
  const filePath = path.join(releaseDirectory, name);
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  lines.push(`${hash.digest('hex')}  ${name}`);
}

const output = `${lines.join('\n')}\n`;
fs.writeFileSync(path.join(releaseDirectory, 'SHA256SUMS.txt'), output, 'utf8');
console.log(`Wrote SHA256SUMS.txt for ${files.length} artefact(s):`);
console.log(output.trim());
