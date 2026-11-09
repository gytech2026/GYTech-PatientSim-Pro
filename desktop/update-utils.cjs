/*
 * GYTech PatientSim Pro
 * Copyright © 2026 GYTech. All Rights Reserved.
 *
 * Update version comparison and release metadata validation.
 * This module is deliberately dependency-free so it can be tested directly.
 */

'use strict';

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function parseVersion(input) {
  if (typeof input !== 'string') return null;
  const match = input.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const aNumeric = /^\d+$/.test(a[index]);
    const bNumeric = /^\d+$/.test(b[index]);
    if (aNumeric && bNumeric) {
      const delta = Number(a[index]) - Number(b[index]);
      if (delta !== 0) return Math.sign(delta);
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }
  return 0;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error('Invalid version for comparison');
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function isStableVersion(input) {
  return Boolean(parseVersion(input)) && parseVersion(input).prerelease.length === 0;
}

function isOfficialRepository(input) {
  return typeof input === 'string' && REPOSITORY_PATTERN.test(input.trim());
}

function isGitHubReleaseUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname === 'www.github.com');
  } catch {
    return false;
  }
}

function validateRelease(release, currentVersion) {
  if (!release || typeof release !== 'object') {
    return { ok: false, reason: 'Release metadata is missing or malformed.' };
  }
  if (release.draft === true || release.prerelease === true) {
    return { ok: false, reason: 'Release is not a stable published release.' };
  }
  if (typeof release.tag_name !== 'string' || !isStableVersion(release.tag_name)) {
    return { ok: false, reason: 'Release tag is not a valid stable semantic version.' };
  }
  if (!isGitHubReleaseUrl(release.html_url)) {
    return { ok: false, reason: 'Release page is not an official HTTPS GitHub URL.' };
  }
  const latestVersion = release.tag_name.replace(/^v/, '');
  if (!parseVersion(currentVersion)) {
    return { ok: false, reason: 'Installed application version is invalid.' };
  }
  const comparison = compareVersions(latestVersion, currentVersion);
  return {
    ok: true,
    latestVersion,
    currentVersion,
    comparison,
    updateAvailable: comparison > 0,
    releaseUrl: release.html_url,
    releaseName: typeof release.name === 'string' && release.name.trim() ? release.name.trim().slice(0, 160) : 'GYTech PatientSim Pro update',
    notes: typeof release.body === 'string' ? release.body.slice(0, 4000) : '',
    publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
  };
}

module.exports = {
  REPOSITORY_PATTERN,
  compareVersions,
  isGitHubReleaseUrl,
  isOfficialRepository,
  isStableVersion,
  parseVersion,
  validateRelease,
};
