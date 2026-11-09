# Desktop Application

**GYTech PatientSim Pro — Advanced Patient Vital Signs Monitor & Defibrillator Simulator**

**Version:** 1.0.0  
**Copyright © 2026 GYTech. All Rights Reserved.**

> Educational simulation only. This is not a medical device. It delivers no
> electrical output and must never connect to or control real medical equipment.

---

## 1. Framework selection

### Assessment

| Criterion | Finding |
|---|---|
| Frontend | Static HTML5, CSS3, ES-module JavaScript |
| UI framework/build system | None; Canvas 2D, SVG, Web Audio, localStorage |
| Runtime Node.js APIs | None required by the simulation |
| Routing | No client-side router; modal-driven single-page UI |
| Existing test infrastructure | Electron 34.1.1/Chromium harnesses already present |
| Local persistence | Namespaced `localStorage` under `gytech.patientsim.*` |
| Native APIs required | Window lifecycle, external release-page opening, local logging |
| Available Windows toolchain | Node.js/npm installed; Rust and MSVC C++ build tools not installed |
| Rendering/audio consistency | Important because the application uses real-time Canvas waveforms and Web Audio |

### Decision: Electron 34.1.1 (fallback)

Tauri 2.x was evaluated first and is structurally compatible with the renderer.
It was **not selected for this release** for the following concrete reasons:

1. **No Rust/MSVC desktop toolchain is available on the primary Windows
   development machine.** Tauri cannot produce a verified Windows installer here
   without adding Rust plus the Visual Studio C++ workload.
2. **The existing application is tested against Electron's bundled Chromium.**
   Tauri would ship a different WebView engine on each operating system
   (WebView2, WKWebView, WebKitGTK). Real-time waveform rendering, Web Audio, and
   CSS layout would need a new cross-engine validation programme before shipping.
3. **Electron provides substantially better compatibility with the already
   verified renderer** and avoids an unnecessary migration risk for a medical
   simulation UI whose behaviour must be preserved.
4. Electron is already the project's declared development-only dependency and
   the engine used by the existing automated test suites.

This is a documented fallback under the user's framework rule, not a silent
preference. No `src-tauri/` directory is created. See
[CROSS_PLATFORM_BUILD.md](CROSS_PLATFORM_BUILD.md) for build details.

---

## 2. Desktop architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Electron main process                                      │
│  • single-instance lifecycle  • native window/menu         │
│  • app:// static protocol     • restrictive CSP headers     │
│  • update API fetch (main only)                            │
│  • external GitHub allowlist  • file logging               │
│  • window-state JSON          • IPC handlers               │
└──────────────────────────────┬──────────────────────────────┘
                               │ contextIsolation + sandbox
┌──────────────────────────────▼──────────────────────────────┐
│ Preload bridge (least privilege)                           │
│  getAppInfo / checkForUpdates / openExternal / openLogs    │
│  log / About and update-check menu events                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ frozen window object
┌──────────────────────────────▼──────────────────────────────┐
│ Existing GYTech PatientSim Pro renderer                    │
│  Canvas waveforms • physiology • alarms • AED/manual/pacing│
│  scenarios • CPR • history • 12-lead • local settings      │
└─────────────────────────────────────────────────────────────┘
```

The desktop shell loads the existing application through the privileged custom
scheme `app://gytech/index.html`. Only `/index.html`, `/css/`, `/js/`, and
`/assets/` paths are served. The application is **not** replaced by a browser
shortcut or an empty WebView.

### Native features implemented

- Native resizable window, minimise/maximise/close controls, F11 full-screen.
- Native application menu (File, View, Help).
- Application icon in the window, executable, and installers.
- Native About dialog plus the in-application About panel.
- Window size/position persistence in `window-state.json`.
- Single-instance lock and graceful exit.
- Application logging in the user data logs directory; **Help → Open Application
  Logs** opens it.
- Production builds disable DevTools by default and suppress F12/Ctrl+Shift+I.
- No splash screen is included; startup is fast enough and the optional splash
  would add a second renderer window without functional benefit.

---

## 3. Application identity

| Field | Value |
|---|---|
| Product name | GYTech PatientSim Pro |
| Full title | Advanced Patient Vital Signs Monitor & Defibrillator Simulator |
| Application ID | `com.gytech.patientsimpro` |
| Publisher / company | GYTech |
| Version | 1.0.0 (read from `package.json`; no invented version) |
| Copyright | Copyright © 2026 GYTech. All Rights Reserved. |
| License | **Apache License 2.0** (`Apache-2.0`) — see [LICENSE](../LICENSE) |
| Update channel | GitHub Releases, **owner configuration required** |

---

## 4. Security controls

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Frozen preload API; no unrestricted IPC or Node.js objects exposed
- Custom static protocol with an explicit path allowlist
- CSP response header plus the existing meta CSP
- Navigation away from `app://gytech` blocked
- New windows denied; external URLs limited to `https://github.com` /
  `https://www.github.com`
- Update fetch performed only in the main process
- Update metadata validated: stable semver, official HTTPS GitHub release page,
  no draft/prerelease releases
- No auto-download, no auto-install, no execution of downloaded files
- Permission requests (camera/microphone/geolocation/USB) denied
- Production DevTools disabled
- No API keys, telemetry, cloud account, or embedded secrets
- Unsigned builds are explicitly labelled; code signing is not claimed

---

## 5. Local data and lifecycle

### Storage locations

Electron stores renderer `localStorage` under the application's user-data
directory:

- Windows: `%APPDATA%\GYTech PatientSim Pro`
- Linux: the platform's Electron user-data directory for this application
- macOS: the platform's Application Support user-data directory

Application logs:

- `<user-data>\logs\patientsim-pro.log`

Window geometry:

- `<user-data>\window-state.json`

The application stores settings, synthetic patients, active patient context, and
simulation event history. **No real patient data is provided or required**, and
there is no telemetry or cloud sync.

### Export / import

Settings → **Desktop Application → Local Simulation Data** provides:

- **EXPORT DATA** — downloads a JSON file containing supported local data.
- **IMPORT DATA** — validates a JSON export, asks for confirmation, replaces
  supported local data, and reloads the interface.

The import is size-limited and schema-validated. It does not import update
preferences or arbitrary localStorage keys.

### Upgrade and uninstall data behaviour

- Application upgrades preserve the user-data directory.
- The NSIS uninstaller is configured **not** to delete application data.
- On Windows, uninstalling the application does not automatically remove
  `%APPDATA%\GYTech PatientSim Pro`; users can remove it manually after exporting
  anything they need.
- Portable mode still stores local data in the Windows user profile, not inside
  the extracted folder.

---

## 6. Update system

The application implements **Notify Then Download** only. It never silently
downloads or installs an update. The publisher must first configure the official
GitHub repository in `desktop/update-config.json`; the current repository leaves
that value blank and does not fabricate a release URL.

See [UPDATE_SYSTEM.md](UPDATE_SYSTEM.md).

---

## 7. Offline operation

The simulation UI, waveforms, alarms, AED/manual defibrillation/pacing simulation,
scenarios, local settings, and local data tools all operate from bundled local
assets. The update checker is the only optional network feature and is disabled
until an official repository is configured. Update failure never blocks startup.

See [TESTING_REPORT](../TESTING_REPORT.md) for the executed offline-like test and
its limitation.

---

## 8. Build identity and status

| Item | Status |
|---|---|
| Electron source integration | **IMPLEMENTED** |
| Windows native app | **BUILT** and **TESTED** (Windows 11 x64) |
| Windows EXE installer | **BUILT**, clean-install, NSIS 1.0.0→synthetic 1.0.1 upgrade, and uninstall **TESTED** |
| Windows MSI installer | **BUILT**, clean-install and uninstall **TESTED**; MSI cross-version upgrade not tested |
| Windows Portable ZIP | **BUILT** and **TESTED** |
| Linux AppImage/DEB/RPM | **CONFIGURED**, not built on this Windows host |
| macOS DMG x64/ARM64 | **CONFIGURED**, not built on this Windows host |
| GitHub Actions desktop release | **CONFIGURED**, not executed |
| Code signing | **NOT CONFIGURED** |
| macOS notarisation | **NOT CONFIGURED** |

Installer locations are reported in the final delivery report and in
[INSTALLATION.md](../INSTALLATION.md).
