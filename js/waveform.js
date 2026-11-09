/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Real-time multi-parameter waveform renderer.
 * A single externally driven render loop feeds all traces. Buffers are generated
 * from physiological sources, never from static images or decorative animation.
 */
import { createECGConfig, EcgSource } from './ecg.js';
import { PlethSource } from './spo2.js';
import { RespirationSource } from './respiration.js';
import { CapnographySource } from './capnography.js';
import { PressureSource } from './bloodpressure.js';
import { store } from './state.js';
import { clamp } from './utilities.js';

class WaveTrace {
  constructor({ key, canvas, generator, color, amplitude = 0.32, maxSeconds = 24.5 }) {
    this.key = key;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.generator = generator;
    this.color = color;
    this.amplitude = amplitude;
    this.sampleRate = generator.sampleRate || 200;
    this.maxSeconds = maxSeconds;
    this.buffer = [];
    this.card = canvas.closest('[data-trace]');
    this.overlay = this.card?.querySelector('[data-wave-overlay]');
    this.statusNode = this.card?.querySelector('[data-wave-status]');
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = window.devicePixelRatio || 1;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
  }

  append(samples) {
    if (!samples || !samples.length) return;
    this.buffer.push(...samples);
    const maxSamples = Math.ceil(this.maxSeconds * this.sampleRate);
    if (this.buffer.length > maxSamples) {
      this.buffer.splice(0, this.buffer.length - maxSamples);
    }
  }

  reset() {
    this.buffer = [];
    this.generator.reset?.();
  }

  drawGrid(ctx, width, height, showGrid) {
    if (!showGrid) return;
    ctx.save();
    const minor = 12;
    const majorEvery = 5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(111, 155, 174, 0.075)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += minor) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += minor) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(111, 155, 174, 0.14)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += minor * majorEvery) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += minor * majorEvery) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(135, 176, 190, 0.13)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }

  draw(windowSeconds) {
    if (!this.width || !this.height) return;
    const ctx = this.ctx;
    const { width, height } = this;
    ctx.clearRect(0, 0, width, height);
    this.drawGrid(ctx, width, height, store.settings.showGrid);

    if (this.buffer.length < 2) return;
    const visibleSamples = Math.max(2, Math.floor(windowSeconds * this.sampleRate));
    const available = Math.min(this.buffer.length, visibleSamples);
    const start = this.buffer.length - available;
    const stride = Math.max(1, Math.floor(available / Math.max(width * 1.6, 200)));
    const center = height * 0.55;
    const gain = this.key === 'ecg' ? Math.max(0.25, store.settings.ecgGain || 1) : 1;
    const scale = height * this.amplitude * gain;
    ctx.save();
    ctx.beginPath();
    let started = false;
    for (let index = 0; index < available; index += stride) {
      const value = this.buffer[start + index];
      const x = width - ((available - 1 - index) / Math.max(visibleSamples - 1, 1)) * width;
      const y = clamp(center - value * scale, -6, height + 6);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.key === 'ecg' ? 1.45 : 1.6;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.key === 'ecg' ? 4 : 3;
    ctx.globalAlpha = 0.96;
    ctx.stroke();
    ctx.restore();
  }

  setOverlay(text, tone = 'neutral') {
    if (!this.overlay) return;
    if (!text) {
      this.overlay.textContent = '';
      this.overlay.classList.add('is-hidden');
      this.overlay.dataset.tone = '';
      this.card?.classList.remove('is-offline');
      return;
    }
    this.overlay.textContent = text;
    this.overlay.classList.remove('is-hidden');
    this.overlay.dataset.tone = tone;
    this.card?.classList.add('is-offline');
  }

  setStatus(text, tone = 'neutral') {
    if (!this.statusNode) return;
    this.statusNode.textContent = text;
    this.statusNode.dataset.tone = tone;
  }
}

export class WaveformEngine {
  constructor(storeRef = store) {
    this.store = storeRef;
    this.traces = new Map();
    this.ecgSource = new EcgSource({ seed: 7141, sampleRate: 400 });
    this.plethSource = new PlethSource({ sampleRate: 200 });
    this.respSource = new RespirationSource({ sampleRate: 120 });
    this.capnoSource = new CapnographySource({ sampleRate: 150 });
    this.artSource = new PressureSource('ART', { sampleRate: 200 });
    this.cvpSource = new PressureSource('CVP', { sampleRate: 200 });
    this.paSource = new PressureSource('PA', { sampleRate: 200 });
    this.icpSource = new PressureSource('ICP', { sampleRate: 200 });
    this.windowSeconds = 10;
    this.lastRendered = performance.now();
    this.buildTraces();
    this.subscribe();
  }

  buildTraces() {
    const configurations = [
      ['ecg', 'waveECG', this.ecgSource, '#00ff66', 0.31],
      ['pleth', 'wavePleth', this.plethSource, '#00d9ff', 0.31],
      ['capno', 'waveCapno', this.capnoSource, '#d58aff', 0.33],
      ['resp', 'waveResp', this.respSource, '#ffd740', 0.32],
      ['art', 'waveART', this.artSource, '#ffc400', 0.31],
      ['cvp', 'waveCVP', this.cvpSource, '#ff9a44', 0.3],
      ['pa', 'wavePA', this.paSource, '#d58aff', 0.3],
      ['icp', 'waveICP', this.icpSource, '#ffb020', 0.3],
    ];
    for (const [key, id, generator, color, amplitude] of configurations) {
      const canvas = document.getElementById(id);
      if (!canvas) continue;
      this.traces.set(key, new WaveTrace({ key, canvas, generator, color, amplitude }));
    }
  }

  subscribe() {
    this.store.on('patient:context-applied', () => this.reset());
    this.store.on('patient:selected', () => this.reset());
    this.store.on('sim:reset', () => this.reset());
    this.store.on('settings:changed', () => {
      this.windowSeconds = 10 * (25 / this.store.settings.sweepSpeed);
    });
    this.windowSeconds = 10 * (25 / this.store.settings.sweepSpeed);
  }

  reset() {
    for (const trace of this.traces.values()) trace.reset();
    this.ecgSource.reset();
    this.plethSource.reset();
    this.respSource.reset();
    this.capnoSource.reset();
    this.artSource.reset();
    this.cvpSource.reset();
    this.paSource.reset();
    this.icpSource.reset();
  }

  buildConfigs() {
    const sim = this.store.sim;
    const effective = this.effectiveCirculation();
    const ecgConfig = createECGConfig(sim);
    const pulseRate = effective.source === 'cpr' ? sim.cpr.rate
      : effective.hasPulse ? (sim.defib.pacing.active ? sim.defib.pacing.rate : sim.heartRate) : 0;
    return {
      ecg: {
        ...ecgConfig,
        gain: this.store.settings.ecgGain,
        noise: sim.ecg.noise,
        artifact: sim.ecg.artifact,
        baselineWander: sim.ecg.baselineWander,
      },
      pleth: {
        rate: pulseRate,
        hasPulse: effective.hasPulse,
        perfusion: sim.perfusion,
        quality: sim.signal.spo2,
        sensorConnected: sim.sensors.spo2,
        respiratoryRate: sim.rr,
      },
      resp: {
        rate: sim.rr,
        depth: sim.respiratoryDepth,
        pattern: sim.respiratoryPattern,
        irregularity: sim.respiratoryIrregularity,
        sensorConnected: sim.sensors.resp,
      },
      capno: {
        rate: sim.rr,
        etco2: sim.etco2,
        pattern: sim.capnoPattern,
        sensorConnected: sim.sensors.capno,
      },
      art: {
        rate: pulseRate || 72,
        hasPulse: effective.hasPulse,
        sensorConnected: sim.sensors.ibp,
        quality: sim.signal.ibp,
      },
      cvp: {
        rate: pulseRate || 72,
        hasPulse: effective.hasPulse,
        sensorConnected: sim.sensors.cvp,
        quality: sim.signal.cvp,
      },
      pa: {
        rate: pulseRate || 72,
        hasPulse: effective.hasPulse,
        sensorConnected: sim.sensors.pa,
        quality: sim.signal.pa,
      },
      icp: {
        rate: pulseRate || 72,
        hasPulse: effective.hasPulse,
        sensorConnected: sim.sensors.icp,
        quality: sim.signal.icp,
      },
    };
  }

  effectiveCirculation() {
    const sim = this.store.sim;
    if (sim.defib.pacing.active && sim.defib.pacing.mechanicalCapture) {
      return { hasPulse: true, source: 'pacing' };
    }
    if (sim.pulse) return { hasPulse: true, source: 'native' };
    if (sim.cpr.active && !sim.cpr.paused && sim.cpr.quality > 0) {
      return { hasPulse: true, source: 'cpr' };
    }
    return { hasPulse: false, source: 'none' };
  }

  generate(dt) {
    const configs = this.buildConfigs();
    for (const [key, trace] of this.traces) {
      const config = configs[key];
      if (!config) continue;
      let samples;
      // ECG timing continues even when leads are disconnected so that
      // reconnection does not produce a time-warped trace.
      if (key === 'ecg' && (!this.store.sim.sensors.ecg || this.store.sim.ecg.leadOff)) {
        trace.generator.advance(dt, config);
        samples = null;
      } else {
        samples = trace.generator.advance(dt, config);
      }
      if (samples === null) {
        const count = Math.max(1, Math.floor(dt * trace.sampleRate));
        samples = new Array(count).fill(0).map(() => (Math.random() - 0.5) * 0.006);
      }
      trace.append(samples);
    }
  }

  render(dt = 0) {
    const now = performance.now();
    const realDt = Math.min(0.08, Math.max(0, (now - this.lastRendered) / 1000));
    this.lastRendered = now;
    const speed = this.store.settings.simulationSpeed || 1;
    const effectiveDt = this.store.sim.running && !this.store.state.ui.waveformFrozen ? realDt * speed : 0;
    if (effectiveDt > 0) this.generate(effectiveDt);
    this.windowSeconds = 10 * (25 / this.store.settings.sweepSpeed);
    for (const trace of this.traces.values()) {
      trace.draw(this.windowSeconds);
    }
    this.updateOverlays();
  }

  updateOverlays() {
    const sim = this.store.sim;
    const effective = this.effectiveCirculation();
    const noPulse = !effective.hasPulse;
    const ecg = this.traces.get('ecg');
    if (ecg) {
      ecg.setOverlay(
        !sim.sensors.ecg ? 'LEADS OFF' : sim.ecg.leadOff ? 'LEAD OFF' : '',
        'off',
      );
      ecg.setStatus(
        !sim.sensors.ecg ? 'NO LEADS' : sim.signal.ecg < 0.4 ? 'LOW SIGNAL' : `${sim.ecg.lead} · ${sim.ecg.leadCount}-LEAD`,
        !sim.sensors.ecg ? 'off' : 'ok',
      );
    }
    const pleth = this.traces.get('pleth');
    if (pleth) {
      pleth.setOverlay(
        !sim.sensors.spo2 ? 'SENSOR OFF' : noPulse ? 'NO PULSE' : sim.signal.spo2 < 0.3 ? 'LOW SIGNAL' : '',
        'off',
      );
      pleth.setStatus(
        !sim.sensors.spo2 ? 'OFF' : noPulse ? 'NO PULSE' : `${Math.round(sim.spo2)}% · ${Math.round(sim.heartRate)} PR`,
        !sim.sensors.spo2 || noPulse ? 'off' : 'ok',
      );
    }
    const resp = this.traces.get('resp');
    if (resp) {
      resp.setOverlay(
        !sim.sensors.resp ? 'BELT OFF' : sim.rr < 0.2 ? 'APNEA' : '',
        !sim.sensors.resp ? 'off' : 'warn',
      );
      resp.setStatus(
        !sim.sensors.resp ? 'OFF' : `${sim.rr.toFixed(0)} /min`,
        !sim.sensors.resp ? 'off' : sim.rr < 4 ? 'warn' : 'ok',
      );
    }
    const capno = this.traces.get('capno');
    if (capno) {
      const apnea = sim.rr < 0.2 || sim.capnoPattern === 'apnea';
      capno.setOverlay(
        !sim.sensors.capno ? 'SAMPLING LINE OFF' : sim.capnoPattern === 'disconnected' ? 'LINE DISCONNECTED' : apnea ? 'APNEA' : '',
        !sim.sensors.capno ? 'off' : 'warn',
      );
      capno.setStatus(
        !sim.sensors.capno ? 'OFF' : `${sim.etco2.toFixed(0)} mmHg`,
        !sim.sensors.capno ? 'off' : apnea ? 'warn' : 'ok',
      );
    }
    const pressureTraces = [
      ['art', sim.sensors.ibp, sim.signal.ibp],
      ['cvp', sim.sensors.cvp, sim.signal.cvp],
      ['pa', sim.sensors.pa, sim.signal.pa],
      ['icp', sim.sensors.icp, sim.signal.icp],
    ];
    for (const [key, connected, quality] of pressureTraces) {
      const trace = this.traces.get(key);
      if (!trace) continue;
      trace.setOverlay(
        !connected ? 'SENSOR OFF' : noPulse ? 'NO PULSE' : quality < 0.3 ? 'LOW SIGNAL' : '',
        'off',
      );
      trace.setStatus(!connected ? 'OFF' : `${Math.round(quality * 100)}%`, !connected ? 'off' : 'ok');
    }
  }

  getSyncMarkerPositions(fromTime, toTime) {
    return this.ecgSource.getSyncMarkerPositions(createECGConfig(this.store.sim), fromTime, toTime);
  }

  getNextRTime() {
    return this.ecgSource.getNextRTime(createECGConfig(this.store.sim));
  }
}

export const waveformEngine = new WaveformEngine(store);
