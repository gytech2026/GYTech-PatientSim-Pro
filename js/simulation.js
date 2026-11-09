/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Single authoritative animation loop for the workstation.
 * The loop drives physiology, defibrillator state, waveform rendering, alarms,
 * 12-lead refresh and throttled UI updates.
 */
import { store } from './state.js';
import { physiology } from './physiology.js';
import { defibrillator } from './defibrillator.js';
import { waveformEngine } from './waveform.js';
import { alarmEngine } from './alarms.js';
import { twelveLeadECG } from './ecg12lead.js';

export class SimulationController {
  constructor({
    storeRef = store,
    phys = physiology,
    defib = defibrillator,
    waveforms = waveformEngine,
    alarms = alarmEngine,
    twelveLead = twelveLeadECG,
  } = {}) {
    this.store = storeRef;
    this.physiology = phys;
    this.defib = defib;
    this.waveforms = waveforms;
    this.alarms = alarms;
    this.twelveLead = twelveLead;
    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
    this.accumulatedUi = 0;
    this.accumulatedClock = 0;
    this.tickListeners = new Set();
    this.clockListeners = new Set();
    this.frameListeners = new Set();
    this.uiInterval = 0.2;
    this.clockInterval = 1;
    this.frameCount = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (time) => {
      if (!this.running) return;
      const dt = Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
      this.lastTime = time;
      this.frameCount += 1;
      this.physiology.update(dt);
      this.defib.tick(dt);
      this.waveforms.render(dt);
      this.alarms.evaluate();
      if (this.twelveLead.isOpen) this.twelveLead.update(dt);
      for (const listener of this.frameListeners) {
        try { listener({ dt, frame: this.frameCount }); } catch (error) { console.error('[GYTech PatientSim Pro] Frame listener failed', error); }
      }
      this.accumulatedUi += dt;
      this.accumulatedClock += dt;
      if (this.accumulatedUi >= this.uiInterval) {
        this.accumulatedUi = 0;
        this.store.emit('simulation:ui-tick', { dt, frame: this.frameCount });
        for (const listener of this.tickListeners) {
          try { listener({ dt, frame: this.frameCount }); } catch (error) { console.error('[GYTech PatientSim Pro] UI tick listener failed', error); }
        }
      }
      if (this.accumulatedClock >= this.clockInterval) {
        this.accumulatedClock = 0;
        for (const listener of this.clockListeners) {
          try { listener(new Date()); } catch (error) { console.error('[GYTech PatientSim Pro] Clock listener failed', error); }
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
    this.store.emit('simulation:started');
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.store.emit('simulation:stopped');
  }

  subscribeTick(listener) {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  subscribeClock(listener) {
    this.clockListeners.add(listener);
    return () => this.clockListeners.delete(listener);
  }

  subscribeFrame(listener) {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  togglePause() {
    this.physiology.setRunning(!this.store.sim.running);
    return this.store.sim.running;
  }
}

export const simulation = new SimulationController();
