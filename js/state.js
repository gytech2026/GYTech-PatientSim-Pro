/**
 * Centralised application state, event bus and validated persistence.
 * All feature modules read and mutate this single store instead of using
 * unrelated globals.
 */
import { clamp, deepClone, parseStoredJSON, writeStoredJSON } from './utilities.js';

export const SETTINGS_KEY = 'gytech.patientsim.settings.v1';
export const UI_STATE_KEY = 'gytech.patientsim.ui.v1';
export const PATIENTS_KEY = 'gytech.patientsim.patients.v1';
export const ACTIVE_PATIENT_KEY = 'gytech.patientsim.active-patient.v1';
export const HISTORY_KEY = 'gytech.patientsim.history.v1';

export const APP_NAME = 'GYTech PatientSim Pro';
export const APP_VERSION = '1.0.1';
export const APP_COPYRIGHT = 'Copyright 2026 GYTech All Right Reserved.';
export const APP_COPYRIGHT_STANDARD = 'Copyright © 2026 GYTech. All Rights Reserved.';
export const PROJECT_TITLE = 'Advanced Patient Vital Signs Monitor & Defibrillator Simulator';

export const DEFAULT_ALARM_LIMITS = Object.freeze({
  heartRate: { low: 50, high: 120, enabled: true, criticalLow: 30, criticalHigh: 180 },
  spo2: { low: 90, high: 100, enabled: true, criticalLow: 85 },
  respiratoryRate: { low: 8, high: 28, enabled: true, criticalLow: 4 },
  etco2: { low: 25, high: 55, enabled: true },
  systolic: { low: 80, high: 180, enabled: true, criticalLow: 60 },
  diastolic: { low: 45, high: 110, enabled: true },
  map: { low: 55, high: 120, enabled: true, criticalLow: 45 },
  temperature: { low: 35, high: 39.5, enabled: true, criticalHigh: 41 },
});

export const DEFAULT_ALARM_TOGGLES = Object.freeze({
  critical: true,
  heartRate: true,
  spo2: true,
  respiratoryRate: true,
  etco2: true,
  bloodPressure: true,
  temperature: true,
  technical: true,
  audio: true,
});

export const DEFAULT_SETTINGS = Object.freeze({
  screenTheme: 'dark',
  brightness: 100,
  sweepSpeed: 25,
  ecgGain: 1,
  tempUnit: 'C',
  pressureUnit: 'mmHg',
  alarmVolume: 0.65,
  audioAlerts: true,
  nibpInterval: 180,
  simulationSpeed: 1,
  showGrid: true,
  language: 'en',
  batteryLevel: 86,
  autoSave: true,
  alarmLimits: DEFAULT_ALARM_LIMITS,
  alarmToggles: DEFAULT_ALARM_TOGGLES,
});

export const RHYTHMS = Object.freeze([
  'NSR', 'SINUS_BRADY', 'SINUS_TACHY', 'AFIB', 'AFLUTTER', 'SVT', 'VT',
  'VF', 'ASYSTOLE', 'PVC', 'AVB1', 'AVB2', 'AVB3', 'PACED',
]);

export const RHYTHM_LABELS = Object.freeze({
  NSR: 'Normal Sinus Rhythm',
  SINUS_BRADY: 'Sinus Bradycardia',
  SINUS_TACHY: 'Sinus Tachycardia',
  AFIB: 'Atrial Fibrillation',
  AFLUTTER: 'Atrial Flutter',
  SVT: 'Supraventricular Tachycardia',
  VT: 'Ventricular Tachycardia',
  VF: 'Ventricular Fibrillation',
  ASYSTOLE: 'Asystole',
  PVC: 'Premature Ventricular Contractions',
  AVB1: 'First-Degree AV Block',
  AVB2: 'Second-Degree AV Block',
  AVB3: 'Third-Degree AV Block',
  PACED: 'Paced Rhythm',
});

export const SHOCKABLE_RHYTHMS = Object.freeze(['VF', 'VT']);

export const SENSOR_KEYS = Object.freeze([
  'ecg', 'spo2', 'resp', 'capno', 'nibp', 'temp', 'temp2', 'ibp', 'cvp', 'pa', 'icp', 'bis',
]);

export const SENSOR_LABELS = Object.freeze({
  ecg: 'ECG / Leads',
  spo2: 'SpO₂ Sensor',
  resp: 'Respiratory Belt',
  capno: 'Capnography',
  nibp: 'NIBP Cuff',
  temp: 'Temperature 1',
  temp2: 'Temperature 2',
  ibp: 'Arterial Line',
  cvp: 'CVP Line',
  pa: 'PA Catheter',
  icp: 'ICP Bolt',
  bis: 'BIS Sensor',
});

export const createSimState = () => ({
  running: true,
  simTime: 0,
  speed: 1,
  rhythm: 'NSR',
  heartRate: 72,
  pulse: true,
  perfusion: 1,
  oxygenation: 98,
  ventilation: 1,
  spo2: 98,
  pr: 72,
  rr: 16,
  etco2: 38,
  tempC: 36.8,
  temp2C: 36.6,
  bpSys: 120,
  bpDia: 78,
  map: 92,
  respiratoryPattern: 'normal',
  capnoPattern: 'normal',
  respiratoryIrregularity: 0,
  respiratoryDepth: 1,
  bis: 47,
  sensors: {
    ecg: true,
    spo2: true,
    resp: true,
    capno: true,
    nibp: true,
    temp: true,
    temp2: true,
    ibp: false,
    cvp: false,
    pa: false,
    icp: false,
    bis: false,
  },
  monitoring: {
    ecg: true,
    spo2: true,
    resp: true,
    capno: true,
    nibp: true,
    temp: true,
    temp2: true,
    ibp: false,
    cvp: false,
    pa: false,
    icp: false,
    bis: false,
  },
  signal: { ecg: 1, spo2: 1, resp: 1, capno: 1, ibp: 1, cvp: 1, pa: 1, icp: 1 },
  ecg: {
    leadCount: 5,
    lead: 'II',
    leadOff: false,
    artifact: 0.02,
    noise: 0.025,
    baselineWander: 0.08,
    gain: 1,
    sweep: 25,
  },
  nibp: {
    measuring: false,
    progress: 0,
    countdown: 180,
    lastSystolic: 120,
    lastDiastolic: 78,
    lastMap: 92,
    lastTime: null,
    cuffError: false,
    failed: false,
  },
  pressures: {
    ibp: { sys: 120, dia: 78, map: 92 },
    cvp: { mean: 6 },
    pa: { sys: 25, dia: 10, mean: 15 },
    icp: { mean: 11 },
  },
  defib: {
    mode: 'monitor',
    machineState: 'MONITORING',
    energy: 120,
    chargeProgress: 0,
    charged: false,
    pads: true,
    padQuality: 1,
    sync: false,
    syncReady: false,
    pacing: {
      active: false,
      rate: 70,
      output: 0,
      electricalCapture: false,
      mechanicalCapture: false,
      threshold: 55,
    },
    aed: {
      phase: 'idle',
      progress: 0,
      recommendation: null,
      analyzing: false,
      safetyConfirmed: false,
      announcement: 'Attach pads to begin AED analysis.',
    },
    shockCount: 0,
    lastShockAt: null,
    lastEvent: 'Device in monitor mode.',
    battery: 92,
    error: null,
  },
  cpr: {
    active: false,
    paused: false,
    rate: 110,
    depth: 5.5,
    compressions: 0,
    ventilations: 0,
    quality: 0,
    elapsed: 0,
    pauseSeconds: 0,
    lastCompressionAt: 0,
    metronome: true,
    feedback: 'CPR idle.',
  },
  scenario: {
    id: null,
    name: null,
    status: 'idle',
    elapsed: 0,
    stageIndex: 0,
    progressionIndex: 0,
    instructions: '',
    notes: '',
    outcomes: [],
    startedAt: null,
  },
  alarmSilenceUntil: 0,
  overrides: {
    heartRate: false,
    spo2: false,
    rr: false,
    bloodPressure: false,
    temperature: false,
    etco2: false,
    rhythm: false,
  },
  activeAlarms: [],
  alarmHistory: [],
});

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[GYTech PatientSim Pro] Event handler failed for "${event}"`, error);
      }
    }
  }
}

const mergeAlarmLimits = (stored) => {
  const merged = deepClone(DEFAULT_ALARM_LIMITS);
  if (!stored || typeof stored !== 'object') return merged;
  for (const key of Object.keys(merged)) {
    if (stored[key] && typeof stored[key] === 'object') {
      merged[key] = { ...merged[key], ...stored[key] };
      if (Number.isFinite(Number(merged[key].low))) merged[key].low = Number(merged[key].low);
      if (Number.isFinite(Number(merged[key].high))) merged[key].high = Number(merged[key].high);
      if (merged[key].criticalLow != null && Number.isFinite(Number(merged[key].criticalLow))) {
        merged[key].criticalLow = Number(merged[key].criticalLow);
      }
      if (merged[key].criticalHigh != null && Number.isFinite(Number(merged[key].criticalHigh))) {
        merged[key].criticalHigh = Number(merged[key].criticalHigh);
      }
      merged[key].enabled = Boolean(merged[key].enabled);
    }
  }
  return merged;
};

export const normalizeSettings = (incoming = {}) => {
  const settings = { ...deepClone(DEFAULT_SETTINGS), ...(incoming || {}) };
  settings.screenTheme = ['dark', 'high-contrast', 'night'].includes(settings.screenTheme)
    ? settings.screenTheme : 'dark';
  settings.brightness = clamp(settings.brightness, 50, 120);
  settings.sweepSpeed = [12.5, 25, 50].includes(Number(settings.sweepSpeed)) ? Number(settings.sweepSpeed) : 25;
  settings.ecgGain = [0.5, 1, 2, 4].includes(Number(settings.ecgGain)) ? Number(settings.ecgGain) : 1;
  settings.tempUnit = settings.tempUnit === 'F' ? 'F' : 'C';
  settings.pressureUnit = settings.pressureUnit === 'kPa' ? 'kPa' : 'mmHg';
  settings.alarmVolume = clamp(settings.alarmVolume, 0, 1);
  settings.audioAlerts = settings.audioAlerts !== false;
  settings.nibpInterval = [0, 60, 120, 180, 300, 600].includes(Number(settings.nibpInterval))
    ? Number(settings.nibpInterval) : 180;
  settings.simulationSpeed = [0.5, 1, 2, 4].includes(Number(settings.simulationSpeed))
    ? Number(settings.simulationSpeed) : 1;
  settings.showGrid = settings.showGrid !== false;
  settings.language = ['en', 'es'].includes(settings.language) ? settings.language : 'en';
  settings.batteryLevel = clamp(settings.batteryLevel ?? 86, 0, 100);
  settings.autoSave = settings.autoSave !== false;
  settings.alarmLimits = mergeAlarmLimits(settings.alarmLimits);
  settings.alarmToggles = { ...DEFAULT_ALARM_TOGGLES, ...(settings.alarmToggles || {}) };
  return settings;
};

export class Store {
  constructor() {
    this.bus = new EventBus();
    this.state = {
      settings: normalizeSettings(parseStoredJSON(SETTINGS_KEY, {})),
      sim: createSimState(),
      patients: [],
      activePatientId: null,
      ui: {
        activeModal: null,
        waveformFrozen: false,
        settingsOpen: false,
        lastSaved: null,
        twelveLeadFrozen: false,
        notes: [],
      },
      meta: {
        name: APP_NAME,
        title: PROJECT_TITLE,
        copyright: APP_COPYRIGHT,
        version: APP_VERSION,
        simulationOnly: true,
        initializedAt: new Date().toISOString(),
      },
    };
    this.state.sim.speed = this.state.settings.simulationSpeed;
    this.state.sim.ecg.gain = this.state.settings.ecgGain;
    this.state.sim.ecg.sweep = this.state.settings.sweepSpeed;
    this.state.sim.defib.battery = Math.round(this.state.settings.batteryLevel);
  }

  on(event, handler) {
    return this.bus.on(event, handler);
  }

  emit(event, payload) {
    this.bus.emit(event, payload);
  }

  get settings() {
    return this.state.settings;
  }

  get sim() {
    return this.state.sim;
  }

  get patient() {
    return this.state.patients.find((item) => item.id === this.state.activePatientId) || null;
  }

  updateSettings(patch, { silent = false } = {}) {
    const previous = this.state.settings;
    this.state.settings = normalizeSettings({ ...previous, ...patch });
    if (this.state.settings.simulationSpeed !== this.state.sim.speed) {
      this.state.sim.speed = this.state.settings.simulationSpeed;
    }
    this.state.sim.ecg.gain = this.state.settings.ecgGain;
    this.state.sim.ecg.sweep = this.state.settings.sweepSpeed;
    if (!silent) {
      this.saveSettings();
      this.emit('settings:changed', this.state.settings);
    }
    return this.state.settings;
  }

  saveSettings() {
    const saved = writeStoredJSON(SETTINGS_KEY, this.state.settings);
    if (saved) this.state.ui.lastSaved = new Date().toISOString();
    return saved;
  }

  updateAlarmLimit(key, patch) {
    if (!this.state.settings.alarmLimits[key]) return;
    this.state.settings.alarmLimits[key] = {
      ...this.state.settings.alarmLimits[key],
      ...patch,
    };
    this.updateSettings({});
    this.emit('alarms:limits-changed', this.state.settings.alarmLimits);
  }

  resetSettings() {
    this.state.settings = normalizeSettings({});
    this.state.sim.ecg.gain = this.state.settings.ecgGain;
    this.state.sim.ecg.sweep = this.state.settings.sweepSpeed;
    this.state.sim.speed = this.state.settings.simulationSpeed;
    this.state.sim.defib.battery = Math.round(this.state.settings.batteryLevel);
    this.saveSettings();
    this.emit('settings:changed', this.state.settings);
    this.emit('settings:reset');
  }

  resetSimulation({ preservePatient = true } = {}) {
    const sim = createSimState();
    Object.assign(this.state.sim, sim);
    if (!preservePatient) this.state.activePatientId = null;
    this.emit('sim:reset', this.state.sim);
  }
}

export const store = new Store();
