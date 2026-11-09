/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Educational capnogram generator with simplified normal, hypoventilation,
 * hyperventilation, apnea, rebreathing, obstruction and disconnected-line
 * patterns.
 */
import { clamp } from './utilities.js';

export class CapnographySource {
  constructor({ sampleRate = 150 } = {}) {
    this.sampleRate = sampleRate;
    this.accumulator = 0;
    this.phase = 0;
    this.time = 0;
    this.breathCount = 0;
  }

  reset() {
    this.accumulator = 0;
    this.phase = 0;
    this.time = 0;
    this.breathCount = 0;
  }

  shapeForPhase(phase, pattern) {
    const p = phase % 1;
    if (pattern === 'obstruction') {
      // Shark-fin: slow upstroke and progressively rising plateau.
      if (p < 0.07) return 0;
      if (p < 0.3) {
        const x = (p - 0.07) / 0.23;
        return x * x;
      }
      if (p < 0.58) {
        const x = (p - 0.3) / 0.28;
        return 0.91 + x * 0.09;
      }
      if (p < 0.7) {
        const x = (p - 0.58) / 0.12;
        return 1 - x;
      }
      return 0;
    }
    if (p < 0.05) return 0;
    if (p < 0.13) {
      const x = (p - 0.05) / 0.08;
      return x * x * (3 - 2 * x);
    }
    if (p < 0.46) {
      const x = (p - 0.13) / 0.33;
      return 1 - x * 0.045;
    }
    if (p < 0.58) {
      const x = (p - 0.46) / 0.12;
      return 1 - x;
    }
    return 0;
  }

  advance(dt, cfg = {}) {
    const rr = clamp(cfg.rate ?? 16, 0, 80);
    const pattern = cfg.pattern || 'normal';
    const connected = cfg.sensorConnected !== false;
    const etco2 = clamp(cfg.etco2 ?? 38, 0, 120);
    const apnea = !connected || rr <= 0.1 || pattern === 'apnea' || pattern === 'disconnected';
    this.accumulator += Math.max(0, Math.min(dt, 0.2));
    const count = Math.floor(this.accumulator * this.sampleRate);
    if (count <= 0) return [];
    this.accumulator -= count / this.sampleRate;
    const output = [];
    for (let index = 0; index < count; index += 1) {
      this.time += 1 / this.sampleRate;
      if (apnea) {
        output.push((Math.random() - 0.5) * (pattern === 'disconnected' ? 0.003 : 0.012));
        continue;
      }
      this.phase += (rr / 60) / this.sampleRate;
      if (this.phase >= 1) {
        this.phase %= 1;
        this.breathCount += 1;
      }
      let shape = this.shapeForPhase(this.phase, pattern);
      let baseline = 0;
      if (pattern === 'rebreathing') {
        baseline = 0.18;
        shape = shape * 0.94 + Math.sin(this.phase * Math.PI * 2) * 0.02;
      }
      const amplitude = clamp(etco2 / 40, 0.05, 2.2) * 0.52;
      let value = baseline + shape * amplitude;
      value += Math.sin(this.time * 2 * Math.PI * 1.3) * 0.002;
      value += (Math.random() - 0.5) * 0.004;
      output.push(value);
    }
    return output;
  }
}

export const CAPNO_PATTERNS = Object.freeze([
  { id: 'normal', label: 'Normal capnogram' },
  { id: 'hypoventilation', label: 'Hypoventilation' },
  { id: 'hyperventilation', label: 'Hyperventilation' },
  { id: 'apnea', label: 'Apnea' },
  { id: 'rebreathing', label: 'Rebreathing' },
  { id: 'obstruction', label: 'Airway obstruction' },
  { id: 'disconnected', label: 'Disconnected sampling line' },
]);
