/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * AED analysis workflow controller.
 * Analysis and recommendations are software simulations derived only from the
 * explicitly configured rhythm and pulse/perfusion state.
 */
import { store } from './state.js';
import { physiology } from './physiology.js';
import { historyManager } from './history.js';
import { audioManager } from './audio.js';
import { clamp } from './utilities.js';

export class AEDController {
  constructor(storeRef = store, phys = physiology, history = historyManager, audio = audioManager) {
    this.store = storeRef;
    this.physiology = phys;
    this.history = history;
    this.audio = audio;
    this.analysisDuration = 4.2;
  }

  get state() {
    return this.store.sim.defib.aed;
  }

  get available() {
    return this.store.sim.defib.mode === 'aed';
  }

  reset() {
    const defib = this.store.sim.defib;
    defib.aed = {
      phase: 'idle',
      progress: 0,
      recommendation: null,
      analyzing: false,
      safetyConfirmed: false,
      announcement: defib.pads ? 'Pads attached. Ready to analyse simulated rhythm.' : 'Attach simulated pads to begin AED analysis.',
    };
  }

  onPadsChanged(connected) {
    if (this.state.analyzing) this.cancelAnalysis('Pads removed during analysis.');
    this.state.phase = 'idle';
    this.state.progress = 0;
    this.state.recommendation = null;
    this.state.analyzing = false;
    this.state.safetyConfirmed = false;
    this.state.announcement = connected
      ? 'Pads attached. Ready to analyse simulated rhythm.'
      : 'Attach simulated pads to begin AED analysis.';
  }

  startAnalysis() {
    if (!this.available) return { ok: false, reason: 'Select AED mode first.' };
    if (!this.store.sim.defib.pads) return { ok: false, reason: 'Attach simulated pads before analysis.' };
    if (this.store.sim.defib.battery <= 5) return { ok: false, reason: 'Simulated battery too low for AED analysis.' };
    if (this.store.sim.defib.charged || this.store.sim.defib.machineState === 'CHARGING') {
      return { ok: false, reason: 'Disarm the simulated charge before re-analysis.' };
    }
    if (this.state.analyzing) return { ok: false, reason: 'Analysis already in progress.' };
    if (this.state.phase === 'analyzing') return { ok: false, reason: 'Analysis already in progress.' };
    this.state.analyzing = true;
    this.state.phase = 'analyzing';
    this.state.progress = 0;
    this.state.recommendation = null;
    this.state.safetyConfirmed = false;
    this.state.announcement = 'Analysing simulated rhythm. Do not touch the simulated patient.';
    this.audio.announce('Analysing rhythm. Do not touch the patient.', { force: true });
    this.history.add({
      type: 'AED_ANALYSIS_START',
      category: 'defibrillator',
      description: 'AED rhythm analysis started.',
      details: { pulse: this.store.sim.pulse, rhythm: this.store.sim.rhythm },
    });
    this.store.emit('aed:analysis-started');
    return { ok: true };
  }

  cancelAnalysis(reason = 'AED analysis cancelled.') {
    this.state.analyzing = false;
    this.state.phase = 'idle';
    this.state.progress = 0;
    this.state.recommendation = null;
    this.state.announcement = reason;
  }

  tick(dt) {
    const defib = this.store.sim.defib;
    if (this.state.analyzing) {
      this.state.progress = clamp(this.state.progress + dt / this.analysisDuration, 0, 1);
      if (!this.available) {
        this.cancelAnalysis('AED mode left. Analysis cancelled.');
        return;
      }
      if (this.state.progress >= 1) this.finishAnalysis();
    }
    if (defib.machineState === 'POST_EVENT_ANALYSIS' && defib.postEventUntil && Date.now() >= defib.postEventUntil) {
      defib.machineState = 'READY';
      defib.postEventUntil = 0;
      if (this.available && this.state.phase === 'post-shock') {
        this.state.phase = 'ready-to-reanalyse';
        this.state.analyzing = false;
        this.state.progress = 0;
        this.state.recommendation = null;
        this.state.safetyConfirmed = false;
        this.state.announcement = 'Post-event analysis complete. Reassess the simulated patient and analyse again if appropriate.';
        defib.lastEvent = 'Post-event analysis complete. Reassess simulated patient.';
      }
      this.store.emit('defib:post-event-complete');
    }
  }

  finishAnalysis() {
    const recommendation = this.physiology.getAEDRecommendation();
    this.state.analyzing = false;
    this.state.progress = 1;
    this.state.recommendation = recommendation;
    this.state.phase = recommendation.shockAdvise ? 'shock-advised' : 'no-shock';
    this.state.safetyConfirmed = false;
    if (recommendation.shockAdvise) {
      this.state.announcement = 'SHOCK ADVISED. Charge the simulated device, confirm the safety check, then deliver simulated energy.';
      this.store.sim.defib.lastEvent = 'AED analysis: shock advised.';
      this.audio.announce('Shock advised. Charge the device.', { force: true });
      this.history.add({
        type: 'AED_SHOCK_ADVISED',
        category: 'defibrillator',
        severity: 'critical',
        description: `AED analysis result: SHOCK ADVISED — ${recommendation.label}.`,
        details: { rhythm: this.store.sim.rhythm, pulse: this.store.sim.pulse, code: recommendation.code },
      });
    } else {
      this.state.announcement = 'NO SHOCK ADVISED. Continue simulated CPR and reassess.';
      this.store.sim.defib.lastEvent = 'AED analysis: no shock advised.';
      this.audio.announce('No shock advised. Resume CPR.', { force: true });
      this.history.add({
        type: 'AED_NO_SHOCK',
        category: 'defibrillator',
        description: `AED analysis result: NO SHOCK ADVISED — ${recommendation.label}.`,
        details: { rhythm: this.store.sim.rhythm, pulse: this.store.sim.pulse, code: recommendation.code },
      });
    }
    this.store.emit('aed:analysis-complete', recommendation);
  }

  setSafetyConfirmed(confirmed) {
    if (!this.available) return { ok: false, reason: 'AED mode is not active.' };
    if (!this.state.recommendation?.shockAdvise) {
      return { ok: false, reason: 'Safety confirmation is available only after a shock-advised analysis.' };
    }
    this.state.safetyConfirmed = Boolean(confirmed);
    return { ok: true, safetyConfirmed: this.state.safetyConfirmed };
  }

  canCharge() {
    return this.available
      && this.store.sim.defib.pads
      && this.state.recommendation?.shockAdvise === true
      && this.state.phase === 'shock-advised'
      && !this.state.analyzing
      && this.store.sim.defib.machineState !== 'CHARGED'
      && this.store.sim.defib.machineState !== 'CHARGING';
  }

  canShock() {
    return this.available
      && this.state.recommendation?.shockAdvise === true
      && this.state.safetyConfirmed === true
      && this.store.sim.defib.machineState === 'CHARGED';
  }

  markDelivered() {
    if (this.store.sim.defib.machineState === 'SHOCK_SIMULATION') {
      this.state.phase = 'post-shock';
      this.state.analyzing = false;
      this.state.progress = 0;
      this.state.recommendation = null;
      this.state.safetyConfirmed = false;
      this.state.announcement = 'Simulated shock delivered. Begin simulated CPR and reassess.';
    }
  }
}

export const aedController = new AEDController();
