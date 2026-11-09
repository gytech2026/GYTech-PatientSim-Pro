# Privacy Statement — GYTech PatientSim Pro

**Effective for GYTech PatientSim Pro 1.0.1.**  
**Copyright 2026 GYTech All Right Reserved.**

This privacy statement describes the browser application and the Electron desktop
application included in this repository. It does not describe the independent
privacy practices of GitHub, the operating system, the browser/Electron vendor, or
any future hosting provider.

> GYTech PatientSim Pro is an educational simulation. Do not enter real patient
> information, personal health information, credentials, or confidential data.

---

## 1. Summary

- The application runs in the browser or as a packaged Electron desktop app.
- It has no GYTech backend service, user accounts, telemetry, analytics, or
  advertising SDK.
- Simulation data is stored locally in `localStorage`; desktop Electron stores
  that profile under the operating system's application-data directory.
- The application loads its own local static assets. The desktop app serves them
  through a restrictive custom protocol.
- Export and print actions happen locally.
- The desktop update checker is optional. It contacts only the official GitHub
  Releases API after the publisher configures an official repository. No
  telemetry is sent.
- Web Speech voice announcements, if used, depend on the browser/operating
  system and may be processed locally or by a vendor service depending on that
  platform's implementation. GYTech does not control or receive that data.
- Hosting providers may collect standard access logs independently.

## 2. Data stored locally

The application stores the following in browser localStorage under keys starting
with `gytech.patientsim.`:

| Data | Purpose | Contains |
|---|---|---|
| Settings | Persist display, units, alarm limits, volume, NIBP interval, speed, theme, battery preference | User preferences |
| Patient profiles | Allow repeatable simulation training scenarios | Fictional simulation names, IDs, ages, sex, room, bed, diagnosis, medical-history notes entered by the user |
| Active patient | Restore selected patient | Patient profile ID |
| Event history | Review, export, and print simulation events | Simulated event descriptions, timestamps, simulated values, fictional patient references |

This data is unencrypted and is accessible to scripts and users with access to
the same browser profile/origin or desktop user profile. It is not designed for
sensitive information.

### Desktop local paths

On Windows, the packaged application uses:

- `%APPDATA%\GYTech PatientSim Pro` — localStorage profile and update preferences
- `%APPDATA%\GYTech PatientSim Pro\logs\patientsim-pro.log` — technical application log
- `%APPDATA%\GYTech PatientSim Pro\window-state.json` — window size/position

Portable mode still uses the Windows user profile rather than storing data inside
the extracted folder. The log is intended for troubleshooting and may contain
technical error messages; do not put sensitive data into patient fields or error
text.

## 3. No assumed cloud storage or telemetry

The application code does not include:

- A remote database.
- User authentication.
- Analytics or tracking.
- Advertising.
- Telemetry beacons.
- A GYTech cloud account.
- External CDN fonts, scripts, or styles.

If a future version adds any network or telemetry feature, this document must be
updated and the change must be reviewed before release.

## 4. Network requests

When served locally or through an approved GitHub Pages deployment, the browser
requests the application's own static files: HTML, CSS, JavaScript, SVG icons,
and branding images. The application does not call third-party APIs.

The desktop renderer makes no remote requests. An optional update check is
performed by the Electron main process against
`https://api.github.com/repos/<configured-owner>/<configured-repository>/releases/latest`
only after the owner configures the official repository. The request includes the
application version in its User-Agent and receives public GitHub release metadata;
no simulation/patient data is sent. The live channel is not configured in this
repository.

The browser's Web Speech API is a platform feature. Depending on the browser,
operating system, installed voices, and platform policy, speech synthesis may
use local or online processing outside GYTech's control. No GYTech service
receives voice content.

Print and download actions create local browser output; they do not upload
content to GYTech.

## 5. Data deletion

Users can delete data by:

- Clearing the simulation event history in the app (after confirmation).
- Deleting simulation patient profiles.
- Clearing site data/localStorage in the browser for the application origin.
- Using a private/incognito session so data is not retained after the session
  (subject to browser behavior).
- On Windows desktop, deleting `%APPDATA%\GYTech PatientSim Pro` after exporting
  anything needed. Uninstalling the application does not delete that folder.
- Using the desktop Settings → Desktop Application → Export Data / Import Data
  controls to move supported data before removing a profile.

Deleting browser site data is outside GYTech's control and may delete all
simulation data for that origin.

## 6. User responsibilities

- Do not enter real patient information.
- Use fictional simulation patients only.
- Do not rely on localStorage for records, backups, or clinical documentation.
- Review downloaded CSV/PNG/print output before sharing.
- Use appropriate device and browser security controls.
- Obtain any consent or institutional approval required for training use.

## 7. Children and sensitive data

The project is intended for educational/professional use. It does not knowingly
collect personal data through a GYTech server. Do not use real data about
children or any identifiable person in the simulator.

## 8. Hosting-provider data

GitHub Pages or any future host may process IP addresses, request logs, cookies,
or account information under its own privacy policy. GYTech does not control
those provider practices. No hosting-provider analytics integration is included
by this application.

## 9. Changes

Material privacy changes must be documented in `CHANGELOG.md` and this file. A
release is not permitted to claim this statement is current if the data flows
have changed without review.

## 10. Contact

No official GYTech privacy contact has been supplied. Use the configurable
placeholder `[GYTECH_PRIVACY_CONTACT]` only after the owner publishes a verified
contact channel.

---

Copyright 2026 GYTech All Right Reserved.
