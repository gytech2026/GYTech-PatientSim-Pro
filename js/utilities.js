/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Shared utility helpers for the GYTech PatientSim Pro simulation workstation.
 * Pure functions only; no DOM side effects except explicit download/clipboard helpers.
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));

export const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

export const inverseLerp = (a, b, value) => (b === a ? 0 : clamp((value - a) / (b - a), 0, 1));

export const roundTo = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(safeNumber(value) * factor) / factor;
};

export const formatNumber = (value, decimals = 0, fallback = '--') => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  return Number(value).toFixed(decimals);
};

export const formatVital = (value, decimals = 0, fallback = '--') => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  return roundTo(value, decimals).toString();
};

export const pad2 = (value) => String(Math.floor(Math.abs(value))).padStart(2, '0');

export const formatClock = (date = new Date()) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

export const formatDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const formatDateTime = (date = new Date()) =>
  `${formatDate(date)} ${formatClock(date)}`;

export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(safeNumber(totalSeconds)));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return hrs > 0 ? `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}` : `${pad2(mins)}:${pad2(secs)}`;
};

export const formatElapsed = (totalSeconds) => {
  const s = Math.max(0, Math.floor(safeNumber(totalSeconds)));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value));
};

export const escapeHTML = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const uid = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const debounce = (fn, wait = 150) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

export const throttle = (fn, minInterval = 100) => {
  let last = 0;
  let pendingArgs = null;
  let timer = null;
  return (...args) => {
    const now = performance.now();
    const remaining = minInterval - (now - last);
    pendingArgs = args;
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = performance.now();
        fn(...pendingArgs);
      }, remaining);
    }
  };
};

export const parseStoredJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[GYTech PatientSim Pro] Unable to read ${key}`, error);
    return fallback;
  }
};

export const writeStoredJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[GYTech PatientSim Pro] Unable to persist ${key}`, error);
    return false;
  }
};

export const downloadFile = (filename, content, mime = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const csvEscape = (value) => {
  const string = String(value ?? '');
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};

export const toCSV = (headers, rows) => {
  const headerLine = headers.map((header) => csvEscape(header.label ?? header)).join(',');
  const body = rows.map((row) => headers.map((header) => csvEscape(row[header.key ?? header])).join(','));
  return [headerLine, ...body].join('\r\n');
};

export const PRESSURE_FACTOR = 0.1333223684; // mmHg -> kPa

export const convertPressureFromMmHg = (value, unit = 'mmHg') =>
  unit === 'kPa' ? safeNumber(value) * PRESSURE_FACTOR : safeNumber(value);

export const convertPressureToMmHg = (value, unit = 'mmHg') =>
  unit === 'kPa' ? safeNumber(value) / PRESSURE_FACTOR : safeNumber(value);

export const pressureUnitLabel = (unit = 'mmHg') => (unit === 'kPa' ? 'kPa' : 'mmHg');

export const formatPressure = (value, unit = 'mmHg', decimals = null) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--';
  const converted = convertPressureFromMmHg(value, unit);
  const places = decimals ?? (unit === 'kPa' ? 1 : 0);
  return converted.toFixed(places);
};

export const convertTempFromC = (value, unit = 'C') =>
  unit === 'F' ? (safeNumber(value) * 9) / 5 + 32 : safeNumber(value);

export const convertTempToC = (value, unit = 'C') =>
  unit === 'F' ? ((safeNumber(value) - 32) * 5) / 9 : safeNumber(value);

export const tempUnitLabel = (unit = 'C') => (unit === 'F' ? '°F' : '°C');

export const formatTemp = (valueC, unit = 'C', decimals = 1) => {
  if (valueC === null || valueC === undefined || !Number.isFinite(Number(valueC))) return '--';
  return convertTempFromC(valueC, unit).toFixed(decimals);
};

export const randomBetween = (min, max) => min + Math.random() * (max - min);

export const gaussian = (x, center, width) => {
  const z = (x - center) / Math.max(width, 1e-6);
  return Math.exp(-0.5 * z * z);
};

/** Deterministic pseudo-random generator for reproducible teaching scenarios. */
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const choose = (array, rng = Math.random) => array[Math.floor(rng() * array.length)];

export const titleCase = (value) => String(value ?? '')
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const humanRhythm = (rhythm) => titleCase(rhythm || 'NSR')
  .replace('Nsr', 'Normal Sinus Rhythm')
  .replace('Afib', 'Atrial Fibrillation')
  .replace('Aflutter', 'Atrial Flutter')
  .replace('Svt', 'Supraventricular Tachycardia')
  .replace('Vt', 'Ventricular Tachycardia')
  .replace('Vf', 'Ventricular Fibrillation')
  .replace('Avb1', 'First-Degree AV Block')
  .replace('Avb2', 'Second-Degree AV Block')
  .replace('Avb3', 'Third-Degree AV Block')
  .replace('Paced', 'Paced Rhythm');

export const isEditableTarget = (target) =>
  target instanceof HTMLElement &&
  (target.matches('input, select, textarea') || target.isContentEditable);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
