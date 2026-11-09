/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Twelve-lead educational ECG display and report generator.
 * All leads share a single beat timeline and use an approximate lead-vector
 * morphology model. The output is explicitly simulated and not diagnostic.
 */
import { ECG_LEADS, EcgSource, createECGConfig } from './ecg.js';
import { APP_COPYRIGHT, APP_NAME, store } from './state.js';
import { historyManager } from './history.js';
import { clamp } from './utilities.js';

export class TwelveLeadECG {
  constructor(storeRef = store, history = historyManager) {
    this.store = storeRef;
    this.history = history;
    this.source = new EcgSource({ seed: 8841, sampleRate: 250 });
    this.sampleRate = 250;
    this.windowSeconds = 5;
    this.buffers = new Map();
    this.canvases = new Map();
    this.isOpen = false;
    this.lastDraw = 0;
    this.lastRender = performance.now();
    this.timeAccumulator = 0;
    this.gain = 1;
    this.primed = false;
    for (const lead of ECG_LEADS) {
      const canvas = document.getElementById(`lead${lead}`);
      if (canvas) {
        this.canvases.set(lead, canvas);
        this.buffers.set(lead, []);
      }
    }
  }

  open() {
    this.isOpen = true;
    this.primed = false;
    this.gain = this.store.settings.ecgGain || 1;
    this.reset();
    this.prime();
    this.draw();
  }

  close() {
    this.isOpen = false;
  }

  reset() {
    this.source.reset();
    this.timeAccumulator = 0;
    for (const lead of ECG_LEADS) this.buffers.set(lead, []);
  }

  getConfig() {
    const cfg = createECGConfig(this.store.sim);
    return {
      ...cfg,
      gain: this.gain,
      noise: Math.min(this.store.sim.ecg.noise, 0.03),
      artifact: this.store.sim.ecg.artifact * 0.35,
      baselineWander: this.store.sim.ecg.baselineWander,
    };
  }

  prime() {
    const cfg = this.getConfig();
    const steps = Math.ceil(this.windowSeconds * this.sampleRate);
    this.source.configure(cfg);
    for (let index = 0; index < steps; index += 1) {
      this.source.time += 1 / this.sampleRate;
      this.source.schedule(cfg);
      for (const lead of ECG_LEADS) {
        this.buffers.get(lead).push(this.source.morphologySample(cfg, this.source.time, lead));
      }
    }
    this.trim();
    this.primed = true;
  }

  trim() {
    const maxSamples = Math.ceil(this.windowSeconds * this.sampleRate) + 4;
    for (const lead of ECG_LEADS) {
      const buffer = this.buffers.get(lead);
      if (buffer.length > maxSamples) buffer.splice(0, buffer.length - maxSamples);
    }
  }

  update(dt) {
    if (!this.isOpen) return;
    const now = performance.now();
    if (now - this.lastDraw < 45) return;
    this.lastDraw = now;
    const cfg = this.getConfig();
    const realDt = Math.min(0.12, Math.max(0, dt || (now - this.lastRender) / 1000)) * (this.store.settings.simulationSpeed || 1);
    this.lastRender = now;
    if (this.store.sim.running && !this.store.state.ui.waveformFrozen) {
      this.source.configure(cfg);
      this.source.time += realDt;
      this.source.schedule(cfg);
      const samples = Math.floor(realDt * this.sampleRate);
      for (let index = 0; index < samples; index += 1) {
        this.source.time += 1 / this.sampleRate;
        this.source.schedule(cfg);
        for (const lead of ECG_LEADS) {
          this.buffers.get(lead).push(this.source.morphologySample(cfg, this.source.time, lead));
        }
      }
      this.trim();
    }
    this.draw();
  }

  drawGainLabel() {
    const label = document.getElementById('twelveLeadGainLabel');
    if (label) label.textContent = `×${this.gain.toFixed(1)}`;
  }

  draw() {
    const cfg = this.getConfig();
    const sensorOk = this.store.sim.sensors.ecg && !this.store.sim.ecg.leadOff;
    for (const lead of ECG_LEADS) {
      const canvas = this.canvases.get(lead);
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050a0c';
      ctx.fillRect(0, 0, width, height);
      this.drawGrid(ctx, width, height);
      const buffer = this.buffers.get(lead);
      if (!sensorOk) {
        ctx.strokeStyle = 'rgba(255, 48, 48, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        continue;
      }
      if (buffer.length < 2) continue;
      const visible = Math.min(buffer.length, this.windowSeconds * this.sampleRate);
      const start = buffer.length - visible;
      const stride = Math.max(1, Math.floor(visible / (width * 1.6)));
      const center = height * 0.52;
      const amplitude = height * 0.31 * clamp(this.gain, 0.4, 4);
      ctx.beginPath();
      for (let index = 0; index < visible; index += stride) {
        const x = width - ((visible - 1 - index) / Math.max(visible - 1, 1)) * width;
        const y = clamp(center - buffer[start + index] * amplitude, -4, height + 4);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#00ff77';
      ctx.lineWidth = 1.15;
      ctx.shadowColor = 'rgba(0,255,119,0.45)';
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    this.drawGainLabel();
  }

  drawGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 119, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 10) {
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 255, 119, 0.1)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 50) {
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 50) {
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  setGain(gain) {
    this.gain = [0.5, 1, 2, 4].includes(Number(gain)) ? Number(gain) : 1;
    this.draw();
    this.history.add({
      type: 'ECG_12LEAD_GAIN',
      category: 'ecg',
      description: `12-lead display gain changed to ×${this.gain}.`,
      details: { gain: this.gain },
    });
  }

  buildCaptureCanvas() {
    const width = 1600;
    const header = 128;
    const rowHeight = 190;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = header + rowHeight * 3 + 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#05090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const patient = this.store.patient;
    ctx.fillStyle = '#e9f6fa';
    ctx.font = '700 28px "Segoe UI", sans-serif';
    ctx.fillText('SIMULATED 12-LEAD ECG', 28, 40);
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffb020';
    ctx.fillText('EDUCATIONAL SIMULATION — NOT FOR CLINICAL DIAGNOSIS', 28, 63);
    ctx.fillStyle = '#9fb6c2';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(`Patient: ${patient?.name || '--'}   ID: ${patient?.id || '--'}   Bed: ${patient?.bed || '--'}   HR: ${Math.round(this.store.sim.heartRate)} bpm`, 28, 88);
    ctx.fillText(`Rhythm: ${this.store.sim.rhythm}   Recorded: ${new Date().toLocaleString()}   Sweep: 25 mm/s   Gain: ×${this.gain}`, 28, 110);
    for (let index = 0; index < ECG_LEADS.length; index += 1) {
      const lead = ECG_LEADS[index];
      const sourceCanvas = this.canvases.get(lead);
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 26 + col * 392;
      const y = header + row * rowHeight;
      ctx.fillStyle = '#0c151a';
      ctx.fillRect(x, y, 382, rowHeight - 24);
      if (sourceCanvas) {
        try { ctx.drawImage(sourceCanvas, x + 34, y + 8, 344, rowHeight - 48); } catch { /* canvas may be empty */ }
      }
      ctx.fillStyle = '#00ff77';
      ctx.font = '700 16px Consolas, monospace';
      ctx.fillText(lead, x + 8, y + 22);
    }
    ctx.fillStyle = '#617883';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`${APP_NAME} — educational waveform simulation. Do not use for diagnosis or treatment. ${APP_COPYRIGHT}`, 26, canvas.height - 16);
    return canvas;
  }

  record() {
    const canvas = this.buildCaptureCanvas();
    const patient = this.store.patient;
    try {
      const anchor = document.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = `gytech-patientsim-12lead-${patient?.id || 'patient'}-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error('[GYTech PatientSim Pro] 12-lead capture failed', error);
    }
    this.history.add({
      type: 'ECG_12LEAD_RECORDED',
      category: 'ecg',
      description: 'Simulated 12-lead ECG recording captured as PNG.',
      details: { rhythm: this.store.sim.rhythm, heartRate: Math.round(this.store.sim.heartRate), gain: this.gain },
    });
    this.store.emit('ui:toast', { message: '12-lead simulation captured as PNG.', tone: 'success' });
    return true;
  }

  printReport() {
    const images = ECG_LEADS.map((lead) => {
      const canvas = this.canvases.get(lead);
      return `<figure><figcaption>${lead}</figcaption><img src="${canvas ? canvas.toDataURL('image/png') : ''}" alt="Simulated lead ${lead}"></figure>`;
    }).join('');
    const patient = this.store.patient;
    const reportHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
      <title>${this.escape(APP_NAME)} — Simulated 12-Lead ECG Report</title>
      <style>
        body{font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:#111;padding:24px}
        h1{font-size:22px;margin:0} .warn{color:#a00;font-weight:700;margin:6px 0 16px}
        .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:5px 24px;font-size:12px;margin-bottom:18px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        figure{margin:0;border:1px solid #bbb;padding:4px;background:#05090b;break-inside:avoid}
        figcaption{color:#00b84a;font:700 12px Consolas,monospace;margin-bottom:2px}
        img{width:100%;display:block}
        footer{font-size:11px;color:#555;margin-top:18px}
        @media print{body{padding:0}.grid{gap:6px}}
      </style></head><body>
      <h1>${this.escape(APP_NAME)} — Simulated 12-Lead ECG Report</h1>
      <div class="warn">EDUCATIONAL SIMULATION ONLY — NOT A CLINICAL ECG</div>
      <div class="meta">
        <div><b>Patient:</b> ${this.escape(patient?.name)}</div>
        <div><b>Patient ID:</b> ${this.escape(patient?.id)}</div>
        <div><b>Bed:</b> ${this.escape(patient?.bed)}</div>
        <div><b>Age / Sex:</b> ${this.escape(patient?.age)} / ${this.escape(patient?.sex)}</div>
        <div><b>Simulated rhythm:</b> ${this.escape(this.store.sim.rhythm)}</div>
        <div><b>Heart rate:</b> ${Math.round(this.store.sim.heartRate)} bpm</div>
        <div><b>Timestamp:</b> ${this.escape(new Date().toLocaleString())}</div>
        <div><b>Gain:</b> ×${this.gain}</div>
        <div><b>Sweep:</b> 25 mm/s</div>
      </div>
      <div class="grid">${images}</div>
      <footer>Generated by ${this.escape(APP_NAME)}. ${this.escape(APP_COPYRIGHT)}
      Educational lead-vector approximation only. Not intended for diagnosis, treatment, or control of medical equipment.</footer>
      <script>setTimeout(()=>window.print(),300);<\/script>
      </body></html>`;
    const popup = window.open('', '_blank', 'width=1100,height=850');
    if (!popup) {
      this.store.emit('ui:toast', { message: 'Popup blocked. Allow popups to print the simulated report.', tone: 'warning' });
      return false;
    }
    popup.document.open();
    popup.document.write(reportHtml);
    popup.document.close();
    this.history.add({
      type: 'ECG_12LEAD_PRINTED',
      category: 'ecg',
      description: 'Simulated 12-lead ECG print report generated.',
      details: { rhythm: this.store.sim.rhythm, heartRate: Math.round(this.store.sim.heartRate) },
    });
    return true;
  }

  escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}

export const twelveLeadECG = new TwelveLeadECG(store, historyManager);
