# Roadmap — GYTech PatientSim Pro

**Project year:** 2026  
**Copyright © 2026 GYTech. All Rights Reserved.**

This roadmap reflects the current repository state. A checked item means the
feature exists in the source code and has relevant verification evidence. It does
not imply clinical validation or regulatory approval.

---

## Status legend

- ✅ **Completed** — implemented and exercised in the current release candidate.
- 🟡 **In progress** — partially implemented or awaiting owner verification.
- ⬜ **Planned** — accepted as future work; not yet implemented.
- 🔵 **Under consideration** — possible direction, not committed.

---

## Phase 1 — Core monitoring ✅

- ✅ Patient profiles and sample simulation patients.
- ✅ Heart rate and ECG rhythm monitoring.
- ✅ SpO₂ and pleth waveform.
- ✅ Respiratory waveform and rate.
- ✅ Intermittent NIBP with failure state and interval control.
- ✅ Temperature and alarm integration.
- ✅ Central alarm engine with silence, acknowledgement, escalation, and history.
- ✅ Responsive bedside-monitor interface.
- ✅ Persistence for settings, patients, and event history.

## Phase 2 — Advanced monitoring ✅

- ✅ 12-lead educational ECG view with print and PNG capture.
- ✅ Capnography with multiple educational patterns.
- ✅ Invasive arterial pressure waveform and numerical values.
- ✅ CVP, PA, and ICP channels.
- ✅ BIS numerical display.
- ✅ Configurable signal quality.
- ✅ ECG gain, sweep speed, artifact, noise, baseline wander, and lead-off simulation.

## Phase 3 — Emergency simulation ✅

- ✅ Manual defibrillator finite state machine.
- ✅ AED analysis workflow with shock/no-shock recommendation and safety confirmation.
- ✅ Synchronized cardioversion mode with simulated sync eligibility and markers.
- ✅ Transcutaneous pacing with electrical/mechanical capture simulation.
- ✅ CPR simulation with counters, simulated quality, pause timing, and metronome.
- ✅ Shock does not automatically produce ROSC.
- ✅ Explicit configured ROSC transition.

## Phase 4 — Professional features ✅

- ✅ Twenty deterministic teaching scenarios.
- ✅ Instructor overrides with manual-override status.
- ✅ Simulation event recording, filtering, CSV export, and printable reports.
- ✅ Scenario timer, pause/resume/reset, instructions, notes, and outcomes.
- ✅ System diagnostics, simulated device self-test, and battery/network fault states.
- ✅ Genuine application screenshots and repository documentation.
- ✅ CI, code-quality, security, Pages, and Dependabot configurations prepared.
- ✅ Repository audit and release-readiness documentation.

## Phase 5 — Desktop application ✅ (Windows verified)

- ✅ Electron 34.1.1 native desktop shell with context isolation, sandboxing, and
  no Node integration in the renderer.
- ✅ Original Windows `.ico`, macOS `.icns`, and Linux PNG icon assets.
- ✅ Native menu, fullscreen, resizable window, window-state persistence, About
  dialog, and single-instance lifecycle.
- ✅ Template GitHub Releases update notification with no silent installation.
- ✅ Local data export/import, application logging, and log-folder access.
- ✅ Windows assisted EXE, MSI, and portable ZIP packaging.
- ✅ Clean install, launch, portable launch, and uninstall smoke tests on Windows.
- ✅ Desktop release workflow configured for Windows, Linux, and macOS runners.

---

## In progress / release blockers 🟡

- ✅ **Owner license approval** — Apache-2.0 adopted; the repository LICENSE is
  the canonical Apache License 2.0 text.
- 🟡 **Official GitHub repository URL and owner identity** — placeholders must be
  replaced before publication.
- 🟡 **Security/conduct contact details** — placeholders must be confirmed.
- 🟡 **GitHub Actions validation on the owner's repository** — workflows are
  prepared but cannot be claimed as passing until executed on GitHub.
- 🟡 **Cross-browser verification** — Chromium/Electron is verified; Firefox and
  Safari are not yet in the automated matrix.
- 🟡 **Screenshot documentation review** — screenshots are genuine captures, but
  the owner must review final presentation before publication.
- 🟡 **Official update repository configuration** — `desktop/update-config.json`
  intentionally has a blank repository. Live update checks are blocked until the
  owner confirms the official GitHub repository.
- 🟡 **Linux and macOS desktop builds** — build configuration is prepared but was
  not executed on the Windows host.
- 🟡 **Code signing / macOS notarisation** — no certificates or Apple credentials
  are available; unsigned status is documented.
- 🟡 **Cross-version MSI upgrade / public upgrade validation** — an NSIS
  1.0.0 → synthetic 1.0.1 upgrade passed locally, but no public later version
  exists and the MSI cross-version path has not been verified.
- 🟡 **Desktop release workflow execution** — `.github/workflows/desktop-release.yml`
  is configured but has not run on GitHub.

---

## Planned ⬜

- ⬜ Cross-browser E2E matrix using Playwright or equivalent.
- ⬜ Fully R-wave-timed synchronized cardioversion simulation.
- ⬜ More physiological pacing failure modes, including intrinsic-rhythm
  superposition during failure to capture.
- ⬜ Internationalization expansion beyond core navigation labels.
- ⬜ Exportable simulation-session report with instructor notes and scenario timeline.
- ⬜ Keyboard navigation and screen-reader audit across all modals.
- ⬜ Automated accessibility checks.
- ⬜ Additional clinical simulation scenarios after educational review.
- ⬜ Formal data schema/version migration strategy for localStorage.
- ⬜ Native code signing for Windows and Developer ID signing/notarisation for macOS.
- ⬜ Cross-version desktop upgrade tests and rollback verification.
- ⬜ Native Linux distribution testing on representative distributions.
- ⬜ Owner-approved release version, DOI, and citation archive.

---

## Under consideration 🔵

- Optional instructor-only scenario editor with validated parameter bounds.
- Waveform recording and playback for debriefing.
- Multi-user classroom session coordination without transferring patient data.
- Web Worker-based waveform computation for very large displays.
- Optional local-only trend analytics for debriefing.
- Institutional branding configuration.

These are ideas, not commitments. None should be presented as implemented.

---

## Known issues / limitations

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) and
[TESTING_REPORT.md](TESTING_REPORT.md). Important limitations:

- No clinical validity or regulatory approval.
- No physical device communication or electrical output.
- Synchronization validates simulated eligibility/markers rather than providing
  real-world R-wave-timed output.
- Pacing failure-to-capture does not yet superimpose a complete intrinsic rhythm.
- Acoustic output, speech synthesis, and print dialogs are not fully automated.
- Browser/desktop localStorage is not a secure clinical record store.
- CI browser tests require Electron and a display/virtual display.
- Windows build only verified on Windows 11 x64; Linux/macOS packages are
  unverified.
- Update channel is not configured and live release checks are blocked.
- Windows binaries are unsigned; macOS builds are unsigned/not notarised.

---

## Release criteria for v1.0.0

- ✅ Apache License 2.0 LICENSE and contribution terms.
- Confirmed repository identity and metadata, including the official update
  repository.
- Green GitHub Actions on the owner's repository, including native Linux and macOS
  desktop build jobs.
- Final documentation/links/screenshots review, including desktop installation and
  update wording.
- No unresolved critical or high-severity security issue.
- Explicit medical disclaimer present in the application and installer materials.
- Owner decision on code signing/notarisation and acceptance of unsigned build
  warnings if applicable.
- Owner authorization to publish.

Until all criteria are met, the repository is a **release candidate**, not a
published release.

---

Copyright © 2026 GYTech. All Rights Reserved.
