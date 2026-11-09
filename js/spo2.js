/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Simulated pulse oximetry and plethysmographic waveform source.
 * The pleth amplitude follows perfusion, pulse state and signal quality.
 */
import { clamp } from './utilities.js';

export class PlethSource {
  constructor({ sampleRate = 200, seed = 311 } = {}) {
    this.sampleRate = sampleRate;
    this.accumulator = 0;
    this.phase = 0;
    this.time = 0;
    this.seed = seed;
    this.lastRate = 72;
  }

  reset() {
    this.phase = 0;
    this.time = 0;
    this.accumulator = 0;
  }

  waveform(phase) {
    const p = phase % 1;
    if (p < 0.1) {
      const x = p / 0.1;
      return x * x * (3 - 2 * x);
    }
    if (p < 0.2) {
      const x = (p - 0.1) / 0.1;
      return 1 - x * 0.28;
    }
    if (p < 0.31) {
      const x = (p - 0.2) / 0.11;
      return 0.72 - x * 0.14 + Math.sin(x * Math.PI) * 0.055;
    }
    if (p < 0.44) {
      const x = (p - 0.31) / 0.13;
      return 0.58 - x * 0.13;
    }
    const x = (p - 0.44) / 0.56;
    return 0.45 * (1 - x) ** 2;
  }

  advance(dt, cfg = {}) {
    const hasPulse = cfg.hasPulse !== false;
    const quality = cfg.sensorConnected === false ? 0 : clamp(cfg.quality ?? 1, 0, 1);
    const perfusion = clamp(cfg.perfusion ?? 1, 0, 1.5);
    const rate = clamp(cfg.rate || 72, 0, 300);
    this.accumulator += Math.max(0, Math.min(dt, 0.2));
    const count = Math.floor(this.accumulator * this.sampleRate);
    if (count <= 0) return [];
    this.accumulator -= count / this.sampleRate;
    const output = [];
    const respiratoryRate = clamp(cfg.respiratoryRate ?? 16, 0, 80);
    for (let index = 0; index < count; index += 1) {
      this.time += 1 / this.sampleRate;
      this.phase += (hasPulse ? rate / 60 : 0) / this.sampleRate;
      if (this.phase > 1) this.phase %= 1;
      if (!hasPulse || quality <= 0.02) {
        output.push((Math.random() - 0.5) * 0.015);
        continue;
      }
      const beat = this.waveform(this.phase);
      const respiratoryMod = 1 + Math.sin(this.time * 2 * Math.PI * (respiratoryRate / 60)) * 0.11;
      const amplitude = 0.82 * clamp(perfusion, 0.12, 1.3) * respiratoryMod * (0.4 + quality * 0.6);
      let value = beat * amplitude;
      value += Math.sin(this.time * 2 * Math.PI * 3.1) * 0.004;
      value += (Math.random() - 0.5) * (0.012 + (1 - quality) * 0.07);
      if (quality < 0.35 && Math.random() < 0.005) value += (Math.random() - 0.5) * 0.24;
      output.push(value);
    }
    return output;
  }
}

export const getSpO2Status = (sim) => {
  if (!sim.sensors.spo2) return { available: false, label: 'SENSOR OFF', tone: 'off' };
  if (sim.signal.spo2 <= 0.05) return { available: false, label: 'NO SIGNAL', tone: 'off' };
  if (!sim.pulse) return { available: false, label: 'NO PULSE', tone: 'warn' };
  if (sim.signal.spo2 < 0.4) return { available: true, label: 'LOW SIGNAL', tone: 'warn' };
  if (sim.spo2 < 85) return { available: true, label: 'CRITICAL', tone: 'critical' };
  if (sim.spo2 < 90) return { available: true, label: 'LOW', tone: 'warn' };
  return { available: true, label: 'GOOD', tone: 'ok' };
};
