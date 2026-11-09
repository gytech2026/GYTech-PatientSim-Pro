# Screenshot Guide — GYTech PatientSim Pro

**Copyright © 2026 GYTech. All Rights Reserved.**

All application screenshots in `assets/screenshots/` were captured from the
running GYTech PatientSim Pro application using Chromium/Electron automation. No
stock images, generated UI mockups, or manufacturer screenshots are used. The
desktop application uses the same renderer; these captures are from the browser
development surface, not a mockup.

- Capture harness: [`tests/capture-screenshots.js`](../tests/capture-screenshots.js)
- Capture viewport: **1600 × 926** content area (consistent across application screenshots)
- Image format: optimized PNG
- Demo data: fictional sample patient and deterministic scenarios
- Branding assets: original GYTech SVG artwork rendered to PNG

---

## Required capture set

| Screenshot | Actual captured state | Dimensions |
|---|---|---|
| [`main-dashboard.png`](../assets/screenshots/main-dashboard.png) | Normal healthy patient, monitor and defibrillator in monitor mode | 1600×926 |
| [`ecg-monitoring.png`](../assets/screenshots/ecg-monitoring.png) | Atrial fibrillation scenario, live ECG and monitor | 1600×926 |
| [`ecg-12-lead.png`](../assets/screenshots/ecg-12-lead.png) | Simulated 12-lead ECG modal | 1600×926 |
| [`spo2-monitoring.png`](../assets/screenshots/spo2-monitoring.png) | Hypoxia scenario, pleth/SpO₂ and monitor | 1600×926 |
| [`capnography.png`](../assets/screenshots/capnography.png) | Capnography scenario with obstruction pattern | 1600×926 |
| [`vital-signs.png`](../assets/screenshots/vital-signs.png) | Invasive and BIS channels enabled, vital-sign rail | 1600×926 |
| [`alarm-management.png`](../assets/screenshots/alarm-management.png) | Critical VF alarm and Alarm Management modal | 1600×926 |
| [`manual-defibrillator.png`](../assets/screenshots/manual-defibrillator.png) | Manual mode, selected energy, simulated charged state | 1600×926 |
| [`aed-mode.png`](../assets/screenshots/aed-mode.png) | AED analysis result on simulated VF | 1600×926 |
| [`synchronized-cardioversion.png`](../assets/screenshots/synchronized-cardioversion.png) | Stable VT, sync mode, simulated sync markers | 1600×926 |
| [`pacing-mode.png`](../assets/screenshots/pacing-mode.png) | Asystole scenario, pacing active with simulated capture | 1600×926 |
| [`cpr-simulation.png`](../assets/screenshots/cpr-simulation.png) | CPR modal with active simulated compressions | 1600×926 |
| [`patient-management.png`](../assets/screenshots/patient-management.png) | Patient Management modal with fictional sample profiles | 1600×926 |
| [`scenario-selection.png`](../assets/screenshots/scenario-selection.png) | Scenario library with selected sepsis-like scenario | 1600×926 |
| [`event-history.png`](../assets/screenshots/event-history.png) | Event History modal with recorded simulation events | 1600×926 |
| [`system-settings.png`](../assets/screenshots/system-settings.png) | Device Settings modal including Browser-edition desktop data/update panel | 1600×926 |

## Branding assets

| Asset | Purpose | Dimensions |
|---|---|---|
| [`gytech-logo.svg`](../assets/branding/gytech-logo.svg) | Original GYTech application mark | 640×640 vector |
| [`gytech-banner.svg`](../assets/branding/gytech-banner.svg) / [`gytech-banner.png`](../assets/branding/gytech-banner.png) | README repository banner | 1600×520 |
| [`social-preview.svg`](../assets/branding/social-preview.svg) / [`social-preview.png`](../assets/branding/social-preview.png) | GitHub social preview | 1280×640 |
| [`gytech-patientsim-mark.svg`](../assets/icons/gytech-patientsim-mark.svg) | Favicon/mark | 64×64 vector |

## Verification performed

The capture harness confirmed:

- Browser page loaded from a local HTTP server.
- Screenshot image dimensions were non-zero and consistent.
- Application screenshots show the actual live monitor canvas and UI.
- Screenshots were captured only after the relevant feature/modal was present.
- The required files exist in `assets/screenshots/` and are referenced by the
  README.
- No stock or manufacturer imagery is used.

## Re-capture

```powershell
npm install
npm run screenshots
```

The harness clears the test browser profile, starts a local HTTP server, renders
the original GYTech branding assets, then captures each implemented feature. It
does not publish, push, or deploy anything.

## Screenshot handling rules

- Do not use real patient data.
- Do not edit a screenshot to show an unimplemented feature.
- It is acceptable to capture a clean state without transient toast overlays.
- It is not acceptable to replace a missing feature with a stock image.
- Any new screenshot must be captured from the running application.

---

Copyright 2026 GYTech All Right Reserved.
