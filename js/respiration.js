/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Respiratory movement and impedance-style waveform generator.
 * Patterns are intentionally simplified educational representations.
 */
import { clamp } from './utilities.js';

export class RespirationSource {
  constructor({ sampleRate = 120 } = {}) {
    this.sampleRate = sampleRate;
    this.accumulator = 0;
    this.phase = 0;
    this.time = 0;
  }

  reset() {
    this.accumulator = 0;
    this.phase = 0;
    this.time = 0;
  }

  advance(dt, cfg = {}) {
    const rr = clamp(cfg.rate ?? 16, 0, 80);
    const depth = clamp(cfg.depth ?? 1, 0, 2);
    const irregularity = clamp(cfg.irregularity ?? 0, 0, 1);
    const pattern = cfg.pattern || 'normal';
    const connected = cfg.sensorConnected !== false;
    const apnea = !connected || rr <= 0.1 || pattern === 'apnea';
    this.accumulator += Math.max(0, Math.min(dt, 0.2));
    const count = Math.floor(this.accumulator * this.sampleRate);
    if (count <= 0) return [];
    this.accumulator -= count / this.sampleRate;
    const output = [];
    for (let index = 0; index < count; index += 1) {
      this.time += 1 / this.sampleRate;
      if (apnea) {
        output.push((Math.random() - 0.5) * (connected ? 0.018 : 0.003));
        continue;
      }
      const jitter = irregularity * 0.16 * Math.sin(this.time * 1.7) * Math.sin(this.time * 0.53);
      this.phase += ((rr / 60) * (1 + jitter)) / this.sampleRate;
      if (this.phase > 1) this.phase %= 1;
      const phase = this.phase;
      let shape;
      if (pattern === 'shallow') {
        shape = Math.sin(phase * 2 * Math.PI) * 0.4 + Math.sin(phase * 4 * Math.PI) * 0.06;
      } else if (pattern === 'rapid') {
        shape = Math.sin(phase * 2 * Math.PI) * 0.82 + Math.sin(phase * 4 * Math.PI) * 0.08;
      } else if (pattern === 'deep') {
        shape = Math.sin(phase * 2 * Math.PI) * 1.18 + Math.sin(phase * 4 * Math.PI) * 0.1;
      } else if (pattern === 'agonal') {
        const gasp = Math.max(0, Math.sin(phase * Math.PI * 2));
        shape = gasp ** 5 * 0.55 + (Math.random() - 0.5) * 0.03;
      } else if (pattern === 'irregular') {
        shape = Math.sin(phase * 2 * Math.PI + Math.sin(this.time * 0.8) * 0.6) * 0.9;
      } else {
        shape = Math.sin(phase * 2 * Math.PI) * 0.9 + Math.sin(phase * 4 * Math.PI) * 0.045;
      }
      const respiratoryAmplitude = depth * (connected ? 1 : 0) * 0.35;
      let value = shape * respiratoryAmplitude;
      value += Math.sin(this.time * 2 * Math.PI * 1.1) * 0.006;
      value += (Math.random() - 0.5) * 0.006;
      output.push(value);
    }
    return output;
  }
}
