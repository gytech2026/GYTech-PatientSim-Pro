/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * GYTech PatientSim Pro — basic repository secret scan.
 * This is a defence-in-depth check, not a substitute for provider-side secret
 * scanning or professional security review.
 *
 * Usage: node scripts/check-secrets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];
const textExtensions = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.yml', '.yaml',
  '.txt', '.cff', '.xml', '.svg', '.env', '.example', '.ps1', '.sh',
]);
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'release', 'release-upgrade', 'screenshots']);
const patterns = [
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Stripe live key', regex: /\bsk_live_[A-Za-z0-9]{24,}\b/ },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Generic API key assignment', regex: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{16,}['"]/i },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const content = fs.readFileSync(full, 'utf8');
      for (const pattern of patterns) {
        if (pattern.regex.test(content)) findings.push({ file: path.relative(ROOT, full), type: pattern.name });
      }
    }
  }
}

walk(ROOT);

console.log('GYTech PatientSim Pro — basic secret scan');
console.log('==========================================');
if (!findings.length) {
  console.log('PASS  No common secret signatures were found in tracked text files.');
  console.log('NOTE  This scan does not replace provider secret scanning, gitleaks, or a professional review.');
} else {
  for (const finding of findings) console.log(`FAIL  ${finding.type}: ${finding.file}`);
  console.log('Remove and rotate any exposed credential before publication.');
  process.exitCode = 1;
}
