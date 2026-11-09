# Testing and Validation Report — GYTech PatientSim Pro

**Version:** 1.0.0 repository release candidate  
**Test date:** 2026-11-09  
**Environment:** Windows 11 x64; Electron 34.1.1 (Chromium 132); electron-builder 26.18.1; Node.js development environment; NSIS/WiX tooling downloaded by electron-builder  
**Copyright © 2026 GYTech. All Rights Reserved.**

> **This is an educational software simulation.** Testing verifies software
> behavior only. It does not establish clinical validity, medical-device safety,
> regulatory compliance, acoustic performance, or cross-browser equivalence.
> See [DISCLAIMER.md](DISCLAIMER.md).

---

## 1. Execution summary

| Suite | Purpose | Result |
|---|---|---|
| `tests/electron-harness.js` | Cold load, required DOM, canvas integrity, failed requests | **PASS** |
| `tests/interactive-harness.js` | Required functional tests, AED/manual workflows, persistence reload | **21 / 21 PASS** |
| `tests/deep-tests.js` | All scenarios, all rhythms, pacing, sync, NIBP, scenario progression, CPR/ROSC, alarm escalation | **12 / 12 PASS** |
| `tests/ui-harness.js` | Visible controls, modals, patient CRUD, alarms, sensors, 12-lead, CPR, responsive layouts | **18 / 18 PASS** |
| `tests/desktop-harness.js` | About, desktop update UI, offline/error handling, data validation, resize, fullscreen, reload persistence, corrupted settings | **19 / 19 PASS** |
| `scripts/validate-repository.mjs` | Required files, JS/desktop syntax, HTML IDs, duplicate bindings, desktop security invariants, links, screenshots, branding, CFF fields | See final validation section |
| `scripts/check-secrets.mjs` | Basic local secret signature scan | See final validation section |
| `tests/capture-screenshots.js` | Genuine application screenshots and branding renders | **PASS** |
| `npm run desktop:build:win` | Windows NSIS EXE, MSI, portable ZIP, icon/metadata packaging | **BUILT** |
| `npm run desktop:smoke` | Packaged app load and simulation smoke test | **PASS** from unpacked, portable, NSIS- and MSI-installed apps |
| Installer tests | Silent clean install, launch, uninstall, synthetic NSIS upgrade | **PASS** (details below) |

**Console/page errors recorded during final application test runs:** 0 actionable
console errors and 0 page errors. The previous Electron no-CSP warning was
resolved by adding a Content Security Policy. This is not a security certification.

**GitHub Actions status:** Workflows are prepared but **have not been executed on
GitHub** because the repository has not been created or pushed. No CI badge or
remote build-passing claim is made.

### Final local validation results

| Validation | Result |
|---|---|
| `npm run validate` (repository structure, syntax, links, buttons, duplicate bindings, desktop security, headers, screenshots, CFF) | **PASS — 19/19 checks** |
| `npm run check:secrets` | **PASS — no common secret signatures found** |
| YAML syntax parse for GitHub workflows/templates/config | **PASS — 10 GitHub YAML files parsed** |
| `CITATION.cff` schema validation (`cffconvert`) | **PASS — valid according to CFF schema 1.2.0** |
| External documentation URLs checked | **PASS — 22 live HTTPS URLs returned HTTP 200; 2 documented `OWNER/REPOSITORY` API templates intentionally return 404** |
| Screenshot dimensions/integrity | **PASS — 16 app screenshots at 1600×926** |
| Desktop installer checksums | **PASS — SHA-256 values re-verified for all three Windows artefacts** |
| Git repository, GitHub account, GitHub Actions execution | **NOT AVAILABLE / NOT EXECUTED** |

---

## 2. Required functional test matrix

| # | Required test | Result | Evidence |
|---|---|---|---|
| 1 | Normal sinus rhythm with normal simulated vital signs | **PASS** | Cold load and interactive test 1: HR 74, SpO₂ 98, valid waveforms |
| 2 | HR increases and ECG cycle timing changes | **PASS** | Interactive test 2: measured R-R 0.400 s at HR 150 |
| 3 | Asystole shows flat ECG and critical alarm | **PASS** | Asystole ECG sample range ≈0.0098; critical ASYSTOLE alarm; HR `---` |
| 4 | VF produces chaotic ECG | **PASS** | VF sample standard deviation ≈0.393; critical VF alarm |
| 5 | Disconnected SpO₂ sensor produces unavailable reading | **PASS** | Reading `---`; technical sensor-off alarm active |
| 6 | Lead-off activates technical alarm | **PASS** | ECG lead-off technical alarm active |
| 7 | AED analyses shockable simulated rhythm | **PASS** | VF analysis returned `shockAdvise: true`; charge/shock workflow executed |
| 8 | AED analyses non-shockable simulated rhythm | **PASS** | Asystole analysis returned `shockAdvise: false` |
| 9 | Shock unavailable before charging | **PASS** | Delivery refused; shock counter unchanged |
| 10 | Invalid therapy action blocked with pads disconnected | **PASS** | Charge refused; `canCharge()` false; disconnect during charge disarms |
| 11 | Synchronized mode displays synchronization state/markers | **PASS** | `syncReady: true`; sync eligibility shown; markers rendered from ECG beat timeline |
| 12 | Pacing operates independently | **PASS** | Pacing active in pacing mode, capture true, no charge state |
| 13 | CPR compression counter updates | **PASS** | Compression count increased in simulation and CPR strip |
| 14 | ROSC requires separate configured recovery | **PASS** | Explicit ROSC refused in VF; shock left pulse false; explicit organized recovery required |
| 15 | Alarm silence does not remove condition | **PASS** | Active alarm count unchanged after silence; visual state remained |
| 16 | Patient switching resets unsafe device state | **PASS** | Charged manual device reset to MONITOR/MONITORING after switch |
| 17 | Waveforms resize correctly | **PASS** | 8 canvases non-zero at 1366×768, 1280×720, tablet, 1600×900, 1920×1080; no document overflow |
| 18 | History records events and timestamps | **PASS** | 78 history entries with timestamps/types/descriptions in interactive run |
| 19 | CSV export produces valid data | **PASS** | Branded simulation-only CSV includes copyright, headers, values, and CRLF separators |
| 20 | Reload restores safe settings and resets transient therapy | **PASS** | Theme/units restored; defibrillator in MONITOR/MONITORING, not charged |

---

## 3. Additional automated checks

| Check | Result |
|---|---|
| All 20 scenarios start with coherent physiology | **PASS** — 20/20, no invalid values or lethal-pulse contradictions |
| All 14 rhythm types generate finite ECG data | **PASS** — 14/14 |
| Pacing failure-to-capture vs. capture states | **PASS** — 20 mA no capture; 90 mA capture |
| Synchronized cardioversion of perfusing VT | **PASS** — converted to NSR with pulse preserved |
| Defibrillator charge/disarm transitions | **PASS** — READY → CHARGING → CHARGED → DISARMING → READY |
| Intermittent NIBP measurement refresh | **PASS** — completed with fresh timestamp and value |
| Sepsis scenario progression and alarms | **PASS** — pressure/HR/temp changed, HR/RR/BP alarms activated |
| CPR provides partial simulated circulation without ROSC | **PASS** — pressure rose, native pulse remained false |
| Simulated shock does not auto-ROSC | **PASS** — organized post-shock ECG remained pulseless until explicit recovery |
| Warning escalation persistence | **PASS** — unacknowledged high-HR warning remained critical after repeated evaluations |
| AED classification respects rhythm and explicit pulse state | **PASS** — stable VT non-shock, pulseless VT shock, PEA non-shock |
| Every dock control opens its intended modal | **PASS** — all 11 tested |
| Patient creation/deletion through UI | **PASS** |
| Alarm limit editing and persistence | **PASS** |
| SpO₂ switch removes valid reading | **PASS** |
| 12-lead renders 12 channels with signal | **PASS** |
| Screenshots non-empty and dimension-valid | **PASS** — 16 application screenshots at 1600×926; branding assets also verified |

## 4. Desktop application and installer verification

### Framework and packaged application

- Electron 34.1.1 desktop shell selected as documented Tauri fallback; see
  [DESKTOP_APPLICATION.md](docs/DESKTOP_APPLICATION.md).
- Packaged app loaded through `app://gytech` with context isolation, sandbox,
  CSP header, and no renderer Node access.
- Extracted executable icon was inspected and matched the GYTech mark.
- Packaged app smoke test verified title, product name, HR/SpO₂/RR, eight
  renderable Canvas waveforms, About version, update-configuration status, and no
  boot error.
- Final packaged app reported:
  `The official update repository has not been configured by the publisher. No
  release information is fabricated.`

### Windows artefacts built

| Artefact | Size | SHA-256 |
|---|---|---|
| `GYTech-PatientSim-Pro-Setup-v1.0.0.exe` | 88,337,888 bytes | `2c1fccc17c7bda38f28a6bb27c53db33b215ec8f5d6732c65af81f554309567b` |
| `GYTech-PatientSim-Pro-x64-v1.0.0.msi` | 93,245,440 bytes | `1a979e325818634fc55786f750b11318ee68984229e8b864c1228521afcdbc55` |
| `GYTech-PatientSim-Pro-Portable-v1.0.0.zip` | 112,536,354 bytes | `a612dd36c965ff06dc54f1213ee3eda033217069e394d2287748b5a5d3f5fe6b` |

`SHA256SUMS.txt` was generated and every hash was re-verified against the final
files.

### Installer operations executed

| Test | Result |
|---|---|
| NSIS silent clean install to a chosen directory | **PASS** — exit 0 |
| NSIS Start Menu shortcut | **PASS** — shortcut created |
| NSIS installed-app launch/smoke | **PASS** — no process left after shutdown |
| NSIS uninstall with app closed | **PASS** — exit 0, installation directory removed |
| MSI silent per-user clean install | **PASS** — exit 0 |
| MSI installed-app launch/smoke | **PASS** — no process left after shutdown |
| MSI uninstall with app closed | **PASS** — exit 0, installed executable removed |
| Portable ZIP extraction | **PASS** — complete runtime and `PORTABLE-README.txt` present |
| Portable launch/smoke | **PASS** — no process left after shutdown |
| NSIS 1.0.0 → synthetic 1.0.1 upgrade | **PASS** — installed over 1.0.0; executable and asar reported 1.0.1 |
| MSI 1.0.0 → later-version upgrade | **NOT EXECUTED** |
| Windows code signing | **NOT CONFIGURED** — unsigned; SmartScreen warning possible |
| macOS DMG / Linux AppImage/DEB/RPM | **NOT BUILT OR TESTED** on this Windows host |

The synthetic 1.0.1 upgrade build was created solely for installer testing and
was **not released**; it was removed afterward. No public 1.0.1 exists.

### Offline-like startup

The final packaged application was started with all network traffic routed to an
unreachable local proxy (`--proxy-server=127.0.0.1:9`). The UI, vital signs,
waveforms, and smoke checks passed. This demonstrates startup without usable
network access, but it is **not** a physical network-adapter disconnection test
(the environment did not have administrative permission to disable the adapter).
The live update repository is unconfigured, so no external update request was
made.

### Update system test coverage

- Synthetic update-available notification: **PASS**
- Installed/latest version display: **PASS**
- Release notes and summary rendering: **PASS**
- Download opening the allowlisted GitHub page: **PASS** with synthetic URL
- Remind Me Later and Dismiss state: **PASS**
- Network-error handling without blocking the simulator: **PASS** with mocked
  error response
- Up-to-date check does not show a false update: **PASS**
- Unsafe HTTP/non-GitHub release URL rejection: **PASS**
- Real GitHub API release check: **BLOCKED / NOT CONFIGURED** — no official
  `OWNER/REPOSITORY` has been supplied.

### Defect found and fixed during release audit

During repository release review, duplicate `bind()` registrations for
History, Sensors, Settings, and Diagnostics caused those dock buttons to open a
modal and immediately toggle it closed. All duplicate bindings were removed, a
regression check was added to `tests/ui-harness.js`, and the repository validator
now rejects duplicate `bind(id, event)` registrations. The fix was re-tested.

---

## 5. Screenshot evidence

Genuine screenshots captured from the running application:

- `assets/screenshots/main-dashboard.png`
- `assets/screenshots/ecg-monitoring.png`
- `assets/screenshots/ecg-12-lead.png`
- `assets/screenshots/spo2-monitoring.png`
- `assets/screenshots/capnography.png`
- `assets/screenshots/vital-signs.png`
- `assets/screenshots/alarm-management.png`
- `assets/screenshots/manual-defibrillator.png`
- `assets/screenshots/aed-mode.png`
- `assets/screenshots/synchronized-cardioversion.png`
- `assets/screenshots/pacing-mode.png`
- `assets/screenshots/cpr-simulation.png`
- `assets/screenshots/patient-management.png`
- `assets/screenshots/scenario-selection.png`
- `assets/screenshots/event-history.png`
- `assets/screenshots/system-settings.png`

Capture method and dimensions: [docs/SCREENSHOT_GUIDE.md](docs/SCREENSHOT_GUIDE.md).

---

## 6. Not executed / limitations

These items must not be described as verified:

1. **No clinical validation** — no clinical accuracy, sensitivity, safety, or
   effectiveness claim can be made.
2. **No physical device testing** — no physical monitor, defibrillator, sensor,
   pacemaker, or network is connected or supported.
3. **No real electrical output** — no shock or pacing output exists.
4. **GitHub Actions** — workflows are prepared but not run on GitHub.
5. **Cross-browser** — automated tests ran in Chromium/Electron only. Firefox and
   Safari are unverified.
6. **Acoustic alarm output** — Web Audio code paths were not acoustically captured
   or measured. User gesture is required.
7. **Speech synthesis** — optional AED voice prompts were not acoustically
   verified.
8. **Native print dialogs** — print report HTML exists; native print dialogs were
   not automated end-to-end.
9. **Security certification** — repository checks are basic and do not constitute
   a professional security audit or certification.
10. **Accessibility certification** — no formal WCAG audit has been performed.
11. **Regulatory/standards compliance** — no IEC 60601, alarm-standard, or other
    regulatory certification is claimed.
12. **Microphone, camera, or real sensors** — none are used.
13. **Linux/macOS desktop builds** — configured for native CI, not built or
    launched on this Windows host.
14. **Windows code signing** — no certificate is configured; binaries are
    unsigned.
15. **macOS signing/notarisation** — not configured or verified.
16. **Live update channel** — official GitHub repository is unconfigured; only
    synthetic update fixtures were tested.
17. **Physical network disconnect** — offline-like startup was tested with an
    unreachable proxy; the adapter could not be disabled without administrator
    rights.
18. **MSI cross-version upgrade** — not executed; only a synthetic NSIS upgrade
    was tested.
19. **Full installer UI/wizard automation** — silent operations were tested; the
    assisted UI and optional Desktop shortcut were not clicked through
    automatically.
20. **Full process restart / data-after-upgrade** — a renderer reload preserved
    settings in the desktop harness, but a complete process-restart test and
    local-data retention across an installed upgrade were not separately
    automated.
21. **Missing-runtime and unsupported-OS scenarios** — the packaged Windows app
    launches without Node.js, but a stripped-runtime environment and unsupported
    operating systems were not independently tested.

---

## 7. Re-run instructions

```powershell
npm install
$env:ELECTRON_RUN_AS_NODE=$null

npm run validate
npm run check:secrets
npm run test:load
npm run test:interactive
npm run test:deep
npm run test:ui
npm run test:desktop
npm run screenshots

npm run desktop:build:win
npm run desktop:checksums
npm run desktop:smoke -- "release\win-unpacked\GYTech PatientSim Pro.exe"
```

On headless Linux, run Electron tests with Xvfb:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:ui
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:desktop
```

The test harnesses intentionally mutate browser-local simulation storage. Use a
fresh test profile or clear site data if a clean dataset is required. Clear
`ELECTRON_RUN_AS_NODE` before launching Electron or a packaged application.

---

## 8. Final assessment

**Current readiness:** **Ready for owner review; not ready for public release.**

The Windows desktop application was built and exercised from unpacked, portable,
NSIS-installed, and MSI-installed forms. The simulated UI, waveforms, settings,
About/version information, update UI, local-data validation, resize, fullscreen,
and graceful smoke shutdown passed. Windows installers and portable ZIP have real
artefacts with verified SHA-256 checksums. Linux/macOS builds, code signing,
notarisation, live GitHub updates, and the full assisted installer UI remain
unverified.

The project is **not** ready for a clinically positioned release and is **not yet
a published open-source release**. It is licensed under the Apache License 2.0,
but repository identity, the official update repository, contacts, and release
authorization remain pending. GitHub Actions remain unexecuted.

No clinical validity is certified.

---

Copyright © 2026 GYTech. All Rights Reserved.
