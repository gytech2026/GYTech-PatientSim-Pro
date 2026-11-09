/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Software-only professional defibrillator simulation.
 * Finite-state machine with strict guards. This module cannot produce or
 * communicate with real electrical therapy.
 */
import { store } from './state.js';
import { physiology } from './physiology.js';
import { historyManager } from './history.js';
import { audioManager } from './audio.js';
import { aedController } from './aed.js';
import { pacingController } from './pacing.js';
import { clamp } from './utilities.js';

export const DEFIB_MODES = Object.freeze([
  { id: 'monitor', label: 'Monitor' },
  { id: 'manual', label: 'Manual Defib' },
  { id: 'aed', label: 'AED' },
  { id: 'sync', label: 'Sync Cardioversion' },
  { id: 'pacing', label: 'Pacing' },
]);

export const DEFIB_STATES = Object.freeze({
  MONITORING: 'MONITORING',
  READY: 'READY',
  CHARGING: 'CHARGING',
  CHARGED: 'CHARGED',
  DISARMING: 'DISARMING',
  SHOCK_SIMULATION: 'SHOCK_SIMULATION',
  POST_EVENT_ANALYSIS: 'POST_EVENT_ANALYSIS',
  ERROR: 'ERROR',
});

export const ENERGY_PRESETS = Object.freeze({
  manual: [50, 100, 120, 150, 200, 250, 300, 360],
  sync: [50, 100, 120, 150, 200],
  aed: [150],
  monitor: [],
  pacing: [],
});

const CHARGE_SECONDS = 3.2;

export class Defibrillator {
  constructor(
    storeRef = store,
    phys = physiology,
    history = historyManager,
    audio = audioManager,
    aed = aedController,
    pacing = pacingController,
  ) {
    this.store = storeRef;
    this.physiology = phys;
    this.history = history;
    this.audio = audio;
    this.aed = aed;
    this.pacing = pacing;
    this.disarmUntil = 0;
    this.shockUntil = 0;
    this.postEventUntil = 0;
    this.lastSyncState = false;
    this.store.on('device:reset-request', (event) => this.reset({ reason: event?.reason || 'device-reset' }));
    this.store.on('patient:context-applied', () => this.reset({ reason: 'patient-context', preserveBattery: true }));
    this.store.on('rhythm:changed', () => {
      if (this.mode === 'aed' && (this.charged || this.machineState === DEFIB_STATES.CHARGING)) {
        this.disarm('Rhythm changed during AED therapy preparation.');
        this.aed.state.phase = 'idle';
        this.aed.state.recommendation = null;
        this.aed.state.announcement = 'Rhythm changed. Reanalyse the simulated rhythm before charging.';
      }
      this.updateSyncReadiness();
    });
    this.store.on('sim:reset', () => this.reset({ reason: 'simulation-reset', preserveBattery: true }));
    this.reset({ reason: 'initial', preserveBattery: true, silent: true });
  }

  get sim() {
    return this.store.sim;
  }

  get defib() {
    return this.store.sim.defib;
  }

  get mode() {
    return this.defib.mode;
  }

  get machineState() {
    return this.defib.machineState;
  }

  reset({ reason = 'reset', preserveBattery = true, silent = false } = {}) {
    this.pacing.deactivate({ silent: true });
    const battery = preserveBattery ? this.defib.battery : Math.round(this.store.settings.batteryLevel);
    Object.assign(this.defib, {
      mode: 'monitor',
      machineState: DEFIB_STATES.MONITORING,
      energy: 120,
      chargeProgress: 0,
      charged: false,
      pads: true,
      padQuality: 1,
      sync: false,
      syncReady: false,
      shockCount: 0,
      lastShockAt: null,
      lastEvent: 'Device in monitor mode. Simulated therapy inactive.',
      battery,
      error: null,
      postEventUntil: 0,
    });
    this.defib.aed = {
      phase: 'idle',
      progress: 0,
      recommendation: null,
      analyzing: false,
      safetyConfirmed: false,
      announcement: 'Attach pads to begin AED analysis.',
    };
    this.disarmUntil = 0;
    this.shockUntil = 0;
    this.postEventUntil = 0;
    this.lastSyncState = false;
    if (!silent) {
      this.history.add({
        type: 'DEVICE_RESET',
        category: 'defibrillator',
        description: `Defibrillator simulation reset to monitor mode (${reason}).`,
        details: { reason, battery },
      });
    }
    this.store.emit('defib:changed');
  }

  setMode(mode) {
    if (!DEFIB_MODES.some((item) => item.id === mode)) {
      return { ok: false, reason: 'Unknown defibrillator mode.' };
    }
    if (this.machineState === DEFIB_STATES.SHOCK_SIMULATION) {
      return { ok: false, reason: 'Wait for the simulated shock event to complete.' };
    }
    if (mode === this.mode) return { ok: true, mode };
    if (this.machineState === DEFIB_STATES.CHARGING || this.machineState === DEFIB_STATES.CHARGED) {
      this.disarm('Mode change');
    }
    if (this.pacing.state.active) this.pacing.deactivate();
    this.defib.mode = mode;
    this.defib.sync = mode === 'sync';
    this.defib.syncReady = false;
    this.defib.charged = false;
    this.defib.chargeProgress = 0;
    this.defib.aed.safetyConfirmed = false;
    if (this.defib.battery <= 0) {
      this.defib.machineState = DEFIB_STATES.ERROR;
      this.defib.error = 'Simulated battery depleted. Replace the simulated battery before therapy.';
    } else {
      this.defib.error = null;
      this.defib.machineState = mode === 'monitor' ? DEFIB_STATES.MONITORING : DEFIB_STATES.READY;
    }
    if (mode === 'aed') {
      this.aed.reset();
      this.defib.energy = 150;
    } else if (mode === 'sync') {
      this.defib.energy = 100;
      this.aed.reset();
    } else if (mode === 'manual') {
      this.defib.energy = 120;
      this.aed.reset();
    } else if (mode === 'pacing') {
      this.defib.energy = 0;
      this.aed.reset();
    } else {
      this.defib.energy = 120;
    }
    this.defib.lastEvent = `${DEFIB_MODES.find((item) => item.id === mode).label} mode selected.`;
    this.history.add({
      type: 'DEFIB_MODE_CHANGE',
      category: 'defibrillator',
      description: `Defibrillator mode changed to ${this.defib.lastEvent.replace(' mode selected.', '')}.`,
      details: { mode, pads: this.defib.pads, sync: this.defib.sync },
    });
    this.updateSyncReadiness();
    this.store.emit('defib:changed');
    this.store.emit('defib:mode-changed', { mode });
    return { ok: true, mode };
  }

  setEnergy(value) {
    if (!['manual', 'sync'].includes(this.mode)) {
      return { ok: false, reason: 'Manual energy selection is unavailable in this mode.' };
    }
    if ([DEFIB_STATES.CHARGING, DEFIB_STATES.CHARGED, DEFIB_STATES.SHOCK_SIMULATION, DEFIB_STATES.POST_EVENT_ANALYSIS].includes(this.machineState)) {
      return { ok: false, reason: 'Energy cannot be changed while charging, charged, or during a post-event analysis.' };
    }
    const presets = ENERGY_PRESETS[this.mode];
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return { ok: false, reason: 'Invalid energy value.' };
    }
    const selected = presets.reduce((closest, preset) => (
      Math.abs(preset - numeric) < Math.abs(closest - numeric) ? preset : closest
    ), presets[0]);
    this.defib.energy = selected;
    this.defib.lastEvent = `Simulated energy set to ${selected} J.`;
    this.store.emit('defib:changed');
    return { ok: true, energy: selected };
  }

  setSyncEnabled(enabled) {
    if (this.mode !== 'sync') {
      return { ok: false, reason: 'Synchronization can be armed only in synchronized cardioversion mode.' };
    }
    if (this.machineState === DEFIB_STATES.SHOCK_SIMULATION) {
      return { ok: false, reason: 'Synchronization cannot be changed during shock delivery.' };
    }
    const next = Boolean(enabled);
    if (!next && (this.charged || this.machineState === DEFIB_STATES.CHARGING)) {
      this.disarm('Synchronization disabled');
    }
    this.defib.sync = next;
    this.updateSyncReadiness();
    this.defib.lastEvent = next ? 'Synchronization armed. Awaiting QRS marker.' : 'Synchronization disabled. Synchronized shock unavailable.';
    this.store.emit('defib:changed');
    return { ok: true, sync: next };
  }

  setPadsConnected(connected) {
    const next = Boolean(connected);
    if (this.defib.pads === next) return { ok: true, pads: next };
    if (!next) {
      if (this.pacing.state.active) this.pacing.deactivate();
      if (this.machineState === DEFIB_STATES.CHARGING || this.machineState === DEFIB_STATES.CHARGED) {
        this.disarm('Pads disconnected');
      }
      if (this.mode === 'aed') this.aed.onPadsChanged(false);
      this.defib.syncReady = false;
    } else if (this.mode === 'aed') {
      this.aed.onPadsChanged(true);
    }
    this.defib.pads = next;
    this.defib.padQuality = next ? 1 : 0;
    this.defib.lastEvent = next
      ? 'Therapy pads connected. Simulated device ready.'
      : 'Therapy pads disconnected. Charging is unavailable.';
    this.history.add({
      type: next ? 'PADS_CONNECTED' : 'PADS_DISCONNECTED',
      category: 'defibrillator',
      severity: next ? 'info' : 'warning',
      description: next ? 'Simulated therapy pads connected.' : 'Simulated therapy pads disconnected.',
      details: { mode: this.mode },
    });
    this.updateSyncReadiness();
    this.store.emit('defib:changed');
    return { ok: true, pads: next };
  }

  togglePads() {
    return this.setPadsConnected(!this.defib.pads);
  }

  updateSyncReadiness() {
    const organised = !['VF', 'ASYSTOLE'].includes(this.store.sim.rhythm) && this.store.sim.heartRate > 0;
    const ready = this.mode === 'sync'
      && this.defib.sync
      && this.defib.pads
      && organised
      && this.store.sim.pulse;
    this.defib.syncReady = ready;
    if (ready !== this.lastSyncState) {
      this.lastSyncState = ready;
      this.store.emit('defib:sync-changed', { syncReady: ready });
    }
    if (this.mode === 'sync' && this.defib.sync && !ready && (this.charged || this.machineState === DEFIB_STATES.CHARGING)) {
      this.disarm('Valid synchronization lost');
      this.defib.lastEvent = 'Synchronization lost. Charge disarmed.';
    }
    return ready;
  }

  canCharge() {
    if (!this.defib.pads) return false;
    if (this.defib.battery <= 5) return false;
    if (!['manual', 'sync', 'aed'].includes(this.mode)) return false;
    if ([DEFIB_STATES.CHARGING, DEFIB_STATES.CHARGED, DEFIB_STATES.SHOCK_SIMULATION, DEFIB_STATES.POST_EVENT_ANALYSIS].includes(this.machineState)) return false;
    if (this.mode === 'sync' && !this.defib.syncReady) return false;
    if (this.mode === 'aed' && !this.aed.canCharge()) return false;
    return true;
  }

  charge() {
    if (!this.defib.pads) {
      this.defib.lastEvent = 'Charge refused: simulated pads are disconnected.';
      return { ok: false, reason: 'Connect simulated therapy pads before charging.' };
    }
    if (this.defib.battery <= 5) {
      return { ok: false, reason: 'Battery too low to charge.' };
    }
    if (!['manual', 'sync', 'aed'].includes(this.mode)) {
      return { ok: false, reason: 'Charging is unavailable in this mode.' };
    }
    if (this.machineState === DEFIB_STATES.CHARGING || this.machineState === DEFIB_STATES.CHARGED) {
      return { ok: false, reason: 'The simulated device is already charging or charged.' };
    }
    if (this.machineState === DEFIB_STATES.SHOCK_SIMULATION || this.machineState === DEFIB_STATES.POST_EVENT_ANALYSIS) {
      return { ok: false, reason: 'Wait for post-event analysis to complete.' };
    }
    if (this.mode === 'sync' && !this.defib.syncReady) {
      return { ok: false, reason: 'Synchronization is not established. Select manual or restore a valid perfusing rhythm and sync.' };
    }
    if (this.mode === 'aed') {
      if (!this.aed.canCharge()) {
        return {
          ok: false,
          reason: this.aed.state.analyzing
            ? 'AED analysis is still in progress.'
            : 'AED charge is available only after a shock-advised analysis.',
        };
      }
      this.defib.energy = 150;
    }
    this.defib.machineState = DEFIB_STATES.CHARGING;
    this.defib.chargeProgress = 0;
    this.defib.charged = false;
    this.defib.lastEvent = `Charging to ${this.defib.energy} J (simulation).`;
    this.audio.chargingTone();
    this.history.add({
      type: 'DEFIB_CHARGE_START',
      category: 'defibrillator',
      severity: 'warning',
      description: `Simulated defibrillator charging to ${this.defib.energy} J.`,
      details: { mode: this.mode, energy: this.defib.energy, pads: this.defib.pads },
    });
    this.store.emit('defib:changed');
    return { ok: true };
  }

  completeCharge() {
    this.defib.machineState = DEFIB_STATES.CHARGED;
    this.defib.charged = true;
    this.defib.chargeProgress = 1;
    this.defib.energy = this.mode === 'aed' ? 150 : this.defib.energy;
    this.defib.battery = clamp(this.defib.battery - 0.8, 0, 100);
    this.defib.lastEvent = `Charged to ${this.defib.energy} J (simulation). Confirm safety before simulated delivery.`;
    this.audio.chargeCompleteTone();
    if (this.mode === 'aed') {
      this.audio.announce('Device charged. Confirm the safety check before delivering the simulated shock.', { force: true });
      this.aed.state.announcement = 'Charged. Confirm safety, then deliver the simulated shock.';
    }
    if (this.mode === 'sync') {
      this.audio.announce('Charged. Synchronized simulated shock ready.', { force: false });
    }
    this.history.add({
      type: 'DEFIB_CHARGED',
      category: 'defibrillator',
      severity: 'warning',
      description: `Simulated charge complete at ${this.defib.energy} J.`,
      details: { mode: this.mode, energy: this.defib.energy },
    });
    this.store.emit('defib:charged');
    this.store.emit('defib:changed');
  }

  disarm(reason = '') {
    if (![DEFIB_STATES.CHARGING, DEFIB_STATES.CHARGED].includes(this.machineState)) {
      return { ok: false, reason: 'There is no simulated charge to disarm.' };
    }
    this.defib.machineState = DEFIB_STATES.DISARMING;
    this.defib.charged = false;
    this.defib.chargeProgress = 0;
    this.defib.lastEvent = 'Simulated charge disarmed.';
    this.disarmUntil = Date.now() + 320;
    this.audio.disarmTone();
    this.history.add({
      type: 'DEFIB_DISARM',
      category: 'defibrillator',
      description: `Simulated charge disarmed${reason ? ` (${reason})` : ''}.`,
      details: { mode: this.mode, reason },
    });
    this.store.emit('defib:changed');
    return { ok: true };
  }

  canShock() {
    if (!this.defib.pads) return false;
    if (this.machineState !== DEFIB_STATES.CHARGED || !this.defib.charged) return false;
    if (!['manual', 'sync', 'aed'].includes(this.mode)) return false;
    if (this.defib.battery <= 2) return false;
    if (this.mode === 'sync' && (!this.defib.sync || !this.defib.syncReady)) return false;
    if (this.mode === 'aed' && !this.aed.canShock()) return false;
    return true;
  }

  deliverShock() {
    if (this.machineState !== DEFIB_STATES.CHARGED || !this.defib.charged) {
      return { ok: false, reason: 'Simulated shock unavailable: device is not charged.' };
    }
    if (!this.defib.pads) {
      return { ok: false, reason: 'Simulated shock unavailable: pads are disconnected.' };
    }
    if (this.mode === 'aed') {
      if (!this.aed.state.safetyConfirmed) {
        return { ok: false, reason: 'Complete the AED safety confirmation before simulated shock delivery.' };
      }
      const currentRecommendation = this.physiology.getAEDRecommendation();
      if (!currentRecommendation.shockAdvise) {
        this.disarm('Rhythm no longer shockable');
        this.defib.lastEvent = 'Simulated shock withheld after re-analysis indicated no shock.';
        return { ok: false, reason: 'Current simulated rhythm is no longer classified as shockable. Reassess.' };
      }
    }
    if (this.mode === 'sync') {
      this.updateSyncReadiness();
      if (!this.defib.sync || !this.defib.syncReady) {
        return { ok: false, reason: 'Synchronized shock unavailable: no valid simulated synchronization.' };
      }
      if (!this.store.sim.pulse) {
        return { ok: false, reason: 'Synchronized cardioversion requires a perfusing simulated rhythm. Use manual mode for pulseless rhythms.' };
      }
    }
    this.defib.machineState = DEFIB_STATES.SHOCK_SIMULATION;
    this.defib.charged = false;
    this.defib.chargeProgress = 0;
    this.defib.battery = clamp(this.defib.battery - 1.7, 0, 100);
    // physiology.applyShock() owns the single authoritative shock counter.
    this.defib.lastShockAt = Date.now();
    this.defib.lastEvent = `Simulated ${this.mode === 'sync' ? 'synchronized ' : ''}energy delivered. Post-event analysis in progress.`;
    this.audio.shockTone();
    this.audio.announce(`Simulated ${this.mode === 'sync' ? 'synchronized shock' : 'shock'} delivered. Resume simulated assessment.`, { force: false });
    const result = this.physiology.applyShock({
      synchronized: this.mode === 'sync',
      mode: this.mode,
    });
    this.aed.markDelivered();
    if (this.mode === 'aed') {
      this.aed.state.phase = 'post-shock';
      this.aed.state.announcement = 'Simulated shock delivered. Begin simulated CPR and reassess.';
    }
    this.shockUntil = Date.now() + 950;
    this.postEventUntil = 0;
    this.store.emit('defib:shock-delivered', { mode: this.mode, result });
    this.store.emit('defib:changed');
    return { ok: true, ...result };
  }

  startAEDAnalysis() {
    return this.aed.startAnalysis();
  }

  setAEDSafelyConfirmed(confirmed) {
    const result = this.aed.setSafetyConfirmed(confirmed);
    this.store.emit('defib:changed');
    return result;
  }

  setPacingActive(active) {
    if (this.mode !== 'pacing') {
      return { ok: false, reason: 'Pacing is available only in pacing mode.' };
    }
    if (active) return this.pacing.activate();
    return this.pacing.deactivate();
  }

  setPacingRate(rate) {
    if (this.mode !== 'pacing') return { ok: false, reason: 'Pacing is available only in pacing mode.' };
    return this.pacing.setRate(rate);
  }

  setPacingOutput(output) {
    if (this.mode !== 'pacing') return { ok: false, reason: 'Pacing is available only in pacing mode.' };
    return this.pacing.setOutput(output);
  }

  setBattery(value) {
    const previous = this.defib.battery;
    this.defib.battery = clamp(Number(value), 0, 100);
    if (this.defib.battery <= 0) {
      if (this.pacing.state.active) this.pacing.deactivate({ silent: true });
      if (this.aed.state.analyzing) this.aed.cancelAnalysis('Simulated battery depleted during analysis.');
      if (this.machineState === DEFIB_STATES.CHARGING || this.machineState === DEFIB_STATES.CHARGED) {
        this.disarm('Battery depleted');
      }
      this.defib.machineState = DEFIB_STATES.ERROR;
      this.defib.charged = false;
      this.defib.chargeProgress = 0;
      this.defib.error = 'Simulated battery depleted. Device therapy unavailable.';
    } else if (previous <= 0 && this.defib.battery > 0) {
      this.defib.machineState = this.mode === 'monitor' ? DEFIB_STATES.MONITORING : DEFIB_STATES.READY;
      this.defib.error = null;
    }
    this.store.updateSettings({ batteryLevel: this.defib.battery });
    this.store.emit('defib:changed');
    return this.defib.battery;
  }

  selfTest() {
    const failures = [];
    if (!this.defib.pads) failures.push('Therapy pads disconnected');
    if (this.defib.battery <= 10) failures.push('Battery critically low');
    if (this.defib.machineState === DEFIB_STATES.ERROR) failures.push(this.defib.error || 'Device error');
    if (!this.store.sim.sensors.ecg) failures.push('ECG acquisition unavailable');
    const passed = failures.length === 0;
    this.history.add({
      type: 'DEVICE_SELF_TEST',
      category: 'system',
      severity: passed ? 'info' : 'warning',
      description: passed ? 'Simulated defibrillator self-test passed.' : `Self-test found: ${failures.join('; ')}.`,
      details: { failures, battery: this.defib.battery },
    });
    this.store.emit('defib:changed');
    return { passed, failures };
  }

  tick(dt) {
    const defib = this.defib;
    if (defib.battery <= 0 && defib.machineState !== DEFIB_STATES.ERROR) {
      if (this.pacing.state.active) this.pacing.deactivate({ silent: true });
      if (this.aed.state.analyzing) this.aed.cancelAnalysis('Simulated battery depleted during analysis.');
      if (defib.charged || defib.machineState === DEFIB_STATES.CHARGING) this.disarm('Battery depleted');
      defib.machineState = DEFIB_STATES.ERROR;
      defib.error = 'Simulated battery depleted. Device therapy unavailable.';
    }
    if (defib.machineState === DEFIB_STATES.CHARGING) {
      defib.chargeProgress = clamp(defib.chargeProgress + dt / CHARGE_SECONDS, 0, 1);
      if (defib.chargeProgress >= 1) this.completeCharge();
    }
    if (defib.machineState === DEFIB_STATES.DISARMING && Date.now() >= this.disarmUntil) {
      defib.machineState = this.mode === 'monitor' ? DEFIB_STATES.MONITORING : DEFIB_STATES.READY;
      this.store.emit('defib:changed');
    }
    if (defib.machineState === DEFIB_STATES.SHOCK_SIMULATION && Date.now() >= this.shockUntil) {
      defib.machineState = DEFIB_STATES.POST_EVENT_ANALYSIS;
      this.shockUntil = 0;
      this.postEventUntil = Date.now() + 2200;
      this.aed.markDelivered();
      this.store.emit('defib:changed');
    }
    if (defib.machineState === DEFIB_STATES.POST_EVENT_ANALYSIS && this.postEventUntil && Date.now() >= this.postEventUntil) {
      this.postEventUntil = 0;
      if (this.mode === 'aed') {
        this.aed.state.phase = 'ready-to-reanalyse';
        this.aed.state.analyzing = false;
        this.aed.state.recommendation = null;
        this.aed.state.safetyConfirmed = false;
        this.aed.state.announcement = 'Post-event analysis complete. Reassess the simulated patient and analyse again.';
      }
      defib.machineState = DEFIB_STATES.READY;
      defib.lastEvent = 'Post-event analysis complete. Reassess simulated patient.';
      this.store.emit('defib:post-event-complete');
      this.store.emit('defib:changed');
    }
    this.aed.tick(dt);
    this.updateSyncReadiness();
  }

  getStatus() {
    const defib = this.defib;
    return {
      mode: defib.mode,
      machineState: defib.machineState,
      modeLabel: DEFIB_MODES.find((item) => item.id === defib.mode)?.label || defib.mode,
      energy: defib.energy,
      presets: ENERGY_PRESETS[defib.mode] || [],
      chargeProgress: defib.chargeProgress,
      charged: defib.charged,
      pads: defib.pads,
      padQuality: defib.padQuality,
      sync: defib.sync,
      syncReady: defib.syncReady,
      pacing: { ...defib.pacing },
      aed: { ...defib.aed },
      battery: defib.battery,
      error: defib.error,
      lastEvent: defib.lastEvent,
      shockCount: defib.shockCount,
      canCharge: this.canCharge(),
      canShock: this.canShock(),
      canDisarm: [DEFIB_STATES.CHARGING, DEFIB_STATES.CHARGED].includes(defib.machineState),
      canAnalyze: defib.mode === 'aed' && defib.pads && !defib.aed.analyzing && !defib.charged,
      safetyConfirmed: defib.aed.safetyConfirmed,
      readiness: defib.battery > 10 && !defib.error,
      simulationOnly: true,
      rhythmClassification: this.physiology.classifyRhythm(),
    };
  }
}

export const defibrillator = new Defibrillator();
