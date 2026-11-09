# ECG Guide — Educational Modeling

**Copyright 2026 GYTech All Right Reserved.**

> **Not a diagnostic ECG system.** The output is an approximate educational
> simulation. Do not use it for clinical interpretation. See
> [DISCLAIMER.md](../DISCLAIMER.md).

---

## 1. Rhythm model

`js/ecg.js` schedules beat events and synthesizes P, QRS, ST, and T components
from parameterized morphology. The model supports:

- Normal sinus rhythm.
- Sinus bradycardia.
- Sinus tachycardia.
- Atrial fibrillation (irregular ventricular timing, no organized P wave).
- Atrial flutter (educational flutter waves).
- Supraventricular tachycardia.
- Ventricular tachycardia (wide-complex model).
- Ventricular fibrillation (chaotic synthesis).
- Asystole (near-flat trace with minimal baseline noise).
- Premature ventricular contractions.
- First-degree AV block.
- Second-degree AV block.
- Third-degree AV block.
- Paced rhythm.

Heart rate changes affect pending cycle timing. Lethal rhythms force a coherent
pulseless state through the physiology engine.

## 2. Display configuration

| Setting | Effect |
|---|---|
| Monitor lead | Educational lead-specific morphology (I–V6) |
| 3/5/12-lead mode | Changes monitor metadata and 12-lead availability context |
| Sweep speed | Changes visible time window |
| Gain | Scales the waveform display |
| Grid | Toggles the canvas grid |
| Noise | Adds baseline noise |
| Motion artifact | Adds intermittent artifact spikes |
| Baseline wander | Adds slow baseline movement |
| Lead-off | Replaces valid ECG with a lead-off state and technical alarm |

Gain affects visual amplitude, not the underlying physiological event model.

## 3. 12-lead view

The 12-lead modal displays:

- I, II, III, aVR, aVL, aVF, V1–V6.
- A shared beat timeline.
- Approximate lead-specific polarities, R/S progression, and repolarization shape.
- Adjustable gain.
- A 5-second display per lead.
- Patient information, rhythm, heart rate, and timestamp.
- PNG recording and print report.

The 12 leads are not twelve copies of one trace; they use different morphology
parameters. They are still an educational vector approximation, not a
diagnostic-quality 12-lead ECG.

## 4. Synchronization markers

The defibrillator screen draws simulated R-wave markers from the same ECG beat
timeline used by the monitor. SYNC mode requires a perfusing organized rhythm and
valid simulated eligibility. The application does not provide hardware-timed
R-wave synchronized output; see [DEFIBRILLATOR_GUIDE.md](DEFIBRILLATOR_GUIDE.md).

## 5. Clinical limitations

- No validated electrode model, axis calculation, ST-segment pathology model, or
  arrhythmia diagnostic algorithm.
- No claim of sensitivity/specificity for shockable rhythms.
- Waveforms are teaching approximations.
- Pacing spikes and capture behavior are simplified.
- The app is not a substitute for ECG training or clinical interpretation.

---

Copyright 2026 GYTech All Right Reserved.
