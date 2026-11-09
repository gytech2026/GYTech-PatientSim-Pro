# Developer Guide — GYTech PatientSim Pro

**Version:** 1.0.0 repository release candidate  
**Copyright © 2026 GYTech. All Rights Reserved.**

> Educational simulation software only. See [DISCLAIMER.md](DISCLAIMER.md).

---

## 1. Quick development setup

```powershell
npm install
npm start
```

Open `http://127.0.0.1:8080/`.

Useful commands:

```powershell
npm run validate
npm run check:secrets
npm run test
npm run test:desktop
npm run screenshots
npm run build:pages
npm run desktop:dev
npm run desktop:build:win
```

On Linux CI, use `xvfb-run -a npm run test`. The test scripts launch Electron
through `scripts/run-electron-test.mjs`, which adds `--no-sandbox` for the test
process only on Linux CI (see
[Test harnesses](#test-harnesses) and [tests/README.md](tests/README.md)).

---

## 2. Architecture at a glance

The browser application is static with no runtime npm dependencies and no bundler.
The optional Electron desktop shell serves the same renderer through a custom
protocol with a least-privilege preload bridge. `simulation.js` owns the single
animation loop. `state.js` owns the central store. `physiology.js` owns the
physiological model. UI code in `app.js` reads the store and renders the DOM.
Desktop-only About/update/data integration lives in `js/desktop.js`; privileged
lifecycle, update fetch, and logging live in `desktop/main.cjs`. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DESKTOP_APPLICATION.md](docs/DESKTOP_APPLICATION.md).

```text
index.html
   → js/app.js (UI/events)
      → js/state.js (store/event bus)
      → js/physiology.js (physiology)
      → js/waveform.js (canvas engine)
      → js/alarms.js (alarm engine)
      → js/defibrillator.js (FSM) → js/aed.js / js/pacing.js
      → js/history.js (events, CSV, reports)
      → js/audio.js (Web Audio)
      → js/settings.js (preferences)
```

---

## 3. Module responsibilities

| Module | Responsibility |
|---|---|
| `js/app.js` | DOM wiring, event handlers, modal system, UI rendering, screenshot-facing display state |
| `js/state.js` | Defaults, central store, event bus, persistence normalization |
| `js/patient.js` | Patient profiles, sample data, CRUD, selection |
| `js/physiology.js` | Physiologic targets, smoothing, NIBP, CPR, scenarios, pacing effects, ROSC |
| `js/vitals.js` | Unit-aware formatting helpers |
| `js/ecg.js` | ECG rhythm/event scheduler and morphologies |
| `js/ecg12lead.js` | 12-lead educational display, PNG capture, print report |
| `js/spo2.js` | Plethysmography generation |
| `js/respiration.js` | Respiratory movement waveform |
| `js/capnography.js` | Capnogram patterns |
| `js/bloodpressure.js` | ART/CVP/PA/ICP waveforms |
| `js/temperature.js` | Temperature display/status helpers |
| `js/pacing.js` | Pacing controller and capture state |
| `js/alarms.js` | Alarm detection, active set, acknowledge, silence, escalation |
| `js/defibrillator.js` | Defibrillator FSM and safety interlocks |
| `js/aed.js` | AED analysis/recommendation workflow |
| `js/scenarios.js` | Twenty deterministic scenarios |
| `js/simulation.js` | Single `requestAnimationFrame` driver |
| `js/waveform.js` | Canvas trace buffers, resize, drawing |
| `js/history.js` | Event recording, filtering, CSV, report HTML |
| `js/audio.js` | Web Audio alarm/metronome scheduler |
| `js/settings.js` | Display/unit/alarm configuration and reset |
| `js/utilities.js` | Pure helpers, conversions, storage, downloads |
| `js/desktop.js` | About, update notification UI, update preferences, local-data export/import, renderer logging |
| `desktop/main.cjs` | Electron lifecycle/menu/security, static protocol, update API fetch, logs, IPC |
| `desktop/preload.cjs` | Frozen contextBridge API; no unrestricted Node/IPC exposure |
| `desktop/update-utils.cjs` | Semantic-version comparison and release-metadata validation |
| `desktop/update-config.json` | Owner-configured official GitHub repository; currently blank |

---

## 4. State and events

Never create parallel state that can contradict the store. Use:

```js
store.emit('event:name', payload);
store.on('event:name', handler);
```

Persist only settings, patient profiles, active patient ID, and event history.
Do not restore therapy transient states such as charge, pacing, or sync mode.

Persisted keys:

- `gytech.patientsim.settings.v1`
- `gytech.patientsim.patients.v1`
- `gytech.patientsim.active-patient.v1`
- `gytech.patientsim.history.v1`

---

## 5. Simulation engine

- `simulation.js` runs one loop: physiology → defibrillator tick → waveform
  render → alarm evaluation → UI tick.
- The simulation speed setting multiplies the time used by physiology and
  waveform generation.
- Do not create a second RAF loop.
- Use simulation-state guards rather than timestamp-only effects when possible.
- Lethal rhythms force pulselessness.
- A shock can organize the ECG but must not automatically restore ROSC.

When adding a physiological parameter:

1. Add validated defaults to `state.js`.
2. Add derivation/update logic in `physiology.js`.
3. Add display formatting in `vitals.js` and UI in `app.js`.
4. Add relevant alarm behavior in `alarms.js`.
5. Record significant events in `history.js` via the history request path.
6. Add tests and documentation.

---

## 6. Waveform rendering

- Waveform sources implement `advance(dt, config)` and a `sampleRate`.
- `waveform.js` maintains sample buffers and draws against a time window derived
  from sweep speed.
- Canvases are DPR-aware and resized through `ResizeObserver`.
- The 12-lead renderer shares a beat timeline across leads.
- Do not use static waveform images for live traces.
- Sensor-off states must not continue to display valid-looking numerical data.

---

## 7. Alarms

- `alarmEngine.evaluate()` is called from the main loop and is throttled.
- Alarms have stable IDs and are computed from the current physiology/sensor
  snapshot.
- Silencing is audible-only.
- Acknowledgement must not remove the underlying condition.
- Warning escalation is persisted while the condition remains active.
- Keep one audible scheduler; do not create overlapping interval loops.

---

## 8. Defibrillator FSM

- Use `defibrillator.setMode`, `charge`, `disarm`, and `deliverShock`; do not
  mutate FSM state directly from UI code.
- Validate pads, battery, charge, mode, AED recommendation/safety, and sync
  eligibility before delivery.
- Pacing belongs to its own controller; do not model it as a defibrillation
  charge.
- Shock delivery must route through `physiology.applyShock` and must not
  auto-ROSC.
- The AED controller owns analysis timing/recommendation. The defibrillator FSM
  owns charge/shock state.

---

## 9. Testing and debugging

### Local browser debugging

- Serve over HTTP.
- Use DevTools console and network tabs.
- Confirm no remote asset requests.
- Confirm no CSP violations.
- Inspect `localStorage` under `gytech.patientsim.*`.
- Use `npm run validate` for structure/link/screenshot checks.

### Test harnesses

- `tests/electron-harness.js` — cold load and DOM/canvas integrity.
- `tests/interactive-harness.js` — required functional flows and persistence.
- `tests/deep-tests.js` — all scenarios/rhythms and device invariants.
- `tests/ui-harness.js` — visible controls, modals, responsive layouts.
- `tests/desktop-harness.js` — desktop About/update UI, data validation, native
  window behavior, synthetic offline/error states.
- `tests/capture-screenshots.js` — genuine application screenshot capture.

Tests require Electron:

```powershell
npm install
npm test
```

Each harness runs through `scripts/run-electron-test.mjs`, which starts the real
Electron binary, clears `ELECTRON_RUN_AS_NODE`, forwards signals, and exits with
the harness's own status. On Linux CI the launcher adds `--no-sandbox` because
GitHub-hosted runners cannot provide Chromium's root-owned `chrome-sandbox`
helper; the flag is limited to that test process and platform. Production is
unchanged: `desktop/main.cjs` keeps `sandbox: true`, and `desktop:dev` and
packaged builds never receive the flag.

State mutation: tests write localStorage and may leave sample data in the test
profile.

### Adding tests

- Prefer behavior-focused checks over implementation-only assertions.
- Include safety-boundary tests.
- Never claim tests that were not executed.
- Update `TESTING_REPORT.md` with actual results.

## 9.1 Desktop development and packaging

- Desktop entry point: `desktop/main.cjs`; least-privilege bridge:
  `desktop/preload.cjs`.
- Renderer integration/update UI: `js/desktop.js`.
- Run the desktop shell against the source with `npm run desktop:dev`.
- Run `npm run test:desktop`; it uses a **synthetic** update bridge and a local
  HTTP server, not GitHub.
- Build Windows packages with `npm run desktop:build:win`; output goes to
  `release/` and is intentionally git-ignored.
- Generate hashes with `npm run desktop:checksums`.
- Launch a packaged build with
  `npm run desktop:smoke -- "release\win-unpacked\GYTech PatientSim Pro.exe"`.
- Clear `ELECTRON_RUN_AS_NODE` before Electron or packaged-app launches.
- The official update `OWNER/REPOSITORY` is intentionally blank. Do not insert a
  fake repository. See [docs/UPDATE_SYSTEM.md](docs/UPDATE_SYSTEM.md).
- Do not commit `release/`, installers, signing credentials, or generated logs.
- Electron/Chromium runtime notices must be preserved in packaged output.

---

## 10. Security and privacy expectations

- Escape user text before HTML insertion.
- Do not weaken CSP without review.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Do not expose unrestricted IPC/Node APIs through the preload bridge.
- Validate any external URL against the GitHub allowlist; never execute downloads.
- Do not add telemetry, external CDNs, remote fonts, tracking, or real data.
- Do not commit signing credentials, update tokens, or secrets.
- Treat localStorage as untrusted local data.
- Follow [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md).

---

## 11. Contribution workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting. Keep pull requests focused,
update documentation and tests, and avoid medical claims beyond the simulator's
scope. Licensing remains pending owner approval.

---

Copyright 2026 GYTech All Right Reserved.
