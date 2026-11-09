# Release Notes — GYTech PatientSim Pro v1.0.1

**Published:** 2026-11-09  
**Tag:** `v1.0.1`  
**Channel:** stable  
**License:** Apache License 2.0 (`Apache-2.0`)  
**Platform:** Windows 11 x64 (tested); Windows 10 not verified; Linux and macOS not
built or verified  
**Copyright © 2026 GYTech. All Rights Reserved.**

> **EDUCATIONAL SIMULATION ONLY.** This application is not a medical device and
> must not be used for real patient monitoring, medical diagnosis, treatment,
> emergency response, or clinical decision-making. All vital signs, ECG waveforms,
> alarms, AED, defibrillation, cardioversion, and pacing actions are simulated.
> The application delivers no electrical output and must not connect to or control
> real medical equipment.

---

## Release title

**GYTech PatientSim Pro v1.0.1 — Advanced Patient Vital Signs Monitor & Defibrillator Simulator**

---

## Summary

The first stable GitHub Release of GYTech PatientSim Pro. It packages the browser
simulator as a Windows x64 Electron desktop application with a user-controlled
update notification flow, Apache-2.0 licensing, and the completed documentation
set.

---

## Downloads

Release page:
<https://github.com/gytech2026/GYTech-PatientSim-Pro/releases/tag/v1.0.1>

| Package | File | SHA-256 (GitHub asset digest) |
|---|---|---|
| Assisted EXE installer | `GYTech-PatientSim-Pro-Setup-v1.0.1.exe` | `ae451053da157b7bfba005aa0cb473d1227307d0d642d979bfe71550aba63fd0` |
| MSI package | `GYTech-PatientSim-Pro-x64-v1.0.1.msi` | `56aa802d13bba451b51c0ec3e1531807e543f83905042588b608c36b6d624b6c` |
| Portable ZIP | `GYTech-PatientSim-Pro-Portable-v1.0.1.zip` | `8530b1683f22bfbde2331d07a9afdcafca1d38353782d216fdb260a1ed199a42` |

Windows binaries are unsigned; Windows SmartScreen may warn about an unknown
publisher. Linux and macOS packages are not provided.

---

## Highlights

- Advanced simulated patient vital signs monitoring.
- ECG waveform visualization with multiple simulated rhythms.
- AED and manual defibrillation simulation.
- Synchronized cardioversion and external pacing simulation.
- CPR simulation and event history.
- Configurable alarms and patient scenarios.
- Local data export and import.
- Stable-release update checking through GitHub Releases (notify then manual
  download; no automatic installation).

---

## Verification

- Automated suite: **75 checks passed, 0 failed** (21 interactive, 12 deep, 18 UI,
  24 desktop) plus repository validation and the packaged smoke test.
- Windows x64 desktop build completed and the published packages were produced
  from the v1.0.1 source.
- Windows 11 x64 was the tested platform. Windows 10, Linux, and macOS were not
  verified.

---

## Important notes

- No package format performs automatic installation. **Download Update** opens the
  official GitHub Release page; installation is manual.
- The desktop application is sandboxed (`sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`).
- Update metadata is fetched only from the official GitHub repository.
- No clinical validation, regulatory approval, or medical-device certification is
  claimed.

---

## License

Apache License, Version 2.0 (SPDX: `Apache-2.0`). See [LICENSE](../LICENSE) and
[NOTICE](../NOTICE).

---

Copyright © 2026 GYTech. All Rights Reserved.
