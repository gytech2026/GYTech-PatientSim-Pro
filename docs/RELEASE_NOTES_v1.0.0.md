# Release Notes — GYTech PatientSim Pro v1.0.0

> **DRAFT — NOT PUBLISHED.** This release candidate is awaiting owner approval of
> licensing, repository identity, contacts, code signing, and publication. No
> release date has been assigned. Do not publish these notes as a final release
> until the release criteria are met.

**Copyright © 2026 GYTech. All Rights Reserved.**

---

## Release title

**GYTech PatientSim Pro v1.0.0 — Advanced Patient Vital Signs Monitor & Defibrillator Simulator**

**Channel:** release candidate / publication pending  
**Release date:** not scheduled  
**License:** pending owner approval — not open source yet  
**Medical status:** educational simulation only; not a medical device  
**Primary build verified:** Windows 11 x64 (Electron 34.1.1)

---

## Summary

GYTech PatientSim Pro combines a multiparameter patient monitor with a
software-only professional defibrillator simulator. This release candidate also
adds a native Electron desktop application with Windows EXE, MSI, and portable ZIP
packaging, a user-controlled update notification system, local data export/import,
and application lifecycle/security controls.

The simulation remains entirely software-based. No physical medical device
communication or electrical output exists.

---

## Highlights

### Simulation

- Eight live waveform channels: ECG, pleth, capnography, respiration, ART, CVP,
  PA, and ICP.
- Fourteen simulated ECG rhythms and a live educational 12-lead view.
- Intermittent NIBP, invasive pressures, temperature, BIS, and alarm integration.
- Manual, AED, synchronized cardioversion, monitor, and pacing modes.
- CPR simulation with compression/ventilation counters and teaching feedback.
- Twenty deterministic education scenarios and six sample patients.
- Event history, CSV export, printable simulation report, and local persistence.
- Responsive layout verified at 1920×1080, 1600×900, 1366×768, 1280×720, and
  tablet widths in Chromium/Electron.

### Desktop

- Native resizable window with File/View/Help menus, fullscreen support, and
  window-state persistence.
- GYTech application icon and About panel with version, publisher, copyright, and
  medical disclaimer.
- Windows assisted NSIS installer, MSI package, and portable ZIP.
- Linux AppImage/DEB/RPM and macOS x64/ARM64 DMG build configuration for native
  CI runners.
- Update notifications for stable GitHub Releases using a user-controlled
  **Download Update** flow. No silent installation.
- Local data export/import and application logging.
- Context isolation, sandboxing, restrictive permissions, custom `app://`
  protocol, CSP headers, and an external-link GitHub allowlist.

---

## Installation

### Windows desktop

Built artefacts are produced locally in `release/` when available:

- `GYTech-PatientSim-Pro-Setup-v1.0.0.exe` — assisted EXE installer
- `GYTech-PatientSim-Pro-x64-v1.0.0.msi` — Windows Installer package
- `GYTech-PatientSim-Pro-Portable-v1.0.0.zip` — extract-and-run package

The desktop builds are unsigned. Windows SmartScreen may warn. See
[INSTALLATION.md](../INSTALLATION.md) and [DESKTOP_APPLICATION.md](DESKTOP_APPLICATION.md).

### Browser/development

```powershell
npm install
npm start
```

Open <http://127.0.0.1:8080/>.

### Linux and macOS

Configured for native CI builds but **not built or tested on this Windows host**.
Do not claim those artefacts work until their native jobs run and the outputs are
launched. macOS builds are unsigned and not notarised.

---

## Compatibility

- Windows 10/11 x64 — desktop build tested on Windows 11 x64.
- Linux x64 — AppImage/DEB/RPM configured; unverified.
- macOS x64 and ARM64 — DMG configured; unverified.
- Browser development — Chromium-based browsers tested; Firefox/Safari not in the
  automated matrix.
- Node.js 18+ for development/test tooling; end users do not need Node.js.
- Screens: 1366×768 and above recommended; tablet layout reflows.

---

## Updates

The update channel is **not live** in this repository. `desktop/update-config.json`
contains an empty repository placeholder because no official GitHub repository URL
has been confirmed. The UI reports that the update source is not configured and
does not invent a release.

When configured, the application checks the official GitHub Releases API for a
stable release and only opens the official release page after user action. It
never downloads or installs silently. See [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md).

---

## Known limitations

- No clinical validation, regulatory approval, or medical-device certification.
- No physical device connectivity or electrical output.
- Synchronized cardioversion validates simulated sync eligibility and markers
  rather than real R-wave-timed hardware output.
- Pacing failure-to-capture is simplified.
- 3-/5-lead strips are partial; 12-lead view is implemented.
- Acoustic alarms, speech synthesis, and native print dialogs are not fully
  covered by automation.
- Automated browser testing is Chromium/Electron only; Firefox/Safari require
  additional validation.
- Windows builds are unsigned; macOS signing/notarisation is not configured.
- Linux and macOS packages are configured but not built in the current
  Windows-only verification environment.
- An NSIS 1.0.0→synthetic 1.0.1 upgrade passed locally; no public 1.0.1 release
  exists and the MSI cross-version upgrade was not tested.
- The live update channel is blocked pending the official repository URL.
- Browser/desktop localStorage is not secure clinical record storage.
- GitHub Actions workflows are configured but have not been executed on GitHub.
- Native clinical alarm-standard compliance is not claimed.

---

## Important medical disclaimer

**This application is an educational software simulation only. It is not a
medical device, is not clinically validated, does not replace professional
training, and must not be used for patient diagnosis, treatment, or actual
emergency medical decisions.** The application delivers no electrical output and
must never connect to or control real medical equipment. See
[DISCLAIMER.md](../DISCLAIMER.md).

---

## License

**PENDING OWNER APPROVAL.** No open-source license is currently effective. See
[LICENSE](../LICENSE), [LICENSE-FAQ.md](../LICENSE-FAQ.md), and the proposed
non-effective draft at
[legal/LICENSE-APACHE-2.0-PROPOSED.txt](../legal/LICENSE-APACHE-2.0-PROPOSED.txt).

---

## Verification

See [TESTING_REPORT.md](../TESTING_REPORT.md) for executed browser tests, desktop
integration tests, packaged application smoke tests, installer tests, and
explicitly unverified areas. Synthetic update fixtures are test data only; they
are not an official release.

---

Copyright © 2026 GYTech. All Rights Reserved.
