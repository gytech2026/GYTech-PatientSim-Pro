/**
 * GYTech PatientSim Pro — prepare a GitHub Pages deployment artefact.
 * Copies only the static runtime application into dist/.
 *
 * Usage: node scripts/prepare-pages.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const copyFile = (relative) => {
  const source = path.join(ROOT, relative);
  const destination = path.join(DIST, relative);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing deployment file: ${relative}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

const copyDirectory = (relative) => {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) copyDirectory(childRelative);
    else copyFile(childRelative);
  }
};

if (path.basename(DIST) !== 'dist') throw new Error('Refusing to clean an unexpected directory.');
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copyFile('index.html');
copyDirectory('css');
copyDirectory('js');
copyDirectory(path.join('assets', 'icons'));
copyFile(path.join('assets', 'branding', 'gytech-logo.svg'));
copyFile(path.join('assets', 'branding', 'gytech-banner.svg'));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
fs.writeFileSync(path.join(DIST, 'BUILD_INFO.txt'), [
  'GYTech PatientSim Pro — static GitHub Pages build',
  'Copyright 2026 GYTech All Right Reserved.',
  'Educational simulation software only.',
  `Prepared: ${new Date().toISOString()}`,
  'Source files: index.html, css/, js/, assets/icons/, assets/branding/',
  '',
].join('\n'));

console.log(`GitHub Pages artefact prepared at ${path.relative(ROOT, DIST)}/`);
