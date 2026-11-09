# Cross-Platform Build and Release

**Copyright © 2026 GYTech. All Rights Reserved.**

This document describes how to produce and verify GYTech PatientSim Pro desktop
artefacts. Do not claim a platform was built or tested unless its job actually
completed and its output was launched.

## Framework

Electron 34.1.1, packaged with electron-builder 26.18.1. See
[DESKTOP_APPLICATION.md](DESKTOP_APPLICATION.md) for the framework decision.

## Prerequisites

- Node.js 24 LTS for CI and release builds (Node.js 18+ remains the minimum for local tooling)
- npm
- Windows 10/11 x64 for the Windows builds
- Ubuntu/Debian-compatible Linux for AppImage/DEB/RPM
- macOS for DMG builds
- No Rust or Tauri toolchain is required for this Electron configuration

```bash
npm ci
```

Electron and electron-builder are development dependencies. The installed
application carries its own Electron runtime; end users do not need Node.js.

## Windows

```powershell
npm run validate
npm run test:desktop
npm run desktop:build:win
npm run desktop:checksums
npm run desktop:smoke -- "release\win-unpacked\GYTech PatientSim Pro.exe"
```

Outputs in `release/`:

| Format | Expected name |
|---|---|
| Assisted NSIS installer | `GYTech-PatientSim-Pro-Setup-v1.0.0.exe` |
| MSI | `GYTech-PatientSim-Pro-x64-v1.0.0.msi` |
| Portable ZIP | `GYTech-PatientSim-Pro-Portable-v1.0.0.zip` |
| Checksums | `SHA256SUMS.txt` |

The installers are unsigned unless the owner configures a code-signing
certificate. Windows SmartScreen may warn on unsigned installers. Do not claim
the binaries are signed.

The NSIS installer is per-user and offers installation-directory selection,
Start Menu shortcut, optional Desktop shortcut, and uninstaller. MSI uses WiX
tooling downloaded by electron-builder. The MSI upgrade code is fixed as
`{04227E65-D441-46F3-98D8-6F48B3E94590}` and must not change after a public
release.

## Linux

Build on Linux (or the GitHub Ubuntu runner), not from Windows:

```bash
npm ci
sudo apt-get update
sudo apt-get install -y libarchive-tools rpm
npm run validate
npm run desktop:build:linux
npm run desktop:checksums
```

Expected artefacts:

- `GYTech-PatientSim-Pro-Linux-x64.AppImage`
- `GYTech-PatientSim-Pro-Linux-x64.deb`
- `GYTech-PatientSim-Pro-Linux-x64.rpm`

The current Windows environment cannot build or validate these packages. They
are **CONFIGURED**, not built or tested. DEB/RPM maintainer metadata uses
`GYTech` without inventing a contact email. Package-manager expectations may
require the owner to add an approved maintainer contact before public
distribution.

## macOS

Build on macOS (or the GitHub macOS runner):

```bash
npm ci
CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:build:mac
npm run desktop:checksums
```

Expected artefacts:

- `GYTech-PatientSim-Pro-macOS-x64.dmg`
- `GYTech-PatientSim-Pro-macOS-arm64.dmg`

The current configuration is unsigned and not notarised. Gatekeeper may block
first launch. **Do not claim Apple signing or notarisation.** A future release
requires an Apple Developer ID certificate, hardened runtime, notarisation, and
stapling. Those credentials are not present in this repository.

The architecture token produced by electron-builder is `arm64` (lowercase); the
desired display convention may use `ARM64` in release notes.

## GitHub Actions

The workflow is [.github/workflows/desktop-release.yml](../.github/workflows/desktop-release.yml).

It runs three native build jobs:

- `windows-2025` → EXE, MSI, portable ZIP
- `ubuntu-24.04` → AppImage, DEB, RPM
- `macos-15` → x64 and ARM64 DMG

Each job installs, validates, builds, and uploads artefacts. The release job
combines artefacts, generates a single `SHA256SUMS.txt`, and can create a GitHub
Release for an authorised tag. The publish job uses the `release` environment;
configure required reviewers in GitHub for additional approval control.

The workflow has **not been executed on GitHub** from this workstation. Check the
Actions run for the authoritative result after pushing; do not claim a build
passed without a green workflow run.

Tagging convention:

```bash
# Only after owner approval and repository setup
git tag v1.0.0
git push origin v1.0.0
```

A tag is an explicit release action. Do not push an authorised tag until the
contacts, signing decisions, and release notes are approved.

## Checksums

`npm run desktop:checksums` hashes existing EXE/MSI/ZIP/AppImage/DEB/RPM/DMG
files and writes `SHA256SUMS.txt`. It fails if the release directory is empty or
missing. It does not create placeholder entries.

## Versioning

Version `1.0.0` is read from `package.json` and used by Electron, the application
About panel, and installer names. A future release must update:

1. `package.json` version
2. `js/state.js` `APP_VERSION`
3. release notes / CHANGELOG
4. rebuild all platform artefacts
5. regenerate checksums

Do not manually rename one installer to a different version.

## Known build limitations

- Windows installers/MSI are unsigned.
- macOS DMG is unsigned and not notarised.
- Linux artefacts are not built in the current Windows-only environment.
- No auto-update installation is implemented by design; only notification and
  manual download.
- Code signing, notarisation, and platform distribution testing remain owner
  responsibilities.
