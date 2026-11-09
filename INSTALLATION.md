# Installation and Execution — GYTech PatientSim Pro

**Version:** 1.0.0  
**Copyright © 2026 GYTech. All Rights Reserved.**

> Educational simulation only. Not a medical device. See
> [DISCLAIMER.md](DISCLAIMER.md).

---

## 1. Choose an edition

| Edition | Best for | Install required | Verified here |
|---|---|---|---|
| Windows EXE installer | Standard Windows desktop installation | Yes | **Yes** — Windows 11 x64 |
| Windows MSI | Managed / Windows Installer deployment | Yes | **Yes** — Windows 11 x64 |
| Windows Portable ZIP | No-install use from an extracted folder | No | **Yes** — Windows 11 x64 |
| Linux AppImage/DEB/RPM | Linux desktop | Depends on format | **No** — configured for native CI |
| macOS DMG | macOS desktop | DMG mount/copy | **No** — configured for native CI |
| Browser development | Development, review, GitHub Pages | Local server | Chromium tested |

No public download URL is configured in this repository. The Windows artefacts
are built locally under `release/`; they are not published until the owner
approves the license, repository, contacts, signing, and release.

---

## 2. Desktop requirements

- **Windows 10/11 x64** for the tested Windows build.
- The package bundles Electron 34.1.1; end users do **not** need Node.js.
- No separate WebView2 runtime is required for this Electron build.
- The builds are unsigned. Windows SmartScreen may warn. No code signing or
  macOS notarisation is configured or claimed.
- Linux/macOS packages must be built on their native platform or CI runner.

---

## 3. Windows desktop installation

### EXE installer

1. Run `GYTech-PatientSim-Pro-Setup-v1.0.0.exe`.
2. Follow the assisted installer.
3. Select an installation directory if offered.
4. Choose the optional Desktop shortcut and Start Menu shortcut.
5. Launch **GYTech PatientSim Pro**.

### MSI

Use Windows Installer:

```powershell
msiexec /i "GYTech-PatientSim-Pro-x64-v1.0.0.msi"
```

Silent deployment for a managed environment (test your own policy first):

```powershell
msiexec /i "GYTech-PatientSim-Pro-x64-v1.0.0.msi" /qn /l*v install.log
```

The MSI installs per-user by default and uses a fixed upgrade code. The current
release's MSI clean-install and uninstall path was tested. An NSIS 1.0.0 →
synthetic 1.0.1 upgrade passed locally; no public 1.0.1 exists, and the MSI
cross-version upgrade was not executed.

### Portable ZIP

1. Extract the entire `GYTech-PatientSim-Pro-Portable-v1.0.0.zip`.
2. Run `GYTech PatientSim Pro.exe` from the extracted folder.
3. No installer or administrator rights required.
4. Local data still lives in `%APPDATA%\GYTech PatientSim Pro`; the profile is
   not stored inside the extracted folder.
5. Delete the extracted folder to remove the portable application. Delete the
   profile folder separately only after exporting anything you need.

See `PORTABLE-README.txt` inside the extracted package.

---

## 4. Linux

Build on a Linux machine/CI runner:

```bash
npm ci
npm run desktop:build:linux
```

Configured formats:

- `GYTech-PatientSim-Pro-Linux-x64.AppImage`
- `GYTech-PatientSim-Pro-Linux-x64.deb`
- `GYTech-PatientSim-Pro-Linux-x64.rpm`

These were **not built or verified** on the Windows development host. Do not
claim a working Linux package until the native CI job completes and the package
is launched on a representative distribution. Package managers may require an
owner-approved maintainer contact.

## 5. macOS

Build on macOS/CI:

```bash
npm ci
CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:build:mac
```

Configured formats:

- `GYTech-PatientSim-Pro-macOS-x64.dmg`
- `GYTech-PatientSim-Pro-macOS-arm64.dmg`

The builds are unsigned and not notarised. Gatekeeper may block first launch.
Do not claim Apple signing or notarisation without verified credentials and a
completed notarisation/stapling process.

---

## 6. Browser/development edition

### Requirements

- Modern browser with ES modules, Canvas 2D, CSS Grid/Flexbox, Web Audio, and
  localStorage. Chromium-based browsers are the primary verified environment.
- A local HTTP server. Opening `index.html` via `file://` is unsupported.
- Node.js 18+ and npm are optional for the static server and required for tests
  and desktop builds.

### Download or clone

Use the owner-approved repository URL once published. The URL is intentionally a
placeholder until GYTech confirms it.

### Run

```powershell
npm install
npm start
```

Open <http://127.0.0.1:8080/>.

Python alternative:

```powershell
python -m http.server 8080
```

Node server direct:

```powershell
node serve.js
node serve.js 8090
```

The server binds to `127.0.0.1`.

### First launch

1. Wait for the bedside monitor to load.
2. Click the application or **AUDIO** to unlock Web Audio.
3. Select a sample patient or create a simulation patient.
4. Choose a scenario or use the Instructor panel.
5. Review [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

---

## 7. Local data and uninstallation

### Windows desktop data

- `%APPDATA%\GYTech PatientSim Pro` — settings, synthetic patients, active
  context, history, update preferences.
- `%APPDATA%\GYTech PatientSim Pro\logs\patientsim-pro.log` — application log.
- `%APPDATA%\GYTech PatientSim Pro\window-state.json` — window geometry.

Use **Settings → Desktop Application → Export Data** before migrating or
removing a profile.

### Uninstall

- **EXE:** use Windows Apps & Features or the uninstaller in the installation
  folder. Application data is preserved.
- **MSI:** use `msiexec /x {PRODUCT-CODE}` or Apps & Features. Application data
  is preserved.
- **Portable:** delete the extracted folder. Data remains in `%APPDATA%` until
  manually removed.
- **Browser:** delete the project folder and clear site data for the local origin.

No GYTech account, cloud sync, or telemetry data is created.

---

## 8. Updating

The desktop app uses **Notify Then Download** only. It never silently installs.
The official GitHub repository must be configured in
`desktop/update-config.json` by the owner; this repository currently has no
official URL, so live checks are **BLOCKED** and no release is fabricated.

When configured, download opens the official GitHub Release page in the system
browser. The user installs manually. See
[docs/UPDATE_SYSTEM.md](docs/UPDATE_SYSTEM.md).

---

## 9. Development and packaging commands

```powershell
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

On headless Linux:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:ui
```

Do not run packaging or tests with `ELECTRON_RUN_AS_NODE=1`; clear it first:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
```

---

## 10. Troubleshooting

### Blank browser page

- Confirm an HTTP URL, not `file://`.
- Check the browser console.
- Confirm `index.html`, `css/`, `js/`, and `assets/` share the project root.
- Clear cached files and reload.

### Desktop app does not start

- Launch the installed app, not `index.html`.
- Check `%APPDATA%\GYTech PatientSim Pro\logs\patientsim-pro.log`.
- Confirm no older instance is holding the single-instance lock.
- The executable is unsigned; follow your organisation's policy for SmartScreen
  warnings.

### No alarm audio

- Click the app or **AUDIO** first; browsers/Electron block audio before a user
  gesture.
- Check application volume, OS volume, and mute state.
- Speech synthesis voices vary by platform and were not acoustically verified.

### Update check unavailable

- Expected if `desktop/update-config.json` has an empty repository.
- Network failures are non-blocking; the simulator remains usable offline.

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more.

---

Copyright © 2026 GYTech. All Rights Reserved.
