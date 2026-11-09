/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Centralised alarm engine.
 * Alarm state is derived from the live physiological model and sensor state.
 * Silencing affects audible annunciation only; active visual alarms remain.
 */
import { store } from './state.js';
import { physiology } from './physiology.js';
import { historyManager } from './history.js';
import { clamp } from './utilities.js';

const PRIORITY_RANK = { critical: 3, warning: 2, technical: 1 };
const ESCALATION_MS = 45000;

const ALARM_DEFS = {
  asystole: { title: 'ASYSTOLE', message: 'No electrical cardiac activity detected.', priority: 'critical', group: 'critical', parameter: 'ECG' },
  vf: { title: 'VENTRICULAR FIBRILLATION', message: 'Chaotic ventricular rhythm. Immediate simulated assessment required.', priority: 'critical', group: 'critical', parameter: 'ECG' },
  pulselessVt: { title: 'PULSELESS VT', message: 'Wide-complex tachycardia without a palpable simulated pulse.', priority: 'critical', group: 'critical', parameter: 'ECG' },
  pea: { title: 'NO PULSE — PEA', message: 'Organised electrical activity without a palpable simulated pulse.', priority: 'critical', group: 'critical', parameter: 'Perfusion' },
  apnea: { title: 'APNEA', message: 'No effective respiratory activity detected.', priority: 'critical', group: 'respiratoryRate', parameter: 'Resp' },
  severeDesat: { title: 'SEVERE DESATURATION', message: 'SpO₂ below the critical configured teaching threshold.', priority: 'critical', group: 'spo2', parameter: 'SpO₂' },
  severeHypotension: { title: 'SEVERE HYPOTENSION', message: 'Systolic pressure below the critical configured teaching threshold.', priority: 'critical', group: 'bloodPressure', parameter: 'NIBP' },
  hrHigh: { title: 'HIGH HEART RATE', message: 'Heart rate above the configured upper limit.', priority: 'warning', group: 'heartRate', parameter: 'HR' },
  hrLow: { title: 'LOW HEART RATE', message: 'Heart rate below the configured lower limit.', priority: 'warning', group: 'heartRate', parameter: 'HR' },
  spo2Low: { title: 'LOW SpO₂', message: 'Oxygen saturation below the configured limit.', priority: 'warning', group: 'spo2', parameter: 'SpO₂' },
  rrHigh: { title: 'HIGH RESPIRATORY RATE', message: 'Respiratory rate above the configured limit.', priority: 'warning', group: 'respiratoryRate', parameter: 'RR' },
  rrLow: { title: 'LOW RESPIRATORY RATE', message: 'Respiratory rate below the configured limit.', priority: 'warning', group: 'respiratoryRate', parameter: 'RR' },
  etco2High: { title: 'HIGH EtCO₂', message: 'End-tidal CO₂ above the configured limit.', priority: 'warning', group: 'etco2', parameter: 'EtCO₂' },
  etco2Low: { title: 'LOW EtCO₂', message: 'End-tidal CO₂ below the configured limit.', priority: 'warning', group: 'etco2', parameter: 'EtCO₂' },
  sysHigh: { title: 'HIGH SYSTOLIC PRESSURE', message: 'Systolic pressure above the configured limit.', priority: 'warning', group: 'bloodPressure', parameter: 'SYS' },
  sysLow: { title: 'LOW SYSTOLIC PRESSURE', message: 'Systolic pressure below the configured limit.', priority: 'warning', group: 'bloodPressure', parameter: 'SYS' },
  diaHigh: { title: 'HIGH DIASTOLIC PRESSURE', message: 'Diastolic pressure above the configured limit.', priority: 'warning', group: 'bloodPressure', parameter: 'DIA' },
  diaLow: { title: 'LOW DIASTOLIC PRESSURE', message: 'Diastolic pressure below the configured limit.', priority: 'warning', group: 'bloodPressure', parameter: 'DIA' },
  mapLow: { title: 'LOW MAP', message: 'Mean arterial pressure below the configured limit.', priority: 'warning', group: 'bloodPressure', parameter: 'MAP' },
  tempHigh: { title: 'HIGH TEMPERATURE', message: 'Temperature above the configured upper limit.', priority: 'warning', group: 'temperature', parameter: 'TEMP' },
  tempLow: { title: 'LOW TEMPERATURE', message: 'Temperature below the configured lower limit.', priority: 'warning', group: 'temperature', parameter: 'TEMP' },
  leadsOff: { title: 'ECG LEAD OFF', message: 'ECG lead or lead set disconnected.', priority: 'technical', group: 'technical', parameter: 'ECG' },
  spo2Off: { title: 'SpO₂ SENSOR OFF', message: 'Pulse oximeter sensor is disconnected.', priority: 'technical', group: 'technical', parameter: 'SpO₂' },
  respOff: { title: 'RESP SENSOR OFF', message: 'Respiratory sensor is disconnected.', priority: 'technical', group: 'technical', parameter: 'Resp' },
  capnoOff: { title: 'CAPNO LINE OFF', message: 'Capnography sampling line is disconnected.', priority: 'technical', group: 'technical', parameter: 'EtCO₂' },
  nibpError: { title: 'NIBP CUFF ERROR', message: 'NIBP measurement unavailable or cuff disconnected.', priority: 'technical', group: 'technical', parameter: 'NIBP' },
  ibpDisconnected: { title: 'IBP DISCONNECTED', message: 'Invasive pressure transducer is disconnected.', priority: 'technical', group: 'technical', parameter: 'IBP' },
  lowBattery: { title: 'LOW BATTERY', message: 'Simulated device battery low.', priority: 'technical', group: 'technical', parameter: 'Battery' },
  commError: { title: 'COMMUNICATION ERROR', message: 'Simulated network communication failure.', priority: 'technical', group: 'technical', parameter: 'Network' },
};

export class AlarmEngine {
  constructor(storeRef = store, phys = physiology, history = historyManager) {
    this.store = storeRef;
    this.physiology = phys;
    this.history = history;
    this.active = new Map();
    this.lastEvaluation = 0;
    this.evaluationInterval = 0.28;
    this.communicationError = false;
    this.listeners = new Set();
    this.store.on('patient:context-applied', () => this.reset());
    this.store.on('sim:reset', () => this.reset());
    this.store.on('settings:changed', () => this.evaluate(true));
  }

  reset() {
    this.active.clear();
    this.store.sim.activeAlarms = [];
    this.emit();
  }

  setCommunicationError(active) {
    this.communicationError = Boolean(active);
    this.evaluate(true);
  }

  isSilenced() {
    return Date.now() < this.store.sim.alarmSilenceUntil;
  }

  silence(seconds = 120) {
    const duration = clamp(seconds, 10, 300);
    this.store.sim.alarmSilenceUntil = Date.now() + duration * 1000;
    this.history.add({
      type: 'ALARM_SILENCE',
      category: 'alarm',
      severity: 'warning',
      description: `Audible alarms silenced for ${duration} seconds. Visual alarms remain active.`,
      details: { durationSeconds: duration },
    });
    this.store.emit('alarms:silence-changed', { silenced: true, until: this.store.sim.alarmSilenceUntil });
    this.emit();
    return true;
  }

  unsilence() {
    this.store.sim.alarmSilenceUntil = 0;
    this.store.emit('alarms:silence-changed', { silenced: false, until: 0 });
    this.emit();
  }

  acknowledge(id = null) {
    let changed = 0;
    for (const alarm of this.active.values()) {
      if ((id === null || alarm.id === id) && !alarm.acknowledged) {
        alarm.acknowledged = true;
        alarm.acknowledgedAt = Date.now();
        changed += 1;
        this.history.add({
          type: 'ALARM_ACKNOWLEDGE',
          category: 'alarm',
          severity: alarm.priority === 'critical' ? 'critical' : 'warning',
          description: `Alarm acknowledged: ${alarm.title}. Underlying condition remains under observation.`,
          details: { alarmId: alarm.id, priority: alarm.priority, parameter: alarm.parameter },
        });
      }
    }
    if (changed) {
      this.syncActive();
      this.emit();
    }
    return changed > 0;
  }

  acknowledgeAll() {
    return this.acknowledge(null);
  }

  evaluate(force = false) {
    const now = performance.now() / 1000;
    if (!force && now - this.lastEvaluation < this.evaluationInterval) return;
    this.lastEvaluation = now;
    const detected = this.detectAlarms();
    const next = new Map();
    for (const alarm of detected) {
      const existing = this.active.get(alarm.id);
      if (existing) {
        const merged = {
          ...existing,
          ...alarm,
          acknowledged: existing.acknowledged,
          acknowledgedAt: existing.acknowledgedAt,
          since: existing.since,
          escalated: existing.escalated,
        };
        if (existing.escalated) {
          merged.priority = 'critical';
          merged.title = alarm.title.startsWith('ESCALATED') ? alarm.title : `ESCALATED — ${alarm.title}`;
        }
        next.set(alarm.id, merged);
      } else {
        next.set(alarm.id, {
          ...alarm,
          since: Date.now(),
          acknowledged: false,
          escalated: false,
        });
        this.history.add({
          type: 'ALARM_ACTIVATED',
          category: 'alarm',
          severity: alarm.priority === 'critical' ? 'critical' : 'warning',
          description: `${alarm.title}: ${alarm.message}${alarm.value !== undefined ? ` (${alarm.value})` : ''}`,
          details: { alarmId: alarm.id, priority: alarm.priority, parameter: alarm.parameter, value: alarm.value },
        });
      }
    }
    for (const [id, oldAlarm] of this.active) {
      if (!next.has(id)) {
        this.history.add({
          type: 'ALARM_CLEARED',
          category: 'alarm',
          description: `Alarm condition resolved: ${oldAlarm.title}.`,
          details: { alarmId: id, parameter: oldAlarm.parameter },
        });
      }
    }

    // Warning escalation when an unacknowledged condition persists.
    for (const alarm of next.values()) {
      if (
        alarm.priority === 'warning'
        && !alarm.acknowledged
        && !alarm.escalated
        && Date.now() - alarm.since >= ESCALATION_MS
      ) {
        alarm.escalated = true;
        alarm.priority = 'critical';
        alarm.title = `ESCALATED — ${alarm.title}`;
        this.history.add({
          type: 'ALARM_ESCALATED',
          category: 'alarm',
          severity: 'critical',
          description: `Unacknowledged alarm escalated: ${alarm.title}.`,
          details: { alarmId: alarm.id, parameter: alarm.parameter },
        });
      }
    }

    this.active = next;
    this.syncActive();
    this.emit();
  }

  detectAlarms() {
    const snap = this.physiology.getAlarmSnapshot();
    const settings = this.store.settings;
    const limits = settings.alarmLimits;
    const toggles = settings.alarmToggles;
    const alarms = [];
    const add = (id, value, extra = {}) => {
      const def = ALARM_DEFS[id];
      if (!def || !this.groupEnabled(def.group)) return;
      alarms.push({
        id: `alarm:${id}`,
        type: id,
        title: def.title,
        message: def.message,
        priority: def.priority,
        group: def.group,
        parameter: def.parameter,
        value,
        ...extra,
      });
    };

    const criticalOn = toggles.critical !== false;
    const ecgAvailable = this.store.sim.sensors.ecg && !this.store.sim.ecg.leadOff;
    const breathingAvailable = this.store.sim.sensors.resp;

    if (criticalOn) {
      if (snap.asystole) add('asystole', 'ASYSTOLE');
      if (snap.vf) add('vf', 'VF');
      if (snap.pulselessVt) add('pulselessVt', 'PULSELESS VT');
      if (
        !snap.asystole && !snap.vf && !snap.pulselessVt && !snap.pulse
        && !this.store.sim.cpr.active
        && !this.store.sim.defib.pacing.active
      ) {
        add('pea', 'NO PULSE');
      }
      if (breathingAvailable && snap.apnea) add('apnea', `${Math.round(snap.rr || 0)} /min`);
      if (limits.spo2.enabled && snap.spo2 !== null && snap.spo2 < limits.spo2.low) {
        if (snap.spo2 < (limits.spo2.criticalLow ?? 85)) add('severeDesat', `${Math.round(snap.spo2)}%`);
      }
      if (
        limits.systolic.enabled && snap.nibp
        && snap.nibp.sys < (limits.systolic.criticalLow ?? 60) && snap.pulse
      ) {
        add('severeHypotension', `${snap.nibp.sys} mmHg`);
      }
    }

    if (toggles.heartRate && limits.heartRate.enabled && snap.hr !== null) {
      const rate = snap.hr;
      if (rate > limits.heartRate.high) add('hrHigh', `${rate} bpm`);
      if (rate > 0 && rate < limits.heartRate.low && !snap.asystole) add('hrLow', `${rate} bpm`);
    }

    if (toggles.spo2 && limits.spo2.enabled && snap.spo2 !== null) {
      if (snap.spo2 < limits.spo2.low && snap.spo2 >= (limits.spo2.criticalLow ?? 85)) {
        add('spo2Low', `${Math.round(snap.spo2)}%`);
      }
    }

    if (toggles.respiratoryRate && limits.respiratoryRate.enabled && snap.rr !== null && !snap.apnea) {
      if (snap.rr > limits.respiratoryRate.high) add('rrHigh', `${Math.round(snap.rr)} /min`);
      if (snap.rr > 0 && snap.rr < limits.respiratoryRate.low) add('rrLow', `${Math.round(snap.rr)} /min`);
    }

    if (toggles.etco2 && limits.etco2.enabled && snap.etco2 !== null && !snap.apnea) {
      if (snap.etco2 > limits.etco2.high) add('etco2High', `${Math.round(snap.etco2)} mmHg`);
      if (snap.etco2 < limits.etco2.low) add('etco2Low', `${Math.round(snap.etco2)} mmHg`);
    }

    if (toggles.bloodPressure && limits.systolic.enabled && snap.nibp) {
      if (snap.nibp.sys > limits.systolic.high) add('sysHigh', `${snap.nibp.sys} mmHg`);
      if (snap.nibp.sys < limits.systolic.low && snap.nibp.sys >= (limits.systolic.criticalLow ?? 60)) {
        add('sysLow', `${snap.nibp.sys} mmHg`);
      }
      if (limits.diastolic.enabled && snap.nibp.dia > limits.diastolic.high) add('diaHigh', `${snap.nibp.dia} mmHg`);
      if (limits.diastolic.enabled && snap.nibp.dia > 0 && snap.nibp.dia < limits.diastolic.low) {
        add('diaLow', `${snap.nibp.dia} mmHg`);
      }
      if (limits.map.enabled && snap.nibp.map < limits.map.low) add('mapLow', `${snap.nibp.map} mmHg`);
    }

    if (toggles.temperature && limits.temperature.enabled && snap.tempC !== null) {
      if (snap.tempC > limits.temperature.high) add('tempHigh', `${snap.tempC.toFixed(1)} °C`);
      if (snap.tempC < limits.temperature.low) add('tempLow', `${snap.tempC.toFixed(1)} °C`);
    }

    if (toggles.technical) {
      const monitored = this.store.sim.monitoring || {};
      if (monitored.ecg && !ecgAvailable) add('leadsOff', 'LEADS OFF');
      if (monitored.spo2 && snap.spo2Off) add('spo2Off', 'SENSOR OFF');
      if (monitored.resp && !this.store.sim.sensors.resp) add('respOff', 'BELT OFF');
      if (monitored.capno && !this.store.sim.sensors.capno) add('capnoOff', 'LINE OFF');
      if (monitored.nibp && snap.nibpError && this.store.sim.sensors.nibp) add('nibpError', 'MEASUREMENT ERROR');
      if (monitored.ibp && !this.store.sim.sensors.ibp) add('ibpDisconnected', 'DISCONNECTED');
      if (snap.lowBattery) add('lowBattery', `${Math.round(this.store.sim.defib.battery)}%`);
      if (snap.commError || this.communicationError) add('commError', 'NETWORK');
    }

    return alarms.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  }

  groupEnabled(group) {
    const toggles = this.store.settings.alarmToggles;
    if (group === 'critical') return toggles.critical !== false;
    if (group === 'technical') return toggles.technical !== false;
    return toggles[group] !== false;
  }

  syncActive() {
    this.store.sim.activeAlarms = [...this.active.values()]
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  }

  emit() {
    const alarms = [...this.active.values()].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
    const payload = {
      alarms,
      highest: alarms[0] || null,
      silenced: this.isSilenced(),
    };
    this.store.emit('alarms:changed', payload);
    for (const listener of this.listeners) {
      try { listener(payload); } catch (error) { console.error('[GYTech PatientSim Pro] Alarm listener error', error); }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get highest() {
    return [...this.active.values()].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0] || null;
  }

  get activeAlarms() {
    return [...this.active.values()].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  }
}

export const alarmEngine = new AlarmEngine(store, physiology, historyManager);
