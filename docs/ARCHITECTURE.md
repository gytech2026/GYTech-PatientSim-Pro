# Architecture — GYTech PatientSim Pro

**Version:** 1.0.0 repository release candidate  
**Copyright © 2026 GYTech. All Rights Reserved.**

> Educational simulation only. Not a medical device. See
> [DISCLAIMER.md](../DISCLAIMER.md).

---

## 1. Architectural goals

The application is a static, browser-only simulation platform. The architecture
prioritizes:

- One authoritative physiological state.
- Deterministic rhythm and scenario behavior where practical.
- A single animation loop for all live waveforms.
- Explicit separation between simulation, alarms, therapy state, and UI.
- No backend, telemetry, or physical device connectivity.
- Clear unavailable states rather than fabricated measurements.
- Observable safety interlocks around simulated defibrillation and pacing.

---

## 2. System context

```mermaid
flowchart LR
    U[Learner / Instructor] --> UI[Bedside Monitor UI]
    UI --> SIM[Simulation Engine]
    SIM --> PHYS[Physiology Model]
    SIM --> WAV[Waveform Renderer]
    SIM --> ALM[Alarm Engine]
    UI --> DEFIB[Defibrillator FSM]
    UI --> CPR[CPR Module]
    UI --> SCEN[Scenario Controller]
    DEFIB --> PHYS
    CPR --> PHYS
    SCEN --> PHYS
    PHYS --> ALM
    ALM --> AUDIO[Web Audio Annunciation]
    UI --> STORE[(Browser localStorage)]
    UI --> REPORTS[CSV / PNG / Print Reports]
    DEFIB -. software only .-> NOOUT[No physical output]
```

---

## 3. Module map

```mermaid
flowchart TD
    APP[app.js<br/>UI controller] --> STATE[state.js<br/>Store + events]
    APP --> PHYS[physiology.js]
    APP --> PAT[patient.js]
    APP --> WAV[waveform.js]
    APP --> ALM[alarms.js]
    APP --> DEFIB[defibrillator.js]
    APP --> AED[aed.js]
    APP --> PACE[pacing.js]
    APP --> CPR[CPR via physiology]
    APP --> SCEN[scenarios.js]
    APP --> HIST[history.js]
    APP --> AUDIO[audio.js]
    APP --> SETTINGS[settings.js]
    APP --> ECG12[ecg12lead.js]
    WAV --> ECG[ecg.js]
    WAV --> SPO2[spo2.js]
    WAV --> RESP[respiration.js]
    WAV --> CAPNO[capnography.js]
    WAV --> BP[bloodpressure.js]
    WAV --> STATE
    ALM --> PHYS
    DEFIB --> AED
    DEFIB --> PACE
    PACE --> PHYS
    AED --> PHYS
    PHYS --> PAT
    PHYS --> HIST
    HIST --> STATE
    ECG12 --> ECG
    ECG12 --> HIST
    AUDIO --> STATE
    SETTINGS --> STATE
```

---

## 4. Single simulation loop

`simulation.js` owns the only `requestAnimationFrame` loop. Every frame:

```mermaid
sequenceDiagram
    participant RAF as requestAnimationFrame
    participant SIM as SimulationController
    participant PHYS as PhysiologyEngine
    participant DEFIB as Defibrillator FSM
    participant WAVE as WaveformEngine
    participant ALARM as AlarmEngine
    participant UI as app.js UI tick

    RAF->>SIM: frame(timestamp)
    SIM->>PHYS: update(dt × speed)
    SIM->>DEFIB: tick(dt)
    SIM->>WAVE: render(dt)
    SIM->>ALARM: evaluate()
    SIM->>UI: ui tick every 200 ms
    SIM->>RAF: next frame
```

This avoids duplicate animation loops. `ecg12lead.js` renders from the same loop
when its modal is open. Audio uses bounded `setInterval` schedulers, not animation
loops.

---

## 5. State model

`state.js` exposes a singleton `store` with:

- `settings` — persisted user preferences and alarm limits.
- `sim` — live physiological, waveform, device, scenario, CPR, pacing, and alarm
  state.
- `patients` and `activePatientId` — managed by `patient.js`.
- `ui` — transient display flags and modal state.
- `meta` — application identity/version/copyright.

An event bus publishes explicit events such as:

- `simulation:ui-tick`
- `patient:selected`
- `patient:context-applied`
- `rhythm:changed`
- `alarms:changed`
- `defib:changed`
- `cpr:compression`
- `scenario:progression`
- `history:changed`

Modules do not use unrelated global variables. Browser storage is written only
through validated persistence helpers.

---

## 6. Physiology data flow

```mermaid
flowchart TD
    SCEN[Scenario / Instructor / Baseline] --> TARGETS[Physiological Targets]
    RHYTHM[Rhythm + HR] --> TARGETS
    CPR[CPR state] --> CIRC[Circulation state]
    PACE[Pacing capture] --> CIRC
    PULSE[Pulse / perfusion state] --> CIRC
    TARGETS --> PHYS[Physiology update]
    CIRC --> PHYS
    PHYS --> VITALS[Vitals snapshot]
    PHYS --> WAVE[Waveform configs]
    PHYS --> ALARMS[Alarm snapshot]
    VITALS --> UI[UI rail]
    WAVE --> CANVAS[Canvas engine]
    ALARMS --> ALARMUI[Alarm banner / audio]
```

Key invariants:

- VF and asystole force a pulseless, zero-pressure state.
- PEA uses organized electrical activity with an explicitly absent pulse.
- SpO₂ and pulse rate are unavailable when the sensor or pulse state cannot
  support a valid reading.
- A shock may organize the ECG but does not automatically restore circulation.
- ROSC requires an explicit recovery transition with an organized rhythm.

---

## 7. ECG rendering pipeline

```mermaid
flowchart LR
    CFG[Rhythm + HR + lead + gain + noise] --> SCHED[ECG event scheduler]
    SCHED --> BEATS[Atrial / ventricular beat events]
    BEATS --> MORPH[Gaussian morphology synthesis]
    MORPH --> BUFFER[Sample buffer]
    BUFFER --> DRAW[Canvas grid + scrolling trace]
    CFG --> DEFIB[Defibrillator mini display]
    BEATS --> SYNC[Sync marker positions]
    MORPH --> LEADS[12-lead shared beat timeline]
```

- The ECG source is parameterized, not a static image.
- All 12 leads share a beat timeline but use different approximate lead-vector
  morphology.
- The waveform is educational and not diagnostic.

Other waveform sources:

- Pleth: pulse rate, perfusion, signal quality, respiratory modulation.
- Respiration: rate, depth, pattern, irregularity.
- Capnography: rate, EtCO₂, educational pattern shapes.
- ART/CVP/PA/ICP: pressure-specific waveform synthesis.

---

## 8. Alarm processing flow

```mermaid
flowchart TD
    PHYS[Physiology snapshot] --> DETECT[Detect critical / warning / technical]
    LIMITS[Alarm limits + group toggles] --> DETECT
    DETECT --> ACTIVE[Active alarm map]
    ACTIVE --> BANNER[Visual banner]
    ACTIVE --> HISTORY[Alarm event history]
    ACTIVE --> AUDIO[One audible scheduler]
    SILENCE[Silence timer] --> AUDIO
    ACK[Acknowledgement] --> AUDIO
    TIME[45s persistence] --> ESCALATE[Warning escalation]
    ESCALATE --> ACTIVE
```

Silence affects sound only. Visual alarms remain active. A single alarm scheduler
selects the highest unacknowledged priority; there is no uncontrolled stacking of
audio loops.

---

## 9. Defibrillator state machine

```mermaid
stateDiagram-v2
    [*] --> MONITORING
    MONITORING --> READY: therapy mode + pads
    READY --> CHARGING: charge allowed
    CHARGING --> CHARGED: charge complete
    CHARGING --> DISARMING: disarm / pads removed / mode change
    CHARGED --> DISARMING: disarm / pads removed / mode change
    CHARGED --> SHOCK_SIMULATION: delivery allowed
    DISARMING --> READY
    SHOCK_SIMULATION --> POST_EVENT_ANALYSIS
    POST_EVENT_ANALYSIS --> READY
    READY --> ERROR: battery/device fault
    CHARGING --> ERROR: battery/device fault
    CHARGED --> ERROR: battery/device fault
    ERROR --> READY: simulated battery restored
```

Guards include pads, battery, charge completion, AED recommendation and safety
confirmation, sync eligibility, and pacing separation. No real electrical output
exists.

---

## 10. AED workflow

```mermaid
flowchart TD
    PADS[Attach simulated pads] --> ANALYZE[Analyse simulated rhythm]
    ANALYZE --> CLASSIFY[Rhythm + explicit pulse state]
    CLASSIFY --> SHOCKABLE{Shock advised?}
    SHOCKABLE -- Yes --> CHARGE[Simulated charge]
    CHARGE --> SAFETY[Operator safety confirmation]
    SAFETY --> SHOCK[Software-only simulated shock]
    SHOCK --> POST[Post-event reassessment]
    SHOCKABLE -- No --> CPR[Continue simulated CPR / reassess]
    POST --> ANALYZE
```

Stable perfusing VT is not treated as an AED shock indication. PEA and asystole
are non-shockable in the educational model.

---

## 11. Scenario workflow

```mermaid
flowchart LR
    SELECT[Select scenario] --> START[Start]
    START --> INITIAL[Apply deterministic initial state]
    INITIAL --> TIMER[Scenario timer]
    TIMER --> PROGRESS{Progression threshold?}
    PROGRESS -- Yes --> APPLY[Apply parameter changes]
    APPLY --> EVENT[Record scenario event]
    EVENT --> TIMER
    PROGRESS -- Pause --> PAUSE[Pause]
    PAUSE --> RESUME[Resume]
    RESUME --> TIMER
    TIMER --> END[Complete / reset / stop]
```

Scenario changes flow through the physiology target engine, so related vitals,
waveforms, and alarms update together.

---

## 12. Persistence

```mermaid
flowchart TD
    UI[Settings / patient form] --> VALID[Validate + normalize]
    VALID --> STORE[Store.update...]
    STORE --> LS[(localStorage)]
    LS --> BOOT[Next application load]
    BOOT --> RESTORE[Restore settings, patients, active patient, history]
    RESTORE --> RESET[Reset transient therapy states]
```

Persisted keys use the `gytech.patientsim.*` namespace. Defibrillator charge,
pacing, sync mode, and active scenario state are intentionally not restored after
reload.

---

## 13. Browser security boundaries

- Static same-origin application.
- Restrictive CSP meta policy and `no-referrer` referrer policy.
- No inline scripts or remote assets.
- User-supplied text escaped before HTML insertion.
- Google-style browser storage only; no encrypted clinical record.
- No backend server, authentication layer, or telemetry.
- Print reports and downloads are local browser outputs.

See [SECURITY.md](../SECURITY.md).

---

## 14. Deliberate limitations

- Not clinically validated.
- Simulated AED/sync/pacing logic is educational.
- Synchronization validates simulated marker eligibility; it is not a real-time
  R-wave-synchronized hardware implementation.
- Pacing failure-to-capture is simplified.
- CPR quality is not measured from sensors.
- No physical device or electrical interface.
- Cross-browser and acoustic behavior require further verification.

---

## 15. Desktop shell

The Electron 34.1.1 desktop shell wraps the same renderer. It does not fork the
simulation modules.

```mermaid
flowchart LR
    M[Electron main] -->|app://gytech static protocol| R[Existing renderer]
    M --> W[Native window / menu / fullscreen]
    M --> L[Local log + window-state JSON]
    M --> U[GitHub release metadata fetch]
    M --> I[IPC handlers]
    I --> P[Frozen preload bridge]
    P --> D[js/desktop.js]
    D --> R
    U --> V[Validate stable release / HTTPS GitHub]
    V --> D
```

- Main process owns lifecycle, window state, menu, protocol, update fetch, logging,
  permissions, and external-link validation.
- Renderer is sandboxed with context isolation and no Node integration.
- Preload exposes only purpose-specific methods.
- `js/desktop.js` handles About, update notification preferences, local-data
  export/import, and renderer error logging.
- Update fetch occurs in main; the renderer CSP remains `connect-src 'self'`.
- See [DESKTOP_APPLICATION.md](DESKTOP_APPLICATION.md) and
  [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md).

---

Copyright © 2026 GYTech. All Rights Reserved.
