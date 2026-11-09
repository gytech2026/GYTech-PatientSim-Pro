/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Patient profile management and sample simulation patients.
 * Profiles persist in localStorage. Live physiology is applied by physiology.js
 * when the patient:selected event is emitted.
 */
import {
  ACTIVE_PATIENT_KEY, PATIENTS_KEY, store,
} from './state.js';
import {
  deepClone, parseStoredJSON, uid, writeStoredJSON,
} from './utilities.js';

const baseline = (overrides = {}) => ({
  rhythm: 'NSR',
  heartRate: 72,
  pulse: true,
  perfusion: 1,
  oxygenation: 98,
  ventilation: 1,
  spo2: 98,
  rr: 16,
  etco2: 38,
  tempC: 36.8,
  temp2C: 36.6,
  bpSys: 120,
  bpDia: 78,
  respiratoryPattern: 'normal',
  capnoPattern: 'normal',
  respiratoryDepth: 1,
  respiratoryIrregularity: 0,
  bis: 47,
  sensors: {
    ecg: true, spo2: true, resp: true, capno: true, nibp: true,
    temp: true, temp2: true, ibp: false, cvp: false, pa: false, icp: false, bis: false,
  },
  pressures: {
    ibp: { sys: 120, dia: 78, map: 92 },
    cvp: { mean: 6 },
    pa: { sys: 25, dia: 10, mean: 15 },
    icp: { mean: 11 },
  },
  ...overrides,
});

export const createPatient = (data = {}) => {
  const now = new Date();
  return {
    id: data.id || `PT-${String(Math.floor(1000 + Math.random() * 9000))}`,
    name: data.name || 'Unnamed Patient',
    age: data.age ?? 55,
    sex: data.sex || 'Other',
    height: data.height ?? 170,
    weight: data.weight ?? 70,
    room: data.room || 'ICU',
    bed: data.bed || '01',
    medicalHistory: data.medicalHistory || 'None documented in simulation profile.',
    diagnosis: data.diagnosis || 'Simulation monitoring',
    status: data.status || 'Stable',
    admissionDate: data.admissionDate || now.toISOString().slice(0, 10),
    baseline: baseline(data.baseline || {}),
    createdAt: data.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

export const SAMPLE_PATIENTS = Object.freeze([
  createPatient({
    id: 'PT-1042',
    name: 'Eleanor Vance',
    age: 64,
    sex: 'Female',
    height: 163,
    weight: 68,
    room: 'ICU',
    bed: '12',
    medicalHistory: 'Hypertension, type 2 diabetes, elective abdominal surgery.',
    diagnosis: 'Post-operative monitoring — stable.',
    status: 'Stable',
    admissionDate: '2026-11-07',
    baseline: baseline({
      heartRate: 74, spo2: 98, rr: 15, etco2: 38, bpSys: 124, bpDia: 78,
      tempC: 36.8, temp2C: 36.7,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: true, ibp: false, cvp: false, pa: false, icp: false, bis: false,
      },
    }),
  }),
  createPatient({
    id: 'PT-2077',
    name: 'Marcus Chen',
    age: 52,
    sex: 'Male',
    height: 178,
    weight: 86,
    room: 'ED',
    bed: '03',
    medicalHistory: 'Hyperlipidaemia, smoker, family history of coronary disease.',
    diagnosis: 'Chest pain — rule out acute coronary syndrome.',
    status: 'Monitoring',
    admissionDate: '2026-11-09',
    baseline: baseline({
      heartRate: 88, spo2: 96, rr: 18, etco2: 37, bpSys: 148, bpDia: 92,
      tempC: 37.1, sensorOverrides: true,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: false, ibp: true, cvp: false, pa: false, icp: false, bis: false,
      },
      pressures: {
        ibp: { sys: 148, dia: 92, map: 111 },
        cvp: { mean: 6 },
        pa: { sys: 25, dia: 10, mean: 15 },
        icp: { mean: 11 },
      },
    }),
  }),
  createPatient({
    id: 'PT-3186',
    name: 'Sofia Alvarez',
    age: 29,
    sex: 'Female',
    height: 160,
    weight: 58,
    room: 'ICU',
    bed: '07',
    medicalHistory: 'Severe asthma, previous ICU admission for exacerbation.',
    diagnosis: 'Acute asthma exacerbation with hypoxaemia.',
    status: 'Critical',
    admissionDate: '2026-11-08',
    baseline: baseline({
      rhythm: 'SINUS_TACHY', heartRate: 118, spo2: 89, rr: 28, etco2: 31,
      bpSys: 128, bpDia: 76, tempC: 37.3, perfusion: 0.82, oxygenation: 89,
      respiratoryPattern: 'rapid', capnoPattern: 'obstruction', respiratoryDepth: 0.7,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: false, ibp: false, cvp: false, pa: false, icp: false, bis: false,
      },
    }),
  }),
  createPatient({
    id: 'PT-4411',
    name: 'Harold Brooks',
    age: 78,
    sex: 'Male',
    height: 172,
    weight: 81,
    room: 'CCU',
    bed: '04',
    medicalHistory: 'Heart failure with reduced ejection fraction, atrial fibrillation, CKD stage 3.',
    diagnosis: 'Acute decompensated heart failure.',
    status: 'Monitoring',
    admissionDate: '2026-11-06',
    baseline: baseline({
      rhythm: 'AFIB', heartRate: 96, spo2: 93, rr: 22, etco2: 42, bpSys: 96, bpDia: 58,
      tempC: 36.5, perfusion: 0.72, oxygenation: 93, respiratoryDepth: 0.8,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: true, ibp: false, cvp: true, pa: false, icp: false, bis: false,
      },
      pressures: {
        ibp: { sys: 96, dia: 58, map: 71 },
        cvp: { mean: 12 },
        pa: { sys: 42, dia: 22, mean: 29 },
        icp: { mean: 11 },
      },
    }),
  }),
  createPatient({
    id: 'PT-5520',
    name: 'Priya Nair',
    age: 41,
    sex: 'Female',
    height: 158,
    weight: 61,
    room: 'PACU',
    bed: '02',
    medicalHistory: 'Migraine, laparoscopic cholecystectomy.',
    diagnosis: 'Post-anaesthesia recovery — bradycardia.',
    status: 'Stable',
    admissionDate: '2026-11-09',
    baseline: baseline({
      rhythm: 'SINUS_BRADY', heartRate: 49, spo2: 97, rr: 13, etco2: 40,
      bpSys: 112, bpDia: 66, tempC: 36.4, temp2C: 36.3, perfusion: 0.9,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: true, ibp: false, cvp: false, pa: false, icp: false, bis: false,
      },
    }),
  }),
  createPatient({
    id: 'PT-6691',
    name: 'Noah Williams',
    age: 8,
    sex: 'Male',
    height: 128,
    weight: 26,
    room: 'PEDS',
    bed: '01',
    medicalHistory: 'No significant past medical history.',
    diagnosis: 'Febrile illness with tachycardia.',
    status: 'Monitoring',
    admissionDate: '2026-11-09',
    baseline: baseline({
      rhythm: 'SINUS_TACHY', heartRate: 126, spo2: 98, rr: 22, etco2: 34,
      bpSys: 104, bpDia: 62, tempC: 38.7, temp2C: 38.5, perfusion: 0.94,
      sensors: {
        ecg: true, spo2: true, resp: true, capno: true, nibp: true,
        temp: true, temp2: false, ibp: false, cvp: false, pa: false, icp: false, bis: false,
      },
    }),
  }),
]);

const validatePatientShape = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const patient = createPatient(candidate);
  if (!patient.name.trim()) patient.name = 'Unnamed Patient';
  if (!patient.id) patient.id = uid('patient');
  patient.age = Math.max(0, Math.min(120, Number(patient.age) || 0));
  patient.height = Math.max(30, Math.min(250, Number(patient.height) || 170));
  patient.weight = Math.max(1, Math.min(350, Number(patient.weight) || 70));
  return patient;
};

export class PatientManager {
  constructor(storeRef = store) {
    this.store = storeRef;
    const stored = parseStoredJSON(PATIENTS_KEY, null);
    const patients = Array.isArray(stored) && stored.length
      ? stored.map(validatePatientShape).filter(Boolean)
      : deepClone(SAMPLE_PATIENTS);
    this.store.state.patients = patients;
    const storedActive = localStorage.getItem(ACTIVE_PATIENT_KEY);
    const activeId = storedActive && patients.some((patient) => patient.id === storedActive)
      ? storedActive : patients[0]?.id || null;
    this.store.state.activePatientId = activeId;
    this.persist();
  }

  get all() {
    return this.store.state.patients;
  }

  get active() {
    return this.store.patient;
  }

  persist() {
    writeStoredJSON(PATIENTS_KEY, this.store.state.patients);
    if (this.store.state.activePatientId) {
      writeStoredJSON(ACTIVE_PATIENT_KEY, this.store.state.activePatientId);
    }
  }

  add(data = {}) {
    const patient = createPatient(data);
    this.store.state.patients.push(patient);
    this.persist();
    this.store.emit('patients:changed', this.store.state.patients);
    this.store.emit('patient:created', patient);
    return patient;
  }

  update(id, data = {}) {
    const index = this.store.state.patients.findIndex((patient) => patient.id === id);
    if (index < 0) return null;
    const existing = this.store.state.patients[index];
    const updated = createPatient({
      ...existing,
      ...data,
      id: existing.id,
      baseline: { ...existing.baseline, ...(data.baseline || {}) },
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    this.store.state.patients[index] = updated;
    this.persist();
    this.store.emit('patients:changed', this.store.state.patients);
    this.store.emit('patient:updated', updated);
    if (this.store.state.activePatientId === id) {
      this.store.emit('patient:profile-updated', updated);
    }
    return updated;
  }

  remove(id) {
    const index = this.store.state.patients.findIndex((patient) => patient.id === id);
    if (index < 0) return false;
    if (this.store.state.patients.length <= 1) return false;
    const [removed] = this.store.state.patients.splice(index, 1);
    if (this.store.state.activePatientId === id) {
      this.select(this.store.state.patients[0].id, { resetSimulation: true });
    }
    this.persist();
    this.store.emit('patients:changed', this.store.state.patients);
    this.store.emit('patient:deleted', removed);
    return true;
  }

  select(id, { resetSimulation = true } = {}) {
    const patient = this.store.state.patients.find((item) => item.id === id);
    if (!patient) return null;
    this.store.state.activePatientId = id;
    this.store.state.ui.notes = [];
    this.persist();
    this.store.emit('patient:selected', { patient, resetSimulation });
    return patient;
  }

  duplicate(id) {
    const source = this.store.state.patients.find((patient) => patient.id === id);
    if (!source) return null;
    const copy = createPatient({
      ...deepClone(source),
      id: `PT-${String(Math.floor(1000 + Math.random() * 9000))}`,
      name: `${source.name} (Copy)`,
    });
    this.store.state.patients.push(copy);
    this.persist();
    this.store.emit('patients:changed', this.store.state.patients);
    this.store.emit('patient:created', copy);
    return copy;
  }

  resetActiveBaseline() {
    const patient = this.active;
    if (!patient) return null;
    this.store.emit('patient:baseline-reset', patient);
    return patient;
  }
}

export const patientManager = new PatientManager(store);
