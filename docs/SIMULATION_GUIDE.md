# Simulation Guide — GYTech PatientSim Pro

**Copyright 2026 GYTech All Right Reserved.**

> Educational software only. The simulator is not clinically validated and does
> not predict real patient outcomes. See [DISCLAIMER.md](../DISCLAIMER.md).

---

## 1. Physiology model

All displayed values share a centralized state in `js/physiology.js`. The model
relates:

- rhythm and heart rate,
- pulse/perfusion state,
- oxygenation and SpO₂,
- ventilation, respiratory rate, and EtCO₂,
- systemic pressure and mean arterial pressure,
- temperature,
- sensor connection and signal quality,
- CPR and pacing effects,
- defibrillator and recovery outcomes.

The model uses bounded smoothing between target and displayed values. Scenarios
set deterministic targets; manual instructor overrides alter those targets.
Values are not independently randomized.

### Pulse / perfusion consistency

- VF and asystole force pulselessness and zero measurable pressure.
- PEA is organized electrical activity with an explicitly absent pulse.
- A palpable pulse can coexist with an organized ECG; it is not inferred from ECG
  morphology alone.
- SpO₂/PR become unavailable without a valid effective pulse or sensor.
- CPR may provide partial simulated circulation but does not change the native
  pulse to present.
- Pacing mechanical capture can restore simulated circulation through the pacing
  interlock; electrical capture alone does not.

---

## 2. Recovery and ROSC

ROSC is **not** triggered by pressing shock. A shock may organize VF into an
organized ECG while the simulated pulse remains absent. To establish ROSC:

1. The rhythm must be organized and non-lethal.
2. Use **INSTRUCTOR → TRIGGER CONFIGURED ROSC**, or run the explicit configured
   ROSC scenario progression.
3. The model restores simulated pulse and pressure and records a recovery event.

This is an educational recovery event, not a clinical prediction or guarantee.

---

## 3. Scenario model

Each scenario defines:

- Initial rhythm, rate, pulse state, perfusion, oxygenation, ventilation,
  pressure, temperature, and relevant waveform patterns.
- Scenario instructions and instructor notes.
- Expected learning outcomes.
- A deterministic progression timeline or an explicit recovery event.
- Alarm conditions produced by the resulting physiology.

Use **PAUSE/RESUME/RESET/STOP** to control the scenario timer. Progression events
update connected parameters together.

---

## 4. Available scenarios

| # | Scenario | Simulated rhythm / state | Primary teaching focus | Implementation |
|---|---|---|---|---|
| 1 | Normal Healthy Patient | Normal sinus rhythm | Baseline monitoring and normal waveform recognition | ✅ Implemented |
| 2 | Sinus Bradycardia | Sinus bradycardia | Rate/perfusion assessment and bradycardia recognition | ✅ Implemented |
| 3 | Sinus Tachycardia | Sinus tachycardia | P-QRS relationship and rate-dependent timing | ✅ Implemented |
| 4 | Atrial Fibrillation | Atrial fibrillation | Irregular RR, absent P waves, pleth correlation | ✅ Implemented |
| 5 | Atrial Flutter | Atrial flutter | Sawtooth atrial activity, regular ventricular response | ✅ Implemented |
| 6 | Supraventricular Tachycardia | SVT | Narrow-complex regular tachycardia | ✅ Implemented |
| 7 | Stable Ventricular Tachycardia | VT with pulse | Differentiate perfusing VT from pulseless VT | ✅ Implemented |
| 8 | Pulseless Ventricular Tachycardia | VT without pulse | Shockable arrest classification and AED workflow | ✅ Implemented |
| 9 | Ventricular Fibrillation | VF, pulseless | Chaotic waveform, critical alarm, shock workflow | ✅ Implemented |
| 10 | Asystole | Asystole, pulseless | Flat ECG, no-shock AED result, CPR context | ✅ Implemented |
| 11 | Pulseless Electrical Activity | Organized ECG, no pulse | Explicit pulse assessment; non-shockable state | ✅ Implemented |
| 12 | Hypoxia | Sinus tachycardia, hypoxaemia | SpO₂ desaturation and compensatory tachycardia | ✅ Implemented |
| 13 | Hypotension | NSR, low pressure | Hypotension recognition and perfusion context | ✅ Implemented |
| 14 | Hypertension | NSR, high pressure | High-pressure alarm context | ✅ Implemented |
| 15 | Hypoventilation | NSR, slow/shallow breathing | EtCO₂ rise, capnogram pattern | ✅ Implemented |
| 16 | Hyperventilation | Sinus tachycardia, rapid deep breathing | Low EtCO₂, capnogram shape | ✅ Implemented |
| 17 | Apnea | NSR with absent respiration | Apnea critical alarm and progressive desaturation | ✅ Implemented |
| 18 | Sepsis-like Deterioration | Sinus tachycardia | Multi-parameter deterioration and alarm progression | ✅ Implemented |
| 19 | Post-Resuscitation State | Sinus tachycardia with restored perfusion | Post-arrest instability, not full recovery | ✅ Implemented |
| 20 | ROSC Simulation | Initial pulseless VT; configured recovery at 25 s | Explicit ROSC transition with organized rhythm | ✅ Implemented |

The scenario list is implemented in `js/scenarios.js`. Scenario progression is
deterministic.

---

## 5. Manual instructor controls

The Instructor panel allows controlled modification of:

- HR and rhythm.
- Pulse state, perfusion.
- SpO₂ and oxygenation state.
- Respiratory rate, EtCO₂, ventilation state.
- Systolic/diastolic pressure.
- Temperature.
- Capnogram and respiratory pattern.

When you manually override a value, the model marks the override and adjusts
related targets where appropriate. Clearing overrides returns to derived
physiology. A manual ROSC action requires an organized rhythm.

---

## 6. CPR simulation

- Start/stop simulated compressions.
- Adjust rate and depth.
- Pause/resume.
- Increment ventilations.
- Trigger a manual compression.
- View compression count, ventilation count, pause time, and calculated quality.
- Optional audible metronome.

CPR may raise simulated pressure/EtCO₂ during arrest. It does not automatically
generate ROSC. Quality is a teaching calculation, not a measurement.

---

## 7. Educational limitations

- The model is not a clinical predictor.
- Rhythm classifications and waveforms are approximate.
- Scenarios do not establish real treatment protocols.
- The shock conversion outcome is a teaching simplification.
- Synchronization validates simulated marker eligibility rather than providing
  physical R-wave-timed therapy.
- Pacing failure-to-capture is simplified.
- No real patient data, device, or clinical response is involved.

---

Copyright 2026 GYTech All Right Reserved.
