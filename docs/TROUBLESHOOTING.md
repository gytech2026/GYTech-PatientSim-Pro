# Troubleshooting — GYTech PatientSim Pro

**Copyright 2026 GYTech All Right Reserved.**

> For clinical emergencies, use appropriate emergency services and validated
> equipment. This project is not a clinical support system.

---

## Desktop application

### Desktop app does not start

- Use the installed application from the Start Menu, or the extracted portable
  `GYTech PatientSim Pro.exe`; do not open `index.html`.
- Check the application log:
  - Windows: `%APPDATA%\GYTech PatientSim Pro\logs\patientsim-pro.log`
- The desktop app bundles Electron. End users do **not** need Node.js.
- The Windows builds are unsigned. Windows SmartScreen may warn; this does not
  mean the build is digitally signed. Follow your organisation's security policy
  before running unsigned software.

### Portable ZIP

Extract the **complete** ZIP before launching. Run
`GYTech PatientSim Pro.exe` from the extracted folder. No installer or
administrator permission is required. Portable data is still stored under
`%APPDATA%\GYTech PatientSim Pro`, not inside the extracted folder.

### MSI installer

Use `msiexec /i "GYTech-PatientSim-Pro-x64-v1.0.1.msi"` or double-click the
installer. The package installs per-user by default. For managed deployment,
follow your organisation's Windows Installer policy and test in your own
environment.

### Uninstalling

The NSIS uninstaller and MSI remove the application files and shortcuts. Local
application data is intentionally preserved. Remove
`%APPDATA%\GYTech PatientSim Pro` manually only after exporting anything you need.

### Update check says no stable release has been published

This is expected until a stable GitHub Release exists for
`gytech2026/GYTech-PatientSim-Pro`. The update source is configured in
`desktop/update-config.json`; the application does not fabricate releases. Use the
**RELEASES** button or
<https://github.com/gytech2026/GYTech-PatientSim-Pro/releases> to check manually.

### Update check says the update repository is not configured

This means `desktop/update-config.json` has an empty or invalid `repository`. A
normal build ships with `gytech2026/GYTech-PatientSim-Pro`; do not replace it with
a placeholder. See [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md).

### Automatic update installation is unavailable

By design. No package format (NSIS, MSI, portable ZIP, AppImage, DEB, RPM, DMG)
performs automatic installation; the project does not bundle `electron-updater`.
Notification opens the official Releases page and you install manually.

### Update check fails while offline

This is non-blocking by design. The simulator and all local features continue to
work. Reconnect and try **CHECK NOW** later; no update is downloaded or installed
automatically.

### Linux or macOS

Linux AppImage/DEB/RPM and macOS DMG builds are configured for native CI/OS
builds but were not built on the Windows development host. Do not treat them as
tested until the CI job completes and the artefact is launched on that platform.
macOS builds are unsigned/not notarised; Gatekeeper may block first launch.

---

## Installation and startup

### Blank page

**Likely cause:** opening `index.html` via `file://` blocks ES modules.

**Fix:** use a local HTTP server:

```powershell
npm start
# or
python -m http.server 8080
```

Open `http://127.0.0.1:8080/`. Check the browser console for the exact error.

### `npm start` says node/npm not found

Install Node.js 18 or later, reopen the terminal, then run `npm start` again.
Alternatively use Python's static server.

### Port 8080 already in use

Use another port:

```powershell
node serve.js 8090
```

or start Python on a different port.

### Missing CSS/JS/assets

Confirm the project root includes `index.html`, `css/`, `js/`, and `assets/`.
Do not move `index.html` into a subfolder without moving the referenced files.
The static server must be started from the project root.

---

## Browser and rendering

### Waveform canvas appears blank

- Resize the browser window slightly to force the ResizeObserver callback.
- Confirm the browser supports Canvas 2D.
- Check the Console for a CSP or JavaScript error.
- Confirm the simulation is not paused/frozen.
- Try a hard reload.

### Layout looks compressed

The app is designed for desktop and tablet widths. At very narrow widths the
defibrillator reflows below the monitor and the workspace becomes internally
scrollable. Recommended desktop sizes: 1366×768 and above.

### High-DPI scaling makes screenshots large

That is expected. Screenshots may be captured at device scale factor greater than
1. The actual CSS layout remains responsive.

### Content Security Policy blocks something

The app uses `default-src 'self'` and no remote resources. A third-party
extension or a modified copy that injects remote scripts/fonts may be blocked.
Do not weaken the CSP just to load external assets without a security review.

---

## Audio and speech

### No alarm tones / metronome

Browsers block audio before a user gesture. Click the app or **AUDIO**. Check:

- App audio button status.
- Alarm sound setting.
- Alarm volume slider.
- Browser tab mute.
- OS volume.
- Browser autoplay policy.

### No AED voice prompts

Web Speech is optional and depends on browser/OS voices. The visible AED
announcement and recommendation are authoritative for the simulation. Speech
synthesis was not verified acoustically in the automated tests.

### Overlapping sounds

The app is designed to use one alarm scheduler at a time and to suppress the CPR
metronome while an audible alarm is active. Report any observed overlap with
browser details.

---

## Simulation and alarms

### SpO₂ shows `---`

Possible causes:

- SpO₂ sensor disconnected.
- No effective pulse.
- Signal quality near zero.
- Lethal rhythm / arrest state.

This is intentional; the simulator does not fabricate a valid reading.

### NIBP shows stale value or no value

NIBP is intermittent. Check the last measurement time and next countdown. A no-flow
state can cause measurement failure. Press **MEASURE NOW** or check cuff sensor
state.

### Alarm will not clear

The underlying physiological condition remains. Acknowledge/silence does not
clear it. Resolve the simulated condition or restore the patient baseline.

### Alarm banner is visible but no sound

Check silence timer, acknowledgement, audio unlock, volume, and browser mute.
Visual alarms remain active during silence by design.

### Defibrillator charge button disabled

Check:

- Therapy mode is MANUAL/AED/SYNC, not MONITOR/PACING.
- Pads are connected.
- Battery is adequate.
- No charge already in progress/completed.
- SYNC has a valid simulated marker/eligibility.
- AED analysis has a shock-advised result.
- Device is not in an error/post-event state.

### Shock button disabled after charging

- AED safety confirmation may be missing.
- Sync eligibility may have been lost.
- Pads may have been disconnected.
- Battery/error state may have changed.

### Shock does not restore ROSC

This is intentional. The simulator never equates shock delivery with ROSC. Use an
explicit configured recovery event or the Instructor ROSC action with an organized
rhythm.

### Pacing shows no mechanical capture

Check output is above the simulated capture threshold and rate is within a valid
range. Electrical capture can occur without mechanical capture in this teaching
model. Pacing is not a defibrillation charge.

---

## Persistence

### Settings/patients disappeared

Possible causes:

- Browser site data cleared.
- Private browsing session ended.
- Different origin/port (localStorage is origin-specific).
- Different browser profile.
- Desktop user-data folder removed or a different Windows account used.

In the desktop application, local data lives under
`%APPDATA%\GYTech PatientSim Pro` on Windows. Use **Settings → Desktop
Application → EXPORT DATA** before removing or migrating a profile. The app does
not back up to a cloud service.

### Reloaded app shows monitor mode / no charge

This is intentional. Unsafe transient device states are not restored. See
[PRIVACY.md](../PRIVACY.md) and [README.md](../README.md).

### History grows large

Use **HISTORY → CLEAR** or clear browser site data. Maximum stored events are
capped in code, but browser storage limits still apply.

---

## Tests

### Electron tests fail with "Cannot find module 'electron'"

Run:

```powershell
npm install
```

The Electron dev dependency must be installed. The browser app itself does not
need Electron.

### Desktop integration tests

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
npm run test:desktop
```

This uses a test-only synthetic update bridge. It does not contact GitHub and
does not prove that a live update channel works.

### Built desktop app smoke test

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
npm run desktop:smoke -- "release\win-unpacked\GYTech PatientSim Pro.exe"
```

The test launcher removes `ELECTRON_RUN_AS_NODE` from the child environment and
reads a JSON result from the packaged application. If it times out, check the
application log and ensure no stale installed instance is holding the
single-instance lock.

### Electron fails on Linux with "The SUID sandbox helper binary was found"

This is a Chromium sandbox bootstrap failure, not an application or Node.js
problem. Electron aborts with SIGTRAP before the harness runs because
`node_modules/electron/dist/chrome-sandbox` is not owned by root with mode `4755`.
GitHub-hosted runners install dependencies as an unprivileged user, so that helper
cannot be configured there. Do not `chmod 4755` blindly, and do not add
`--no-sandbox` to the desktop application.

The test scripts solve it in `scripts/run-electron-test.mjs`: on Linux that
launcher starts the **test process** with `--no-sandbox` when `CI=true` or
`GITHUB_ACTIONS=true`, or when you explicitly set `ELECTRON_TEST_NO_SANDBOX=1`.
Production startup is untouched and keeps `sandbox: true`.

Run the Linux test under a virtual display:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:load
```

On a local Linux machine without a configured SUID sandbox:

```bash
ELECTRON_TEST_NO_SANDBOX=1 xvfb-run -a npm run test:interactive
```

Do not export `ELECTRON_TEST_NO_SANDBOX` in production launch scripts.

### Electron window/capture failure on Linux

Use a virtual display:

```bash
xvfb-run -a npm run test:interactive
```

### `ELECTRON_RUN_AS_NODE` is set

Unset it before running Electron tests:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
```

### Screenshots fail

Ensure the app is running under an HTTP origin and the test harness can start a
browser window. Screenshot capture was verified on Chromium/Electron in the
development environment; GitHub Actions screenshot behavior depends on the
runner's display configuration.

---

## Security and privacy

- Do not use real patient data.
- Do not weaken CSP or add remote scripts without review.
- Report vulnerabilities privately per [SECURITY.md](../SECURITY.md).
- No security check in this repository certifies clinical or regulatory safety.

---

Copyright 2026 GYTech All Right Reserved.
