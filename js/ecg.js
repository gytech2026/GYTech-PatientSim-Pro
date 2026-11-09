/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Parameterised ECG synthesis engine.
 * Every rhythm has its own event-timing and morphology model. The output is a
 * teaching approximation and must not be interpreted as a diagnostic ECG.
 */
import { clamp, gaussian, mulberry32 } from './utilities.js';

export const ECG_LEADS = Object.freeze(['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']);

export const LEAD_MORPHOLOGY = Object.freeze({
  I: { p: 0.8, q: -0.08, r: 0.72, s: -0.16, t: 0.65, st: 0.02 },
  II: { p: 1, q: -0.12, r: 1, s: -0.22, t: 0.8, st: 0.03 },
  III: { p: 0.5, q: -0.16, r: 0.55, s: -0.23, t: 0.45, st: 0.01 },
  aVR: { p: -0.65, q: 0.1, r: -0.78, s: 0.14, t: -0.55, st: -0.02 },
  aVL: { p: 0.55, q: -0.1, r: 0.54, s: -0.16, t: 0.4, st: 0 },
  aVF: { p: 0.7, q: -0.1, r: 0.75, s: -0.2, t: 0.55, st: 0.02 },
  V1: { p: 0.25, q: 0, r: 0.26, s: -0.66, t: -0.15, st: -0.02 },
  V2: { p: 0.3, q: 0, r: 0.38, s: -0.72, t: 0.08, st: 0.01 },
  V3: { p: 0.35, q: -0.04, r: 0.65, s: -0.48, t: 0.28, st: 0.02 },
  V4: { p: 0.45, q: -0.08, r: 0.86, s: -0.28, t: 0.45, st: 0.03 },
  V5: { p: 0.5, q: -0.1, r: 0.8, s: -0.2, t: 0.5, st: 0.02 },
  V6: { p: 0.45, q: -0.12, r: 0.7, s: -0.15, t: 0.45, st: 0.01 },
});

const isAtrialFibrillation = (rhythm) => rhythm === 'AFIB';
const isAtrialFlutter = (rhythm) => rhythm === 'AFLUTTER';
const isVentricularFibrillation = (rhythm) => rhythm === 'VF';
const isAsystole = (rhythm) => rhythm === 'ASYSTOLE';

const rhythmInterval = (rhythm, heartRate, rng) => {
  const base = 60 / clamp(heartRate || 72, 20, 300);
  if (isAtrialFibrillation(rhythm)) {
    const irregular = 0.55 + rng() * 1.05;
    return base * irregular;
  }
  if (rhythm === 'AFLUTTER') return base;
  if (rhythm === 'PVC') return base;
  return base;
};

const prOffset = (rhythm, heartRate) => {
  if (rhythm === 'AVB1') return -0.3;
  if (rhythm === 'SVT') return -0.09;
  if (rhythm === 'SINUS_TACHY') return -0.13;
  if (rhythm === 'NSR' || rhythm === 'SINUS_BRADY' || rhythm === 'PVC' || rhythm === 'VT') return -0.16;
  return -0.16;
};

const qrsWidth = (rhythm) => (
  ['VT', 'PVC'].includes(rhythm) ? 0.12
    : rhythm === 'PACED' ? 0.14
      : rhythm === 'SVT' ? 0.07 : 0.085
);

const tOffset = (rhythm, heartRate) => {
  if (rhythm === 'SINUS_TACHY' || rhythm === 'SVT' || heartRate > 120) return 0.2;
  return 0.27;
};

export class EcgSource {
  constructor({ seed = 7139, sampleRate = 400 } = {}) {
    this.sampleRate = sampleRate;
    this.time = 0;
    this.accumulator = 0;
    this.rng = mulberry32(seed);
    this.ventricularEvents = [];
    this.atrialEvents = [];
    this.nextVentricularAt = 0.12;
    this.nextAtrialAt = 0.4;
    this.lastRhythm = null;
    this.lastHeartRate = null;
    this.pvcCounter = 0;
    this.flutterPhase = 0;
    this.lead = 'II';
    this.pacing = { active: false, capture: true };
  }

  reset(time = 0) {
    this.time = time;
    this.accumulator = 0;
    this.ventricularEvents = [];
    this.atrialEvents = [];
    this.nextVentricularAt = time + 0.12;
    this.nextAtrialAt = time + 0.3;
    this.lastRhythm = null;
    this.lastHeartRate = null;
    this.pvcCounter = 0;
    this.rng = mulberry32(7139);
  }

  configure(cfg = {}) {
    const rhythmChanged = cfg.rhythm !== this.lastRhythm;
    const rateChanged = Math.abs((cfg.heartRate || 0) - (this.lastHeartRate || 0)) > 0.5;
    this.lead = cfg.lead || this.lead || 'II';
    this.pacing = {
      active: Boolean(cfg.pacing?.active),
      capture: cfg.pacing?.capture !== false,
    };
    if (rhythmChanged) {
      this.lastRhythm = cfg.rhythm;
      this.lastHeartRate = cfg.heartRate;
      // Keep only events that have already begun contributing to the trace;
      // discard future events from the previous rhythm to prevent overlaps.
      this.ventricularEvents = this.ventricularEvents.filter((event) => event.r <= this.time + 0.001);
      this.atrialEvents = this.atrialEvents.filter((event) => event.p <= this.time + 0.001);
      this.nextVentricularAt = this.time + 0.06;
      this.nextAtrialAt = this.time + 0.2;
      this.pvcCounter = 0;
    } else if (rateChanged) {
      this.lastHeartRate = cfg.heartRate;
      // Re-time the next beats immediately when the operator changes rate.
      // Future complexes from the previous rate are discarded; completed
      // complexes remain available for the trailing waveform.
      this.ventricularEvents = this.ventricularEvents.filter((event) => event.r <= this.time + 0.001);
      this.atrialEvents = this.atrialEvents.filter((event) => event.p <= this.time + 0.001);
      const rate = clamp(cfg.heartRate || 72, 20, 300);
      this.nextVentricularAt = this.time + Math.max(0.08, 60 / rate);
      this.pvcCounter = 0;
      if (cfg.rhythm === 'AVB2') {
        this.nextAtrialAt = this.time + 60 / clamp(rate * 2, 50, 280);
      } else if (cfg.rhythm === 'AVB3') {
        this.nextAtrialAt = this.time + 60 / 75;
      } else {
        this.nextAtrialAt = this.time + 1;
      }
    }
  }

  schedule(cfg) {
    const rhythm = cfg.rhythm || 'NSR';
    if (isAsystole(rhythm) || isVentricularFibrillation(rhythm)) {
      this.ventricularEvents = this.ventricularEvents.filter((event) => event.r > this.time - 1);
      this.atrialEvents = this.atrialEvents.filter((event) => event.p > this.time - 1);
      this.nextVentricularAt = this.time + 1;
      this.nextAtrialAt = this.time + 1;
      return;
    }
    const rate = clamp(cfg.heartRate || 72, 20, 300);
    const horizon = this.time + 1.2;
    let guard = 0;
    while (this.nextVentricularAt <= horizon && guard < 50) {
      guard += 1;
      const beatTime = this.nextVentricularAt;
      let type = 'normal';
      let interval = rhythmInterval(rhythm, rate, this.rng);
      let pOffset = prOffset(rhythm, rate);
      let paced = rhythm === 'PACED' || this.pacing.active;

      if (rhythm === 'PVC') {
        this.pvcCounter += 1;
        if (this.pvcCounter % 4 === 0) {
          type = 'pvc';
          pOffset = null;
          interval = (60 / rate) * 0.75;
        }
      } else if (rhythm === 'VT') {
        type = 'wide';
        pOffset = null;
      } else if (rhythm === 'PACED' || paced) {
        type = 'paced';
        pOffset = null;
      } else if (rhythm === 'AFIB') {
        pOffset = null;
      } else if (rhythm === 'AFLUTTER') {
        pOffset = null;
      } else if (rhythm === 'AVB2' || rhythm === 'AVB3') {
        pOffset = null;
      } else if (rhythm === 'SVT') {
        type = 'narrow';
        pOffset = -0.08;
      }

      const capture = !paced || rhythm !== 'PACED' || this.pacing.capture;
      this.ventricularEvents.push({
        r: beatTime,
        type,
        pOffset,
        capture,
        wide: ['wide', 'pvc', 'paced'].includes(type),
        qrsScale: rhythm === 'VT' ? 1.12 : rhythm === 'PVC' ? 1.15 : 1,
        tScale: rhythm === 'VT' ? 0.7 : 1,
        st: rhythm === 'VT' ? -0.12 : 0.02,
      });
      if (rhythm === 'PVC' && this.pvcCounter % 4 === 3) {
        interval = (60 / rate) * 1.3;
      }
      if (rhythm === 'AVB2') {
        // Independently scheduled P waves at twice the ventricular rate.
        interval = 60 / rate;
      }
      this.nextVentricularAt += interval;
    }

    if (rhythm === 'AVB2' || rhythm === 'AVB3') {
      const atrialRate = rhythm === 'AVB2' ? clamp(rate * 2, 50, 280) : 75;
      const atrialInterval = 60 / atrialRate;
      let guardAtrial = 0;
      while (this.nextAtrialAt <= horizon && guardAtrial < 80) {
        guardAtrial += 1;
        this.atrialEvents.push({ p: this.nextAtrialAt, blocked: rhythm === 'AVB2' });
        this.nextAtrialAt += atrialInterval;
      }
    } else {
      this.nextAtrialAt = this.time + 1;
    }

    const cutoff = this.time - 2;
    if (this.ventricularEvents.length > 24) {
      this.ventricularEvents = this.ventricularEvents.filter((event) => event.r > cutoff);
    }
    if (this.atrialEvents.length > 24) {
      this.atrialEvents = this.atrialEvents.filter((event) => event.p > cutoff);
    }
  }

  morphologySample(cfg, t, mode = 'II') {
    const rhythm = cfg.rhythm || 'NSR';
    const mods = LEAD_MORPHOLOGY[mode] || LEAD_MORPHOLOGY.II;
    const rate = clamp(cfg.heartRate || 72, 20, 320);
    let value = 0;

    if (isVentricularFibrillation(rhythm)) {
      const warp = Math.sin(t * 0.73) * 0.55 + Math.sin(t * 0.29 + 1.1) * 0.35;
      const f1 = 4.1 + Math.sin(t * 0.43) * 0.8;
      const f2 = 6.6 + Math.cos(t * 0.31) * 1.1;
      value = (
        Math.sin(2 * Math.PI * f1 * t + warp * 3) * 0.55
        + Math.sin(2 * Math.PI * f2 * t + 2.1) * 0.26
        + Math.sin(2 * Math.PI * (f1 * 1.7) * t + 0.7) * 0.12
      ) * (mods.r * 0.9 + 0.2);
      value += (Math.random() - 0.5) * 0.075;
      return clamp(value, -1.7, 1.7);
    }

    if (isAsystole(rhythm)) {
      return (Math.sin(t * 0.9) * 0.008) + (Math.random() - 0.5) * 0.007;
    }

    const baselineWander = Math.sin(t * 2 * Math.PI * 0.24 + 0.3) * (cfg.baselineWander ?? 0.08) * 0.28;
    value += baselineWander;

    if (isAtrialFibrillation(rhythm)) {
      value += (
        Math.sin(2 * Math.PI * 5.3 * t + Math.sin(t * 1.1))
        + 0.55 * Math.sin(2 * Math.PI * 6.9 * t + 0.4)
      ) * 0.035 * (mods.p + 0.4);
    }

    if (isAtrialFlutter(rhythm)) {
      const flutterHz = 300 / 60;
      const phase = (t * flutterHz) % 1;
      const saw = 2 * Math.abs(phase - 0.5) - 1;
      value += saw * 0.11 * (mods.p + 0.4);
    }

    for (const beat of this.ventricularEvents) {
      const dt = t - beat.r;
      if (dt < -0.34 || dt > 0.82) continue;
      const capture = beat.capture !== false;
      if (!capture) {
        // Pacer spike without captured QRS/T.
        if (beat.type === 'paced' && dt > -0.03 && dt < 0.02) {
          value += gaussian(dt, 0, 0.003) * 0.95;
        }
        continue;
      }
      const wide = beat.wide;
      const widthScale = wide ? 1.7 : 1;
      if (dt > -0.08 && dt < 0.16) {
        const qCenter = -0.018 * widthScale;
        const rCenter = 0.006 * widthScale;
        const sCenter = 0.033 * widthScale;
        const qWidth = wide ? 0.026 : 0.0075;
        const rWidth = wide ? 0.043 : 0.0105;
        const sWidth = wide ? 0.033 : 0.013;
        const q = gaussian(dt, qCenter, qWidth) * mods.q;
        const r = gaussian(dt, rCenter, rWidth) * mods.r * beat.qrsScale;
        const s = gaussian(dt, sCenter, sWidth) * mods.s * (wide ? 1.15 : 1);
        value += q + r + s;
        if (rhythm === 'VT') {
          value += gaussian(dt, 0.015, 0.06) * mods.r * 0.18;
        }
      }
      const tw = gaussian(dt, tOffset(rhythm, rate), rhythm === 'VT' ? 0.085 : 0.065);
      value += tw * mods.t * (beat.tScale || 1) * 0.23;
      if (dt > 0.03 && dt < 0.22) {
        value += gaussian(dt, 0.11, 0.055) * (beat.st || 0) * mods.t;
      }
      if (beat.pOffset !== null && beat.pOffset !== undefined) {
        const pdt = dt - beat.pOffset;
        if (pdt > -0.08 && pdt < 0.08) {
          value += gaussian(pdt, 0, 0.023) * mods.p * 0.15;
        }
      }
      if (beat.type === 'paced') {
        value += gaussian(dt, -0.014, 0.003) * 0.85;
      }
      if (beat.type === 'pvc') {
        value += gaussian(dt, 0.09, 0.02) * mods.t * 0.25;
      }
    }

    for (const atrial of this.atrialEvents) {
      const pdt = t - atrial.p;
      if (pdt > -0.08 && pdt < 0.08) {
        value += gaussian(pdt, 0, 0.021) * mods.p * 0.16;
      }
    }

    const noiseLevel = clamp(cfg.noise ?? 0.025, 0, 0.4);
    value += (Math.random() - 0.5) * noiseLevel * 0.5;
    const artifact = clamp(cfg.artifact ?? 0, 0, 1);
    if (artifact > 0 && Math.random() < artifact * 0.006) {
      value += (Math.random() - 0.5) * artifact * 0.9;
    }
    return clamp(value, -2.2, 2.2);
  }

  synthesizeSample(cfg, t) {
    return this.morphologySample(cfg, t, cfg.lead || this.lead || 'II');
  }

  advance(dt, cfg = {}) {
    this.configure(cfg);
    this.accumulator += Math.max(0, Math.min(dt, 0.2));
    const count = Math.floor(this.accumulator * this.sampleRate);
    if (count <= 0) return [];
    this.accumulator -= count / this.sampleRate;
    const output = [];
    for (let index = 0; index < count; index += 1) {
      this.time += 1 / this.sampleRate;
      this.schedule(cfg);
      output.push(this.synthesizeSample(cfg, this.time));
    }
    return output;
  }

  getNextRTime(cfg = {}) {
    this.configure(cfg);
    this.schedule(cfg);
    const upcoming = this.ventricularEvents
      .map((event) => event.r)
      .filter((time) => time >= this.time)
      .sort((a, b) => a - b);
    return upcoming[0] ?? this.time + 0.1;
  }

  isInSyncWindow(cfg = {}, windowSeconds = 0.08) {
    const next = this.getNextRTime(cfg);
    return Math.abs(next - this.time) <= windowSeconds;
  }

  getLastRTime(cfg = {}) {
    this.configure(cfg);
    this.schedule(cfg);
    const past = this.ventricularEvents
      .map((event) => event.r)
      .filter((time) => time <= this.time)
      .sort((a, b) => b - a);
    return past[0] ?? null;
  }

  getSyncMarkerPositions(cfg = {}, fromTime, toTime) {
    this.configure(cfg);
    this.schedule(cfg);
    return this.ventricularEvents
      .map((event) => event.r)
      .filter((time) => time >= fromTime && time <= toTime);
  }
}

export const createECGConfig = (sim) => ({
  rhythm: sim.rhythm,
  heartRate: sim.rhythm === 'PACED' ? sim.defib.pacing.rate : sim.heartRate,
  lead: sim.ecg.lead,
  noise: sim.ecg.noise,
  artifact: sim.ecg.artifact,
  baselineWander: sim.ecg.baselineWander,
  gain: sim.ecg.gain,
  pacing: {
    active: sim.defib.pacing.active,
    capture: sim.defib.pacing.electricalCapture,
  },
});

/** Generate a sample for a specific 12-lead channel from the same beat timeline. */
export const synthesizeLead = (source, cfg, t, lead) => source.morphologySample(cfg, t, lead);
