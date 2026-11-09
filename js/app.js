/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * GYTech PatientSim Pro — application controller.
 * Wires the single simulation loop to the clinical monitoring surface,
 * structured modals and all interactive device controls.
 */
import {
  APP_VERSION, RHYTHMS, RHYTHM_LABELS, SENSOR_KEYS, SENSOR_LABELS, store,
} from './state.js';
import { patientManager } from './patient.js';
import { physiology } from './physiology.js';
import { waveformEngine } from './waveform.js';
import { alarmEngine } from './alarms.js';
import { defibrillator } from './defibrillator.js';
import { simulation } from './simulation.js';
import { twelveLeadECG } from './ecg12lead.js';
import { historyManager } from './history.js';
import { audioManager } from './audio.js';
import { settingsManager } from './settings.js';
import { desktopManager } from './desktop.js';
import { SCENARIOS } from './scenarios.js';
import { getSpO2Status } from './spo2.js';
import { getTemperatureStatus } from './temperature.js';
import { formatClock, formatDate, formatDateTime, formatDuration, formatElapsed } from './utilities.js';
import {
  formatPressure, formatTemp, pressureUnitLabel, tempUnitLabel,
  clamp, escapeHTML,
} from './utilities.js';
import {
  formatPressurePair, temperatureDifferenceDisplay,
} from './vitals.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const bind = (id, event, handler) => {
  const element = $(id);
  if (element) element.addEventListener(event, handler);
};

const MODAL_MAP = {
  patients: 'modalPatients',
  scenarios: 'modalScenarios',
  instructor: 'modalInstructor',
  cpr: 'modalCPR',
  alarms: 'modalAlarms',
  ecg: 'modalECG',
  sensors: 'modalSensors',
  settings: 'modalSettings',
  history: 'modalHistory',
  twelve: 'modalTwelveLead',
  diagnostics: 'modalDiagnostics',
  about: 'modalAbout',
  update: 'modalUpdate',
};

const DOCK_MAP = {
  patients: 'btnPatients',
  scenarios: 'btnScenarios',
  instructor: 'btnInstructor',
  cpr: 'btnCPR',
  alarms: 'btnAlarms',
  ecg: 'btnECGSettings',
  sensors: 'btnSensors',
  history: 'btnHistory',
  twelve: 'btn12Lead',
  settings: 'btnDeviceSettings',
  diagnostics: 'btnDiagnostics',
};

const ALARM_GROUP_LABELS = {
  critical: 'Critical alarm group',
  heartRate: 'Heart rate limits',
  spo2: 'SpO₂ limits',
  respiratoryRate: 'Respiratory rate limits',
  etco2: 'EtCO₂ limits',
  bloodPressure: 'Blood pressure limits',
  temperature: 'Temperature limits',
  technical: 'Technical alarms',
  audio: 'Audio annunciation',
};

const ALARM_LIMIT_LABELS = {
  heartRate: 'Heart rate (bpm)',
  spo2: 'SpO₂ (%)',
  respiratoryRate: 'Respiratory rate (/min)',
  etco2: 'EtCO₂ (mmHg)',
  systolic: 'Systolic (mmHg)',
  diastolic: 'Diastolic (mmHg)',
  map: 'MAP (mmHg)',
  temperature: 'Temperature (°C)',
};

const ui = {
  activeModal: null,
  selectedPatientId: null,
  selectedScenarioId: SCENARIOS[0]?.id || null,
  alarmPayload: { alarms: [], highest: null, silenced: false },
  alarmSignature: '',
  energySignature: '',
  cprHistorySignature: '',
  railContextSignature: '',
  confirmCallback: null,
  lastDefibDraw: 0,
  lastCprMetronomeKey: '',
  lastDefibScreenOverlay: '',
  lastCprHistoryCount: -1,
};

/* ============================================================
   Generic UI helpers
   ============================================================ */

function setText(id, value, tone = null) {
  const element = $(id);
  if (!element) return;
  element.textContent = value;
  if (tone) element.dataset.tone = tone;
}

function setElementText(element, value) {
  if (element) element.textContent = value;
}

function setStatus(id, text, tone = 'off') {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.dataset.tone = tone;
}

function toast(message, tone = 'info', duration = 3600) {
  const stack = $('toastStack');
  if (!stack) return;
  const element = document.createElement('div');
  element.className = 'toast';
  element.dataset.tone = tone;
  element.textContent = message;
  stack.appendChild(element);
  setTimeout(() => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(4px)';
    element.style.transition = 'opacity .2s, transform .2s';
    setTimeout(() => element.remove(), 220);
  }, duration);
}

function confirmAction(title, message, callback, confirmLabel = 'CONFIRM') {
  $('confirmTitle').textContent = title;
  $('confirmMessage').textContent = message;
  $('confirmOk').textContent = confirmLabel;
  ui.confirmCallback = callback;
  $('confirmLayer').hidden = false;
}

function closeConfirm() {
  $('confirmLayer').hidden = true;
  ui.confirmCallback = null;
}

function setValueIfIdle(element, value) {
  if (!element) return;
  if (document.activeElement === element) return;
  element.value = value;
}

function setCheckedIfIdle(element, value) {
  if (!element) return;
  if (document.activeElement === element) return;
  element.checked = Boolean(value);
}

/* ============================================================
   Modal system
   ============================================================ */

function closeModal() {
  if (!ui.activeModal) return;
  if (ui.activeModal === 'twelve') twelveLeadECG.close();
  for (const modalId of Object.values(MODAL_MAP)) {
    const modal = $(modalId);
    if (modal) modal.hidden = true;
  }
  $('modalLayer').hidden = true;
  ui.activeModal = null;
  store.state.ui.activeModal = null;
  for (const button of $$('.dock-button')) button.classList.remove('is-active');
}

function openModal(name) {
  const modalId = MODAL_MAP[name];
  if (!modalId) return;
  if (ui.activeModal === name) {
    closeModal();
    return;
  }
  if (ui.activeModal === 'twelve') twelveLeadECG.close();
  for (const otherModalId of Object.values(MODAL_MAP)) {
    const modal = $(otherModalId);
    if (modal) modal.hidden = true;
  }
  const modal = $(modalId);
  if (!modal) return;
  $('modalLayer').hidden = false;
  modal.hidden = false;
  ui.activeModal = name;
  store.state.ui.activeModal = name;
  for (const button of $$('.dock-button')) {
    button.classList.toggle('is-active', DOCK_MAP[name] === button.id);
  }

  if (name === 'patients') preparePatientModal();
  else if (name === 'scenarios') {
    renderScenarioList();
    refreshScenarioDetail();
  } else if (name === 'instructor') syncInstructorControls(true);
  else if (name === 'cpr') refreshCPRUI();
  else if (name === 'alarms') {
    renderAlarmGroupToggles();
    renderAlarmLimits();
    renderActiveAlarms(ui.alarmPayload);
    syncAlarmVolumeControl();
  } else if (name === 'ecg') syncECGSettings();
  else if (name === 'sensors') renderSensorConfig();
  else if (name === 'settings') syncSettingsControls();
  else if (name === 'history') renderHistory();
  else if (name === 'twelve') {
    updateTwelveLeadMeta();
    twelveLeadECG.open();
    requestAnimationFrame(() => twelveLeadECG.draw());
  } else if (name === 'diagnostics') renderDiagnostics();
}

/* ============================================================
   Patient management
   ============================================================ */

function preparePatientModal() {
  ui.selectedPatientId = store.state.activePatientId;
  renderPatientList();
  loadPatientForm(patientManager.active);
}

function renderPatientList() {
  const container = $('patientList');
  if (!container) return;
  const activeId = store.state.activePatientId;
  container.innerHTML = store.state.patients.map((patient) => `
    <div class="patient-card ${patient.id === activeId ? 'is-active' : ''}" data-patient-id="${escapeHTML(patient.id)}" role="button" tabindex="0">
      <div class="patient-card-name">${escapeHTML(patient.name)}<span>${escapeHTML(patient.id)}</span></div>
      <div class="patient-card-meta">${escapeHTML(patient.age)} y · ${escapeHTML(patient.sex)} · ${escapeHTML(patient.room)} / ${escapeHTML(patient.bed)}</div>
      <div class="patient-card-diagnosis">${escapeHTML(patient.diagnosis || 'No diagnosis')}</div>
    </div>`).join('');
}

function loadPatientForm(patient = null) {
  const isNew = !patient;
  $('patientRecordId').value = patient?.id || '';
  $('patientName').value = patient?.name || '';
  $('patientId').value = patient?.id || `PT-${Math.floor(1000 + Math.random() * 9000)}`;
  $('patientId').readOnly = !isNew;
  $('patientAge').value = patient?.age ?? 55;
  $('patientSex').value = patient?.sex || 'Other';
  $('patientHeight').value = patient?.height ?? 170;
  $('patientWeight').value = patient?.weight ?? 70;
  $('patientRoom').value = patient?.room || 'ICU';
  $('patientBed').value = patient?.bed || '01';
  $('patientStatus').value = patient?.status || 'Stable';
  $('patientAdmission').value = patient?.admissionDate || new Date().toISOString().slice(0, 10);
  $('patientHistory').value = patient?.medicalHistory || '';
  $('patientDiagnosis').value = patient?.diagnosis || '';
  $('patientEditorTitle').textContent = isNew ? 'NEW PATIENT' : 'EDIT PATIENT';
  $('patientEditNote').textContent = isNew ? 'A new simulation profile.' : 'Changes apply to the active simulation context.';
  $('patientFormFeedback').textContent = '';
  $('patientFormFeedback').className = 'form-feedback';
  $('btnDeletePatient').disabled = isNew || store.state.patients.length <= 1;
  $('btnDuplicatePatient').disabled = isNew;
  $('btnResetPatientSim').disabled = isNew;
}

function readPatientForm() {
  return {
    name: $('patientName').value.trim(),
    id: $('patientId').value.trim().toUpperCase(),
    age: Number($('patientAge').value),
    sex: $('patientSex').value,
    height: Number($('patientHeight').value),
    weight: Number($('patientWeight').value),
    room: $('patientRoom').value.trim(),
    bed: $('patientBed').value.trim(),
    status: $('patientStatus').value,
    admissionDate: $('patientAdmission').value,
    medicalHistory: $('patientHistory').value.trim(),
    diagnosis: $('patientDiagnosis').value.trim(),
  };
}

function savePatient(event) {
  event.preventDefault();
  const recordId = $('patientRecordId').value;
  const data = readPatientForm();
  const feedback = $('patientFormFeedback');
  if (!data.name) {
    feedback.textContent = 'Patient name is required.';
    feedback.className = 'form-feedback is-error';
    $('patientName').focus();
    return;
  }
  if (!data.id) {
    feedback.textContent = 'Patient ID is required.';
    feedback.className = 'form-feedback is-error';
    $('patientId').focus();
    return;
  }
  if (!Number.isFinite(data.age) || data.age < 0 || data.age > 120) {
    feedback.textContent = 'Age must be between 0 and 120.';
    feedback.className = 'form-feedback is-error';
    return;
  }
  if (!Number.isFinite(data.height) || data.height < 30 || data.height > 250) {
    feedback.textContent = 'Height must be 30–250 cm.';
    feedback.className = 'form-feedback is-error';
    return;
  }
  if (!Number.isFinite(data.weight) || data.weight < 1 || data.weight > 350) {
    feedback.textContent = 'Weight must be 1–350 kg.';
    feedback.className = 'form-feedback is-error';
    return;
  }
  if (!recordId) {
    if (store.state.patients.some((patient) => patient.id === data.id)) {
      feedback.textContent = 'That patient ID already exists. Choose a unique ID.';
      feedback.className = 'form-feedback is-error';
      return;
    }
    const patient = patientManager.add(data);
    patientManager.select(patient.id);
    loadPatientForm(patient);
    feedback.textContent = 'Patient created and selected.';
    feedback.className = 'form-feedback is-ok';
    toast(`Patient ${patient.name} created.`, 'success');
  } else {
    const updated = patientManager.update(recordId, data);
    if (updated) {
      loadPatientForm(updated);
      feedback.textContent = 'Patient profile saved.';
      feedback.className = 'form-feedback is-ok';
      toast('Patient profile saved.', 'success');
    } else {
      feedback.textContent = 'Unable to save patient profile.';
      feedback.className = 'form-feedback is-error';
    }
  }
  renderPatientList();
  updatePatientContext();
}

function selectPatient(id) {
  if (!id) return;
  const patient = patientManager.select(id);
  if (!patient) return;
  ui.selectedPatientId = id;
  renderPatientList();
  loadPatientForm(patient);
  updatePatientContext();
  toast(`Patient context: ${patient.name}. Transient device state reset.`, 'info');
}

function deleteSelectedPatient() {
  const id = $('patientRecordId').value || store.state.activePatientId;
  const patient = store.state.patients.find((item) => item.id === id);
  if (!patient) return;
  if (store.state.patients.length <= 1) {
    toast('At least one simulation patient must remain.', 'warning');
    return;
  }
  confirmAction(
    'Delete patient profile',
    `Delete ${patient.name} from simulation storage? The active monitoring context will switch to another patient. This cannot be undone.`,
    () => {
      const removed = patientManager.remove(patient.id);
      if (removed) {
        renderPatientList();
        loadPatientForm(patientManager.active);
        toast('Patient profile deleted.', 'success');
      } else {
        toast('Patient could not be deleted.', 'warning');
      }
    },
    'DELETE PATIENT',
  );
}

function duplicateSelectedPatient() {
  const id = $('patientRecordId').value || store.state.activePatientId;
  if (!id) return;
  const copy = patientManager.duplicate(id);
  if (copy) {
    patientManager.select(copy.id);
    renderPatientList();
    loadPatientForm(copy);
    toast('Patient profile duplicated and selected.', 'success');
  }
}

function resetActivePatientSimulation() {
  const patient = patientManager.active;
  if (!patient) return;
  confirmAction(
    'Reset patient simulation',
    `Restore ${patient.name} to the saved simulation baseline? Current vital signs, CPR, pacing and scenario state will be reset.`,
    () => {
      patientManager.resetActiveBaseline();
      toast('Patient simulation reset to baseline.', 'success');
    },
    'RESET SIMULATION',
  );
}

function updatePatientContext() {
  const patient = patientManager.active;
  if (!patient) return;
  const sim = store.sim;
  setText('topPatientName', patient.name);
  setText('topPatientId', patient.id);
  setText('topPatientAge', patient.age);
  setText('topPatientSex', patient.sex);
  setText('topPatientRoom', patient.room);
  setText('topPatientBed', patient.bed);
  setText('monitorContext', `${patient.name} · ${patient.room} ${patient.bed}`);
  const statusChip = $('topPatientStatus');
  if (statusChip) {
    statusChip.textContent = patient.status;
    statusChip.style.color = patient.status === 'Critical' ? 'var(--critical)'
      : patient.status === 'Monitoring' ? 'var(--warning)' : 'var(--normal)';
    statusChip.style.borderColor = patient.status === 'Critical' ? 'rgba(255,48,48,.3)'
      : patient.status === 'Monitoring' ? 'rgba(255,176,32,.28)' : 'rgba(0,216,120,.28)';
  }
  const liveDot = $('patientLiveDot');
  if (liveDot) {
    liveDot.classList.toggle('is-critical', sim.activeAlarms.some((alarm) => alarm.priority === 'critical'));
    liveDot.classList.toggle('is-paused', !sim.running);
  }
  updateRailReference();
}

function updateRailReference() {
  const patient = patientManager.active;
  const scenario = store.sim.scenario;
  setText('railScenarioLabel', scenario.id ? `${scenario.name} · ${scenario.status.toUpperCase()}` : 'None active');
  setText('railDiagnosisLabel', patient?.diagnosis || '--');
}

function renderRailEvents() {
  const entries = historyManager.entries.slice(0, 4);
  const signature = entries.map((entry) => `${entry.id}:${entry.type}`).join('|') + (patientManager.active?.id || '');
  if (signature === ui.railContextSignature) return;
  ui.railContextSignature = signature;
  const list = $('railRecentEvents');
  if (!list) return;
  list.innerHTML = entries.length
    ? entries.map((entry) => `<li><time>${escapeHTML((entry.displayTime || '').slice(11))}</time><span>${escapeHTML(entry.description)}</span></li>`).join('')
    : '<li>No simulation events yet.</li>';
  updateRailReference();
}

function updateDefibChecklist(status) {
  const sim = store.sim;
  const setMark = (id, state) => {
    const mark = $(id);
    if (!mark) return;
    mark.className = `check-mark${state ? ` is-${state}` : ''}`;
  };
  setText('checkPads', status.pads ? 'CONNECTED' : 'DISCONNECTED');
  $('checkPads').className = status.pads ? 'is-ok' : 'is-critical';
  setMark('checkPadsMark', status.pads ? 'ok' : 'critical');

  const ecgAvailable = sim.sensors.ecg && !sim.ecg.leadOff;
  setText('checkRhythm', ecgAvailable ? status.rhythmClassification.label.toUpperCase() : 'NO ECG');
  $('checkRhythm').className = ecgAvailable ? (status.rhythmClassification.shockable ? 'is-warn' : 'is-ok') : 'is-warn';
  setMark('checkRhythmMark', ecgAvailable ? (status.rhythmClassification.shockable ? 'warn' : 'ok') : 'warn');

  const pulseKnown = !['VF', 'ASYSTOLE'].includes(sim.rhythm);
  const hasPulse = sim.pulse;
  setText('checkPulse', !pulseKnown ? 'PULSELESS RHYTHM' : hasPulse ? 'PULSE PRESENT' : 'NO PULSE');
  $('checkPulse').className = !pulseKnown ? 'is-critical' : hasPulse ? 'is-ok' : 'is-warn';
  setMark('checkPulseMark', !pulseKnown ? 'critical' : hasPulse ? 'ok' : 'warn');

  let chargeText = 'DISCHARGED';
  if (status.machineState === 'CHARGING') chargeText = `CHARGING ${Math.round(status.chargeProgress * 100)}%`;
  else if (status.machineState === 'CHARGED') chargeText = `${status.energy} J CHARGED`;
  else if (status.machineState === 'SHOCK_SIMULATION') chargeText = 'DELIVERED';
  else if (status.machineState === 'ERROR') chargeText = 'ERROR';
  setText('checkCharge', chargeText);
  $('checkCharge').className = status.machineState === 'CHARGED' ? 'is-warn' : status.machineState === 'ERROR' ? 'is-critical' : 'is-ok';
  setMark('checkChargeMark', status.machineState === 'CHARGED' ? 'warn' : status.machineState === 'ERROR' ? 'critical' : 'ok');

  let syncText = 'NOT REQUIRED';
  let syncState = '';
  if (status.mode === 'sync') {
    syncText = status.syncReady ? 'MARKER ACQUIRED' : 'NO MARKER';
    syncState = status.syncReady ? 'ok' : 'warn';
  }
  setText('checkSync', syncText);
  $('checkSync').className = syncState ? `is-${syncState}` : '';
  setMark('checkSyncMark', syncState);
}

/* ============================================================
   Scenario management
   ============================================================ */

function renderScenarioList() {
  const container = $('scenarioList');
  if (!container) return;
  const filter = $('scenarioCategoryFilter')?.value || 'all';
  const visible = SCENARIOS.filter((scenario) => filter === 'all' || scenario.category === filter);
  container.innerHTML = visible.map((scenario, index) => {
    const isSelected = scenario.id === ui.selectedScenarioId;
    const isRunning = store.sim.scenario.id === scenario.id;
    return `
      <div class="scenario-card ${isSelected ? 'is-active' : ''}" data-scenario-id="${escapeHTML(scenario.id)}" role="button" tabindex="0" title="${escapeHTML(scenario.description)}">
        <span class="scenario-index">${String(SCENARIOS.indexOf(scenario) + 1).padStart(2, '0')}</span>
        <span class="scenario-card-main">
          <span class="scenario-card-name">${escapeHTML(scenario.name)}</span>
          <span class="scenario-card-meta">${escapeHTML(scenario.category)} · ${escapeHTML(scenario.initial.rhythm)}${isRunning ? ' · RUNNING' : ''}</span>
        </span>
        <span class="scenario-category">${escapeHTML(scenario.initial.rhythm)}</span>
      </div>`;
  }).join('') || '<div class="empty-inline">No scenarios in this category.</div>';
}

function selectScenario(id) {
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) return;
  ui.selectedScenarioId = id;
  renderScenarioList();
  refreshScenarioDetail();
}

function getSelectedScenario() {
  return SCENARIOS.find((item) => item.id === ui.selectedScenarioId) || SCENARIOS[0] || null;
}

function refreshScenarioDetail() {
  const scenario = getSelectedScenario();
  if (!scenario) return;
  const active = store.sim.scenario.id === scenario.id;
  const state = active ? store.sim.scenario : {
    status: 'idle', elapsed: 0, instructions: scenario.instructions,
    notes: scenario.instructorNotes, outcomes: scenario.outcomes,
  };
  $('scenarioDetailEmpty').classList.add('is-hidden');
  $('scenarioDetailContent').classList.remove('is-hidden');
  setText('scenarioDetailCategory', scenario.category.toUpperCase());
  setText('scenarioDetailName', scenario.name);
  setText('scenarioDetailDescription', scenario.description);
  setText('scenarioDetailStatus', String(state.status || 'idle').toUpperCase());
  setText('scenarioDetailElapsed', formatDuration(state.elapsed || 0));
  setText('scenarioDetailRhythm', RHYTHM_LABELS[scenario.initial.rhythm] || scenario.initial.rhythm);
  setText('scenarioDetailDuration', `${scenario.duration || 0}s`);
  setText('scenarioDetailInstructions', scenario.instructions);
  setText('scenarioDetailNotes', scenario.instructorNotes);
  const outcomes = $('scenarioDetailOutcomes');
  if (outcomes) outcomes.innerHTML = scenario.outcomes.map((outcome) => `<li>${escapeHTML(outcome)}</li>`).join('');
  const progress = scenario.duration ? clamp((state.elapsed || 0) / scenario.duration, 0, 1) : 0;
  const bar = $('scenarioProgressBar');
  if (bar) bar.style.width = `${progress * 100}%`;
  setText('scenarioProgressLabel', state.status === 'running'
    ? `${formatDuration(state.elapsed || 0)} elapsed · scenario running`
    : state.status === 'paused' ? `Paused at ${formatDuration(state.elapsed || 0)}`
      : state.status === 'completed' ? 'Scenario complete' : 'Not started');
  const running = active && state.status === 'running';
  const paused = active && state.status === 'paused';
  $('btnStartScenario').disabled = running || paused;
  $('btnPauseScenario').disabled = !running;
  $('btnResumeScenario').disabled = !paused;
  $('btnResetScenario').disabled = !active;
  $('btnStopScenario').disabled = !active;
}

function startSelectedScenario() {
  const scenario = getSelectedScenario();
  if (!scenario) return;
  const result = physiology.startScenario(scenario.id);
  if (result.ok) {
    toast(`Scenario started: ${scenario.name}`, 'info');
    refreshScenarioDetail();
    renderScenarioList();
    updateDefibUI();
  } else {
    toast(result.reason, 'warning');
  }
}

function pauseSelectedScenario() {
  const result = physiology.pauseScenario();
  if (!result.ok) toast(result.reason, 'warning');
  refreshScenarioDetail();
}

function resumeSelectedScenario() {
  const result = physiology.resumeScenario();
  if (!result.ok) toast(result.reason, 'warning');
  refreshScenarioDetail();
}

function resetSelectedScenario() {
  const result = physiology.resetScenario();
  if (!result.ok) toast(result.reason, 'warning');
  else toast('Scenario reset to deterministic initial state.', 'success');
  refreshScenarioDetail();
  renderScenarioList();
  updateDefibUI();
}

function stopSelectedScenario() {
  const result = physiology.stopScenario();
  if (!result.ok) toast(result.reason, 'warning');
  else toast('Scenario stopped.', 'info');
  refreshScenarioDetail();
  renderScenarioList();
}

/* ============================================================
   Instructor controls
   ============================================================ */

function setRangeOutput(id, value) {
  const output = $(id);
  if (output) output.textContent = String(value);
}

function syncInstructorControls(force = false) {
  const sim = store.sim;
  const setRange = (id, value) => {
    const element = $(id);
    if (!element) return;
    if (!force && document.activeElement === element) return;
    element.value = value;
  };
  setRange('instructorHR', Math.round(sim.heartRate));
  setText('instructorHRValue', Math.round(sim.heartRate));
  setRange('instructorPerfusion', Math.round(sim.perfusion * 100));
  setText('instructorPerfusionValue', Math.round(sim.perfusion * 100));
  setRange('instructorSpO2', Math.round(sim.spo2));
  setText('instructorSpO2Value', Math.round(sim.spo2));
  setRange('instructorRR', Math.round(sim.rr));
  setText('instructorRRValue', Math.round(sim.rr));
  setRange('instructorEtCO2', Math.round(sim.etco2));
  setText('instructorEtCO2Value', Math.round(sim.etco2));
  setRange('instructorOxygenation', Math.round(sim.oxygenation));
  setText('instructorOxygenationValue', Math.round(sim.oxygenation));
  setRange('instructorVentilation', Math.round(sim.ventilation * 100));
  setText('instructorVentilationValue', Math.round(sim.ventilation * 100));
  setRange('instructorTemp', sim.tempC.toFixed(1));
  setText('instructorTempValue', sim.tempC.toFixed(1));
  setValueIfIdle($('instructorBPSys'), Math.round(sim.bpSys));
  setValueIfIdle($('instructorBPDia'), Math.round(sim.bpDia));
  setValueIfIdle($('instructorRhythm'), sim.rhythm);
  const pulseSelect = $('instructorPulse');
  if (pulseSelect && document.activeElement !== pulseSelect) pulseSelect.value = String(sim.pulse);
  if (pulseSelect) pulseSelect.disabled = sim.rhythm === 'VF' || sim.rhythm === 'ASYSTOLE';
  setValueIfIdle($('instructorCapnoPattern'), sim.capnoPattern);
  setValueIfIdle($('instructorRespPattern'), sim.respiratoryPattern);
  const overrides = Object.entries(sim.overrides).filter(([, active]) => active).map(([key]) => key);
  $('overrideHR').classList.toggle('is-hidden', !sim.overrides.heartRate);
  const status = $('instructorStatus');
  if (status) {
    status.textContent = overrides.length
      ? `Manual overrides active: ${overrides.join(', ')}. Unmarked values remain physiologically derived.`
      : 'No manual overrides active. All values are derived from the simulated physiology.';
  }
}

function recordVitalChange(parameter, value, unit = '') {
  historyManager.add({
    type: 'VITAL_CHANGE',
    category: 'vitals',
    description: `Manual simulated vital change: ${parameter} = ${value}${unit ? ` ${unit}` : ''}.`,
    details: { parameter, value, unit, source: 'instructor override' },
  });
}

function bindInstructor() {
  const bindRange = (id, outputId, callback, scale = 1, changeLabel = null, unit = '') => {
    const slider = $(id);
    if (!slider) return;
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      setText(outputId, scale === 1 ? Math.round(value) : value.toFixed(1));
      callback(value);
    });
    if (changeLabel) {
      slider.addEventListener('change', () => {
        recordVitalChange(changeLabel, slider.value, unit);
      });
    }
  };

  bindRange('instructorHR', 'instructorHRValue', (value) => physiology.setManualOverride('heartRate', value), 1, 'Heart rate', 'bpm');
  bindRange('instructorPerfusion', 'instructorPerfusionValue', (value) => physiology.setManualOverride('perfusion', value / 100), 1, 'Perfusion', '%');
  bindRange('instructorSpO2', 'instructorSpO2Value', (value) => physiology.setManualOverride('spo2', value), 1, 'SpO₂', '%');
  bindRange('instructorRR', 'instructorRRValue', (value) => physiology.setManualOverride('rr', value), 1, 'Respiratory rate', '/min');
  bindRange('instructorEtCO2', 'instructorEtCO2Value', (value) => physiology.setManualOverride('etco2', value), 1, 'EtCO₂', 'mmHg');
  bindRange('instructorOxygenation', 'instructorOxygenationValue', (value) => physiology.setManualOverride('oxygenation', value), 1, 'Oxygenation state', '%');
  bindRange('instructorVentilation', 'instructorVentilationValue', (value) => physiology.setManualOverride('ventilation', value / 100), 1, 'Ventilation state', '%');
  const tempSlider = $('instructorTemp');
  if (tempSlider) {
    tempSlider.addEventListener('input', () => {
      const value = Number(tempSlider.value);
      setText('instructorTempValue', value.toFixed(1));
      physiology.setManualOverride('temperature', value);
    });
    tempSlider.addEventListener('change', () => {
      recordVitalChange('Temperature', Number(tempSlider.value).toFixed(1), '°C');
    });
  }

  bind('instructorRhythm', 'change', (event) => {
    const result = physiology.setRhythm(event.target.value);
    if (!result) toast('Unable to apply rhythm.', 'warning');
    syncInstructorControls();
  });
  bind('instructorPulse', 'change', (event) => {
    const result = physiology.setManualOverride('pulse', event.target.value === 'true');
    if (!result.ok) toast(result.reason, 'warning');
    else recordVitalChange('Pulse state', event.target.value === 'true' ? 'present' : 'absent');
    syncInstructorControls();
  });
  bind('btnApplyBP', 'click', () => {
    const sys = Number($('instructorBPSys').value);
    const dia = Number($('instructorBPDia').value);
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia < 0 || dia >= sys) {
      toast('Enter valid systolic and diastolic pressures with DIA below SYS.', 'warning');
      return;
    }
    const result = physiology.setManualOverride('bp', { sys, dia });
    if (!result.ok) toast(result.reason, 'warning');
    else {
      recordVitalChange('NIBP', `${Math.round(sys)}/${Math.round(dia)}`, 'mmHg');
      toast(`Simulated pressure set to ${Math.round(sys)}/${Math.round(dia)} mmHg.`, 'success');
    }
  });
  bind('instructorCapnoPattern', 'change', (event) => {
    physiology.setCapnoPattern(event.target.value);
    recordVitalChange('Capnogram pattern', event.target.value);
    toast(`Capnogram pattern: ${event.target.selectedOptions[0].textContent}.`, 'info');
  });
  bind('instructorRespPattern', 'change', (event) => {
    physiology.setRespiratoryPattern(event.target.value);
    recordVitalChange('Respiratory pattern', event.target.value);
    toast(`Respiratory pattern: ${event.target.selectedOptions[0].textContent}.`, 'info');
  });
  bind('btnClearOverrides', 'click', () => {
    physiology.clearManualOverride();
    syncInstructorControls(true);
    toast('Manual overrides cleared; derived physiology resumed.', 'success');
  });
  bind('btnRosc', 'click', () => {
    const result = physiology.applyRosc({ trigger: 'instructor' });
    if (!result.ok) toast(result.reason, 'warning');
    else toast(result.message, 'success');
  });
  bind('btnRestoreBaseline', 'click', () => {
    confirmAction(
      'Restore patient baseline',
      'Restore the active patient to the saved baseline? Scenario, CPR, pacing, alarm and device transient states will be reset.',
      () => {
        patientManager.resetActiveBaseline();
        toast('Patient baseline restored.', 'success');
      },
      'RESTORE BASELINE',
    );
  });
}

/* ============================================================
   CPR
   ============================================================ */

function toggleCPR() {
  if (store.sim.cpr.active) {
    physiology.stopCPR();
    audioManager.stopCPRMetronome();
    toast('Simulated CPR stopped.', 'info');
  } else {
    physiology.startCPR();
    toast('Simulated CPR started. Compression simulation is software-only.', 'warning');
  }
  refreshCPRUI();
}

function refreshCPRUI() {
  const cpr = store.sim.cpr;
  const activeLabel = cpr.active ? (cpr.paused ? 'CPR PAUSED' : 'CPR ACTIVE') : 'CPR IDLE';
  setText('cprStripStatus', activeLabel);
  $('cprStripStatus').className = `cpr-status ${cpr.active ? (cpr.paused ? 'is-paused' : 'is-active') : ''}`;
  setText('cprStripRate', Math.round(cpr.rate));
  setText('cprStripDepth', cpr.depth.toFixed(1));
  setText('cprStripCount', cpr.compressions);
  setText('cprStripVent', cpr.ventilations);
  setText('cprStripQuality', cpr.active ? `${cpr.quality}%` : '--');
  const quickButton = $('btnQuickCprToggle');
  if (quickButton) quickButton.textContent = cpr.active ? 'STOP CPR' : 'START CPR';
  setText('cprModalStatus', activeLabel);
  setText('cprCompressionCount', cpr.compressions);
  setText('cprVentilationCount', cpr.ventilations);
  setText('cprQuality', cpr.active ? `${cpr.quality}%` : '--');
  setText('cprElapsed', formatDuration(cpr.elapsed));
  setText('cprPauseTime', formatElapsed(cpr.pauseSeconds));
  setText('cprRateDisplay', `${Math.round(cpr.rate)} /min`);
  setText('cprFeedback', cpr.feedback);
  $('cprPulseVisual').classList.toggle('is-active', cpr.active && !cpr.paused);
  $('btnCprToggle').textContent = cpr.active ? 'STOP CPR' : 'START CPR';
  const pauseButton = $('btnCprPause');
  if (pauseButton) {
    pauseButton.textContent = cpr.paused ? 'RESUME COMPRESSIONS' : 'PAUSE COMPRESSIONS';
    pauseButton.disabled = !cpr.active;
  }
  const rateSlider = $('cprRate');
  if (rateSlider && document.activeElement !== rateSlider) rateSlider.value = cpr.rate;
  const depthSlider = $('cprDepth');
  if (depthSlider && document.activeElement !== depthSlider) depthSlider.value = cpr.depth;
  setText('cprRateValue', Math.round(cpr.rate));
  setText('cprDepthValue', cpr.depth.toFixed(1));
  const metronome = $('cprMetronome');
  if (metronome && document.activeElement !== metronome) metronome.checked = cpr.metronome;
  renderCPRHistory();
  const metronomeKey = `${cpr.active}:${cpr.paused}:${cpr.rate}:${cpr.metronome}:${store.settings.audioAlerts}`;
  if (metronomeKey !== ui.lastCprMetronomeKey) {
    ui.lastCprMetronomeKey = metronomeKey;
    if (cpr.active && !cpr.paused) {
      audioManager.setCPRMetronome(true, cpr.rate, { metronome: cpr.metronome });
    } else {
      audioManager.stopCPRMetronome();
    }
  }
}

function renderCPRHistory() {
  const entries = historyManager.entries.filter((entry) => entry.category === 'cpr').slice(0, 7);
  const signature = entries.map((entry) => entry.id).join('|');
  if (signature === ui.cprHistorySignature) return;
  ui.cprHistorySignature = signature;
  const list = $('cprEventList');
  if (!list) return;
  list.innerHTML = entries.length
    ? entries.map((entry) => `<li>${escapeHTML(entry.displayTime)} — ${escapeHTML(entry.description)}</li>`).join('')
    : '<li>No CPR events yet.</li>';
}

function bindCPR() {
  bind('btnQuickCprToggle', 'click', toggleCPR);
  bind('btnQuickCpr', 'click', () => openModal('cpr'));
  bind('btnCPR', 'click', () => openModal('cpr'));
  bind('btnCprToggle', 'click', toggleCPR);
  bind('btnCprPause', 'click', () => {
    if (!store.sim.cpr.active) {
      toast('Start CPR before pausing compressions.', 'warning');
      return;
    }
    physiology.setCPRPaused(!store.sim.cpr.paused);
    refreshCPRUI();
  });
  bind('btnCprVentilate', 'click', () => {
    const result = physiology.recordVentilation();
    if (!result.ok) toast(result.reason, 'warning');
    refreshCPRUI();
  });
  bind('btnCprCompression', 'click', () => {
    const result = physiology.recordManualCompression();
    if (!result.ok) toast(result.reason, 'warning');
    refreshCPRUI();
  });
  bind('cprRate', 'input', (event) => {
    physiology.setCPRParameters({ rate: Number(event.target.value) });
    refreshCPRUI();
  });
  bind('cprDepth', 'input', (event) => {
    physiology.setCPRParameters({ depth: Number(event.target.value) });
    refreshCPRUI();
  });
  bind('cprMetronome', 'change', (event) => {
    physiology.setCPRParameters({ metronome: event.target.checked });
    ui.lastCprMetronomeKey = '';
    refreshCPRUI();
  });
}

/* ============================================================
   Alarm management UI
   ============================================================ */

function renderAlarmGroupToggles() {
  const container = $('alarmGroupToggles');
  if (!container) return;
  const toggles = store.settings.alarmToggles;
  container.innerHTML = Object.entries(ALARM_GROUP_LABELS).map(([key, label]) => `
    <label class="toggle-row"><input type="checkbox" data-alarm-group="${key}" ${toggles[key] !== false ? 'checked' : ''}><span>${label}</span></label>
  `).join('');
  for (const checkbox of $$('[data-alarm-group]', container)) {
    checkbox.addEventListener('change', () => {
      settingsManager.setAlarmToggle(checkbox.dataset.alarmGroup, checkbox.checked);
    });
  }
}

function renderAlarmLimits() {
  const body = $('alarmLimitRows');
  if (!body) return;
  body.innerHTML = Object.entries(store.settings.alarmLimits).map(([key, limits]) => `
    <tr data-alarm-limit="${key}">
      <td>${escapeHTML(ALARM_LIMIT_LABELS[key] || key)}</td>
      <td><input type="number" data-limit-low="${key}" value="${limits.low}" step="1"></td>
      <td><input type="number" data-limit-high="${key}" value="${limits.high}" step="1"></td>
      <td><input type="checkbox" data-limit-enabled="${key}" ${limits.enabled ? 'checked' : ''}></td>
    </tr>`).join('');
  for (const input of $$('[data-limit-low], [data-limit-high]', body)) {
    input.addEventListener('change', () => {
      const key = input.dataset.limitLow || input.dataset.limitHigh;
      const row = input.closest('tr');
      const low = Number(row?.querySelector('[data-limit-low]')?.value);
      const high = Number(row?.querySelector('[data-limit-high]')?.value);
      const result = settingsManager.setAlarmLimit(key, low, high);
      if (result && result.ok === false) {
        toast(result.reason, 'warning');
        renderAlarmLimits();
      }
    });
  }
  for (const checkbox of $$('[data-limit-enabled]', body)) {
    checkbox.addEventListener('change', () => {
      store.updateAlarmLimit(checkbox.dataset.limitEnabled, { enabled: checkbox.checked });
    });
  }
}

function syncAlarmVolumeControl() {
  const volume = $('alarmVolume');
  if (volume && document.activeElement !== volume) volume.value = Math.round(store.settings.alarmVolume * 100);
  setText('alarmVolumeValue', Math.round(store.settings.alarmVolume * 100));
}

function renderAlarmBanner(payload) {
  const banner = $('alarmBanner');
  if (!banner) return;
  const highest = payload.highest;
  const audibleSilenced = payload.silenced || Date.now() < store.sim.alarmSilenceUntil;
  const activeCount = payload.alarms.length;
  const topAlarm = $('topAlarmState');
  const topAlarmText = $('topAlarmText');
  if (!highest) {
    banner.classList.add('is-hidden');
    banner.classList.remove('is-silenced');
    if (topAlarm) {
      topAlarm.className = 'alarm-status-pill';
      topAlarmText.textContent = 'NO ALARM';
    }
  } else {
    banner.classList.remove('is-hidden');
    banner.dataset.priority = highest.priority;
    $('alarmBannerPriority').textContent = highest.priority.toUpperCase();
    $('alarmBannerTitle').textContent = highest.title;
    $('alarmBannerMessage').textContent = highest.message;
    $('alarmBannerCount').textContent = `${activeCount} ACTIVE`;
    banner.classList.toggle('is-silenced', audibleSilenced);
    $('btnAckAlarm').disabled = payload.alarms.every((alarm) => alarm.acknowledged);
    $('btnSilenceAlarm').textContent = audibleSilenced ? 'SILENCED' : 'SILENCE 120s';
    if (topAlarm) {
      topAlarm.className = `alarm-status-pill has-${highest.priority}${audibleSilenced ? ' is-silenced' : ''}`;
      topAlarmText.textContent = highest.priority === 'critical' ? 'CRITICAL' : highest.priority === 'warning' ? 'WARNING' : 'TECHNICAL';
    }
  }
  const activeCountEl = $('activeAlarmCount');
  if (activeCountEl) activeCountEl.textContent = `${activeCount} ACTIVE`;
  const liveDot = $('patientLiveDot');
  if (liveDot) liveDot.classList.toggle('is-critical', payload.alarms.some((alarm) => alarm.priority === 'critical'));
}

function renderActiveAlarms(payload) {
  const container = $('activeAlarmList');
  if (!container) return;
  const alarms = payload.alarms || [];
  if (!alarms.length) {
    container.innerHTML = '<div class="empty-inline">No active alarms. Audible and visual annunciation clear.</div>';
    return;
  }
  container.innerHTML = alarms.map((alarm) => `
    <div class="active-alarm" data-priority="${alarm.priority}">
      <div class="active-alarm-info">
        <div class="active-alarm-title">${escapeHTML(alarm.title)}<span class="active-alarm-priority">${alarm.priority.toUpperCase()}</span></div>
        <div class="active-alarm-message">${escapeHTML(alarm.message)}</div>
        <div class="active-alarm-meta">${escapeHTML(alarm.parameter)}${alarm.value !== undefined ? ` · ${escapeHTML(String(alarm.value))}` : ''} · since ${new Date(alarm.since).toLocaleTimeString()}${alarm.acknowledged ? ' · ACKNOWLEDGED' : ''}</div>
      </div>
      <div class="active-alarm-actions">
        ${alarm.acknowledged ? '<span class="active-alarm-acked">ACK</span>' : `<button type="button" class="compact-button" data-ack-alarm="${escapeHTML(alarm.id)}">ACK</button>`}
      </div>
    </div>`).join('');
  for (const button of $$('[data-ack-alarm]', container)) {
    button.addEventListener('click', () => {
      alarmEngine.acknowledge(button.dataset.ackAlarm);
    });
  }
}

function handleAlarmsChanged(payload) {
  ui.alarmPayload = payload;
  audioManager.setAlarms(payload);
  const signature = `${(payload.alarms || []).map((alarm) => `${alarm.id}:${alarm.priority}:${alarm.acknowledged}:${alarm.escalated}`).join('|')}|${payload.silenced}`;
  if (signature !== ui.alarmSignature) {
    ui.alarmSignature = signature;
    renderAlarmBanner(payload);
    if (ui.activeModal === 'alarms') renderActiveAlarms(payload);
    updateVitalAlarmClasses(payload);
    updatePatientContext();
  }
  if (ui.activeModal === 'alarms') {
    const count = $('activeAlarmCount');
    if (count) count.textContent = `${payload.alarms.length} ACTIVE`;
  }
}

function updateVitalAlarmClasses(payload) {
  const parameters = new Set((payload.alarms || []).map((alarm) => alarm.parameter));
  const map = [
    ['hr', ['HR']],
    ['spo2', ['SpO₂']],
    ['nibp', ['NIBP', 'SYS', 'DIA', 'MAP']],
    ['rr', ['RR', 'Resp']],
    ['etco2', ['EtCO₂']],
    ['temp', ['TEMP']],
  ];
  for (const [cardName, keys] of map) {
    const card = document.querySelector(`[data-vital="${cardName}"]`);
    if (!card) continue;
    card.classList.toggle('is-alarm', keys.some((key) => parameters.has(key)));
  }
}

function bindAlarms() {
  bind('btnAckAlarm', 'click', () => alarmEngine.acknowledgeAll());
  bind('btnSilenceAlarm', 'click', () => {
    alarmEngine.silence(120);
    toast('Audible alarms silenced for 120 seconds. Visual alarms remain active.', 'warning');
  });
  bind('btnAcknowledgeAll', 'click', () => {
    const changed = alarmEngine.acknowledgeAll();
    toast(changed ? 'Active alarms acknowledged. Underlying conditions remain.' : 'No unacknowledged alarms.', changed ? 'success' : 'info');
  });
  bind('btnSilenceAll', 'click', () => {
    alarmEngine.silence(120);
    toast('Audible alarms silenced for 120 seconds.', 'warning');
  });
  bind('alarmVolume', 'input', (event) => {
    const value = Number(event.target.value);
    setText('alarmVolumeValue', value);
    settingsManager.setAlarmVolume(value / 100);
    audioManager.updateVolume();
  });
  bind('btnAudioTest', 'click', async () => {
    await audioManager.ensureContext();
    audioManager.tone({ frequency: 880, duration: 0.18, gain: 0.25 });
    audioManager.tone({ frequency: 660, duration: 0.2, gain: 0.2, delay: 0.24 });
    audioManager.tone({ frequency: 988, duration: 0.2, gain: 0.22, delay: 0.48 });
    toast('Simulated alarm audio test.', 'info');
  });
}

/* ============================================================
   ECG settings and 12-lead
   ============================================================ */

function syncECGSettings() {
  const sim = store.sim;
  setValueIfIdle($('ecgRhythmSelect'), sim.rhythm);
  setValueIfIdle($('ecgLeadCount'), String(sim.ecg.leadCount));
  setValueIfIdle($('ecgLeadSelect'), sim.ecg.lead);
  setValueIfIdle($('ecgSweepSelect'), String(store.settings.sweepSpeed));
  setValueIfIdle($('ecgGainSelect'), String(store.settings.ecgGain));
  setValueIfIdle($('ecgGridSelect'), String(store.settings.showGrid));
  setValueIfIdle($('ecgNoise'), Math.round(sim.ecg.noise * 1000));
  setText('ecgNoiseValue', (sim.ecg.noise * 100).toFixed(1));
  setValueIfIdle($('ecgArtifact'), Math.round(sim.ecg.artifact * 100));
  setText('ecgArtifactValue', Math.round(sim.ecg.artifact * 100));
  setValueIfIdle($('ecgWander'), Math.round(sim.ecg.baselineWander * 100));
  setText('ecgWanderValue', Math.round(sim.ecg.baselineWander * 100));
  setCheckedIfIdle($('ecgLeadOff'), sim.ecg.leadOff);
}

function bindECGSettings() {
  bind('ecgRhythmSelect', 'change', (event) => {
    const applied = physiology.setRhythm(event.target.value);
    if (!applied) toast('Unable to apply selected rhythm.', 'warning');
    updateWaveMeta();
  });
  bind('ecgLeadCount', 'change', (event) => {
    store.sim.ecg.leadCount = [3, 5, 12].includes(Number(event.target.value)) ? Number(event.target.value) : 5;
    updateWaveMeta();
    store.emit('physiology:ecg-config-changed');
  });
  bind('ecgLeadSelect', 'change', (event) => {
    store.sim.ecg.lead = event.target.value;
    updateWaveMeta();
  });
  bind('ecgSweepSelect', 'change', (event) => {
    settingsManager.setSweepSpeed(event.target.value);
    updateWaveMeta();
  });
  bind('ecgGainSelect', 'change', (event) => {
    settingsManager.setECGGain(event.target.value);
    updateWaveMeta();
  });
  bind('ecgGridSelect', 'change', (event) => {
    store.updateSettings({ showGrid: event.target.value === 'true' });
  });
  bind('ecgNoise', 'input', (event) => {
    const value = Number(event.target.value);
    store.sim.ecg.noise = value / 1000;
    setText('ecgNoiseValue', (value / 10).toFixed(1));
  });
  bind('ecgArtifact', 'input', (event) => {
    store.sim.ecg.artifact = Number(event.target.value) / 100;
    setText('ecgArtifactValue', event.target.value);
  });
  bind('ecgWander', 'input', (event) => {
    store.sim.ecg.baselineWander = Number(event.target.value) / 100;
    setText('ecgWanderValue', event.target.value);
  });
  bind('ecgLeadOff', 'change', (event) => {
    physiology.setLeadOff(event.target.checked);
    toast(event.target.checked ? 'ECG lead-off simulated.' : 'ECG leads reconnected.', event.target.checked ? 'warning' : 'success');
  });
  bind('btnOpenTwelveLeadModal', 'click', () => openModal('twelve'));
  bind('btn12Lead', 'click', () => openModal('twelve'));
  bind('btnOpen12LeadTop', 'click', () => openModal('twelve'));

  bind('twelveLeadGain', 'change', (event) => {
    twelveLeadECG.setGain(Number(event.target.value));
    setText('twelveLeadGainLabel', `×${Number(event.target.value).toFixed(1)}`);
  });
  bind('btnTwelveLeadRefresh', 'click', () => {
    twelveLeadECG.open();
    updateTwelveLeadMeta();
    toast('12-lead simulation refreshed.', 'info');
  });
  bind('btnTwelveLeadRecord', 'click', () => twelveLeadECG.record());
  bind('btnTwelveLeadPrint', 'click', () => twelveLeadECG.printReport());
}

function updateTwelveLeadMeta() {
  const patient = patientManager.active;
  const sim = store.sim;
  setText('twelveLeadPatient', patient?.name || '--');
  setText('twelveLeadPatientId', patient?.id || '--');
  setText('twelveLeadHR', `${sim.heartRate ? Math.round(sim.heartRate) : '--'} bpm`);
  setText('twelveLeadRhythm', RHYTHM_LABELS[sim.rhythm] || sim.rhythm);
  setText('twelveLeadTimestamp', formatDateTime(new Date()));
}

/* ============================================================
   Sensors and NIBP configuration
   ============================================================ */

function renderSensorConfig() {
  const container = $('sensorConfigGrid');
  if (!container) return;
  const sim = store.sim;
  container.innerHTML = SENSOR_KEYS.map((key) => {
    const connected = Boolean(sim.sensors[key]);
    const monitored = sim.monitoring?.[key] !== false;
    let status = 'NOT MONITORED';
    if (connected) status = `CONNECTED · ${Math.round((sim.signal[key] ?? 1) * 100)}% SIGNAL`;
    else if (monitored) status = 'DISCONNECTED — TECHNICAL ALARM';
    return `
      <div class="sensor-config-card ${connected ? 'is-connected' : monitored ? 'is-off' : ''}">
        <div class="sensor-config-main">
          <div class="sensor-config-name">${escapeHTML(SENSOR_LABELS[key] || key)}</div>
          <div class="sensor-config-status">${status}</div>
        </div>
        <label class="sensor-switch" title="Toggle simulated sensor connection">
          <input type="checkbox" data-sensor-toggle="${key}" ${connected ? 'checked' : ''}>
          <span></span>
        </label>
      </div>`;
  }).join('');
  for (const checkbox of $$('[data-sensor-toggle]', container)) {
    checkbox.addEventListener('change', () => {
      const result = physiology.setSensor(checkbox.dataset.sensorToggle, checkbox.checked);
      if (!result.ok) toast(result.reason, 'warning');
      else toast(`${SENSOR_LABELS[checkbox.dataset.sensorToggle] || checkbox.dataset.sensorToggle} ${checkbox.checked ? 'connected' : 'disconnected'}.`, checkbox.checked ? 'success' : 'warning');
      renderSensorConfig();
    });
  }
  setValueIfIdle($('nibpIntervalSelect'), String(store.settings.nibpInterval));
  const qualityContainer = $('sensorQualityControls');
  if (qualityContainer) {
    const qualityKeys = ['ecg', 'spo2', 'resp', 'capno', 'ibp'];
    qualityContainer.innerHTML = qualityKeys.map((key) => `
      <label class="sensor-quality-row">
        <span>${escapeHTML(SENSOR_LABELS[key]?.split(' ')[0] || key.toUpperCase())}</span>
        <input type="range" min="0" max="100" step="1" value="${Math.round((sim.signal[key] ?? 1) * 100)}" data-signal-quality="${key}">
        <output id="signalQuality${key}">${Math.round((sim.signal[key] ?? 1) * 100)}%</output>
      </label>`).join('');
    for (const slider of $$('[data-signal-quality]', qualityContainer)) {
      slider.addEventListener('input', () => {
        const key = slider.dataset.signalQuality;
        const value = Number(slider.value);
        physiology.setSignalQuality(key, value / 100);
        setText(`signalQuality${key}`, `${value}%`);
      });
      slider.addEventListener('change', () => {
        historyManager.add({
          type: 'SIGNAL_QUALITY_CHANGE',
          category: 'sensor',
          description: `Simulated ${SENSOR_LABELS[slider.dataset.signalQuality] || slider.dataset.signalQuality} signal quality set to ${slider.value}%.`,
          details: { sensor: slider.dataset.signalQuality, quality: Number(slider.value) },
        });
      });
    }
  }
  updateSensorNibpStatus();
}

function updateSensorNibpStatus() {
  const sim = store.sim;
  const state = sim.nibp;
  let status = 'READY';
  if (!sim.sensors.nibp) status = 'DISCONNECTED';
  else if (state.measuring) status = 'MEASURING';
  else if (state.failed) status = 'LAST MEASUREMENT FAILED';
  else if (state.cuffError) status = 'CUFF ERROR';
  setText('sensorNibpStatus', status);
  let detail = 'Next measurement: manual';
  if (state.measuring) detail = `In progress — ${Math.round(state.progress * 100)}%`;
  else if (store.settings.nibpInterval > 0) detail = `Next automatic measurement in ${formatDuration(state.countdown)}`;
  else detail = 'Automatic interval disabled';
  setText('sensorNibpCountdown', detail);
}

function bindSensors() {
  bind('btnOpenSensorsFromRail', 'click', () => openModal('sensors'));
  bind('nibpIntervalSelect', 'change', (event) => {
    settingsManager.setNIBPInterval(Number(event.target.value));
    updateSensorNibpStatus();
  });
  bind('btnMeasureNIBP', 'click', () => {
    const result = physiology.requestNIBP();
    if (!result.ok) toast(result.reason, 'warning');
    else toast('Intermittent NIBP measurement started.', 'info');
    updateSensorNibpStatus();
  });
}

/* ============================================================
   Device settings
   ============================================================ */

function syncSettingsControls() {
  const settings = store.settings;
  setValueIfIdle($('settingTheme'), settings.screenTheme);
  setValueIfIdle($('settingLanguage'), settings.language);
  setValueIfIdle($('settingBrightness'), settings.brightness);
  setText('settingBrightnessValue', settings.brightness);
  const speeds = [0.5, 1, 2, 4];
  const speedIndex = speeds.indexOf(settings.simulationSpeed);
  setValueIfIdle($('settingSpeed'), speedIndex >= 0 ? speedIndex : 1);
  setText('settingSpeedValue', settings.simulationSpeed.toFixed(1));
  setValueIfIdle($('settingTempUnit'), settings.tempUnit);
  setValueIfIdle($('settingPressureUnit'), settings.pressureUnit);
  setValueIfIdle($('settingAlarmVolume'), Math.round(settings.alarmVolume * 100));
  setText('settingAlarmVolumeValue', Math.round(settings.alarmVolume * 100));
  setValueIfIdle($('settingBattery'), Math.round(store.sim.defib.battery));
  setText('settingBatteryValue', Math.round(store.sim.defib.battery));
  setCheckedIfIdle($('settingShowGrid'), settings.showGrid);
  setCheckedIfIdle($('settingAudioAlerts'), settings.audioAlerts);
  setText('lastSavedLabel', store.state.ui.lastSaved ? formatDateTime(new Date(store.state.ui.lastSaved)) : '—');
  let storage = 'READY';
  try {
    const key = '__gytech_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
  } catch {
    storage = 'UNAVAILABLE';
  }
  setText('storageStatusLabel', storage);
  setText('versionLabel', APP_VERSION);
}

function bindSettings() {
  bind('settingTheme', 'change', (event) => settingsManager.setTheme(event.target.value));
  bind('settingLanguage', 'change', (event) => {
    settingsManager.setLanguage(event.target.value);
    toast(event.target.value === 'es' ? 'Idioma de la interfaz: Español.' : 'Interface language: English.', 'info');
  });
  bind('settingBrightness', 'input', (event) => {
    const value = Number(event.target.value);
    setText('settingBrightnessValue', value);
    settingsManager.setBrightness(value);
  });
  bind('settingSpeed', 'input', (event) => {
    const speeds = [0.5, 1, 2, 4];
    const value = speeds[Number(event.target.value)] || 1;
    setText('settingSpeedValue', value.toFixed(1));
    settingsManager.setSimulationSpeed(value);
  });
  bind('settingTempUnit', 'change', (event) => {
    settingsManager.setTempUnit(event.target.value);
    updateUnitLabels();
    refreshUI();
  });
  bind('settingPressureUnit', 'change', (event) => {
    settingsManager.setPressureUnit(event.target.value);
    updateUnitLabels();
    refreshUI();
  });
  bind('settingAlarmVolume', 'input', (event) => {
    const value = Number(event.target.value);
    setText('settingAlarmVolumeValue', value);
    settingsManager.setAlarmVolume(value / 100);
    audioManager.updateVolume();
  });
  bind('settingBattery', 'input', (event) => {
    const value = Number(event.target.value);
    setText('settingBatteryValue', value);
    defibrillator.setBattery(value);
    refreshUI();
  });
  bind('settingShowGrid', 'change', (event) => {
    store.updateSettings({ showGrid: event.target.checked });
  });
  bind('settingAudioAlerts', 'change', async (event) => {
    store.updateSettings({ audioAlerts: event.target.checked });
    if (event.target.checked) {
      await audioManager.ensureContext();
      audioManager.setAlarms(ui.alarmPayload);
    } else {
      audioManager.stopAlarmLoop();
      audioManager.stopCPRMetronome();
    }
    audioManager.emitStatus();
  });
  bind('btnResetSettings', 'click', () => {
    confirmAction(
      'Reset settings to defaults',
      'Restore all display, unit, alarm-limit and simulation preferences to defaults? Patient profiles and event history are not deleted.',
      () => {
        settingsManager.resetToDefaults();
        syncSettingsControls();
        syncAlarmVolumeControl();
        updateUnitLabels();
        refreshUI();
      },
      'RESET DEFAULTS',
    );
  });
}

function updateUnitLabels() {
  const pressureUnit = pressureUnitLabel(store.settings.pressureUnit);
  const tempUnit = tempUnitLabel(store.settings.tempUnit);
  const nibpUnit = document.querySelector('.vital-nibp .vital-unit');
  if (nibpUnit) nibpUnit.textContent = pressureUnit;
  for (const unit of $$('.vital-mini .mini-unit')) unit.textContent = pressureUnit;
  for (const trace of ['art', 'cvp', 'pa', 'icp']) {
    const card = document.querySelector(`[data-trace="${trace}"]`);
    const unit = card?.querySelector('.wave-unit');
    if (unit) unit.textContent = pressureUnit;
  }
  setText('vitalTempUnit', tempUnit);
  setText('vitalTempUnitInline', tempUnit);
}

/* ============================================================
   Defibrillator UI
   ============================================================ */

function renderEnergyButtons(status) {
  const container = $('energyGrid');
  if (!container) return;
  const signature = `${status.mode}:${status.presets.join(',')}:${status.energy}:${status.machineState}`;
  if (signature === ui.energySignature) return;
  ui.energySignature = signature;
  if (!status.presets.length) {
    container.innerHTML = '<span class="field-note" style="grid-column:1/-1;padding:6px 2px;">No energy selection in this mode.</span>';
    return;
  }
  container.innerHTML = status.presets.map((energy) => `
    <button type="button" class="energy-button ${energy === status.energy ? 'is-selected' : ''}" data-energy="${energy}" ${['CHARGING', 'CHARGED', 'SHOCK_SIMULATION', 'POST_EVENT_ANALYSIS'].includes(status.machineState) ? 'disabled' : ''}>${energy} J</button>
  `).join('');
  for (const button of $$('[data-energy]', container)) {
    button.addEventListener('click', () => {
      const result = defibrillator.setEnergy(Number(button.dataset.energy));
      if (!result.ok) toast(result.reason, 'warning');
      updateDefibUI();
    });
  }
}

function updateDefibUI() {
  const status = defibrillator.getStatus();
  const sim = store.sim;
  for (const tab of $$('[data-defib-mode]')) {
    tab.classList.toggle('is-active', tab.dataset.defibMode === status.mode);
  }
  setText('defibScreenMode', `${status.modeLabel.toUpperCase()} MODE`);
  setText('defibScreenState', status.machineState.replaceAll('_', ' '));
  setText('defibBattery', `${Math.round(status.battery)}%`);
  setText('defibEnergyDisplay', status.mode === 'pacing' ? 'PACING' : status.mode === 'monitor' ? '—' : `${status.energy} J`);
  setText('defibPadsState', status.pads ? 'CONNECTED' : 'DISCONNECTED');
  setText('defibSyncState', status.sync ? (status.syncReady ? 'READY' : 'NO MARKER') : 'OFF');
  setText('defibStateLabel', status.machineState.replaceAll('_', ' '));
  $('defibPadsState').style.color = status.pads ? 'var(--normal)' : 'var(--critical)';
  $('defibSyncState').style.color = status.sync ? (status.syncReady ? 'var(--normal)' : 'var(--warning)') : 'var(--text-faint)';
  setText('chargePercent', `${Math.round(status.chargeProgress * 100)}%`);
  $('chargeProgressBar').style.width = `${status.chargeProgress * 100}%`;
  let chargeStatus = 'READY TO CHARGE';
  if (status.machineState === 'CHARGING') chargeStatus = 'CHARGING — SIMULATION';
  else if (status.machineState === 'CHARGED') chargeStatus = status.mode === 'aed' ? 'CHARGED — CONFIRM SAFETY' : 'CHARGED — READY';
  else if (status.machineState === 'DISARMING') chargeStatus = 'DISARMING';
  else if (status.machineState === 'SHOCK_SIMULATION') chargeStatus = 'SIMULATED SHOCK DELIVERED';
  else if (status.machineState === 'POST_EVENT_ANALYSIS') chargeStatus = 'POST-EVENT ANALYSIS';
  else if (status.machineState === 'ERROR') chargeStatus = 'DEVICE ERROR';
  else if (!status.pads) chargeStatus = 'PADS DISCONNECTED';
  setText('chargeStatusText', chargeStatus);
  renderEnergyButtons(status);

  const chargeButton = $('btnCharge');
  chargeButton.disabled = !status.canCharge;
  chargeButton.classList.toggle('is-ready', status.canCharge);
  $('btnDisarm').disabled = !status.canDisarm;
  const shockButton = $('btnShock');
  shockButton.disabled = !status.canShock;
  shockButton.classList.toggle('is-ready', status.canShock);
  setText('btnPadsToggle', status.pads ? 'PADS CONNECTED' : 'PADS DISCONNECTED');
  $('btnPadsToggle').classList.toggle('is-paid', status.pads);
  const syncButton = $('btnSyncToggle');
  setText('btnSyncToggle', status.sync ? 'SYNC ON' : 'SYNC OFF');
  syncButton.classList.toggle('is-on', status.sync);
  syncButton.disabled = status.mode !== 'sync';
  setText('defibLastEvent', status.lastEvent);
  setText('defibRhythmDisplay', (RHYTHM_LABELS[sim.rhythm] || sim.rhythm).toUpperCase());
  const classification = status.rhythmClassification;
  setText('defibClassification', classification.label.toUpperCase());
  $('defibClassification').style.color = classification.shockable ? 'var(--critical)' : 'var(--warning)';
  setText('deviceReadiness', status.readiness ? 'READY' : 'NOT READY');
  $('deviceReadiness').className = status.readiness ? '' : 'is-critical';
  setText('deviceRhythmClass', classification.label);
  $('deviceRhythmClass').className = classification.shockable ? 'is-critical' : '';
  setText('defibHR', physiology.getVitals().hr === null ? '---' : Math.round(physiology.getVitals().hr));
  $('defibColumn').classList.toggle('state-error', status.machineState === 'ERROR' || !status.pads);

  const aedPanel = $('defibAedPanel');
  const syncPanel = $('defibSyncPanel');
  const pacingPanel = $('defibPacingPanel');
  const monitorPanel = $('defibModeMonitorPanel');
  monitorPanel.classList.toggle('is-hidden', status.mode !== 'monitor');
  aedPanel.classList.toggle('is-hidden', status.mode !== 'aed');
  syncPanel.classList.toggle('is-hidden', status.mode !== 'sync');
  pacingPanel.classList.toggle('is-hidden', status.mode !== 'pacing');
  if (status.mode === 'manual') monitorPanel.classList.remove('is-hidden');
  if (status.mode === 'manual') {
    monitorPanel.querySelector('.panel-note strong').textContent = 'MANUAL DEFIBRILLATION';
    monitorPanel.querySelector('.panel-note span').textContent = 'Select energy, charge, confirm the simulated device state, then deliver software-only energy.';
  } else if (status.mode === 'monitor') {
    monitorPanel.querySelector('.panel-note strong').textContent = 'MONITOR MODE';
    monitorPanel.querySelector('.panel-note span').textContent = 'Therapy output disabled. Attach simulated pads and select a therapy mode to begin.';
  }

  if (status.mode === 'aed') {
    setText('aedAnnouncement', status.aed.announcement);
    $('aedProgressBar').style.width = `${Math.round(status.aed.progress * 100)}%`;
    setText('btnAedAnalyze', status.aed.analyzing ? `ANALYSING ${Math.round(status.aed.progress * 100)}%` : 'ANALYSE RHYTHM');
    $('btnAedAnalyze').disabled = !status.canAnalyze;
    const rec = $('aedRecommendation');
    if (status.aed.recommendation) {
      rec.classList.remove('is-hidden');
      const advised = status.aed.recommendation.shockAdvise;
      rec.classList.toggle('is-no-shock', !advised);
      setText('aedRecommendationLabel', advised ? 'SHOCK ADVISED' : 'NO SHOCK ADVISED');
      setText('aedRecommendationDetail', status.aed.recommendation.label);
    } else {
      rec.classList.add('is-hidden');
    }
    const safety = $('aedSafetyCheck');
    if (document.activeElement !== safety) safety.checked = status.aed.safetyConfirmed;
    safety.disabled = !(status.aed.recommendation?.shockAdvise) || status.machineState === 'SHOCK_SIMULATION';
  }

  if (status.mode === 'sync') {
    setText('syncReadyLabel', status.syncReady ? 'MARKER ACQUIRED' : 'NOT READY');
    $('syncReadyLabel').className = status.syncReady ? '' : 'is-warn';
    setText('syncModeLabel', status.sync ? 'ON' : 'OFF');
    $('syncModeLabel').className = status.sync ? '' : 'is-warn';
  }

  if (status.mode === 'pacing') {
    const pacing = status.pacing;
    setText('pacingCaptureStatus', pacing.active ? (pacing.mechanicalCapture ? 'CAPTURE' : pacing.electricalCapture ? 'ELECTRICAL ONLY' : 'NO CAPTURE') : 'IDLE');
    setText('pacingRateValue', Math.round(pacing.rate));
    setText('pacingOutputValue', Math.round(pacing.output));
    setText('pacingElectricalCapture', pacing.electricalCapture ? 'YES' : 'NO');
    setText('pacingMechanicalCapture', pacing.mechanicalCapture ? 'YES' : 'NO');
    $('pacingElectricalCapture').className = pacing.electricalCapture ? 'is-yes' : '';
    $('pacingMechanicalCapture').className = pacing.mechanicalCapture ? 'is-yes' : '';
    const rate = $('pacingRate');
    const output = $('pacingOutput');
    if (document.activeElement !== rate) rate.value = pacing.rate;
    if (document.activeElement !== output) output.value = pacing.output;
    $('btnPacingStart').textContent = pacing.active ? 'STOP PACING' : 'START PACING';
    $('btnPacingStart').disabled = !status.pads;
  }
  $('defibScreenOverlay').textContent = getDefibScreenOverlay(status);
  const syncMarkerState = status.mode === 'sync' && status.syncReady;
  $('defibSyncMarkers').classList.toggle('is-hidden', !syncMarkerState);
  updateDefibChecklist(status);
}

function getDefibScreenOverlay(status) {
  if (!status.pads) return 'PADS DISCONNECTED — THERAPY UNAVAILABLE';
  if (status.machineState === 'ERROR') return status.error || 'DEVICE ERROR';
  if (status.machineState === 'CHARGING') return `CHARGING ${Math.round(status.chargeProgress * 100)}%`;
  if (status.machineState === 'CHARGED') return status.mode === 'aed' ? 'CHARGED — CONFIRM SAFETY' : 'CHARGED — READY TO DELIVER';
  if (status.machineState === 'SHOCK_SIMULATION') return 'SIMULATED SHOCK DELIVERED';
  if (status.aed.analyzing) return `ANALYSING RHYTHM ${Math.round(status.aed.progress * 100)}%`;
  if (status.mode === 'sync' && !status.syncReady) return 'NO VALID SYNCHRONIZATION';
  if (status.mode === 'pacing' && status.pacing.active && !status.pacing.mechanicalCapture) return 'PACING — NO MECHANICAL CAPTURE';
  if (!store.sim.sensors.ecg || store.sim.ecg.leadOff) return 'ECG LEADS OFF';
  return '';
}

function drawDefibScreen() {
  const now = performance.now();
  if (now - ui.lastDefibDraw < 40) return;
  ui.lastDefibDraw = now;
  const canvas = $('defibWaveCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const width = rect.width;
  const height = rect.height;
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#040c0b';
  ctx.fillRect(0, 0, width, height);
  if (store.settings.showGrid) {
    ctx.strokeStyle = 'rgba(0,255,102,.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y <= height; y += 10) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,255,102,.1)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y <= height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  }
  const sim = store.sim;
  const trace = waveformEngine.traces.get('ecg');
  if (trace && trace.buffer.length > 2 && sim.sensors.ecg && !sim.ecg.leadOff) {
    const sampleRate = trace.sampleRate;
    const windowSeconds = 4;
    const visible = Math.min(trace.buffer.length, Math.floor(windowSeconds * sampleRate));
    const start = trace.buffer.length - visible;
    const stride = Math.max(1, Math.floor(visible / (width * 2)));
    const center = height * 0.54;
    const amplitude = height * 0.3 * (store.settings.ecgGain || 1);
    ctx.beginPath();
    for (let index = 0; index < visible; index += stride) {
      const x = width - ((visible - 1 - index) / Math.max(visible - 1, 1)) * width;
      const y = clamp(center - trace.buffer[start + index] * amplitude, -4, height + 4);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.1;
    ctx.shadowColor = 'rgba(0,255,102,.55)';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = 'rgba(255,48,48,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
  const status = defibrillator.getStatus();
  if (status.mode === 'sync' && status.syncReady) {
    const source = waveformEngine.ecgSource;
    const windowSeconds = 4;
    const markers = source.ventricularEvents
      .map((event) => event.r)
      .filter((time) => time <= source.time && time >= source.time - windowSeconds);
    ctx.fillStyle = '#ffb020';
    for (const time of markers) {
      const x = width - ((source.time - time) / windowSeconds) * width;
      ctx.fillRect(x - 1, height - 7, 2, 7);
      ctx.beginPath();
      ctx.moveTo(x, 3);
      ctx.lineTo(x - 3, 8);
      ctx.lineTo(x + 3, 8);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function bindDefibrillator() {
  for (const tab of $$('[data-defib-mode]')) {
    tab.addEventListener('click', () => {
      const result = defibrillator.setMode(tab.dataset.defibMode);
      if (!result.ok) toast(result.reason, 'warning');
      updateDefibUI();
    });
  }
  bind('btnCharge', 'click', () => {
    const result = defibrillator.charge();
    if (!result.ok) toast(result.reason, 'warning');
    else toast(`Simulated charge started at ${store.sim.defib.energy} J.`, 'info');
    updateDefibUI();
  });
  bind('btnDisarm', 'click', () => {
    const result = defibrillator.disarm('operator request');
    if (!result.ok) toast(result.reason, 'info');
    else toast('Simulated charge disarmed.', 'info');
    updateDefibUI();
  });
  bind('btnShock', 'click', () => {
    const result = defibrillator.deliverShock();
    if (!result.ok) {
      toast(result.reason, 'warning');
    } else {
      toast(`Simulated shock delivered. ${result.message || ''}`, 'critical', 5200);
    }
    updateDefibUI();
  });
  bind('btnPadsToggle', 'click', () => {
    const result = defibrillator.togglePads();
    toast(result.pads ? 'Simulated therapy pads connected.' : 'Simulated therapy pads disconnected. Charging blocked.', result.pads ? 'success' : 'warning');
    updateDefibUI();
  });
  bind('btnSyncToggle', 'click', () => {
    if (store.sim.defib.mode !== 'sync') {
      toast('Synchronization is available only in Sync Cardioversion mode.', 'info');
      return;
    }
    const result = defibrillator.setSyncEnabled(!store.sim.defib.sync);
    if (!result.ok) toast(result.reason, 'warning');
    updateDefibUI();
  });
  bind('btnAedAnalyze', 'click', () => {
    const result = defibrillator.startAEDAnalysis();
    if (!result.ok) toast(result.reason, 'warning');
    else toast('AED analysis started. Do not touch the simulated patient.', 'info');
    updateDefibUI();
  });
  bind('aedSafetyCheck', 'change', (event) => {
    const result = defibrillator.setAEDSafelyConfirmed(event.target.checked);
    if (!result.ok && event.target.checked) {
      toast(result.reason, 'warning');
      event.target.checked = false;
    }
    updateDefibUI();
  });
  bind('pacingRate', 'input', (event) => {
    defibrillator.setPacingRate(Number(event.target.value));
    updateDefibUI();
  });
  bind('pacingOutput', 'input', (event) => {
    defibrillator.setPacingOutput(Number(event.target.value));
    updateDefibUI();
  });
  bind('btnPacingStart', 'click', () => {
    const result = defibrillator.setPacingActive(!store.sim.defib.pacing.active);
    if (!result.ok) toast(result.reason, 'warning');
    else toast(store.sim.defib.pacing.active ? 'Simulated pacing started.' : 'Simulated pacing stopped.', store.sim.defib.pacing.active ? 'warning' : 'info');
    updateDefibUI();
  });
  bind('btnDefibSelfTest', 'click', () => {
    const result = defibrillator.selfTest();
    toast(result.passed ? 'Simulated defibrillator self-test passed.' : `Self-test findings: ${result.failures.join('; ')}`, result.passed ? 'success' : 'warning', 5000);
    if (ui.activeModal === 'diagnostics') renderDiagnostics();
  });
}

/* ============================================================
   History
   ============================================================ */

function renderHistory() {
  const body = $('historyTableBody');
  if (!body) return;
  const category = $('historyCategoryFilter')?.value || 'all';
  const query = $('historySearch')?.value || '';
  const entries = historyManager.getFiltered(category, query).slice(0, 500);
  body.innerHTML = entries.length
    ? entries.map((entry) => {
      const values = Object.entries(entry.details || {})
        .filter(([key]) => !['message', 'reason'].includes(key))
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' · ');
      return `
      <tr>
        <td>${escapeHTML(entry.displayTime)}</td>
        <td><span class="event-severity" data-severity="${escapeHTML(entry.severity || 'info')}"></span>${escapeHTML(entry.category)}</td>
        <td>${escapeHTML(entry.type)}</td>
        <td>${escapeHTML(entry.description)}</td>
        <td class="history-values">${escapeHTML(values || '—')}</td>
        <td>${escapeHTML(entry.patientName)}${entry.patientId ? `<br><small>${escapeHTML(entry.patientId)}</small>` : ''}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6"><div class="empty-inline">No events match the current filter.</div></td></tr>';
  setText('historySummary', `${historyManager.getFiltered(category, query).length} recorded events · simulation-only data${entries.length === 500 ? ' · showing latest 500' : ''}`);
}

function bindHistory() {
  bind('historyCategoryFilter', 'change', renderHistory);
  const search = $('historySearch');
  if (search) search.addEventListener('input', () => {
    clearTimeout(ui.historySearchTimer);
    ui.historySearchTimer = setTimeout(renderHistory, 120);
  });
  bind('btnExportHistory', 'click', () => {
    try {
      historyManager.exportCSV();
      toast('Event history exported as CSV.', 'success');
      renderHistory();
    } catch (error) {
      console.error('[GYTech PatientSim Pro] CSV export failed', error);
      toast('CSV export failed.', 'warning');
    }
  });
  bind('btnClearHistory', 'click', () => {
    confirmAction(
      'Clear simulation event history',
      'Clear all recorded simulation events from local storage? This action cannot be undone. Patient profiles and settings remain.',
      () => {
        historyManager.clear();
        renderHistory();
        toast('Event history cleared.', 'success');
      },
      'CLEAR HISTORY',
    );
  });
  bind('btnPrintReport', 'click', () => {
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) {
      toast('Popup blocked. Allow popups to print the simulation report.', 'warning');
      return;
    }
    popup.document.open();
    popup.document.write(historyManager.buildReportHTML());
    popup.document.close();
    historyManager.add({
      type: 'REPORT_PRINTED',
      category: 'system',
      description: 'Simulation event report generated for printing.',
      details: {},
    });
    toast('Simulation report opened for printing.', 'success');
  });
}

/* ============================================================
   Diagnostics
   ============================================================ */

function renderDiagnostics({ preserveOutput = false } = {}) {
  const components = $('diagnosticsComponents');
  const device = $('diagnosticsDevice');
  if (!components || !device) return;
  let storage = 'READY';
  try {
    localStorage.setItem('__gytech_diag__', '1');
    localStorage.removeItem('__gytech_diag__');
  } catch {
    storage = 'BLOCKED';
  }
  const waveformCount = waveformEngine.traces.size;
  const componentRows = [
    ['Simulation loop', simulation.running ? 'RUNNING' : 'STOPPED', simulation.running ? 'ok' : 'warn'],
    ['Physiology model', 'LOADED', 'ok'],
    ['Waveform engine', `${waveformCount} TRACES`, waveformCount >= 8 ? 'ok' : 'warn'],
    ['Alarm engine', `${alarmEngine.activeAlarms.length} ACTIVE`, alarmEngine.activeAlarms.length ? 'warn' : 'ok'],
    ['Audio engine', audioManager.unlocked ? 'UNLOCKED' : 'NEEDS USER INPUT', audioManager.unlocked ? 'ok' : 'warn'],
    ['Local storage', storage, storage === 'READY' ? 'ok' : 'error'],
    ['Patient profiles', `${store.state.patients.length} LOADED`, 'ok'],
    ['Event history', `${historyManager.entries.length} EVENTS`, 'ok'],
    ['Application version', APP_VERSION, 'ok'],
  ];
  components.innerHTML = componentRows.map(([label, value, state]) => `
    <div class="diagnostic-row"><span>${escapeHTML(label)}</span><b class="${state === 'warn' ? 'is-warn' : state === 'error' ? 'is-error' : ''}">${escapeHTML(value)}</b></div>
  `).join('');
  const status = defibrillator.getStatus();
  const deviceRows = [
    ['Mode', status.modeLabel, 'ok'],
    ['Finite state', status.machineState, status.machineState === 'ERROR' ? 'error' : 'ok'],
    ['Therapy pads', status.pads ? 'CONNECTED' : 'DISCONNECTED', status.pads ? 'ok' : 'warn'],
    ['Battery', `${Math.round(status.battery)}%`, status.battery > 20 ? 'ok' : 'warn'],
    ['Charge', status.charged ? `${status.energy} J CHARGED` : 'DISCHARGED', 'ok'],
    ['Synchronization', status.sync ? (status.syncReady ? 'READY' : 'NO MARKER') : 'OFF', status.sync && !status.syncReady ? 'warn' : 'ok'],
    ['Pacing', status.pacing.active ? `${status.pacing.rate} ppm` : 'OFF', 'ok'],
    ['Shock count', String(status.shockCount), 'ok'],
    ['External communication', 'NONE — SOFTWARE SIMULATOR', 'ok'],
  ];
  device.innerHTML = deviceRows.map(([label, value, state]) => `
    <div class="diagnostic-row"><span>${escapeHTML(label)}</span><b class="${state === 'warn' ? 'is-warn' : state === 'error' ? 'is-error' : ''}">${escapeHTML(value)}</b></div>
  `).join('');
  setCheckedIfIdle($('diagnosticsCommError'), alarmEngine.communicationError);
  if (!preserveOutput) {
    setText('diagnosticsOutput', 'Diagnostics snapshot loaded. Run self-test for a fresh validation pass.');
  }
}

function runDiagnostics() {
  const lines = [];
  const stamp = formatDateTime(new Date());
  lines.push(`GYTech PatientSim Pro ${APP_VERSION} — simulation self-test`);
  lines.push(`Timestamp: ${stamp}`);
  lines.push(`Patient context: ${patientManager.active?.name || 'NONE'} (${patientManager.active?.id || '--'})`);
  lines.push('');
  const defibTest = defibrillator.selfTest();
  lines.push(`[${defibTest.passed ? 'PASS' : 'WARN'}] Defibrillator simulation self-test${defibTest.failures.length ? `: ${defibTest.failures.join('; ')}` : ''}`);
  lines.push(`[${simulation.running ? 'PASS' : 'WARN'}] Animation/simulation loop`);
  lines.push(`[${waveformEngine.traces.size >= 8 ? 'PASS' : 'WARN'}] Waveform traces: ${waveformEngine.traces.size}`);
  lines.push(`[${alarmEngine.activeAlarms.length ? 'INFO' : 'PASS'}] Active alarms: ${alarmEngine.activeAlarms.length}`);
  lines.push(`[PASS] Event history entries: ${historyManager.entries.length}`);
  lines.push(`[PASS] Patient profiles: ${store.state.patients.length}`);
  lines.push(`[PASS] Defibrillator finite state: ${defibrillator.machineState}`);
  lines.push(`[INFO] Audio context: ${audioManager.unlocked ? 'unlocked' : 'locked pending user interaction'}`);
  lines.push(`[INFO] Network: software simulation link only`);
  lines.push('');
  lines.push('No physical device communication is implemented or possible.');
  historyManager.add({
    type: 'SYSTEM_SELF_TEST',
    category: 'system',
    description: 'System diagnostics self-test completed.',
    details: { defibPassed: defibTest.passed, activeAlarms: alarmEngine.activeAlarms.length },
  });
  updateNetworkState();
  renderDiagnostics({ preserveOutput: true });
  $('diagnosticsOutput').textContent = lines.join('\n');
  toast(defibTest.passed ? 'System self-test completed.' : 'Self-test completed with findings.', defibTest.passed ? 'success' : 'warning');
}

function updateNetworkState() {
  const online = !alarmEngine.communicationError;
  setText('networkText', online ? 'ONLINE' : 'OFFLINE');
  $('networkDot').parentElement.classList.toggle('is-error', !online);
}

function bindDiagnostics() {
  bind('btnDisclaimer', 'click', () => {
    openModal('diagnostics');
    toast('Educational simulation only. Never use for diagnosis or treatment.', 'warning', 5200);
  });
  bind('btnRunDiagnostics', 'click', runDiagnostics);
  bind('diagnosticsCommError', 'change', (event) => {
    alarmEngine.setCommunicationError(event.target.checked);
    updateNetworkState();
    toast(event.target.checked ? 'Simulated network communication error enabled.' : 'Simulated network communication restored.', event.target.checked ? 'warning' : 'success');
  });
}

/* ============================================================
   Live monitoring surface
   ============================================================ */

function updateWaveMeta() {
  const sim = store.sim;
  const settings = store.settings;
  setText('waveLeadLabel', sim.ecg.lead || 'II');
  setText('ecgSweepMeta', `${settings.sweepSpeed} mm/s · ×${settings.ecgGain}`);
  setText('ecgLeadLabel', sim.ecg.leadCount >= 12 ? '12-LEAD' : `${sim.ecg.leadCount}-LEAD`);
  const leadCountSelect = $('ecgLeadCount');
  if (leadCountSelect && document.activeElement !== leadCountSelect) leadCountSelect.value = String(sim.ecg.leadCount);
}

function refreshVitals() {
  const v = physiology.getVitals();
  const sim = store.sim;
  const settings = store.settings;
  const pressureUnit = settings.pressureUnit;
  const tempUnit = settings.tempUnit;

  setText('vitalHR', v.hr === null ? '---' : Math.round(v.hr));
  setText('vitalPR', v.pr === null ? '--' : Math.round(v.pr));
  let hrStatus = '--';
  let hrTone = 'off';
  if (!sim.sensors.ecg) { hrStatus = 'OFF'; }
  else if (sim.ecg.leadOff) { hrStatus = 'LEADS OFF'; hrTone = 'warn'; }
  else if (sim.rhythm === 'ASYSTOLE') { hrStatus = 'ASYSTOLE'; hrTone = 'critical'; }
  else if (sim.rhythm === 'VF') { hrStatus = 'VF'; hrTone = 'critical'; }
  else if (v.hr !== null) {
    hrStatus = RHYTHM_LABELS[sim.rhythm]?.replace('Normal Sinus Rhythm', 'NSR').toUpperCase() || 'ECG';
    hrTone = 'ok';
    if (v.hr > settings.alarmLimits.heartRate.high) { hrStatus = 'HIGH'; hrTone = 'warn'; }
    else if (v.hr < settings.alarmLimits.heartRate.low) { hrStatus = 'LOW'; hrTone = 'warn'; }
  }
  setStatus('vitalHRStatus', hrStatus, hrTone);
  const hrBadge = $('hrBadge');
  if (hrBadge) hrBadge.textContent = sim.sensors.ecg ? sim.rhythm : 'OFF';

  const spo2Status = getSpO2Status(sim);
  setText('vitalSpO2', v.spo2 === null ? '---' : Math.round(v.spo2));
  setText('vitalSpO2Signal', sim.sensors.spo2 ? `${Math.round(sim.signal.spo2 * 100)}% SIGNAL` : 'SENSOR OFF');
  setStatus('vitalSpO2Status', spo2Status.label, spo2Status.tone === 'ok' ? 'ok' : spo2Status.tone === 'warn' ? 'warn' : spo2Status.tone === 'critical' ? 'critical' : 'off');
  $('vitalSpO2Status').textContent = spo2Status.label;
  $('vitalSpO2Status').dataset.tone = spo2Status.tone === 'off' ? 'off' : spo2Status.tone;

  const nibp = v.nibp;
  const nibpState = v.nibpState;
  setText('vitalSYS', nibp ? formatPressure(nibp.sys, pressureUnit) : '---');
  setText('vitalDIA', nibp ? formatPressure(nibp.dia, pressureUnit) : '--');
  setText('vitalSysMini', nibp ? formatPressure(nibp.sys, pressureUnit) : '--');
  setText('vitalDiaMini', nibp ? formatPressure(nibp.dia, pressureUnit) : '--');
  setText('vitalMapMini', nibp ? formatPressure(nibp.map, pressureUnit) : '--');
  const nibpMode = $('vitalNibpMode');
  if (!sim.sensors.nibp) { nibpMode.textContent = 'OFF'; nibpMode.dataset.mode = 'manual'; }
  else if (nibpState.measuring) { nibpMode.textContent = 'MEAS'; nibpMode.dataset.mode = 'measuring'; }
  else if (nibpState.failed) { nibpMode.textContent = 'ERROR'; nibpMode.dataset.mode = 'manual'; }
  else { nibpMode.textContent = settings.nibpInterval > 0 ? 'AUTO' : 'MANUAL'; nibpMode.dataset.mode = 'auto'; }
  let nibpTime = 'NO READING';
  if (nibpState.measuring) nibpTime = `MEASURING ${Math.round(nibpState.progress * 100)}%`;
  else if (nibpState.lastTime && nibp) nibpTime = `${formatElapsed((Date.now() - nibpState.lastTime) / 1000)} AGO${settings.nibpInterval > 0 ? ` · NEXT ${formatDuration(nibpState.countdown)}` : ''}`;
  else if (nibpState.failed) nibpTime = 'MEASUREMENT FAILED';
  else if (!sim.sensors.nibp) nibpTime = 'CUFF OFF';
  setText('vitalNibpTime', nibpTime);
  let nibpTone = nibp ? 'ok' : 'off';
  let nibpStatus = nibp ? 'OK' : '--';
  if (!sim.sensors.nibp) { nibpStatus = 'OFF'; nibpTone = 'off'; }
  else if (nibpState.failed) { nibpStatus = 'FAIL'; nibpTone = 'warn'; }
  else if (nibpState.measuring) { nibpStatus = 'MEAS'; nibpTone = 'warn'; }
  else if (nibpState.cuffError) { nibpStatus = 'ERR'; nibpTone = 'warn'; }
  setStatus('vitalNibpStatus', nibpStatus, nibpTone);
  const progress = $('nibpProgress');
  progress.classList.toggle('is-hidden', !nibpState.measuring);
  if (nibpState.measuring) $('nibpProgressBar').style.width = `${nibpState.progress * 100}%`;

  setText('vitalRR', v.rr === null ? '--' : Math.round(v.rr));
  let rrStatus = '--';
  let rrTone = 'off';
  if (sim.sensors.resp) {
    rrStatus = sim.rr < 4 ? 'APNEA' : 'SPONT';
    rrTone = sim.rr < 4 ? 'critical' : 'ok';
  } else rrStatus = 'OFF';
  setStatus('vitalRRStatus', rrStatus, rrTone);

  setText('vitalEtCO2', v.etco2 === null ? '--' : Math.round(v.etco2));
  let etTone = 'off';
  let etStatus = '--';
  if (sim.sensors.capno) {
    etStatus = sim.rr < 0.2 || sim.capnoPattern === 'apnea' ? 'APNEA' : 'CO₂';
    etTone = sim.rr < 0.2 || sim.capnoPattern === 'apnea' ? 'critical' : 'ok';
  } else etStatus = 'OFF';
  setStatus('vitalEtCO2Status', etStatus, etTone);

  setText('vitalTemp', formatTemp(v.tempC, tempUnit));
  setText('vitalTemp2', formatTemp(v.temp2C, tempUnit));
  setText('vitalTempDiff', temperatureDifferenceDisplay(v, tempUnit));
  const tempStatus = getTemperatureStatus(sim);
  setStatus('vitalTempStatus', tempStatus.label, tempStatus.tone);
  $('vitalTempUnit').textContent = tempUnitLabel(tempUnit);
  $('vitalTempUnitInline').textContent = tempUnitLabel(tempUnit);

  setText('miniART', v.ibp ? formatPressurePair(v.ibp.sys, v.ibp.dia, pressureUnit) : '--');
  setText('miniCVP', v.cvp === null ? '--' : formatPressure(v.cvp, pressureUnit));
  setText('miniPA', v.pa ? formatPressurePair(v.pa.sys, v.pa.dia, pressureUnit) : '--');
  setText('miniICP', v.icp === null ? '--' : formatPressure(v.icp, pressureUnit));
  setText('miniBIS', v.bis === null ? '--' : v.bis);

  const sensorOff = SENSOR_KEYS.filter((key) => sim.monitoring?.[key] && !sim.sensors[key]).length;
  const sensorIndicator = $('railSensorSummary');
  if (sensorIndicator) {
    sensorIndicator.className = `sensor-indicator ${sensorOff ? 'is-warn' : ''}`;
  }

  updatePatientContext();
  updateWaveMeta();
  updateMonitorStatus(v);
  updateCPRStripOnly();
  updateNIBPOnly();
  updateDefibUI();
  if (ui.activeModal === 'instructor') syncInstructorControls();
  if (ui.activeModal === 'cpr') refreshCPRUI();
  if (ui.activeModal === 'sensors') updateSensorNibpStatus();
  if (ui.activeModal === 'twelve') updateTwelveLeadMeta();
}

function updateCPRStripOnly() {
  const cpr = store.sim.cpr;
  setText('cprStripStatus', cpr.active ? (cpr.paused ? 'CPR PAUSED' : 'CPR ACTIVE') : 'IDLE');
  $('cprStripStatus').className = `cpr-status ${cpr.active ? (cpr.paused ? 'is-paused' : 'is-active') : ''}`;
  setText('cprStripRate', Math.round(cpr.rate));
  setText('cprStripDepth', cpr.depth.toFixed(1));
  setText('cprStripCount', cpr.compressions);
  setText('cprStripVent', cpr.ventilations);
  setText('cprStripQuality', cpr.active ? `${cpr.quality}%` : '--');
  const quickButton = $('btnQuickCprToggle');
  if (quickButton) quickButton.textContent = cpr.active ? 'STOP CPR' : 'START CPR';
}

function updateNIBPOnly() {
  const state = store.sim.nibp;
  if (state.measuring) {
    $('nibpProgress').classList.remove('is-hidden');
    $('nibpProgressBar').style.width = `${state.progress * 100}%`;
  }
}

function updateMonitorStatus(v) {
  const sim = store.sim;
  const settings = store.settings;
  const rhythmLabel = RHYTHM_LABELS[sim.rhythm] || sim.rhythm;
  setText('monitorRhythmChip', sim.rhythm);
  $('monitorRhythmChip').classList.toggle('is-alert', ['VF', 'ASYSTOLE'].includes(sim.rhythm) || (sim.rhythm === 'VT' && !sim.pulse));
  const perfusion = $('monitorPerfusionChip');
  if (v.pulseSource === 'cpr') {
    perfusion.textContent = 'CPR PERFUSION';
    perfusion.className = 'monitor-chip is-warn';
  } else if (v.pulseSource === 'pacing') {
    perfusion.textContent = 'PACED CAPTURE';
    perfusion.className = 'monitor-chip';
  } else if (sim.pulse) {
    perfusion.textContent = 'PULSE PRESENT';
    perfusion.className = 'monitor-chip';
  } else {
    perfusion.textContent = 'NO PULSE';
    perfusion.className = 'monitor-chip is-alert';
  }
  setText('monitorSimClock', `T+ ${formatDuration(sim.simTime)}`);
  setText('topDate', formatDate(new Date()));
  setText('topClock', formatClock(new Date()));
  setText('topBattery', `${Math.round(sim.defib.battery)}%`);
  $('topBattery').style.color = sim.defib.battery <= 20 ? 'var(--warning)' : 'var(--normal)';
  const simStatusText = $('simStatusText');
  const simStatusPill = $('simStatusPill');
  const isPaused = !sim.running;
  simStatusText.textContent = isPaused ? 'PAUSED' : 'RUNNING';
  simStatusPill.classList.toggle('is-paused', isPaused);
  $('pauseButtonLabel').textContent = isPaused ? 'RESUME' : 'PAUSE';
  $('btnPauseSim').querySelector('svg').innerHTML = isPaused
    ? '<path d="M4 2l10 6-10 6z" fill="currentColor"></path>'
    : '<rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"></rect><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"></rect>';
  const audioButton = $('btnAudio');
  audioButton.classList.toggle('is-muted', !store.settings.audioAlerts || !audioManager.unlocked);
  setText('audioButtonLabel', audioManager.unlocked && store.settings.audioAlerts ? 'AUDIO' : 'MUTED');
  $('audioWavePath').style.opacity = audioManager.unlocked && store.settings.audioAlerts ? '1' : '.2';
  setText('monitorContext', `${patientManager.active?.name || 'No patient'} · ${patientManager.active?.room || '--'} ${patientManager.active?.bed || '--'}`);
  const alarm = alarmEngine.highest;
  const topAlarm = $('topAlarmState');
  if (!alarm) {
    topAlarm.className = 'alarm-status-pill';
    setText('topAlarmText', 'NO ALARM');
  } else {
    topAlarm.className = `alarm-status-pill has-${alarm.priority}${alarmEngine.isSilenced() ? ' is-silenced' : ''}`;
    setText('topAlarmText', alarm.priority === 'critical' ? 'CRITICAL' : alarm.priority === 'warning' ? 'WARNING' : 'TECHNICAL');
  }
  const patientLiveDot = $('patientLiveDot');
  if (patientLiveDot) patientLiveDot.classList.toggle('is-paused', isPaused);
  setText('dockTimer', `SIM T+ ${formatDuration(sim.simTime)}`);
  const scenarioLabel = sim.scenario.id
    ? `${sim.scenario.name} · ${formatDuration(sim.scenario.elapsed)} · ${sim.scenario.status.toUpperCase()}`
    : 'NO SCENARIO';
  setText('dockScenarioLabel', scenarioLabel);
  setText('ecgLeadLabel', sim.ecg.leadCount >= 12 ? '12-LEAD' : `${sim.ecg.leadCount}-LEAD`);
  const freeze = $('btnFreeze');
  freeze.textContent = store.state.ui.waveformFrozen ? 'UNFREEZE' : 'FREEZE';
  freeze.classList.toggle('is-active', store.state.ui.waveformFrozen);
  setText('topPatientRoom', patientManager.active?.room || '--');
  setText('topPatientBed', patientManager.active?.bed || '--');
  const leadStatus = !sim.sensors.ecg ? 'NO LEADS' : sim.ecg.leadOff ? 'LEAD OFF' : 'ECG OK';
  setElementText(document.querySelector('.wave-ecg [data-wave-status]'), `${sim.ecg.lead} · ${leadStatus}`);
}

function refreshUI() {
  refreshVitals();
  updateRailReference();
  if (ui.activeModal === 'scenarios') {
    refreshScenarioDetail();
  }
}

/* ============================================================
   Top-level bindings and boot
   ============================================================ */

function populateRhythmSelects() {
  for (const id of ['ecgRhythmSelect', 'instructorRhythm']) {
    const select = $(id);
    if (!select) continue;
    select.innerHTML = RHYTHMS.map((rhythm) => `<option value="${rhythm}">${escapeHTML(RHYTHM_LABELS[rhythm] || rhythm)}</option>`).join('');
  }
}

function updateClock() {
  setText('topDate', formatDate(new Date()));
  setText('topClock', formatClock(new Date()));
}

function bindGlobal() {
  bind('btnPauseSim', 'click', () => {
    const running = simulation.togglePause();
    toast(running ? 'Simulation resumed.' : 'Simulation paused. Waveforms and numerical trends are frozen.', running ? 'success' : 'warning');
    refreshUI();
  });
  bind('btnFreeze', 'click', () => {
    store.state.ui.waveformFrozen = !store.state.ui.waveformFrozen;
    toast(store.state.ui.waveformFrozen ? 'Waveform display frozen.' : 'Waveform display live.', 'info');
    refreshUI();
  });
  bind('btnAudio', 'click', async () => {
    if (!audioManager.unlocked) {
      const ok = await audioManager.ensureContext();
      if (!ok) {
        toast('Audio is unavailable in this browser.', 'warning');
        return;
      }
      if (!store.settings.audioAlerts) audioManager.setMuted(false);
      audioManager.setAlarms(ui.alarmPayload);
      toast('Audio enabled. Alarm annunciation uses the Web Audio API.', 'success');
    } else {
      audioManager.setMuted(store.settings.audioAlerts);
      toast(store.settings.audioAlerts ? 'Alarm audio muted.' : 'Alarm audio enabled.', 'info');
    }
    audioManager.emitStatus();
    refreshUI();
  });
  bind('btnPatients', 'click', () => openModal('patients'));
  bind('btnScenarios', 'click', () => openModal('scenarios'));
  bind('btnInstructor', 'click', () => openModal('instructor'));
  bind('btnAlarms', 'click', () => openModal('alarms'));
  bind('btnECGSettings', 'click', () => openModal('ecg'));
  bind('btnSensors', 'click', () => openModal('sensors'));
  bind('btnHistory', 'click', () => openModal('history'));
  bind('btnRailHistory', 'click', () => openModal('history'));
  bind('btnDeviceSettings', 'click', () => openModal('settings'));
  bind('btnDiagnostics', 'click', () => openModal('diagnostics'));
  bind('patientForm', 'submit', savePatient);
  bind('btnNewPatient', 'click', () => loadPatientForm(null));
  bind('btnDuplicatePatient', 'click', duplicateSelectedPatient);
  bind('btnDeletePatient', 'click', deleteSelectedPatient);
  bind('btnResetPatientSim', 'click', resetActivePatientSimulation);
  bind('scenarioCategoryFilter', 'change', renderScenarioList);
  bind('btnStartScenario', 'click', startSelectedScenario);
  bind('btnPauseScenario', 'click', pauseSelectedScenario);
  bind('btnResumeScenario', 'click', resumeSelectedScenario);
  bind('btnResetScenario', 'click', resetSelectedScenario);
  bind('btnStopScenario', 'click', stopSelectedScenario);
  bind('confirmCancel', 'click', closeConfirm);
  bind('confirmOk', 'click', () => {
    const callback = ui.confirmCallback;
    closeConfirm();
    if (typeof callback === 'function') callback();
  });

  for (const close of $$('[data-close-modal="true"]')) {
    close.addEventListener('click', () => {
      if (close.classList.contains('modal-backdrop')) closeModal();
      else closeModal();
    });
  }

  const patientList = $('patientList');
  if (patientList) {
    patientList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-patient-id]');
      if (card) selectPatient(card.dataset.patientId);
    });
    patientList.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-patient-id]');
      if (card) {
        event.preventDefault();
        selectPatient(card.dataset.patientId);
      }
    });
  }
  const scenarioList = $('scenarioList');
  if (scenarioList) {
    scenarioList.addEventListener('click', (event) => {
      const card = event.target.closest('[data-scenario-id]');
      if (card) selectScenario(card.dataset.scenarioId);
    });
    scenarioList.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-scenario-id]');
      if (card) {
        event.preventDefault();
        selectScenario(card.dataset.scenarioId);
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target instanceof HTMLElement && target.matches('input, select, textarea, [contenteditable="true"]');
    if (event.key === 'Escape') {
      if (!$('confirmLayer').hidden) closeConfirm();
      else if (ui.activeModal) closeModal();
      return;
    }
    if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'p') {
      event.preventDefault();
      simulation.togglePause();
      refreshUI();
    } else if (key === 'f') {
      event.preventDefault();
      store.state.ui.waveformFrozen = !store.state.ui.waveformFrozen;
      refreshUI();
    } else if (key === 'a') {
      event.preventDefault();
      alarmEngine.acknowledgeAll();
    } else if (key === 's') {
      event.preventDefault();
      alarmEngine.silence(120);
    } else if (key === 'm') {
      event.preventDefault();
      audioManager.setMuted(store.settings.audioAlerts);
      audioManager.emitStatus();
      refreshUI();
    }
  });
}

function subscribeEvents() {
  store.on('patients:changed', () => {
    if (ui.activeModal === 'patients') {
      renderPatientList();
    }
  });
  store.on('patient:created', (patient) => {
    historyManager.add({
      type: 'PATIENT_CREATED',
      category: 'patient',
      description: `Simulation patient created: ${patient.name} (${patient.id}).`,
      details: { age: patient.age, sex: patient.sex, room: patient.room, bed: patient.bed },
    });
  });
  store.on('patient:updated', (patient) => {
    historyManager.add({
      type: 'PATIENT_UPDATED',
      category: 'patient',
      description: `Patient profile updated: ${patient.name} (${patient.id}).`,
      details: { age: patient.age, status: patient.status },
    });
    updatePatientContext();
    if (ui.activeModal === 'patients') renderPatientList();
  });
  store.on('patient:deleted', (patient) => {
    historyManager.add({
      type: 'PATIENT_DELETED',
      category: 'patient',
      description: `Simulation patient deleted: ${patient.name} (${patient.id}).`,
      details: {},
    });
    if (ui.activeModal === 'patients') {
      renderPatientList();
      loadPatientForm(patientManager.active);
    }
  });
  store.on('patient:selected', ({ patient }) => {
    ui.selectedPatientId = patient.id;
    updatePatientContext();
    if (ui.activeModal === 'patients') {
      renderPatientList();
      loadPatientForm(patient);
    }
    ui.alarmSignature = '';
    alarmEngine.evaluate(true);
    ui.lastCprMetronomeKey = '';
    refreshUI();
  });
  store.on('patient:profile-updated', () => {
    updatePatientContext();
    if (ui.activeModal === 'patients') renderPatientList();
  });
  store.on('patient:context-applied', () => {
    updatePatientContext();
    refreshUI();
  });
  store.on('physiology:patient-applied', () => {
    updateDefibUI();
    ui.energySignature = '';
  });
  store.on('settings:changed', () => {
    settingsManager.apply();
    updateUnitLabels();
    updateWaveMeta();
    updateDefibUI();
    syncSettingsControls();
    syncAlarmVolumeControl();
    audioManager.updateVolume();
    if (!store.settings.audioAlerts) {
      audioManager.stopAlarmLoop();
      audioManager.stopCPRMetronome();
    } else {
      audioManager.setAlarms(ui.alarmPayload);
    }
    if (ui.activeModal === 'ecg') syncECGSettings();
    if (ui.activeModal === 'alarms') renderAlarmGroupToggles();
    refreshUI();
  });
  store.on('economy:noop', () => {});
  store.on('alarms:changed', handleAlarmsChanged);
  store.on('history:changed', () => {
    if (ui.activeModal === 'history') renderHistory();
    renderCPRHistory();
    renderRailEvents();
  });
  store.on('nibp:started', updateSensorNibpStatus);
  store.on('nibp:complete', updateSensorNibpStatus);
  store.on('nibp:failed', (result) => {
    toast(result.reason, 'warning');
    updateSensorNibpStatus();
  });
  store.on('rhythm:changed', () => {
    updateWaveMeta();
    if (ui.activeModal === 'ecg') syncECGSettings();
    if (ui.activeModal === 'instructor') syncInstructorControls();
    updateDefibUI();
  });
  store.on('sensors:changed', () => {
    if (ui.activeModal === 'sensors') renderSensorConfig();
    ui.alarmSignature = '';
    refreshUI();
  });
  store.on('scenario:started', () => {
    ui.energySignature = '';
    refreshScenarioDetail();
    renderScenarioList();
    updateDefibUI();
  });
  store.on('scenario:paused', refreshScenarioDetail);
  store.on('scenario:resumed', refreshScenarioDetail);
  store.on('scenario:reset', refreshScenarioDetail);
  store.on('scenario:stopped', refreshScenarioDetail);
  store.on('scenario:completed', () => {
    toast('Simulation scenario completed.', 'info');
    refreshScenarioDetail();
  });
  store.on('scenario:progression', ({ event }) => {
    if (event?.note) toast(`Scenario event: ${event.note}`, 'info', 4800);
    refreshScenarioDetail();
  });
  store.on('cpr:started', refreshCPRUI);
  store.on('cpr:stopped', refreshCPRUI);
  store.on('cpr:compression', () => {
    updateCPRStripOnly();
  });
  store.on('cpr:ventilation', updateCPRStripOnly);
  store.on('defib:changed', () => {
    updateDefibUI();
  });
  store.on('defib:charged', () => {
    toast('Simulated defibrillator charged. Confirm the simulated patient is clear.', 'warning', 4200);
  });
  store.on('defib:shock-delivered', ({ result }) => {
    if (result?.converted) {
      toast(result.message, 'warning', 5200);
    }
  });
  store.on('defib:sync-changed', updateDefibUI);
  store.on('defib:mode-changed', (payload) => {
    if (payload.mode === 'sync') toast('Synchronized cardioversion mode: verify QRS sync markers before charging.', 'info');
    if (payload.mode === 'pacing') toast('Pacing mode is independent of defibrillation.', 'info');
  });
  store.on('pacing:changed', updateDefibUI);
  store.on('pacing:ui-changed', updateDefibUI);
  store.on('aed:analysis-complete', (recommendation) => {
    toast(recommendation.shockAdvise ? 'AED analysis: SHOCK ADVISED.' : 'AED analysis: NO SHOCK ADVISED.', recommendation.shockAdvise ? 'critical' : 'success', 5000);
  });
  store.on('aed:analysis-started', updateDefibUI);
  store.on('rosc:applied', () => {
    toast('Configured ROSC transition applied. Reassess simulated perfusion and rhythm.', 'success', 5000);
  });
  store.on('sim:running-changed', () => {
    refreshUI();
  });
  store.on('instructor:changed', () => {
    if (ui.activeModal === 'instructor') syncInstructorControls();
    refreshUI();
  });
  store.on('pacing:changed', updateDefibUI);
  audioManager.subscribeStatus(() => {
    if (ui.activeModal === 'settings') syncSettingsControls();
    const button = $('btnAudio');
    if (button) {
      button.classList.toggle('is-muted', !store.settings.audioAlerts || !audioManager.unlocked);
      setText('audioButtonLabel', audioManager.unlocked && store.settings.audioAlerts ? 'AUDIO' : 'MUTED');
    }
  });
  historyManager.add({
    type: 'SIMULATION_SESSION_STARTED',
    category: 'system',
    description: 'Simulation workstation session started. All data is simulated.',
    details: { version: APP_VERSION, patient: patientManager.active?.id },
  });
}

function init() {
  populateRhythmSelects();
  settingsManager.apply();
  updateUnitLabels();
  updateWaveMeta();
  updatePatientContext();
  updateClock();
  updateNetworkState();
  updateDefibUI();
  renderAlarmBanner(ui.alarmPayload);
  renderAlarmGroupToggles();
  renderAlarmLimits();
  renderAlarmVolumeControlIfPossible();
  syncSettingsControls();
  syncECGSettings();
  syncInstructorControls(true);
  refreshCPRUI();
  renderRailEvents();
  updateDefibChecklist(defibrillator.getStatus());
  bindGlobal();
  bindInstructor();
  bindCPR();
  bindAlarms();
  bindECGSettings();
  bindSensors();
  bindSettings();
  bindDefibrillator();
  bindHistory();
  bindDiagnostics();
  desktopManager.initialize({
    openModal,
    closeModal,
    confirmAction,
    toast,
  });
  subscribeEvents();
  audioManager.attachInteractionUnlock();
  alarmEngine.evaluate(true);
  alarmEngine.subscribe((payload) => {
    // Audio update is already performed by handleAlarmsChanged. This callback
    // provides a stable extension hook without adding another loop.
  });
  simulation.subscribeTick(() => refreshUI());
  simulation.subscribeFrame(() => drawDefibScreen());
  simulation.subscribeClock(updateClock);
  simulation.start();
  requestAnimationFrame(() => {
    for (const trace of waveformEngine.traces.values()) trace.resize();
    updateDefibUI();
    refreshUI();
  });
}

function renderAlarmVolumeControlIfPossible() {
  // Synchronises the volume input available in both alarm and settings modals.
  syncAlarmVolumeControl();
}

init();
