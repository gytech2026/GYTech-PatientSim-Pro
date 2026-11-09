/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Central physiological simulation model.
 * All vital signs, waveforms, alarms and device effects share this state.
 * Values are educational approximations, not clinical predictions.
 */
import {
  RHYTHMS, SENSOR_KEYS, SHOCKABLE_RHYTHMS, store,
} from './state.js';
import { patientManager } from './patient.js';
import { historyManager } from './history.js';
import { getScenarioById, scenarioPatchFromInitial } from './scenarios.js';
import { clamp, deepClone, roundTo } from './utilities.js';

const smooth = (current, target, tau, dt) => {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(tau) || tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
};

const isLethalRhythm = (rhythm) => rhythm === 'VF' || rhythm === 'ASYSTOLE';

const sanitizeBPM = (value, rhythm) => {
  if (rhythm === 'ASYSTOLE' || rhythm === 'VF') return 0;
  return clamp(value, 20, 300);
};

const numeric = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};

export class PhysiologyEngine {
  constructor(storeRef = store, patients = patientManager, history = historyManager) {
    this.store = storeRef;
    this.patients = patients;
    this.history = history;
    this.targets = {
      spo2: 98,
      bpSys: 120,
      bpDia: 78,
      etco2: 38,
      rr: 16,
      tempC: 36.8,
      temp2C: 36.6,
      heartRate: 72,
      oxygenation: 98,
    };
    this.pacingBackup = null;
    this.cprAccumulator = 0;
    this.cprClock = 0;
    this.lastAlarmEmitted = null;
    this.lastNibpResult = null;

    this.store.on('patient:selected', ({ patient }) => {
      if (patient) this.applyPatient(patient);
    });
    this.store.on('patient:baseline-reset', (patient) => {
      if (patient) {
        this.applyPatient(patient, { reason: 'baseline_reset' });
        this.store.emit('alarms:clear-request');
        this.history.add({
          type: 'PATIENT_RESET',
          category: 'patient',
          description: `Simulation state reset to baseline for ${patient.name}.`,
          details: { patientId: patient.id },
        });
      }
    });
    const initial = this.patients.active;
    if (initial) this.applyPatient(initial, { reason: 'initial_load', silent: true });
  }

  get sim() {
    return this.store.sim;
  }

  /** Apply a patient's saved baseline safely and reset transient device effects. */
  applyPatient(patient, { reason = 'selection', silent = false } = {}) {
    const baseline = deepClone(patient.baseline || {});
    const sim = this.sim;
    const rhythm = RHYTHMS.includes(baseline.rhythm) ? baseline.rhythm : 'NSR';
    const lethal = isLethalRhythm(rhythm);
    const hasPulse = lethal ? false : (baseline.pulse !== false);

    this.stopCPR({ silent: true });
    this.pacingBackup = null;
    sim.defib.pacing = {
      active: false, rate: 70, output: 0, electricalCapture: false,
      mechanicalCapture: false, threshold: sim.defib.pacing?.threshold || 55,
    };
    if (sim.defib.mode === 'pacing' || sim.defib.mode === 'sync' || sim.defib.mode === 'aed') {
      sim.defib.mode = 'monitor';
    }
    sim.defib.machineState = 'MONITORING';
    sim.defib.charged = false;
    sim.defib.chargeProgress = 0;
    sim.defib.sync = false;
    sim.defib.syncReady = false;
    sim.defib.aed = {
      phase: 'idle', progress: 0, recommendation: null, analyzing: false,
      safetyConfirmed: false, announcement: 'Attach pads to begin AED analysis.',
    };
    sim.defib.error = null;
    sim.defib.lastEvent = 'Device reset to monitor mode for patient context.';

    sim.scenario = {
      id: null, name: null, status: 'idle', elapsed: 0, stageIndex: 0,
      progressionIndex: 0, instructions: '', notes: '', outcomes: [], startedAt: null,
    };
    sim.cpr = {
      active: false, paused: false, rate: 110, depth: 5.5, compressions: 0,
      ventilations: 0, quality: 0, elapsed: 0, pauseSeconds: 0, lastCompressionAt: 0,
      metronome: true, feedback: 'CPR idle.',
    };
    sim.alarmSilenceUntil = 0;
    sim.activeAlarms = [];
    sim.overrides = {
      heartRate: false, spo2: false, rr: false, bloodPressure: false,
      temperature: false, etco2: false, rhythm: false,
    };
    sim.running = true;
    sim.simTime = 0;

    sim.sensors = { ...sim.sensors, ...(baseline.sensors || {}) };
    for (const key of SENSOR_KEYS) {
      if (typeof sim.sensors[key] !== 'boolean') sim.sensors[key] = false;
    }
    const coreMonitored = ['ecg', 'spo2', 'resp', 'capno', 'nibp', 'temp'];
    sim.monitoring = {};
    for (const key of SENSOR_KEYS) {
      sim.monitoring[key] = coreMonitored.includes(key) || Boolean(sim.sensors[key]);
    }
    sim.signal = { ecg: 1, spo2: 1, resp: 1, capno: 1, ibp: 1, cvp: 1, pa: 1, icp: 1 };

    sim.rhythm = rhythm;
    sim.heartRate = sanitizeBPM(numeric(baseline.heartRate, 72, 0, 300), rhythm);
    sim.pulse = hasPulse;
    sim.perfusion = lethal ? 0 : numeric(baseline.perfusion, 1, 0, 1.5);
    sim.oxygenation = numeric(baseline.oxygenation, 98, 0, 100);
    sim.ventilation = numeric(baseline.ventilation, 1, 0, 2);
    sim.spo2 = lethal ? Math.min(numeric(baseline.spo2, 70, 0, 100), 72) : numeric(baseline.spo2, 98, 0, 100);
    sim.rr = numeric(baseline.rr, 16, 0, 80);
    sim.etco2 = numeric(baseline.etco2, 38, 0, 100);
    sim.tempC = numeric(baseline.tempC, 36.8, 25, 43);
    sim.temp2C = numeric(baseline.temp2C, sim.tempC - 0.2, 25, 43);
    sim.bpSys = hasPulse ? numeric(baseline.bpSys, 120, 0, 300) : 0;
    sim.bpDia = hasPulse ? numeric(baseline.bpDia, 78, 0, 200) : 0;
    if (sim.bpDia > sim.bpSys) sim.bpDia = Math.max(0, sim.bpSys - 10);
    sim.map = this.calculateMap(sim.bpSys, sim.bpDia);
    sim.respiratoryPattern = baseline.respiratoryPattern || (sim.rr === 0 ? 'apnea' : 'normal');
    sim.capnoPattern = baseline.capnoPattern || (sim.rr === 0 ? 'apnea' : 'normal');
    sim.respiratoryDepth = numeric(baseline.respiratoryDepth, 1, 0, 2);
    sim.respiratoryIrregularity = numeric(baseline.respiratoryIrregularity, 0, 0, 1);
    sim.bis = numeric(baseline.bis, 47, 0, 100);
    sim.pressures = deepClone(baseline.pressures || {
      ibp: { sys: sim.bpSys, dia: sim.bpDia, map: sim.map },
      cvp: { mean: 6 },
      pa: { sys: 25, dia: 10, mean: 15 },
      icp: { mean: 11 },
    });
    sim.pressures.ibp = {
      sys: numeric(baseline.pressures?.ibp?.sys, sim.bpSys, 0, 300),
      dia: numeric(baseline.pressures?.ibp?.dia, sim.bpDia, 0, 200),
      map: numeric(baseline.pressures?.ibp?.map, sim.map, 0, 250),
    };
    sim.pressures.cvp = { mean: numeric(baseline.pressures?.cvp?.mean, 6, -5, 50) };
    sim.pressures.pa = {
      sys: numeric(baseline.pressures?.pa?.sys, 25, 0, 100),
      dia: numeric(baseline.pressures?.pa?.dia, 10, 0, 60),
      mean: numeric(baseline.pressures?.pa?.mean, 15, 0, 80),
    };
    sim.pressures.icp = { mean: numeric(baseline.pressures?.icp?.mean, 11, 0, 80) };

    sim.ecg.leadOff = !sim.sensors.ecg;
    sim.ecg.artifact = 0.02;
    sim.ecg.noise = 0.025;
    sim.ecg.baselineWander = 0.08;
    sim.nibp.measuring = false;
    sim.nibp.progress = 0;
    sim.nibp.cuffError = !sim.sensors.nibp || !hasPulse;
    sim.nibp.failed = !hasPulse;
    sim.nibp.lastSystolic = hasPulse ? sim.bpSys : null;
    sim.nibp.lastDiastolic = hasPulse ? sim.bpDia : null;
    sim.nibp.lastMap = hasPulse ? sim.map : null;
    sim.nibp.lastTime = hasPulse ? Date.now() : null;
    sim.nibp.countdown = this.store.settings.nibpInterval || 0;
    this.targets = {
      spo2: sim.spo2,
      bpSys: sim.bpSys,
      bpDia: sim.bpDia,
      etco2: sim.etco2,
      rr: sim.rr,
      tempC: sim.tempC,
      temp2C: sim.temp2C,
      heartRate: sim.heartRate,
      oxygenation: sim.oxygenation,
    };

    this.store.state.ui.activeModal = null;
    this.store.emit('patient:context-applied', { patient, reason, resetSimulation: true });
    this.store.emit('physiology:patient-applied', patient);
    if (!silent && reason === 'selection') {
      this.history.add({
        type: 'PATIENT_SELECTED',
        category: 'patient',
        description: `Patient ${patient.name} (${patient.id}) selected. Monitoring context reset safely.`,
        details: { bed: patient.bed, room: patient.room, rhythm, heartRate: sim.heartRate },
      });
    }
  }

  calculateMap(sys, dia) {
    const s = Math.max(0, Number(sys) || 0);
    const d = Math.max(0, Number(dia) || 0);
    if (s <= 0 && d <= 0) return 0;
    return Math.round(d + (s - d) / 3);
  }

  update(dtReal) {
    if (!this.store.state.ui.waveformFrozen && this.sim.running) {
      const dt = Math.max(0, Math.min(0.25, dtReal)) * (this.store.settings.simulationSpeed || 1);
      this.sim.simTime += dt;
      this.updateCPR(dt);
      this.updatePacing();
      this.updateNIBP(dt);
      this.updateScenario(dt);
      this.updatePhysiology(dt);
      this.store.emit('sim:tick', dt);
    }
  }

  updatePhysiology(dt) {
    const sim = this.sim;
    const effective = this.getEffectiveCirculation();
    const lethal = isLethalRhythm(sim.rhythm);

    sim.heartRate = sanitizeBPM(sim.heartRate, sim.rhythm);
    if (sim.defib.pacing.active) {
      sim.heartRate = sanitizeBPM(sim.defib.pacing.rate, 'PACED');
    }
    if (sim.rhythm === 'VF' || sim.rhythm === 'ASYSTOLE') {
      sim.pulse = false;
      sim.perfusion = 0;
    }
    if (!sim.pulse && !lethal && sim.defib.pacing.active && sim.defib.pacing.mechanicalCapture) {
      // Mechanical capture is reflected through effective circulation without
      // mutating the native rhythm state.
    }

    let bpSysTarget = sim.pulse ? this.targets.bpSys : 0;
    let bpDiaTarget = sim.pulse ? this.targets.bpDia : 0;
    let spo2Target = clamp(this.targets.spo2, 0, 100);
    let etco2Target = this.targets.etco2;
    let perfusionTarget = sim.perfusion;

    if (!sim.pulse) {
      if (effective.source === 'pacing') {
        bpSysTarget = Math.max(96, this.targets.bpSys);
        bpDiaTarget = Math.max(58, this.targets.bpDia);
        perfusionTarget = Math.max(0.72, sim.perfusion);
        spo2Target = Math.max(88, Math.min(spo2Target, 96));
      } else if (effective.source === 'cpr') {
        const q = sim.cpr.quality / 100;
        bpSysTarget = 56 + q * 42;
        bpDiaTarget = 28 + q * 24;
        perfusionTarget = 0.22 + q * 0.23;
        etco2Target = Math.max(etco2Target, 9 + q * 18);
        spo2Target = Math.max(spo2Target, 65);
      } else {
        bpSysTarget = 0;
        bpDiaTarget = 0;
        perfusionTarget = 0;
        if (sim.rr <= 0 || lethal) etco2Target = Math.min(etco2Target, lethal ? 8 : 12);
      }
    } else if (sim.defib.pacing.active && sim.defib.pacing.mechanicalCapture) {
      bpSysTarget = Math.max(100, this.targets.bpSys);
      bpDiaTarget = Math.max(60, this.targets.bpDia);
      perfusionTarget = Math.max(0.8, sim.perfusion);
    }

    sim.bpSys = smooth(sim.bpSys, bpSysTarget, 0.7, dt);
    sim.bpDia = smooth(sim.bpDia, bpDiaTarget, 0.7, dt);
    if (sim.bpSys < 1) sim.bpSys = 0;
    if (sim.bpDia < 1) sim.bpDia = 0;
    if (sim.bpDia > sim.bpSys) sim.bpDia = sim.bpSys;
    sim.map = this.calculateMap(sim.bpSys, sim.bpDia);
    sim.perfusion = smooth(sim.perfusion, perfusionTarget, 1.2, dt);

    if (effective.hasPulse) {
      sim.spo2 = smooth(sim.spo2, spo2Target, 2.2, dt);
    } else {
      sim.spo2 = smooth(sim.spo2, Math.min(spo2Target, 65), 3.5, dt);
    }
    sim.etco2 = smooth(sim.etco2, Math.max(0, etco2Target), 1.7, dt);
    sim.tempC = smooth(sim.tempC, this.targets.tempC, 22, dt);
    sim.temp2C = smooth(sim.temp2C, this.targets.temp2C, 25, dt);
    sim.rr = smooth(sim.rr, this.targets.rr, 0.9, dt);
    if (sim.rr < 0.2) sim.rr = 0;
    sim.oxygenation = smooth(sim.oxygenation, this.targets.oxygenation, 2, dt);
    sim.pr = effective.hasPulse && sim.sensors.spo2 ? sim.heartRate : 0;

    if (sim.sensors.ibp && effective.hasPulse) {
      const targetIpb = { sys: sim.bpSys, dia: sim.bpDia, map: sim.map };
      sim.pressures.ibp.sys = smooth(sim.pressures.ibp.sys, targetIpb.sys, 0.5, dt);
      sim.pressures.ibp.dia = smooth(sim.pressures.ibp.dia, targetIpb.dia, 0.5, dt);
      sim.pressures.ibp.map = smooth(sim.pressures.ibp.map, targetIpb.map, 0.5, dt);
    }
  }

  getEffectiveCirculation() {
    const sim = this.sim;
    if (sim.defib.pacing.active && sim.defib.pacing.mechanicalCapture) {
      return { hasPulse: true, source: 'pacing', quality: 1 };
    }
    if (sim.pulse) return { hasPulse: true, source: 'native', quality: sim.perfusion || 1 };
    if (sim.cpr.active && !sim.cpr.paused && sim.cpr.quality > 0) {
      return { hasPulse: true, source: 'cpr', quality: sim.cpr.quality / 100 };
    }
    return { hasPulse: false, source: 'none', quality: 0 };
  }

  hasPerfusingPulse() {
    return this.getEffectiveCirculation().hasPulse;
  }

  updateNIBP(dt) {
    const sim = this.sim;
    const nibp = sim.nibp;
    const interval = this.store.settings.nibpInterval;
    if (!sim.sensors.nibp) {
      nibp.measuring = false;
      nibp.progress = 0;
      nibp.cuffError = true;
      nibp.countdown = 0;
      return;
    }
    if (nibp.cuffError && !nibp.failed) nibp.cuffError = false;

    if (nibp.measuring) {
      nibp.progress = clamp(nibp.progress + dt / 8, 0, 1);
      if (nibp.progress >= 1) {
        nibp.measuring = false;
        nibp.progress = 0;
        const effective = this.getEffectiveCirculation();
        if (!effective.hasPulse) {
          nibp.failed = true;
          nibp.cuffError = false;
          nibp.lastSystolic = null;
          nibp.lastDiastolic = null;
          nibp.lastMap = null;
          nibp.lastTime = Date.now();
          this.lastNibpResult = { ok: false, reason: 'No pulsatile flow detected. NIBP reading unavailable.' };
          this.store.emit('nibp:failed', this.lastNibpResult);
          this.history.add({
            type: 'NIBP_FAILED',
            category: 'measurement',
            severity: 'warning',
            description: 'Automatic NIBP measurement failed: no pulsatile flow detected.',
            details: { attempt: 'simulated oscillometric' },
          });
        } else {
          const sys = Math.round(sim.bpSys + (Math.random() - 0.5) * 3);
          const dia = Math.round(sim.bpDia + (Math.random() - 0.5) * 3);
          nibp.lastSystolic = clamp(sys, 0, 300);
          nibp.lastDiastolic = clamp(Math.min(dia, sys - 4), 0, 200);
          nibp.lastMap = this.calculateMap(nibp.lastSystolic, nibp.lastDiastolic);
          nibp.lastTime = Date.now();
          nibp.failed = false;
          nibp.cuffError = false;
          this.lastNibpResult = {
            ok: true,
            sys: nibp.lastSystolic,
            dia: nibp.lastDiastolic,
            map: nibp.lastMap,
          };
          this.store.emit('nibp:complete', this.lastNibpResult);
          this.history.add({
            type: 'NIBP_MEASUREMENT',
            category: 'measurement',
            description: `NIBP measured: ${nibp.lastSystolic}/${nibp.lastDiastolic} mmHg (MAP ${nibp.lastMap}).`,
            details: { systolic: nibp.lastSystolic, diastolic: nibp.lastDiastolic, map: nibp.lastMap },
          });
        }
        nibp.countdown = interval > 0 ? interval : 0;
      }
    } else if (interval > 0) {
      nibp.countdown = Math.max(0, nibp.countdown - dt);
      if (nibp.countdown <= 0) this.requestNIBP({ automatic: true });
    } else {
      nibp.countdown = 0;
    }
  }

  requestNIBP({ automatic = false } = {}) {
    const sim = this.sim;
    if (!sim.sensors.nibp) {
      return { ok: false, reason: 'NIBP cuff is disconnected.' };
    }
    if (sim.nibp.measuring) {
      return { ok: false, reason: 'A measurement is already in progress.' };
    }
    sim.nibp.measuring = true;
    sim.nibp.progress = 0;
    sim.nibp.cuffError = false;
    this.store.emit('nibp:started', { automatic });
    this.history.add({
      type: automatic ? 'NIBP_AUTO_START' : 'NIBP_MANUAL_START',
      category: 'measurement',
      description: automatic ? 'Automatic intermittent NIBP measurement started.' : 'Manual NIBP measurement started.',
      details: { interval: this.store.settings.nibpInterval },
    });
    return { ok: true };
  }

  updatePacing() {
    const pacing = this.sim.defib.pacing;
    if (!pacing.active) return;
    pacing.electricalCapture = pacing.output >= pacing.threshold;
    pacing.mechanicalCapture = pacing.electricalCapture && pacing.output >= pacing.threshold + 8
      && pacing.rate >= 20;
    if (pacing.mechanicalCapture) {
      this.sim.pulse = true;
      this.sim.perfusion = Math.max(this.sim.perfusion, 0.78);
      this.sim.heartRate = pacing.rate;
    }
  }

  setPacing({ active, rate, output } = {}) {
    const sim = this.sim;
    const pacing = sim.defib.pacing;
    if (typeof rate === 'number') pacing.rate = clamp(rate, 20, 180);
    if (typeof output === 'number') pacing.output = clamp(output, 0, 200);

    if (active === true && !pacing.active) {
      this.pacingBackup = {
        rhythm: sim.rhythm,
        pulse: sim.pulse,
        heartRate: sim.heartRate,
        perfusion: sim.perfusion,
        bpSys: this.targets.bpSys,
        bpDia: this.targets.bpDia,
        spo2: this.targets.spo2,
      };
      pacing.active = true;
      sim.rhythm = 'PACED';
      sim.capnoPattern = sim.capnoPattern === 'apnea' ? 'apnea' : sim.capnoPattern;
    }
    if (active === false && pacing.active) {
      pacing.active = false;
      pacing.electricalCapture = false;
      pacing.mechanicalCapture = false;
      const backup = this.pacingBackup;
      this.pacingBackup = null;
      if (backup) {
        sim.rhythm = backup.rhythm;
        sim.pulse = backup.pulse;
        sim.heartRate = backup.heartRate;
        sim.perfusion = backup.perfusion;
        this.targets.bpSys = backup.bpSys;
        this.targets.bpDia = backup.bpDia;
        this.targets.spo2 = backup.spo2;
      }
    }
    pacing.electricalCapture = pacing.active && pacing.output >= pacing.threshold;
    pacing.mechanicalCapture = pacing.active && pacing.electricalCapture && pacing.output >= pacing.threshold + 8;
    if (pacing.mechanicalCapture) {
      sim.pulse = true;
      this.targets.bpSys = Math.max(100, this.targets.bpSys);
      this.targets.bpDia = Math.max(60, this.targets.bpDia);
      this.targets.spo2 = Math.max(92, this.targets.spo2);
      sim.oxygenation = Math.max(94, sim.oxygenation);
    } else if (pacing.active) {
      const backup = this.pacingBackup;
      if (backup) sim.pulse = backup.pulse;
      if (sim.rhythm === 'VF' || sim.rhythm === 'ASYSTOLE') sim.pulse = false;
    }
    this.store.emit('pacing:changed', { ...pacing });
    return { ...pacing };
  }

  setRhythm(rhythm, { fromScenario = false, record = true } = {}) {
    if (!RHYTHMS.includes(rhythm)) return false;
    if (this.sim.defib.pacing.active) this.setPacing({ active: false });
    const previous = this.sim.rhythm;
    if (previous === rhythm) return true;
    const sim = this.sim;
    sim.rhythm = rhythm;
    if (rhythm === 'VF' || rhythm === 'ASYSTOLE') {
      sim.pulse = false;
      sim.perfusion = 0;
      sim.heartRate = 0;
      sim.bpSys = 0;
      sim.bpDia = 0;
      sim.map = 0;
      this.targets.bpSys = 0;
      this.targets.bpDia = 0;
      this.targets.heartRate = 0;
      sim.nibp.lastSystolic = null;
      sim.nibp.lastDiastolic = null;
      sim.nibp.lastMap = null;
      if (rhythm === 'ASYSTOLE') {
        sim.actionRhythm = '';
      }
    } else {
      if (sim.heartRate <= 0) sim.heartRate = rhythm === 'SINUS_BRADY' ? 46 : 72;
      if (rhythm === 'SINUS_BRADY') {
        sim.heartRate = clamp(sim.heartRate, 30, 59);
      } else if (rhythm === 'SINUS_TACHY') {
        sim.heartRate = clamp(sim.heartRate, 101, 160);
      } else if (rhythm === 'SVT') {
        sim.heartRate = clamp(sim.heartRate, 150, 240);
      } else if (rhythm === 'AFLUTTER') {
        sim.heartRate = clamp(sim.heartRate, 120, 180);
      } else if (rhythm === 'VT') {
        sim.heartRate = clamp(sim.heartRate, 110, 250);
      } else if (rhythm === 'PACED') {
        sim.heartRate = sim.defib.pacing.rate || 70;
        sim.pulse = true;
      }
      sim.targets = this.targets;
      this.targets.heartRate = sim.heartRate;
      if (sim.pulse) {
        this.targets.bpSys = Math.max(sim.bpSys, rhythm === 'VT' ? 100 : 0);
        this.targets.bpDia = Math.max(sim.bpDia, rhythm === 'VT' ? 58 : 0);
      }
    }
    sim.overrides.rhythm = !fromScenario;
    this.store.emit('rhythm:changed', { previous, rhythm, fromScenario });
    if (record) {
      this.history.add({
        type: 'RHYTHM_CHANGE',
        category: 'rhythm',
        severity: isLethalRhythm(rhythm) ? 'critical' : 'info',
        description: `Simulated rhythm changed from ${previous} to ${rhythm}.`,
        details: { heartRate: sim.heartRate, pulse: sim.pulse },
      });
    }
    return true;
  }

  classifyRhythm() {
    const rhythm = this.sim.rhythm;
    const hasPulse = this.getEffectiveCirculation().hasPulse;
    if (rhythm === 'VF') {
      return {
        code: 'VF', shockable: !hasPulse || !this.sim.pulse,
        label: 'Ventricular Fibrillation', requiresPulseAssessment: false,
      };
    }
    if (rhythm === 'ASYSTOLE') {
      return { code: 'ASYSTOLE', shockable: false, label: 'Asystole', requiresPulseAssessment: false };
    }
    if (!this.sim.pulse) {
      return {
        code: 'PEA', shockable: false,
        label: rhythm === 'VT' ? 'Pulseless Ventricular Tachycardia' : 'Pulseless Electrical Activity',
        requiresPulseAssessment: false,
      };
    }
    if (rhythm === 'VT') {
      return {
        code: 'PERFUSING_VT', shockable: false, label: 'Ventricular Tachycardia with pulse',
        requiresPulseAssessment: true,
      };
    }
    return {
      code: 'PERFUSING', shockable: false, label: 'Perfusing rhythm',
      requiresPulseAssessment: true,
    };
  }

  getAEDRecommendation() {
    const classification = this.classifyRhythm();
    return {
      ...classification,
      shockAdvise: classification.code === 'VF'
        || (classification.code === 'PEA' && this.sim.rhythm === 'VT'),
      noShockAdvise: !(classification.code === 'VF'
        || (classification.code === 'PEA' && this.sim.rhythm === 'VT')),
    };
  }

  applyShock({ synchronized = false, mode = 'manual' } = {}) {
    const sim = this.sim;
    const wasPerfusing = this.hasPerfusingPulse() && sim.pulse;
    const beforeRhythm = sim.rhythm;
    let converted = false;
    let message = 'No rhythm change.';
    if (sim.rhythm === 'VF') {
      sim.rhythm = 'SINUS_BRADY';
      sim.heartRate = 36;
      sim.pulse = false;
      sim.perfusion = 0;
      sim.bpSys = 0;
      sim.bpDia = 0;
      sim.map = 0;
      this.targets.heartRate = 36;
      this.targets.bpSys = 0;
      this.targets.bpDia = 0;
      converted = true;
      message = 'Simulated shock organised the ECG to a slow perfusing-compatible rhythm, but mechanical circulation has not returned. Continue assessment.';
    } else if (sim.rhythm === 'VT') {
      if (wasPerfusing || synchronized) {
        sim.rhythm = 'NSR';
        sim.heartRate = 82;
        sim.pulse = true;
        sim.perfusion = Math.max(0.85, sim.perfusion);
        sim.bpSys = Math.max(104, sim.bpSys);
        sim.bpDia = Math.max(62, sim.bpDia);
        sim.map = this.calculateMap(sim.bpSys, sim.bpDia);
        this.targets.heartRate = 82;
        this.targets.bpSys = sim.bpSys;
        this.targets.bpDia = sim.bpDia;
        converted = true;
        message = 'Simulated synchronized energy converted the perfusing ventricular rhythm.';
      } else {
        sim.rhythm = 'NSR';
        sim.heartRate = 52;
        sim.pulse = false;
        sim.perfusion = 0;
        sim.bpSys = 0;
        sim.bpDia = 0;
        sim.map = 0;
        converted = true;
        message = 'Simulated shock organised the ECG, but no pulse is present. This remains a pulseless state until a separate recovery event.';
      }
    } else {
      message = 'Simulated energy delivered. No conversion expected in this rhythm model.';
    }
    sim.defib.shockCount += 1;
    sim.defib.lastShockAt = Date.now();
    if (sim.pulse && sim.sensors.nibp) {
      sim.nibp.lastSystolic = Math.round(sim.bpSys);
      sim.nibp.lastDiastolic = Math.round(sim.bpDia);
      sim.nibp.lastMap = this.calculateMap(sim.bpSys, sim.bpDia);
      sim.nibp.lastTime = Date.now();
      sim.nibp.failed = false;
    } else {
      sim.nibp.lastSystolic = null;
      sim.nibp.lastDiastolic = null;
      sim.nibp.lastMap = null;
      sim.nibp.lastTime = null;
    }
    sim.overrides.rhythm = false;
    this.store.emit('defib:shock-applied', { mode, synchronized, converted, message, beforeRhythm });
    this.history.add({
      type: synchronized ? 'SYNC_CARDIOVERSION' : 'DEFIBRILLATION_SHOCK',
      category: 'defibrillator',
      severity: 'critical',
      description: `${synchronized ? 'Synchronized cardioversion' : 'Defibrillation'} simulation delivered in ${mode} mode. ${message}`,
      details: { beforeRhythm, afterRhythm: sim.rhythm, pulse: sim.pulse, message },
    });
    return {
      ok: true,
      converted,
      pulse: sim.pulse,
      rosc: false,
      message,
    };
  }

  applyRosc({ trigger = 'instructor' } = {}) {
    const sim = this.sim;
    if (sim.rhythm === 'VF' || sim.rhythm === 'ASYSTOLE') {
      return {
        ok: false,
        reason: 'ROSC requires an organised electrical rhythm. Convert the simulated rhythm first.',
      };
    }
    sim.pulse = true;
    sim.perfusion = Math.max(0.8, sim.perfusion);
    sim.oxygenation = Math.max(94, sim.oxygenation);
    sim.spo2 = Math.max(92, sim.spo2);
    sim.heartRate = sim.heartRate > 0 ? sim.heartRate : 88;
    this.targets.heartRate = sim.heartRate;
    this.targets.spo2 = sim.spo2;
    this.targets.oxygenation = sim.oxygenation;
    this.targets.bpSys = Math.max(100, this.targets.bpSys || 100);
    this.targets.bpDia = Math.max(60, this.targets.bpDia || 60);
    sim.bpSys = this.targets.bpSys;
    sim.bpDia = this.targets.bpDia;
    sim.map = this.calculateMap(sim.bpSys, sim.bpDia);
    sim.rr = Math.max(12, sim.rr || 12);
    sim.etco2 = Math.max(30, sim.etco2);
    this.targets.rr = sim.rr;
    this.targets.etco2 = sim.etco2;
    sim.capnoPattern = sim.capnoPattern === 'apnea' ? 'normal' : sim.capnoPattern;
    sim.respiratoryPattern = sim.respiratoryPattern === 'apnea' ? 'normal' : sim.respiratoryPattern;
    sim.nibp.lastSystolic = sim.bpSys;
    sim.nibp.lastDiastolic = sim.bpDia;
    sim.nibp.lastMap = sim.map;
    sim.nibp.lastTime = Date.now();
    sim.nibp.failed = false;
    this.history.add({
      type: 'ROSC_EVENT',
      category: 'recovery',
      severity: 'info',
      description: `Configured ROSC event (${trigger}): organised rhythm with restored simulated perfusion.`,
      details: { rhythm: sim.rhythm, heartRate: sim.heartRate, bp: `${Math.round(sim.bpSys)}/${Math.round(sim.bpDia)}` },
    });
    this.store.emit('rosc:applied', { trigger });
    return { ok: true, message: 'Configured ROSC transition applied.' };
  }

  startCPR() {
    const cpr = this.sim.cpr;
    if (cpr.active) {
      cpr.paused = false;
      return { ok: true, reason: 'CPR resumed.' };
    }
    cpr.active = true;
    cpr.paused = false;
    cpr.elapsed = 0;
    cpr.pauseSeconds = 0;
    cpr.compressions = 0;
    cpr.ventilations = 0;
    cpr.lastCompressionAt = this.sim.simTime;
    this.cprAccumulator = 0;
    this.updateCPRQuality();
    this.history.add({
      type: 'CPR_STARTED',
      category: 'cpr',
      severity: 'critical',
      description: 'Simulated CPR started.',
      details: { rate: cpr.rate, depth: cpr.depth },
    });
    this.store.emit('cpr:started');
    return { ok: true };
  }

  stopCPR({ silent = false } = {}) {
    const cpr = this.sim.cpr;
    const wasActive = cpr.active;
    cpr.active = false;
    cpr.paused = false;
    cpr.quality = 0;
    cpr.feedback = 'CPR stopped.';
    this.cprAccumulator = 0;
    if (wasActive && !silent) {
      this.history.add({
        type: 'CPR_STOPPED',
        category: 'cpr',
        severity: 'info',
        description: 'Simulated CPR stopped.',
        details: { compressions: cpr.compressions, ventilations: cpr.ventilations, elapsed: Math.round(cpr.elapsed) },
      });
      this.store.emit('cpr:stopped');
    }
  }

  setCPRPaused(paused) {
    const cpr = this.sim.cpr;
    if (!cpr.active) return { ok: false, reason: 'CPR is not active.' };
    cpr.paused = Boolean(paused);
    cpr.feedback = cpr.paused ? 'Compressions paused.' : 'Compressions resumed.';
    this.history.add({
      type: cpr.paused ? 'CPR_PAUSED' : 'CPR_RESUMED',
      category: 'cpr',
      description: cpr.paused ? 'Simulated compressions paused.' : 'Simulated compressions resumed.',
      details: { pauseSeconds: Math.round(cpr.pauseSeconds) },
    });
    return { ok: true };
  }

  setCPRParameters({ rate, depth, metronome } = {}) {
    const cpr = this.sim.cpr;
    if (Number.isFinite(Number(rate))) cpr.rate = clamp(Number(rate), 60, 160);
    if (Number.isFinite(Number(depth))) cpr.depth = clamp(Number(depth), 1, 8);
    if (typeof metronome === 'boolean') cpr.metronome = metronome;
    this.updateCPRQuality();
    return { ...cpr };
  }

  updateCPRQuality() {
    const cpr = this.sim.cpr;
    const rateScore = clamp(1 - Math.abs(cpr.rate - 110) / 45, 0, 1);
    const depthScore = clamp(1 - Math.abs(cpr.depth - 5.5) / 2.5, 0, 1);
    cpr.quality = Math.round((rateScore * 0.55 + depthScore * 0.45) * 100);
    if (cpr.quality >= 85) cpr.feedback = 'Simulated quality: good. Rate and depth near teaching target.';
    else if (cpr.quality >= 60) cpr.feedback = 'Simulated quality: fair. Adjust rate or depth.';
    else cpr.feedback = 'Simulated quality: poor. Review compression rate and depth.';
  }

  updateCPR(dt) {
    const cpr = this.sim.cpr;
    if (!cpr.active) return;
    cpr.elapsed += dt;
    this.updateCPRQuality();
    if (cpr.paused) {
      cpr.pauseSeconds += dt;
      cpr.feedback = 'Compressions paused. Minimise interruptions in the simulation.';
      return;
    }
    this.cprClock += dt;
    const interval = 60 / cpr.rate;
    this.cprAccumulator += dt;
    let emitted = 0;
    while (this.cprAccumulator >= interval && emitted < 4) {
      this.cprAccumulator -= interval;
      cpr.compressions += 1;
      cpr.lastCompressionAt = this.sim.simTime;
      emitted += 1;
      this.store.emit('cpr:compression', { count: cpr.compressions, quality: cpr.quality });
    }
  }

  recordManualCompression() {
    const cpr = this.sim.cpr;
    if (!cpr.active) return { ok: false, reason: 'Start CPR before recording compressions.' };
    cpr.compressions += 1;
    cpr.lastCompressionAt = this.sim.simTime;
    this.store.emit('cpr:compression', { count: cpr.compressions, quality: cpr.quality, manual: true });
    return { ok: true, count: cpr.compressions };
  }

  setRespiratoryPattern(pattern) {
    const allowed = ['normal', 'rapid', 'shallow', 'deep', 'apnea', 'agonal', 'irregular'];
    if (!allowed.includes(pattern)) return { ok: false, reason: 'Unknown respiratory pattern.' };
    this.sim.respiratoryPattern = pattern;
    if (pattern === 'apnea') {
      this.targets.rr = 0;
      this.sim.rr = 0;
      this.targets.etco2 = 0;
      this.sim.capnoPattern = 'apnea';
    }
    this.store.emit('instructor:changed', { key: 'respiratoryPattern', value: pattern });
    return { ok: true };
  }

  setCapnoPattern(pattern) {
    const allowed = ['normal', 'hypoventilation', 'hyperventilation', 'apnea', 'rebreathing', 'obstruction', 'disconnected'];
    if (!allowed.includes(pattern)) return { ok: false, reason: 'Unknown capnography pattern.' };
    this.sim.capnoPattern = pattern;
    if (pattern === 'apnea') {
      this.targets.rr = 0;
      this.sim.rr = 0;
      this.targets.etco2 = 0;
      this.sim.respiratoryPattern = 'apnea';
    } else if (pattern === 'hypoventilation' && !this.sim.overrides.rr) {
      this.targets.rr = 8;
      this.sim.rr = 8;
      this.targets.etco2 = 55;
    } else if (pattern === 'hyperventilation' && !this.sim.overrides.rr) {
      this.targets.rr = 28;
      this.sim.rr = 28;
      this.targets.etco2 = 27;
    }
    this.store.emit('instructor:changed', { key: 'capnoPattern', value: pattern });
    return { ok: true };
  }

  recordVentilation() {
    const cpr = this.sim.cpr;
    if (!cpr.active) return { ok: false, reason: 'Start CPR before recording simulated ventilations.' };
    cpr.ventilations += 1;
    this.store.emit('cpr:ventilation', { count: cpr.ventilations });
    if (cpr.ventilations % 2 === 0) {
      this.history.add({
        type: 'CPR_VENTILATION',
        category: 'cpr',
        description: 'Two simulated ventilations recorded.',
        details: { totalVentilations: cpr.ventilations },
      });
    }
    return { ok: true, count: cpr.ventilations };
  }

  setRunning(running) {
    this.sim.running = Boolean(running);
    this.store.emit('sim:running-changed', this.sim.running);
  }

  applyScenarioInitial(initial = {}) {
    const sim = this.sim;
    const lethal = isLethalRhythm(initial.rhythm);
    const patch = scenarioPatchFromInitial(initial);
    if (patch.rhythm) sim.rhythm = patch.rhythm;
    sim.heartRate = sanitizeBPM(numeric(patch.heartRate, sim.heartRate, 0, 300), sim.rhythm);
    sim.pulse = lethal ? false : patch.pulse !== false;
    sim.perfusion = lethal ? 0 : numeric(patch.perfusion, sim.perfusion, 0, 1.5);
    sim.oxygenation = numeric(patch.oxygenation, sim.oxygenation, 0, 100);
    sim.ventilation = numeric(patch.ventilation, sim.ventilation, 0, 2);
    sim.spo2 = lethal ? Math.min(numeric(patch.spo2, 65, 0, 100), 72) : numeric(patch.spo2, sim.spo2, 0, 100);
    sim.rr = numeric(patch.rr, sim.rr, 0, 80);
    sim.etco2 = numeric(patch.etco2, sim.etco2, 0, 100);
    sim.bpSys = sim.pulse ? numeric(patch.bpSys, sim.bpSys, 0, 300) : 0;
    sim.bpDia = sim.pulse ? numeric(patch.bpDia, sim.bpDia, 0, 200) : 0;
    if (sim.bpDia > sim.bpSys) sim.bpDia = Math.max(0, sim.bpSys - 8);
    sim.map = this.calculateMap(sim.bpSys, sim.bpDia);
    sim.tempC = numeric(patch.tempC, sim.tempC, 25, 43);
    sim.temp2C = numeric(patch.temp2C, sim.temp2C, 25, 43);
    sim.respiratoryPattern = patch.respiratoryPattern || sim.respiratoryPattern;
    sim.capnoPattern = patch.capnoPattern || sim.capnoPattern;
    sim.respiratoryDepth = numeric(patch.respiratoryDepth, sim.respiratoryDepth, 0, 2);
    sim.respiratoryIrregularity = numeric(patch.respiratoryIrregularity, sim.respiratoryIrregularity, 0, 1);
    sim.bis = numeric(patch.bis, sim.bis, 0, 100);
    if (patch.sensors) sim.sensors = { ...sim.sensors, ...patch.sensors };
    if (patch.pressures) sim.pressures = deepClone(patch.pressures);
    if (sim.sensors.ibp && sim.pulse) {
      sim.pressures.ibp = { sys: sim.bpSys, dia: sim.bpDia, map: sim.map };
    }
    sim.overrides = {
      heartRate: false, spo2: false, rr: false, bloodPressure: false,
      temperature: false, etco2: false, rhythm: false,
    };
    this.targets = {
      spo2: sim.spo2,
      bpSys: sim.bpSys,
      bpDia: sim.bpDia,
      etco2: sim.etco2,
      rr: sim.rr,
      tempC: sim.tempC,
      temp2C: sim.temp2C,
      heartRate: sim.heartRate,
      oxygenation: sim.oxygenation,
    };
    sim.nibp.lastSystolic = sim.pulse ? sim.bpSys : null;
    sim.nibp.lastDiastolic = sim.pulse ? sim.bpDia : null;
    sim.nibp.lastMap = sim.pulse ? sim.map : null;
    sim.nibp.lastTime = sim.pulse ? Date.now() : null;
    sim.nibp.countdown = this.store.settings.nibpInterval || 0;
    sim.nibp.failed = !sim.pulse;
    sim.nibp.cuffError = !sim.sensors.nibp;
    sim.nibp.measuring = false;
    this.store.emit('physiology:scenario-initial-applied');
  }

  applyScenarioPatch(patch = {}) {
    const sim = this.sim;
    if (patch.recovery) {
      this.applyRosc({ trigger: 'scenario progression' });
      return;
    }
    if (patch.rhythm) sim.rhythm = patch.rhythm;
    const lethal = isLethalRhythm(sim.rhythm);
    if (patch.pulse !== undefined) sim.pulse = lethal ? false : Boolean(patch.pulse);
    if (patch.perfusion !== undefined) sim.perfusion = clamp(patch.perfusion, 0, 1.5);
    if (patch.oxygenation !== undefined) sim.oxygenation = clamp(patch.oxygenation, 0, 100);
    if (patch.ventilation !== undefined) sim.ventilation = clamp(patch.ventilation, 0, 2);
    if (patch.heartRate !== undefined) sim.heartRate = sanitizeBPM(patch.heartRate, sim.rhythm);
    if (patch.spo2 !== undefined) this.targets.spo2 = clamp(patch.spo2, 0, 100);
    if (patch.oxygenation !== undefined) this.targets.oxygenation = clamp(patch.oxygenation, 0, 100);
    if (patch.rr !== undefined) {
      sim.rr = clamp(patch.rr, 0, 80);
      this.targets.rr = sim.rr;
    }
    if (patch.etco2 !== undefined) this.targets.etco2 = clamp(patch.etco2, 0, 100);
    if (patch.bpSys !== undefined) this.targets.bpSys = clamp(patch.bpSys, 0, 300);
    if (patch.bpDia !== undefined) this.targets.bpDia = clamp(patch.bpDia, 0, 200);
    if (patch.tempC !== undefined) this.targets.tempC = clamp(patch.tempC, 25, 43);
    if (patch.temp2C !== undefined) this.targets.temp2C = clamp(patch.temp2C, 25, 43);
    if (patch.respiratoryPattern) sim.respiratoryPattern = patch.respiratoryPattern;
    if (patch.capnoPattern) sim.capnoPattern = patch.capnoPattern;
    if (patch.respiratoryDepth !== undefined) sim.respiratoryDepth = clamp(patch.respiratoryDepth, 0, 2);
    if (patch.respiratoryIrregularity !== undefined) sim.respiratoryIrregularity = clamp(patch.respiratoryIrregularity, 0, 1);
    if (patch.heartRate !== undefined) this.targets.heartRate = sim.heartRate;
    const lethalNow = isLethalRhythm(sim.rhythm);
    if (lethalNow) {
      sim.pulse = false;
      sim.perfusion = 0;
      sim.bpSys = 0;
      sim.bpDia = 0;
      sim.map = 0;
      sim.heartRate = 0;
      sim.nibp.lastSystolic = null;
      sim.nibp.lastDiastolic = null;
      sim.nibp.lastMap = null;
      sim.nibp.lastTime = null;
      this.targets.bpSys = 0;
      this.targets.bpDia = 0;
      this.targets.heartRate = 0;
    } else if (!sim.pulse) {
      sim.bpSys = 0;
      sim.bpDia = 0;
      sim.map = 0;
      sim.nibp.lastSystolic = null;
      sim.nibp.lastDiastolic = null;
      sim.nibp.lastMap = null;
      sim.nibp.lastTime = null;
    } else if (patch.bpSys !== undefined || patch.bpDia !== undefined) {
      sim.nibp.lastSystolic = Math.round(this.targets.bpSys);
      sim.nibp.lastDiastolic = Math.round(this.targets.bpDia);
      sim.nibp.lastMap = this.calculateMap(this.targets.bpSys, this.targets.bpDia);
      sim.nibp.lastTime = Date.now();
      sim.nibp.failed = false;
    }
  }

  startScenario(id) {
    const scenario = getScenarioById(id);
    if (!scenario) return { ok: false, reason: 'Unknown simulation scenario.' };
    this.setPacing({ active: false });
    this.stopCPR({ silent: true });
    this.applyScenarioInitial(scenario.initial);
    this.sim.scenario = {
      id: scenario.id,
      name: scenario.name,
      status: 'running',
      elapsed: 0,
      stageIndex: 0,
      progressionIndex: 0,
      instructions: scenario.instructions,
      notes: scenario.instructorNotes,
      outcomes: [...scenario.outcomes],
      startedAt: new Date().toISOString(),
      description: scenario.description,
      duration: scenario.duration,
    };
    this.store.emit('scenario:started', scenario);
    this.store.emit('device:reset-request', { reason: 'scenario-start' });
    this.history.add({
      type: 'SCENARIO_START',
      category: 'scenario',
      description: `Scenario started: ${scenario.name}.`,
      details: { scenarioId: scenario.id, category: scenario.category, initialRhythm: scenario.initial.rhythm },
    });
    return { ok: true, scenario };
  }

  pauseScenario() {
    if (this.sim.scenario.status !== 'running') return { ok: false, reason: 'Scenario is not running.' };
    this.sim.scenario.status = 'paused';
    this.history.add({
      type: 'SCENARIO_PAUSE',
      category: 'scenario',
      description: `Scenario paused: ${this.sim.scenario.name}.`,
      details: { elapsed: Math.round(this.sim.scenario.elapsed) },
    });
    this.store.emit('scenario:paused');
    return { ok: true };
  }

  resumeScenario() {
    if (this.sim.scenario.status !== 'paused') return { ok: false, reason: 'Scenario is not paused.' };
    this.sim.scenario.status = 'running';
    this.history.add({
      type: 'SCENARIO_RESUME',
      category: 'scenario',
      description: `Scenario resumed: ${this.sim.scenario.name}.`,
      details: { elapsed: Math.round(this.sim.scenario.elapsed) },
    });
    this.store.emit('scenario:resumed');
    return { ok: true };
  }

  resetScenario() {
    const scenario = getScenarioById(this.sim.scenario.id);
    if (!scenario) return { ok: false, reason: 'No active scenario to reset.' };
    this.stopCPR({ silent: true });
    this.setPacing({ active: false });
    this.applyScenarioInitial(scenario.initial);
    this.sim.scenario = {
      ...this.sim.scenario,
      status: 'running',
      elapsed: 0,
      stageIndex: 0,
      progressionIndex: 0,
      startedAt: new Date().toISOString(),
    };
    this.store.emit('scenario:reset', scenario);
    this.store.emit('device:reset-request', { reason: 'scenario-reset' });
    this.history.add({
      type: 'SCENARIO_RESET',
      category: 'scenario',
      description: `Scenario reset: ${scenario.name}.`,
      details: { scenarioId: scenario.id },
    });
    return { ok: true };
  }

  stopScenario() {
    if (!this.sim.scenario.id) return { ok: false, reason: 'No active scenario.' };
    this.setPacing({ active: false });
    this.stopCPR({ silent: true });
    const name = this.sim.scenario.name;
    const id = this.sim.scenario.id;
    this.sim.scenario = {
      id: null, name: null, status: 'idle', elapsed: 0, stageIndex: 0,
      progressionIndex: 0, instructions: '', notes: '', outcomes: [], startedAt: null,
    };
    this.history.add({
      type: 'SCENARIO_STOP',
      category: 'scenario',
      description: `Scenario stopped: ${name}.`,
      details: { scenarioId: id },
    });
    this.store.emit('scenario:stopped');
    return { ok: true };
  }

  updateScenario(dt) {
    const scenarioState = this.sim.scenario;
    if (!scenarioState.id || scenarioState.status !== 'running') return;
    scenarioState.elapsed += dt;
    const scenario = getScenarioById(scenarioState.id);
    if (!scenario) return;
    const progression = scenario.progression || [];
    while (
      scenarioState.progressionIndex < progression.length
      && scenarioState.elapsed >= progression[scenarioState.progressionIndex].at
    ) {
      const event = progression[scenarioState.progressionIndex];
      this.applyScenarioPatch(event.patch || event);
      this.history.add({
        type: event.recovery ? 'ROSC_EVENT' : 'SCENARIO_PROGRESSION',
        category: event.recovery ? 'recovery' : 'scenario',
        severity: event.recovery ? 'info' : 'warning',
        description: event.note || 'Scenario progression event applied.',
        details: { scenario: scenario.name, atSeconds: event.at },
      });
      this.store.emit('scenario:progression', { scenario, event });
      scenarioState.progressionIndex += 1;
    }
    if (scenario.duration && scenarioState.elapsed >= scenario.duration && scenarioState.status === 'running') {
      scenarioState.status = 'completed';
      this.history.add({
        type: 'SCENARIO_COMPLETE',
        category: 'scenario',
        description: `Scenario completed: ${scenario.name}.`,
        details: { duration: Math.round(scenarioState.elapsed) },
      });
      this.store.emit('scenario:completed', scenario);
    }
  }

  setManualOverride(key, value) {
    const sim = this.sim;
    switch (key) {
      case 'heartRate': {
        if (isLethalRhythm(sim.rhythm)) {
          return { ok: false, reason: 'Heart rate cannot be paced in asystole or VF. Change rhythm first.' };
        }
        sim.heartRate = sanitizeBPM(Number(value), sim.rhythm);
        this.targets.heartRate = sim.heartRate;
        sim.overrides.heartRate = true;
        break;
      }
      case 'spo2': {
        const spo2 = clamp(Number(value), 60, 100);
        this.targets.spo2 = spo2;
        sim.oxygenation = Math.max(sim.oxygenation, spo2);
        this.targets.oxygenation = sim.oxygenation;
        sim.overrides.spo2 = true;
        break;
      }
      case 'rr': {
        const rr = clamp(Number(value), 0, 60);
        this.targets.rr = rr;
        sim.rr = rr;
        sim.overrides.rr = true;
        if (rr === 0) {
          sim.respiratoryPattern = 'apnea';
          sim.capnoPattern = 'apnea';
          this.targets.etco2 = 0;
        } else if (!sim.overrides.etco2) {
          this.targets.etco2 = clamp(40 + (16 - rr) * 0.9, 12, 90);
          sim.capnoPattern = rr > 24 ? 'hyperventilation' : rr < 10 ? 'hypoventilation' : 'normal';
          sim.respiratoryPattern = rr > 24 ? 'rapid' : rr < 10 ? 'shallow' : 'normal';
        }
        break;
      }
      case 'bp': {
        const sys = clamp(Number(value?.sys), 0, 300);
        const dia = clamp(Number(value?.dia), 0, 200);
        if (dia > sys) return { ok: false, reason: 'Diastolic pressure cannot exceed systolic pressure.' };
        if (!sim.pulse) return { ok: false, reason: 'Blood pressure is not measurable without a palpable pulse or CPR.' };
        this.targets.bpSys = sys;
        this.targets.bpDia = dia;
        sim.bpSys = sys;
        sim.bpDia = dia;
        sim.map = this.calculateMap(sys, dia);
        sim.nibp.lastSystolic = sys;
        sim.nibp.lastDiastolic = dia;
        sim.nibp.lastMap = sim.map;
        sim.nibp.lastTime = Date.now();
        sim.nibp.failed = false;
        sim.overrides.bloodPressure = true;
        break;
      }
      case 'temperature': {
        this.targets.tempC = clamp(Number(value), 28, 43);
        sim.tempC = this.targets.tempC;
        sim.overrides.temperature = true;
        break;
      }
      case 'etco2': {
        this.targets.etco2 = clamp(Number(value), 0, 100);
        sim.etco2 = this.targets.etco2;
        sim.overrides.etco2 = true;
        break;
      }
      case 'pulse': {
        if (value && isLethalRhythm(sim.rhythm)) {
          return { ok: false, reason: 'VF and asystole cannot be assigned a palpable pulse.' };
        }
        sim.pulse = Boolean(value);
        if (!sim.pulse) {
          sim.perfusion = 0;
          this.targets.bpSys = 0;
          this.targets.bpDia = 0;
        } else if (sim.bpSys <= 0) {
          sim.bpSys = 112;
          sim.bpDia = 68;
          sim.map = this.calculateMap(112, 68);
          this.targets.bpSys = 112;
          this.targets.bpDia = 68;
          sim.perfusion = Math.max(0.7, sim.perfusion);
        }
        break;
      }
      case 'perfusion': {
        sim.perfusion = clamp(Number(value), 0, 1.5);
        break;
      }
      case 'oxygenation': {
        sim.oxygenation = clamp(Number(value), 0, 100);
        this.targets.oxygenation = sim.oxygenation;
        if (!sim.overrides.spo2) this.targets.spo2 = clamp(sim.oxygenation, 40, 100);
        break;
      }
      case 'ventilation': {
        sim.ventilation = clamp(Number(value), 0, 2);
        if (!sim.overrides.etco2 && !sim.overrides.rr) {
          this.targets.etco2 = clamp(40 + (1 - sim.ventilation) * 16, 0, 90);
        }
        break;
      }
      case 'rhythm': {
        return { ok: this.setRhythm(String(value)) };
      }
      default:
        return { ok: false, reason: `Unknown parameter ${key}.` };
    }
    this.store.emit('instructor:changed', { key, value });
    return { ok: true, value };
  }

  clearManualOverride(key = null) {
    const sim = this.sim;
    const keys = key ? [key] : Object.keys(sim.overrides);
    for (const item of keys) {
      if (item in sim.overrides) sim.overrides[item] = false;
    }
    if (key === 'heartRate' || !key) {
      const rhythm = sim.rhythm;
      if (rhythm === 'SINUS_BRADY') sim.heartRate = 48;
      else if (rhythm === 'SINUS_TACHY') sim.heartRate = 118;
      else if (rhythm === 'SVT') sim.heartRate = 170;
      else if (rhythm === 'AFLUTTER') sim.heartRate = 150;
      else if (rhythm === 'VT') sim.heartRate = 160;
      else if (rhythm === 'ASYSTOLE' || rhythm === 'VF') sim.heartRate = 0;
      else if (rhythm === 'PACED') sim.heartRate = sim.defib.pacing.rate;
      else sim.heartRate = 72;
      this.targets.heartRate = sim.heartRate;
    }
    this.store.emit('instructor:override-cleared', { key });
    return { ok: true };
  }

  setSensor(key, connected, { record = true } = {}) {
    if (!SENSOR_KEYS.includes(key)) return { ok: false, reason: 'Unknown sensor.' };
    const sim = this.sim;
    const next = Boolean(connected);
    if (sim.sensors[key] === next) return { ok: true };
    sim.sensors[key] = next;
    if (next) sim.monitoring[key] = true;
    if (key === 'ecg') sim.ecg.leadOff = !next;
    if (key === 'nibp') {
      sim.nibp.measuring = false;
      sim.nibp.progress = 0;
      sim.nibp.cuffError = !next;
      sim.nibp.countdown = next ? this.store.settings.nibpInterval : 0;
    }
    if (!next) sim.signal[key] = 0;
    else sim.signal[key] = 1;
    this.store.emit('sensors:changed', { key, connected: next });
    if (record) {
      this.history.add({
        type: next ? 'SENSOR_CONNECTED' : 'SENSOR_DISCONNECTED',
        category: 'sensor',
        severity: next ? 'info' : 'warning',
        description: `${key.toUpperCase()} sensor ${next ? 'connected' : 'disconnected'}.`,
        details: { sensor: key, connected: next },
      });
    }
    return { ok: true, connected: next };
  }

  setLeadOff(leadOff) {
    return this.setSensor('ecg', !leadOff);
  }

  setSignalQuality(key, quality) {
    if (!(key in this.sim.signal)) return false;
    this.sim.signal[key] = clamp(Number(quality), 0, 1);
    return true;
  }

  getVitals() {
    const sim = this.sim;
    const effective = this.getEffectiveCirculation();
    const ecgAvailable = sim.sensors.ecg && !sim.ecg.leadOff && sim.signal.ecg > 0.05;
    const lethal = isLethalRhythm(sim.rhythm);
    const hr = ecgAvailable && !lethal ? Math.round(sim.heartRate) : null;
    const spo2Available = sim.sensors.spo2 && sim.signal.spo2 > 0.12 && effective.hasPulse;
    const nibp = sim.nibp;
    const nibpAvailable = sim.sensors.nibp && !nibp.cuffError && !nibp.failed
      && Number.isFinite(nibp.lastSystolic);
    const ibpAvailable = sim.sensors.ibp && effective.hasPulse;
    const cvpAvailable = sim.sensors.cvp;
    const paAvailable = sim.sensors.pa && effective.hasPulse;
    const icpAvailable = sim.sensors.icp;
    return {
      hr,
      heartRateRaw: sim.heartRate,
      rhythm: sim.rhythm,
      pulse: effective.hasPulse,
      pulseSource: effective.source,
      spo2: spo2Available ? sim.spo2 : null,
      pr: spo2Available ? Math.round(sim.heartRate) : null,
      rr: sim.sensors.resp ? sim.rr : null,
      etco2: sim.sensors.capno ? sim.etco2 : null,
      tempC: sim.sensors.temp ? sim.tempC : null,
      temp2C: sim.sensors.temp2 ? sim.temp2C : null,
      tempDiffC: sim.sensors.temp && sim.sensors.temp2 ? Math.abs(sim.tempC - sim.temp2C) : null,
      nibp: nibpAvailable ? {
        sys: Math.round(nibp.lastSystolic),
        dia: Math.round(nibp.lastDiastolic),
        map: Math.round(nibp.lastMap),
        time: nibp.lastTime,
      } : null,
      nibpState: {
        measuring: nibp.measuring,
        progress: nibp.progress,
        countdown: nibp.countdown,
        failed: nibp.failed,
        cuffError: nibp.cuffError || !sim.sensors.nibp,
        lastTime: nibp.lastTime,
      },
      ibp: ibpAvailable ? {
        sys: Math.round(sim.pressures.ibp.sys),
        dia: Math.round(sim.pressures.ibp.dia),
        map: Math.round(sim.pressures.ibp.map),
      } : null,
      cvp: cvpAvailable ? Math.round(sim.pressures.cvp.mean) : null,
      pa: paAvailable ? {
        sys: Math.round(sim.pressures.pa.sys),
        dia: Math.round(sim.pressures.pa.dia),
        map: Math.round(sim.pressures.pa.mean),
      } : null,
      icp: icpAvailable ? Math.round(sim.pressures.icp.mean) : null,
      bis: sim.sensors.bis ? Math.round(sim.bis) : null,
      mapCentral: effective.hasPulse ? sim.map : null,
      effectivePerfusion: effective.quality,
      sensors: { ...sim.sensors },
      signal: { ...sim.signal },
      timestamp: Date.now(),
    };
  }

  getAlarmSnapshot() {
    const v = this.getVitals();
    return {
      ...v,
      asystole: this.sim.rhythm === 'ASYSTOLE',
      vf: this.sim.rhythm === 'VF',
      pulselessVt: this.sim.rhythm === 'VT' && !this.sim.pulse,
      apnea: this.sim.rr < 4 && this.sim.sensors.resp,
      severeDesat: v.spo2 !== null && v.spo2 < 85,
      severeHypotension: v.nibp !== null && v.nibp.sys < 70,
      leadOff: this.sim.sensors.ecg && this.sim.ecg.leadOff,
      spo2Off: !this.sim.sensors.spo2,
      nibpError: !this.sim.sensors.nibp || this.sim.nibp.cuffError || this.sim.nibp.failed,
      ibpDisconnected: !this.sim.sensors.ibp,
      lowBattery: this.sim.defib.battery <= 20,
      commError: false,
    };
  }

  getSnapshotForHistory() {
    const v = this.getVitals();
    return {
      rhythm: v.rhythm,
      hr: v.hr,
      spo2: v.spo2 === null ? null : roundTo(v.spo2, 0),
      rr: v.rr === null ? null : roundTo(v.rr, 0),
      bp: v.nibp ? `${v.nibp.sys}/${v.nibp.dia}` : null,
      etco2: v.etco2 === null ? null : roundTo(v.etco2, 0),
      temp: v.tempC === null ? null : roundTo(v.tempC, 1),
      pulse: v.pulse,
    };
  }
}

export const physiology = new PhysiologyEngine(store, patientManager, historyManager);
