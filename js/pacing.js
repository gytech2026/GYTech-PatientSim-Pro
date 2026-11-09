/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Transcutaneous pacing controller.
 * Electrical capture and simulated mechanical capture are deliberately separate.
 */
import { store } from './state.js';
import { physiology } from './physiology.js';
import { historyManager } from './history.js';
import { audioManager } from './audio.js';
import { clamp } from './utilities.js';

export const PACING_LIMITS = Object.freeze({
  rate: { min: 20, max: 180, default: 70 },
  output: { min: 0, max: 200, default: 0 },
  captureThreshold: 55,
});

export class PacingController {
  constructor(storeRef = store, phys = physiology, history = historyManager, audio = audioManager) {
    this.store = storeRef;
    this.physiology = phys;
    this.history = history;
    this.audio = audio;
  }

  get state() {
    return this.store.sim.defib.pacing;
  }

  get available() {
    return this.store.sim.defib.mode === 'pacing' && this.store.sim.defib.pads;
  }

  activate() {
    const defib = this.store.sim.defib;
    if (defib.mode !== 'pacing') {
      return { ok: false, reason: 'Pacing is available only in pacing mode.' };
    }
    if (!defib.pads) {
      return { ok: false, reason: 'Connect simulated pacing/defibrillation pads first.' };
    }
    if (defib.battery <= 5) {
      return { ok: false, reason: 'Simulated battery too low to start pacing.' };
    }
    if (defib.charged || defib.machineState === 'CHARGING') {
      return { ok: false, reason: 'Disarm the simulated charge before starting pacing.' };
    }
    const result = this.physiology.setPacing({ active: true, rate: this.state.rate, output: this.state.output });
    this.history.add({
      type: 'PACING_START',
      category: 'pacing',
      description: `Simulated transcutaneous pacing started at ${this.state.rate} ppm, ${this.state.output} mA.`,
      details: {
        rate: this.state.rate,
        output: this.state.output,
        electricalCapture: result.electricalCapture,
        mechanicalCapture: result.mechanicalCapture,
      },
    });
    this.audio.tone({ frequency: 560, duration: 0.08, gain: 0.12 });
    this.store.emit('pacing:ui-changed');
    return { ok: true, ...result };
  }

  deactivate({ silent = false } = {}) {
    if (!this.state.active) return { ok: true };
    if (!silent) {
      this.history.add({
        type: 'PACING_STOP',
        category: 'pacing',
        description: 'Simulated transcutaneous pacing stopped.',
        details: { rate: this.state.rate, output: this.state.output },
      });
    }
    this.physiology.setPacing({ active: false });
    this.audio.disarmTone();
    this.store.emit('pacing:ui-changed');
    return { ok: true };
  }

  setRate(rate) {
    const value = clamp(Number(rate), PACING_LIMITS.rate.min, PACING_LIMITS.rate.max);
    this.state.rate = value;
    if (this.state.active) this.physiology.setPacing({ active: true, rate: value, output: this.state.output });
    this.store.emit('pacing:ui-changed');
    return { ok: true, rate: value };
  }

  setOutput(output) {
    const value = clamp(Number(output), PACING_LIMITS.output.min, PACING_LIMITS.output.max);
    this.state.output = value;
    if (this.state.active) this.physiology.setPacing({ active: true, output: value });
    this.store.emit('pacing:ui-changed');
    return { ok: true, output: value };
  }

  getStatus() {
    const state = this.state;
    return {
      active: state.active,
      rate: state.rate,
      output: state.output,
      electricalCapture: state.electricalCapture,
      mechanicalCapture: state.mechanicalCapture,
      threshold: state.threshold,
      modeWarning: this.store.sim.defib.mode !== 'pacing' ? 'Pacing controls are inactive outside pacing mode.' : null,
    };
  }

  reset() {
    this.physiology.setPacing({ active: false });
  }
}

export const pacingController = new PacingController();
