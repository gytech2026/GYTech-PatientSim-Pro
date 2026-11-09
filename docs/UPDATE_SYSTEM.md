# Update System — Notify Then Download

**Copyright © 2026 GYTech. All Rights Reserved.**

GYTech PatientSim Pro uses a **user-controlled** update notification model. It
does not silently download, execute, or install updates.

## Current status

| Item | Status |
|---|---|
| Update UI and preference handling | **IMPLEMENTED** |
| Update version/metadata validation | **IMPLEMENTED** and **TESTED** with synthetic fixtures |
| Update notification / error handling | **TESTED** with a synthetic bridge |
| Official update repository | **CONFIGURED** — `gytech2026/GYTech-PatientSim-Pro` |
| Live GitHub Release check | **IMPLEMENTED**; no stable release has been published yet, so the app reports "no stable release" |
| Live update against a real release | **NOT YET TESTED** — no release exists |
| Automatic download/installation | **DELIBERATELY NOT IMPLEMENTED** for any package format |

The repository is configured in `desktop/update-config.json` as
`gytech2026/GYTech-PatientSim-Pro`. The application derives:

```text
https://api.github.com/repos/gytech2026/GYTech-PatientSim-Pro/releases/latest
```

and the manual download page:

```text
https://github.com/gytech2026/GYTech-PatientSim-Pro/releases
```

Public release metadata is read without a personal access token. No token,
credential, or GitHub account is required for public release checks.

## Supported update path by package format

The application ships its own release notifier; it does **not** bundle
`electron-updater`, and the build does not publish `latest.yml`, `latest-mac.yml`,
or blockmap files. Consequently **no package format performs automatic
download-and-install**. Every format uses the same manual path: notify, open the
official Releases page, and let the user download and run the installer.

| Format | Automatic install | Update behaviour |
|---|---|---|
| Windows NSIS setup EXE | No | Notify + open official Releases page |
| Windows MSI | No | Notify + open official Releases page |
| Windows portable ZIP | No | Notify + open official Releases page |
| Linux AppImage | No | Notify + open official Releases page |
| Linux DEB / RPM | No | Notify + open official Releases page |
| macOS DMG (x64 / arm64) | No | Notify + open official Releases page |

Do not describe any of these formats as self-updating. Adding automatic install
would require adding an updater dependency, generating signed update metadata per
platform, and testing upgrade paths for each format — none of which is present or
tested today.

## Behaviour

1. After startup, a configured build waits six seconds, then checks for a newer
   stable release if automatic checks are enabled.
2. Periodic checks are scheduled from `checkIntervalHours` while the application
   runs.
3. The main process requests the latest GitHub Release with a 15-second timeout.
4. The release is rejected unless it is:
   - a non-draft, non-prerelease release;
   - tagged with a valid stable semantic version;
   - linked to an official `https://github.com/...` release page.
5. The installed version is compared to the latest version.
6. Results are reported as one of:
   - `update-available` — dialog with installed/latest versions and notes;
   - `up-to-date` — "You are running the latest stable version";
   - `no-release` — no stable release published yet (HTTP 404 from GitHub);
   - `error` — offline, timeout, rate limit, invalid metadata, or HTTP failure;
   - `disabled` / `unconfigured` — build configuration states.
7. If newer, the in-app dialog shows:
   - installed version;
   - latest version;
   - release name and a plain-text release-notes excerpt;
   - **Download Update** — opens the official GitHub Release page;
   - **View Release Notes** — opens the official page;
   - **Remind Me Later** — snoozes for the configured hours;
   - **Dismiss** — suppresses that exact version until a later version.
8. The Settings panel always offers **RELEASES**, which opens the configured
   official Releases page for manual checks and downloads.
9. No downloaded binary is executed, and no installer is launched automatically.
10. Concurrent checks are de-duplicated in both the renderer and the main
    process, so repeated clicks or menu actions cannot overlap GitHub requests.

## Security properties

- The update fetch runs in the Electron **main process**, not in the renderer.
- Only `https://api.github.com` is contacted for metadata.
- External release links are restricted to `https://github.com` and
  `https://www.github.com`.
- Release metadata is size-limited and validated.
- The app never trusts a URL supplied by a release note; only the API's
  `html_url` is used after host validation.
- The renderer CSP remains `connect-src 'self'`; the simulation page itself has no
  remote fetch capability.
- Network errors and rate limits are caught and never block the simulator.
- The user can disable automatic checks in Settings; manual checks remain
  available.
- Dismiss/snooze state is stored locally. No update telemetry is transmitted.
- No credentials, tokens, or GitHub account details are exposed to the renderer.

## Testing performed

The desktop harness used a **synthetic fixture bridge** to verify:

- notification content and installed/latest versions;
- Download opening the validated GitHub Release URL;
- the RELEASES button opening the configured official Releases page;
- Remind Me Later and Dismiss behaviour;
- overlapping check requests being de-duplicated;
- a missing release (no published stable release) not producing a false update;
- error responses not blocking the simulator;
- up-to-date responses not showing a false update;
- unsafe HTTP release URLs being rejected;
- semantic-version comparisons.

The synthetic fixture values are test data only and are not presented as an
official release.

The configured GitHub endpoint currently returns **HTTP 404** for
`releases/latest` because no release has been published; the official Releases
page returns **HTTP 200**. The in-app live check has **not** been exercised
against a real published release. Do not describe the live update channel as
verified until that is done.

## Manual release test after publishing a stable release

1. Publish a real stable GitHub Release with a semantic version tag.
2. Ensure the release is not a draft/prerelease and has its notes filled in.
3. Launch the installed desktop application.
4. Open Settings → Desktop Application → **CHECK NOW**.
5. Confirm the dialog shows the real version and release page.
6. Verify **DOWNLOAD UPDATE** opens the official page in the default browser.
7. Verify **RELEASES** opens the official Releases page.
8. Verify no binary is downloaded or executed automatically.
9. Verify network failure and offline startup by disconnecting the network and
   launching the simulator.

Only after these steps may the update channel be described as live-tested.
