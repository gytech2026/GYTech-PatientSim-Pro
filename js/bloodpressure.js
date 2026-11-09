/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Invasive pressure waveform generators (arterial, CVP, pulmonary artery, ICP).
 * These are simplified educational waveforms, not calibrated pressure signals.
 */
import { clamp } from './utilities.js';

const pulseShape = (phase) => {
  const p = phase % 1;
  if (p < 0.09) {
    const x = p / 0.09;
    return 0.2 + 0.8 * (1 - (1 - x) ** 2);
  }
  if (p < 0.2) {
    const x = (p - 0.09) / 0.11;
    return 1 - x * 0.22;
  }
  if (p < 0.3) {
    const x = (p - 0.2) / 0.1;
    return 0.78 - x * 0.16 + Math.sin(x * Math.PI) * 0.065;
  }
  if (p < 0.46) {
    const x = (p - 0.3) / 0.16;
    return 0.62 - x * 0.15;
  }
  const x = (p - 0.46) / 0.54;
  return 0.47 * (1 - x) ** 2.2;
};

export class PressureSource {
  constructor(mode = 'ART', { sampleRate = 200 } = {}) {
    this.mode = mode;
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
    const connected = cfg.sensorConnected !== false;
    const hasPulse = cfg.hasPulse !== false;
    const rate = clamp(cfg.rate || 72, 0, 300);
    const quality = connected ? clamp(cfg.quality ?? 1, 0, 1) : 0;
    this.accumulator += Math.max(0, Math.min(dt, 0.2));
    const count = Math.floor(this.accumulator * this.sampleRate);
    if (count <= 0) return [];
    this.accumulator -= count / this.sampleRate;
    const output = [];
    for (let index = 0; index < count; index += 1) {
      this.time += 1 / this.sampleRate;
      if (!connected) {
        output.push(0);
        continue;
      }
      if (!hasPulse) {
        output.push((Math.random() - 0.5) * 0.008);
        continue;
      }
      this.phase += (rate / 60) / this.sampleRate;
      if (this.phase >= 1) this.phase %= 1;
      let value = 0;
      if (this.mode === 'ART') {
        value = pulseShape(this.phase) * 0.85;
      } else if (this.mode === 'CVP') {
        const p = this.phase;
        const a = Math.exp(-((p - 0.14) ** 2) / 0.002) * 0.42;
        const c = Math.exp(-((p - 0.3) ** 2) / 0.001) * 0.34;
        const v = Math.exp(-((p - 0.55) ** 2) / 0.004) * 0.27;
        value = (a + c + v) * 0.55 - 0.12;
      } else if (this.mode === 'PA') {
        value = pulseShape(this.phase) * 0.58;
        value += Math.exp(-((this.phase - 0.4) ** 2) / 0.006) * 0.16;
      } else if (this.mode === 'ICP') {
        value = pulseShape(this.phase) * 0.42
          + Math.sin(this.time * 2 * Math.PI * 0.25) * 0.1
          + Math.sin(this.phase * 2 * Math.PI) * 0.06;
      }
      value += (Math.random() - 0.5) * (0.006 + (1 - quality) * 0.04);
      output.push(value);
    }
    return output;
  }
}

export const formatBP = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : '--');
