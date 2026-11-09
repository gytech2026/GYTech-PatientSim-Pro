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
| Live GitHub Release check | **BLOCKED — no official repository configured** |
| Automatic download/installation | **DELIBERATELY NOT IMPLEMENTED** |

No official GitHub repository URL exists in this repository. Therefore
`desktop/update-config.json` deliberately contains an empty `repository` value.
The desktop application shows “official update repository has not been
configured” and performs no live release check. It does **not** invent versions,
release URLs, download links, or release notes.

## Configuration

After the owner confirms the official repository, set:

```json
{
  "enabled": true,
  "repository": "OWNER/REPOSITORY",
  "checkIntervalHours": 6,
  "remindLaterHours": 24,
  "releaseNotesMaxLength": 2400
}
```

Do not use a fabricated `OWNER/REPOSITORY`. The application derives the endpoint:

```text
https://api.github.com/repos/OWNER/REPOSITORY/releases/latest
```

Only GitHub's official HTTPS API endpoint is used. There is no configurable
download host or arbitrary update server.

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
6. If newer, the in-app dialog shows:
   - installed version;
   - latest version;
   - release name and a plain-text release-notes excerpt;
   - **Download Update** — opens the official GitHub Release page;
   - **View Release Notes** — opens the official page;
   - **Remind Me Later** — snoozes for the configured hours;
   - **Dismiss** — suppresses that exact version until a later version.
7. No downloaded binary is executed, and no installer is launched automatically.

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

## Testing performed

The desktop harness used a **synthetic fixture bridge** to verify:

- notification content and installed/latest versions;
- Download opening the validated GitHub Release URL;
- Remind Me Later and Dismiss behaviour;
- error responses not blocking the simulator;
- up-to-date responses not showing a false update;
- unsafe HTTP release URLs being rejected;
- semantic-version comparisons.

The synthetic fixture values are test data only and are not presented as an
official release. A real GitHub API check could not be executed because the
official repository is not configured. Do not describe the live update channel
as verified.

## Manual release test after configuring the repository

1. Publish a real stable GitHub Release with a semantic version tag.
2. Ensure the release is not a draft/prerelease and has its notes filled in.
3. Launch the installed desktop application.
4. Open Settings → Desktop Application → Check Now.
5. Confirm the dialog shows the real version and release page.
6. Verify Download opens the official page in the default browser.
7. Verify no binary is downloaded or executed automatically.
8. Verify network failure and offline startup by disconnecting the network and
   launching the simulator.

Only after these steps may the update channel be described as live-tested.
