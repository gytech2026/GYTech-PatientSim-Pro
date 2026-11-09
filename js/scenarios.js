/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Deterministic clinical teaching scenarios.
 * Each scenario fully describes the initial simulated physiology, waveform
 * patterns, progression, and expected teaching outcomes.
 */

const base = {
  rhythm: 'NSR',
  heartRate: 72,
  pulse: true,
  perfusion: 1,
  oxygenation: 98,
  ventilation: 1,
  spo2: 98,
  rr: 16,
  etco2: 38,
  bpSys: 120,
  bpDia: 78,
  tempC: 36.8,
  temp2C: 36.6,
  respiratoryPattern: 'normal',
  capnoPattern: 'normal',
  respiratoryDepth: 1,
  respiratoryIrregularity: 0,
  bis: 47,
  overrideRhythm: true,
  sensors: null,
  pressures: null,
};

const scenario = (id, name, category, description, initial, options = {}) => ({
  id,
  name,
  category,
  description,
  instructions: options.instructions || 'Observe the simulated monitor. Review waveform morphology, numerical values, and active alarms.',
  instructorNotes: options.instructorNotes || 'Use the instructor panel to explore interventions. All changes are simulation-only.',
  initial: { ...base, ...initial },
  progression: options.progression || [],
  outcomes: options.outcomes || ['Recognise the simulated condition and select an appropriate educational intervention.'],
  duration: options.duration || 180,
  rhythmClassification: options.rhythmClassification || null,
});

export const SCENARIOS = Object.freeze([
  scenario(
    'normal-healthy', 'Normal Healthy Patient', 'Baseline',
    'A physiologically stable adult with normal sinus rhythm and preserved perfusion.',
    { rhythm: 'NSR', heartRate: 71, spo2: 99, rr: 15, etco2: 39, bpSys: 118, bpDia: 74, tempC: 36.7, temp2C: 36.6 },
    {
      instructions: 'Establish a baseline. Confirm the ECG is organised, pulse is present, and measurements are within the teaching ranges.',
      instructorNotes: 'Normal baseline for comparison. Try changing sweep speed and gain without interrupting the rhythm.',
      outcomes: ['Identify normal sinus rhythm.', 'Verify consistent HR, pulse rate, and pleth timing.'],
    },
  ),
  scenario(
    'sinus-bradycardia', 'Sinus Bradycardia', 'Rhythm',
    'Sinus rhythm at 44 bpm with preserved consciousness and borderline perfusion.',
    { rhythm: 'SINUS_BRADY', heartRate: 44, spo2: 97, rr: 13, etco2: 41, bpSys: 104, bpDia: 62, perfusion: 0.88, tempC: 36.5 },
    {
      instructions: 'Assess for signs of poor perfusion. Decide whether the simulated patient is stable or unstable.',
      instructorNotes: 'If mechanical capture is desired, use the pacing module with sufficient output. Pacing is independent of defibrillation.',
      outcomes: ['Recognise bradycardia.', 'Distinguish stable from unstable bradycardia in the simulation.'],
    },
  ),
  scenario(
    'sinus-tachycardia', 'Sinus Tachycardia', 'Rhythm',
    'Sinus tachycardia at 128 bpm in a monitored simulated patient.',
    { rhythm: 'SINUS_TACHY', heartRate: 128, spo2: 97, rr: 22, etco2: 34, bpSys: 132, bpDia: 82, tempC: 37.4, perfusion: 0.95 },
    {
      instructions: 'Examine the P-QRS relationship and the effect of rate on waveform timing.',
      instructorNotes: 'The ECG cycle length should shorten as heart rate rises. Verify the pleth pulse rate follows the simulated pulse.',
      outcomes: ['Differentiate sinus tachycardia from SVT in the educational model.'],
    },
  ),
  scenario(
    'atrial-fibrillation', 'Atrial Fibrillation', 'Rhythm',
    'Irregularly irregular rhythm with absent organised P waves and variable RR intervals.',
    { rhythm: 'AFIB', heartRate: 104, spo2: 96, rr: 19, etco2: 37, bpSys: 126, bpDia: 78, perfusion: 0.9, respiratoryIrregularity: 0.25 },
    {
      instructions: 'Inspect RR irregularity and absence of consistent P waves. Correlate with the pleth rhythm.',
      instructorNotes: 'The model deliberately varies RR intervals. Heart-rate changes alter the overall irregular timing.',
      outcomes: ['Recognise irregularly irregular rhythm.', 'Avoid relying on a single RR interval.'],
    },
  ),
  scenario(
    'atrial-flutter', 'Atrial Flutter', 'Rhythm',
    'Regular ventricular response with sawtooth atrial activity at a simulated 2:1 conduction ratio.',
    { rhythm: 'AFLUTTER', heartRate: 150, spo2: 96, rr: 20, etco2: 35, bpSys: 122, bpDia: 76, perfusion: 0.9 },
    {
      instructions: 'Identify flutter waves between QRS complexes and the regular ventricular response.',
      instructorNotes: 'The educational flutter model is approximate and not intended for diagnostic interpretation.',
      outcomes: ['Recognise sawtooth atrial activity in the simulation.'],
    },
  ),
  scenario(
    'svt', 'Supraventricular Tachycardia', 'Rhythm',
    'Narrow-complex regular tachycardia at 170 bpm with preserved simulated circulation.',
    { rhythm: 'SVT', heartRate: 170, spo2: 97, rr: 23, etco2: 33, bpSys: 118, bpDia: 74, perfusion: 0.9 },
    {
      instructions: 'Assess rhythm regularity, QRS width, and simulated haemodynamic tolerance.',
      instructorNotes: 'Synchronized cardioversion is a separate defibrillator mode. It requires valid simulated synchronisation.',
      outcomes: ['Distinguish SVT from VT in the simulation.'],
    },
  ),
  scenario(
    'stable-vt', 'Stable Ventricular Tachycardia', 'Rhythm',
    'Wide-complex regular tachycardia with a simulated palpable pulse and measurable pressure.',
    { rhythm: 'VT', heartRate: 152, pulse: true, spo2: 95, rr: 20, etco2: 34, bpSys: 112, bpDia: 70, perfusion: 0.78 },
    {
      instructions: 'Confirm the simulated pulse state. A stable perfusing VT is not the same as pulseless VT.',
      instructorNotes: 'Do not treat every VT as pulseless. Use the pulse control to explore the difference safely in software.',
      outcomes: ['Differentiate stable and pulseless VT using perfusion state.'],
    },
  ),
  scenario(
    'pulseless-vt', 'Pulseless Ventricular Tachycardia', 'Arrest',
    'Wide-complex tachycardia without a simulated palpable pulse or effective circulation.',
    { rhythm: 'VT', heartRate: 186, pulse: false, perfusion: 0, oxygenation: 35, ventilation: 0.2, spo2: 62, rr: 5, etco2: 12, bpSys: 0, bpDia: 0, tempC: 36.1, respiratoryPattern: 'agonal' },
    {
      instructions: 'Assess pulse/perfusion first. The simulated monitor classifies this as a shockable arrest only when pulselessness is explicitly established.',
      instructorNotes: 'Shock delivery may organise the ECG but does not automatically establish ROSC. Use a separate configured recovery transition.',
      outcomes: ['Recognise a shockable pulseless rhythm.', 'Avoid automatic ROSC assumptions after a simulated shock.'],
      rhythmClassification: 'SHOCKABLE_ARREST',
    },
  ),
  scenario(
    'ventricular-fibrillation', 'Ventricular Fibrillation', 'Arrest',
    'Chaotic, disorganised ventricular activity with no palpable pulse.',
    { rhythm: 'VF', heartRate: 0, pulse: false, perfusion: 0, oxygenation: 20, ventilation: 0.1, spo2: 55, rr: 0, etco2: 8, bpSys: 0, bpDia: 0, tempC: 36.0, capnoPattern: 'apnea', respiratoryPattern: 'apnea' },
    {
      instructions: 'Recognise the chaotic waveform, absent pulse, and critical alarm state. Attach simulated pads before charging.',
      instructorNotes: 'A simulated shock can organise the ECG in this teaching model. ROSC requires the dedicated recovery event and organised perfusion.',
      outcomes: ['Recognise VF as a shockable simulated arrest rhythm.', 'Complete the AED or manual shock workflow safely.'],
      rhythmClassification: 'SHOCKABLE_ARREST',
    },
  ),
  scenario(
    'asystole', 'Asystole', 'Arrest',
    'Near-flat ECG with absent mechanical and electrical cardiac activity and no pulse.',
    { rhythm: 'ASYSTOLE', heartRate: 0, pulse: false, perfusion: 0, oxygenation: 10, ventilation: 0, spo2: 0, rr: 0, etco2: 4, bpSys: 0, bpDia: 0, tempC: 35.6, capnoPattern: 'apnea', respiratoryPattern: 'apnea' },
    {
      instructions: 'Confirm the flat waveform and absent pulse. AED analysis should recommend no shock.',
      instructorNotes: 'Asystole is not shockable. Use CPR and a separate configured recovery event if teaching ROSC.',
      outcomes: ['Recognise asystole.', 'Confirm the AED does not recommend a shock.'],
      rhythmClassification: 'NON_SHOCKABLE_ARREST',
    },
  ),
  scenario(
    'pea', 'Pulseless Electrical Activity', 'Arrest',
    'Organised electrical activity without a palpable simulated pulse or effective circulation.',
    { rhythm: 'NSR', heartRate: 58, pulse: false, perfusion: 0, oxygenation: 22, ventilation: 0.2, spo2: 60, rr: 6, etco2: 14, bpSys: 0, bpDia: 0, tempC: 36.2, respiratoryPattern: 'agonal', capnoPattern: 'hypoventilation' },
    {
      instructions: 'Demonstrate that ECG morphology alone cannot establish PEA. The pulse/perfusion state is explicitly pulseless.',
      instructorNotes: 'PEA is non-shockable in this model. Mechanical CPR may generate a small simulated pressure and EtCO₂ change.',
      outcomes: ['Recognise PEA requires a pulseless state with organised electrical activity.'],
      rhythmClassification: 'NON_SHOCKABLE_ARREST',
    },
  ),
  scenario(
    'hypoxia', 'Hypoxia', 'Respiration',
    'Progressive desaturation with compensatory tachypnoea and tachycardia.',
    { rhythm: 'SINUS_TACHY', heartRate: 116, spo2: 87, oxygenation: 86, rr: 26, etco2: 32, bpSys: 134, bpDia: 80, perfusion: 0.85, respiratoryPattern: 'rapid', capnoPattern: 'hyperventilation' },
    {
      instructions: 'Observe SpO₂, respiratory pattern, and the relationship between oxygenation and pulse rate.',
      instructorNotes: 'The simulated SpO₂ responds to the oxygenation state. Sensor disconnection will remove the reading rather than fabricate a value.',
      outcomes: ['Recognise hypoxaemia and compensatory tachycardia.'],
    },
  ),
  scenario(
    'hypotension', 'Hypotension', 'Circulation',
    'Low systemic pressure with preserved rhythm and borderline perfusion.',
    { rhythm: 'NSR', heartRate: 104, spo2: 95, rr: 21, etco2: 36, bpSys: 78, bpDia: 44, perfusion: 0.63, oxygenation: 94, respiratoryPattern: 'rapid' },
    {
      instructions: 'Assess the pressure, perfusion, and mental-status context provided by the scenario notes.',
      instructorNotes: 'Adjust the manual blood pressure to observe alarm thresholds. MAP is derived from the simulated systolic and diastolic values.',
      outcomes: ['Identify hypotension and reduced perfusion in the simulation.'],
    },
  ),
  scenario(
    'hypertension', 'Hypertension', 'Circulation',
    'Markedly elevated systemic pressure with a perfusing rhythm.',
    { rhythm: 'NSR', heartRate: 84, spo2: 97, rr: 18, etco2: 38, bpSys: 188, bpDia: 112, perfusion: 1, oxygenation: 97 },
    {
      instructions: 'Compare the measured values with the configured teaching alarm limits.',
      instructorNotes: 'High-pressure alarms should activate for elevated simulated values. Confirm the alarm history records them.',
      outcomes: ['Recognise high blood pressure alarm conditions.'],
    },
  ),
  scenario(
    'hypoventilation', 'Hypoventilation', 'Respiration',
    'Slow, shallow respiration with rising EtCO₂ and falling SpO₂.',
    { rhythm: 'NSR', heartRate: 88, spo2: 91, oxygenation: 91, rr: 7, etco2: 58, bpSys: 116, bpDia: 72, respiratoryPattern: 'shallow', capnoPattern: 'hypoventilation', respiratoryDepth: 0.55, ventilation: 0.45 },
    {
      instructions: 'Relate low respiratory rate and shallow depth to the capnogram and EtCO₂.',
      instructorNotes: 'The capnogram shape changes with the respiratory pattern. Apnea suppresses inspired and expired CO₂ traces.',
      outcomes: ['Identify hypoventilation and its capnographic pattern.'],
    },
  ),
  scenario(
    'hyperventilation', 'Hyperventilation', 'Respiration',
    'Rapid deep breathing with low EtCO₂ and mild respiratory alkalosis context.',
    { rhythm: 'SINUS_TACHY', heartRate: 112, spo2: 99, oxygenation: 99, rr: 32, etco2: 24, bpSys: 126, bpDia: 78, respiratoryPattern: 'deep', capnoPattern: 'hyperventilation', respiratoryDepth: 1.3, ventilation: 1.35 },
    {
      instructions: 'Inspect the capnogram plateau and EtCO₂ trend during hyperventilation.',
      instructorNotes: 'The waveform model is simplified and intended only to demonstrate shape and direction of change.',
      outcomes: ['Recognise hyperventilation and low EtCO₂.'],
    },
  ),
  scenario(
    'apnea', 'Apnea', 'Respiration',
    'No effective respiration, absent capnogram, and progressive desaturation.',
    { rhythm: 'NSR', heartRate: 68, spo2: 86, oxygenation: 84, rr: 0, etco2: 0, bpSys: 122, bpDia: 76, perfusion: 0.9, respiratoryPattern: 'apnea', capnoPattern: 'apnea', respiratoryDepth: 0, ventilation: 0.05 },
    {
      instructions: 'Identify absent respiratory waveform and capnogram. Observe the critical apnea alarm and desaturation.',
      instructorNotes: 'This is an apnoea simulation with a perfusing rhythm. Pulse remains present unless changed in the instructor panel.',
      progression: [
        { at: 30, patch: { spo2: 78, oxygenation: 76, heartRate: 58, perfusion: 0.72 }, note: 'Progressive desaturation and bradycardia.' },
        { at: 65, patch: { heartRate: 44, perfusion: 0.52, bpSys: 92, bpDia: 54 }, note: 'Deteriorating perfusion.' },
      ],
      outcomes: ['Recognise apnea and severe desaturation.', 'Escalate to simulated airway/ventilation interventions.'],
    },
  ),
  scenario(
    'sepsis', 'Sepsis-like Deterioration', 'Deterioration',
    'A simulated inflammatory deterioration with tachycardia, fever, hypotension, and increasing oxygen demand.',
    { rhythm: 'SINUS_TACHY', heartRate: 116, spo2: 94, oxygenation: 93, rr: 24, etco2: 32, bpSys: 96, bpDia: 56, tempC: 38.9, temp2C: 38.7, perfusion: 0.72, respiratoryPattern: 'rapid' },
    {
      instructions: 'Track the multi-parameter deterioration. Press Start to run the timelined progression.',
      instructorNotes: 'The scenario progresses deterministically at 35s and 75s. Pause or reset to discuss the events.',
      progression: [
        { at: 35, patch: { heartRate: 126, bpSys: 86, bpDia: 48, spo2: 92, tempC: 39.1, perfusion: 0.6 }, note: 'Worsening hypotension and tachycardia.' },
        { at: 75, patch: { heartRate: 138, bpSys: 76, bpDia: 42, spo2: 89, rr: 30, perfusion: 0.48, oxygenation: 88 }, note: 'Critical deterioration. Severe hypotension and hypoxaemia.' },
      ],
      outcomes: ['Recognise sepsis-like deterioration.', 'Correlate fever, tachycardia, hypotension, and oxygenation.'],
    },
  ),
  scenario(
    'post-resuscitation', 'Post-Resuscitation State', 'Recovery',
    'A post-arrest simulation with organised rhythm, restored perfusion, and ongoing vulnerability.',
    { rhythm: 'SINUS_TACHY', heartRate: 104, pulse: true, perfusion: 0.8, oxygenation: 94, spo2: 94, rr: 22, etco2: 35, bpSys: 102, bpDia: 62, tempC: 35.9, temp2C: 35.8, respiratoryPattern: 'rapid' },
    {
      instructions: 'Review the restored pulse, organised rhythm, and residual instability. This state is not equivalent to full recovery.',
      instructorNotes: 'Demonstrates post-event physiology. Continue monitoring; the simulation does not claim clinical outcome validity.',
      outcomes: ['Differentiate ROSC from full recovery.', 'Prioritise ongoing simulated monitoring.'],
    },
  ),
  scenario(
    'rosc', 'ROSC Simulation', 'Recovery',
    'A configured recovery event smoothly restores organised rhythm and perfusion after simulated arrest care.',
    { rhythm: 'VT', heartRate: 178, pulse: false, perfusion: 0, oxygenation: 24, ventilation: 0.15, spo2: 58, rr: 4, etco2: 10, bpSys: 0, bpDia: 0, tempC: 36.0, respiratoryPattern: 'agonal' },
    {
      instructions: 'This scenario includes an explicit ROSC transition at 25 seconds. Start the scenario timer and observe the change. No shock button causes ROSC.',
      instructorNotes: 'ROSC occurs only through the scenario’s configured recovery progression or the explicit instructor recovery action, never automatically from a shock.',
      progression: [
        { at: 25, recovery: true, note: 'Configured ROSC event: organised rhythm with restored simulated perfusion.' },
      ],
      outcomes: ['Observe a configured ROSC transition with organised rhythm and restored perfusion.'],
    },
  ),
]);

export const getScenarioById = (id) => SCENARIOS.find((item) => item.id === id) || null;

export const scenarioPatchFromInitial = (initial = {}) => {
  const patch = {};
  for (const key of [
    'rhythm', 'heartRate', 'pulse', 'perfusion', 'oxygenation', 'ventilation', 'spo2',
    'rr', 'etco2', 'bpSys', 'bpDia', 'tempC', 'temp2C', 'respiratoryPattern',
    'capnoPattern', 'respiratoryDepth', 'respiratoryIrregularity', 'bis',
  ]) {
    if (initial[key] !== undefined) patch[key] = initial[key];
  }
  if (initial.sensors) patch.sensors = { ...initial.sensors };
  if (initial.pressures) patch.pressures = JSON.parse(JSON.stringify(initial.pressures));
  return patch;
};
