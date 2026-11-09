# Changelog

All notable changes to GYTech PatientSim Pro are documented here. The project
uses [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions and
[Semantic Versioning](https://semver.org/).

Copyright © 2026 GYTech. All Rights Reserved.

> Release dates are intentionally omitted until an approved public release is
> published. The 1.0.0 entry below describes a repository release candidate, not
> a published release.

## [Unreleased]

### Planned

- Owner-approved license and contribution policy.
- Confirmed GitHub organization/repository URL and homepage.
- Official GitHub repository configured for live update checks.
- Windows code signing and macOS Developer ID signing/notarisation.
- Public and MSI cross-version upgrade validation; an NSIS synthetic upgrade passed.
- Native Linux and macOS build execution and distribution smoke tests.
- Cross-browser automated verification.
- Additional synchronized cardioversion timing refinement.
- Expanded pacing failure-to-capture intrinsic-rhythm modeling.

---

## [1.0.0] — UNRELEASED RELEASE CANDIDATE

**Status:** publication blocked pending owner approval of license, repository
identity, and deployment destination. No release date has been assigned.

### Added

- GYTech PatientSim Pro branding, original GYTech logo, banner, social preview,
  and favicon.
- Responsive professional bedside-monitor workspace for 1920×1080, 1600×900,
  1366×768, 1280×720, and tablet layouts.
- Real-time waveform engine for ECG, plethysmography, capnography, respiration,
  arterial pressure, CVP, pulmonary artery pressure, and ICP.
- Fourteen parameterized ECG rhythm models, including sinus rhythms, AF, flutter,
  SVT, VT, VF, asystole, PVCs, AV blocks, and paced rhythm.
- Live simulated 12-lead ECG view with lead-specific educational morphology,
  gain control, PNG recording, and print report.
- Intermittent NIBP with configuration, countdown, manual measurement, failure
  state, and measurement timestamp.
- Numeric monitoring for HR, PR, SpO₂, NIBP, SYS, DIA, MAP, RR, EtCO₂, dual
  temperature, ART, CVP, PA, ICP, and BIS.
- Central alarm engine with critical, warning, and technical priorities,
  configurable limits, acknowledge, silence, escalation, and event history.
- Defibrillator finite state machine with monitor, manual, AED, synchronized
  cardioversion, and transcutaneous pacing modes.
- AED analysis workflow with shock/no-shock recommendation, charge gating,
  safety confirmation, and post-event reassessment.
- CPR simulation with rate, depth, simulated quality calculation, compression and
  ventilation counters, pause timing, and optional metronome.
- Six sample simulation patients, patient profile CRUD, instructor overrides, and
  twenty deterministic teaching scenarios.
- Explicit ROSC recovery flow; simulated shocks do not automatically create ROSC.
- Persistent settings, patient profiles, and simulation event history in
  localStorage; CSV export and printable simulation report.
- GYTech repository governance documentation, licensing draft, contribution guide,
  security policy, privacy statement, third-party audit, and disclaimers.
- GitHub issue forms, pull request template, Dependabot config, CI/quality/security
  workflows, and optional GitHub Pages deployment workflow.
- Genuine application screenshots captured from the running build.
- Electron 34.1.1 native desktop application with resizable window, application
  menu, F11 full-screen, window-state persistence, single-instance handling, and
  native About dialog.
- Windows assisted NSIS EXE, WiX MSI, and portable ZIP packaging, using original
  GYTech icons for Windows, Linux, and macOS.
- Linux AppImage/DEB/RPM and macOS x64/ARM64 DMG build configuration for native
  CI runners; these were not built on the Windows host.
- User-controlled Notify Then Download update system for stable GitHub Releases,
  including version comparison, metadata validation, release-page opening,
  snooze, dismiss, and disable-check preference.
- Desktop local-data JSON export/import, application logging, and About/version
  information.
- Desktop security configuration: context isolation, sandboxing, no Node
  integration, restrictive custom protocol, CSP headers, GitHub-only external
  links, and production DevTools disabled.
- Desktop integration tests, packaged-app smoke test, installer checksum script,
  and cross-platform desktop-release workflow.

### Changed

- Rebranded application, reports, exports, and repository from the previous
  working title to GYTech PatientSim Pro.
- Added Content Security Policy and referrer-policy meta tags.
- Added a source copyright header policy across original application files.
- Added centralized identity/version constants for reports and diagnostics.
- Declared Electron as the desktop runtime and retained it as a test dependency;
  the browser edition still has no runtime npm dependencies.
- Standardized desktop product identity and copyright in package, installer, About,
  and application metadata.

### Fixed

- Removed an obsolete simulation-state property that could throw when switching to
  a lethal rhythm.
- Corrected simulated shock counter double increment.
- Corrected warning alarm escalation reverting from critical on subsequent
  evaluations.
- Ensured NIBP display updates when a scenario or instructor changes the simulated
  pressure context.
- Prevented pacing or AED analysis from operating on a depleted simulated battery.
- Ensured post-event synthesis and alarm state remain simulation-only.

### Security

- Added a restrictive CSP meta policy and referrer policy.
- Added a CSP response header, sandboxed preload bridge, navigation restrictions,
  permission denial, and GitHub-only external-link allowlist for the desktop app.
- Added update metadata validation and exact GitHub HTTPS release-page checks.
- Added basic local secret scanning and a GitHub security workflow.
- Documented browser-local and desktop-local data handling and responsible disclosure.

### Deprecated

- None currently announced.

### Removed

- Removed legacy working-title branding from application source and public
  documentation.

---

## Versioning policy

- `MAJOR`: incompatible changes to publicly documented behavior or data formats.
- `MINOR`: backwards-compatible feature additions.
- `PATCH`: backwards-compatible fixes, documentation corrections, and security
  hardening.

No published release exists yet. Do not cite this changelog as evidence of a
legal release, regulatory approval, or clinical validation.
