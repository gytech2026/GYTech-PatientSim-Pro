/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Simulation event recorder with filtering, CSV export and print support.
 * Records are explicitly simulation records and are never clinical documents.
 */
import {
  APP_COPYRIGHT, APP_NAME, APP_VERSION, HISTORY_KEY, store,
} from './state.js';
import {
  downloadFile, formatDateTime, parseStoredJSON, toCSV, uid, writeStoredJSON,
} from './utilities.js';

export class HistoryManager {
  constructor(storeRef = store) {
    this.store = storeRef;
    const stored = parseStoredJSON(HISTORY_KEY, []);
    this.entries = Array.isArray(stored) ? stored.filter((entry) => entry && entry.timestamp) : [];
    this.maxEntries = 2500;
    this.filter = { category: 'all', query: '' };
    this.store.on('history:record', (event) => this.add(event));
  }

  add({ type = 'GENERAL', description = '', details = {}, category = 'system', severity = 'info' }) {
    const patient = this.store.patient;
    const entry = {
      id: uid('evt'),
      timestamp: new Date().toISOString(),
      displayTime: formatDateTime(new Date()),
      simTime: Math.floor(this.store.sim.simTime),
      type,
      category,
      severity,
      description,
      details,
      patientId: patient?.id || null,
      patientName: patient?.name || 'No patient selected',
    };
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) this.entries.length = this.maxEntries;
    this.persist();
    this.store.emit('history:changed', this.entries);
    return entry;
  }

  persist() {
    writeStoredJSON(HISTORY_KEY, this.entries);
  }

  getFiltered(category = this.filter.category, query = this.filter.query) {
    const search = query.trim().toLowerCase();
    return this.entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!search) return true;
      return `${entry.type} ${entry.description} ${entry.patientName} ${entry.patientId}`
        .toLowerCase().includes(search);
    });
  }

  setFilter(patch) {
    this.filter = { ...this.filter, ...patch };
    this.store.emit('history:filter-changed', this.filter);
  }

  clear({ keepDevice = false } = {}) {
    this.entries = keepDevice
      ? this.entries.filter((entry) => entry.category !== 'patient' && entry.category !== 'alarm')
      : [];
    this.persist();
    this.store.emit('history:changed', this.entries);
  }

  exportCSV() {
    const headers = [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'displayTime', label: 'Display Time' },
      { key: 'patientId', label: 'Patient ID' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'category', label: 'Category' },
      { key: 'type', label: 'Event Type' },
      { key: 'severity', label: 'Severity' },
      { key: 'description', label: 'Description' },
      { key: 'details', label: 'Details' },
    ];
    const rows = this.entries.map((entry) => ({
      ...entry,
      details: Object.entries(entry.details || {})
        .map(([key, value]) => `${key}=${value}`)
        .join('; '),
    }));
    const csv = `${APP_NAME} — SIMULATION RECORD — NOT A CLINICAL DOCUMENT\r\n${APP_COPYRIGHT}\r\n${toCSV(headers, rows)}`;
    const date = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
    downloadFile(`gytech-patientsim-event-log-${date}.csv`, csv, 'text/csv;charset=utf-8');
    this.add({
      type: 'DATA_EXPORT',
      category: 'system',
      description: 'Simulation event history exported as CSV.',
      details: { rows: rows.length },
    });
    return csv;
  }

  buildReportHTML() {
    const patient = this.store.patient;
    const rows = this.entries.slice(0, 200).map((entry) => `
      <tr>
        <td>${this.escape(entry.displayTime)}</td>
        <td>${this.escape(entry.category)}</td>
        <td>${this.escape(entry.type)}</td>
        <td>${this.escape(entry.description)}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
      <title>${this.escape(APP_NAME)} Simulation Report</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:28px}
        h1{margin:0;font-size:24px} .warn{color:#a00;font-weight:700;margin:8px 0 18px}
        .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 28px;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;border-bottom:1px solid #ccc;padding:6px}
        th{background:#eee} footer{margin-top:20px;font-size:11px;color:#555}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>${this.escape(APP_NAME)} — Simulation Event Report</h1>
      <p class="warn">SIMULATION DATA ONLY — NOT A CLINICAL RECORD</p>
      <div class="meta">
        <div><b>Patient:</b> ${this.escape(patient?.name || 'No patient')}</div>
        <div><b>Patient ID:</b> ${this.escape(patient?.id || '--')}</div>
        <div><b>Age / Sex:</b> ${this.escape(patient?.age ?? '--')} / ${this.escape(patient?.sex || '--')}</div>
        <div><b>Location:</b> ${this.escape(patient?.room || '--')} / Bed ${this.escape(patient?.bed || '--')}</div>
        <div><b>Report generated:</b> ${this.escape(formatDateTime(new Date()))}</div>
        <div><b>Simulation clock:</b> ${this.escape(Math.floor(this.store.sim.simTime))} s</div>
      </div>
      <table><thead><tr><th>Timestamp</th><th>Category</th><th>Event</th><th>Description</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No recorded events.</td></tr>'}</tbody></table>
      <footer>Generated by ${this.escape(APP_NAME)} ${this.escape(APP_VERSION)}. ${this.escape(APP_COPYRIGHT)}
      Educational simulation only. Not intended for diagnosis, treatment, or control of real medical equipment.</footer>
      </body></html>`;
  }

  escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}

export const historyManager = new HistoryManager(store);
