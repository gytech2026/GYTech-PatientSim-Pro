/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Display preferences, units, language, alarm configuration helpers and
 * reset-to-default. Settings persist in localStorage through the store.
 */
import { store } from './state.js';
import { historyManager } from './history.js';
import { clamp } from './utilities.js';

export const TRANSLATIONS = Object.freeze({
  en: {
    patients: 'Patients', scenarios: 'Scenarios', instructor: 'Instructor', cpr: 'CPR',
    alarms: 'Alarms', ecg: 'ECG', history: 'History', twelveLead: '12-Lead',
    settings: 'Settings', diagnostics: 'Diagnostics', monitor: 'Monitor', manualDefib: 'Manual Defib',
    sync: 'Sync Cardioversion', pacing: 'Pacing', hr: 'Heart Rate', spo2: 'SpO₂',
    nibp: 'NIBP', rr: 'Respiratory Rate', temp: 'Temperature', etco2: 'EtCO₂',
    simulation: 'Simulation', pause: 'Pause', resume: 'Resume', start: 'Start', reset: 'Reset',
    acknowledge: 'Acknowledge', silence: 'Silence', audioOn: 'Audio On', audioOff: 'Audio Off',
    noActiveAlarms: 'No active alarms', critical: 'Critical', warning: 'Warning', technical: 'Technical',
  },
  es: {
    patients: 'Pacientes', scenarios: 'Escenarios', instructor: 'Instructor', cpr: 'RCP',
    alarms: 'Alarmas', ecg: 'ECG', history: 'Historial', twelveLead: '12 Derivaciones',
    settings: 'Ajustes', diagnostics: 'Diagnóstico', monitor: 'Monitor', manualDefib: 'Desfibrilación manual',
    sync: 'Cardioversión sincronizada', pacing: 'Marcapasos', hr: 'Frecuencia cardíaca', spo2: 'SpO₂',
    nibp: 'PAN', rr: 'Frecuencia respiratoria', temp: 'Temperatura', etco2: 'EtCO₂',
    simulation: 'Simulación', pause: 'Pausar', resume: 'Reanudar', start: 'Iniciar', reset: 'Restablecer',
    acknowledge: 'Reconocer', silence: 'Silenciar', audioOn: 'Audio activado', audioOff: 'Audio desactivado',
    noActiveAlarms: 'Sin alarmas activas', critical: 'Crítica', warning: 'Advertencia', technical: 'Técnica',
  },
});

const ALARM_LIMIT_RANGES = Object.freeze({
  heartRate: { min: 0, max: 300 },
  spo2: { min: 0, max: 100 },
  respiratoryRate: { min: 0, max: 80 },
  etco2: { min: 0, max: 100 },
  systolic: { min: 0, max: 300 },
  diastolic: { min: 0, max: 200 },
  map: { min: 0, max: 250 },
  temperature: { min: 25, max: 43 },
});

export class SettingsManager {
  constructor(storeRef = store, history = historyManager) {
    this.store = storeRef;
    this.history = history;
  }

  t(key, fallback = key) {
    const lang = this.store.settings.language || 'en';
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || fallback;
  }

  apply() {
    document.documentElement.dataset.theme = this.store.settings.screenTheme;
    document.documentElement.style.setProperty('--screen-brightness', `${this.store.settings.brightness / 100}`);
    document.documentElement.lang = this.store.settings.language;
    document.documentElement.dataset.tempUnit = this.store.settings.tempUnit;
    document.documentElement.dataset.pressureUnit = this.store.settings.pressureUnit;
    this.translateStaticUI();
  }

  translateStaticUI() {
    for (const element of document.querySelectorAll('[data-i18n]')) {
      const key = element.dataset.i18n;
      const translation = this.t(key, element.dataset.i18nFallback || element.textContent);
      if (translation) element.textContent = translation;
    }
    for (const element of document.querySelectorAll('[data-i18n-title]')) {
      const key = element.dataset.i18nTitle;
      element.title = this.t(key, element.title);
    }
  }

  update(patch, description = 'Settings updated.') {
    this.store.updateSettings(patch);
    this.apply();
    this.history.add({
      type: 'SETTINGS_CHANGE',
      category: 'settings',
      description,
      details: { ...patch },
    });
    return this.store.settings;
  }

  setTheme(theme) {
    return this.update({ screenTheme: theme }, `Display theme changed to ${theme}.`);
  }

  setBrightness(value) {
    return this.update({ brightness: clamp(value, 50, 120) }, `Screen brightness set to ${Math.round(value)}%.`);
  }

  setSweepSpeed(speed) {
    return this.update({ sweepSpeed: Number(speed) }, `Waveform sweep speed set to ${speed} mm/s.`);
  }

  setECGGain(gain) {
    return this.update({ ecgGain: Number(gain) }, `ECG display gain set to ×${gain}.`);
  }

  setTempUnit(unit) {
    return this.update({ tempUnit: unit === 'F' ? 'F' : 'C' }, `Temperature unit set to ${unit}.`);
  }

  setPressureUnit(unit) {
    return this.update({ pressureUnit: unit === 'kPa' ? 'kPa' : 'mmHg' }, `Pressure unit set to ${unit}.`);
  }

  setAlarmVolume(value) {
    return this.update({ alarmVolume: clamp(value, 0, 1) }, `Alarm volume set to ${Math.round(value * 100)}%.`);
  }

  setNIBPInterval(seconds) {
    const interval = [0, 60, 120, 180, 300, 600].includes(Number(seconds)) ? Number(seconds) : 180;
    this.store.sim.nibp.countdown = interval || 0;
    return this.update({ nibpInterval: interval }, `NIBP automatic interval set to ${interval === 0 ? 'manual only' : `${interval} seconds`}.`);
  }

  setSimulationSpeed(speed) {
    return this.update({ simulationSpeed: Number(speed) }, `Simulation speed set to ×${speed}.`);
  }

  setLanguage(language) {
    const lang = ['en', 'es'].includes(language) ? language : 'en';
    return this.update({ language: lang }, `Interface language set to ${lang === 'es' ? 'Spanish' : 'English'}.`);
  }

  setBattery(value) {
    const battery = clamp(value, 0, 100);
    this.store.sim.defib.battery = battery;
    this.store.updateSettings({ batteryLevel: battery });
    this.store.emit('defib:changed');
    return battery;
  }

  setAlarmLimit(key, low, high) {
    const limits = this.store.settings.alarmLimits[key];
    if (!limits) return false;
    const patch = {};
    if (Number.isFinite(Number(low))) patch.low = Number(low);
    if (Number.isFinite(Number(high))) patch.high = Number(high);
    const range = ALARM_LIMIT_RANGES[key];
    if (range) {
      for (const value of Object.values(patch)) {
        if (value < range.min || value > range.max) {
          return { ok: false, reason: `Alarm limits for ${key} must remain between ${range.min} and ${range.max}.` };
        }
      }
    }
    if (patch.low !== undefined && patch.high !== undefined && patch.low >= patch.high) {
      return { ok: false, reason: 'The low limit must be below the high limit.' };
    }
    this.store.updateAlarmLimit(key, patch);
    this.history.add({
      type: 'ALARM_LIMIT_CHANGE',
      category: 'alarm',
      description: `Alarm limits updated for ${key}.`,
      details: { ...patch },
    });
    return { ok: true };
  }

  setAlarmToggle(key, enabled) {
    const toggles = { ...this.store.settings.alarmToggles, [key]: Boolean(enabled) };
    const patch = { alarmToggles: toggles };
    if (key === 'audio') patch.audioAlerts = Boolean(enabled);
    this.store.updateSettings(patch);
    this.history.add({
      type: 'ALARM_TOGGLE',
      category: 'alarm',
      description: `Alarm group ${key} ${enabled ? 'enabled' : 'disabled'}.`,
      details: { group: key, enabled },
    });
    return true;
  }

  resetToDefaults() {
    this.store.resetSettings();
    this.apply();
    this.history.add({
      type: 'SETTINGS_RESET',
      category: 'settings',
      severity: 'warning',
      description: 'All display and alarm settings reset to simulation defaults.',
      details: {},
    });
    this.store.emit('ui:toast', { message: 'Settings restored to defaults.', tone: 'success' });
  }
}

export const settingsManager = new SettingsManager(store, historyManager);
