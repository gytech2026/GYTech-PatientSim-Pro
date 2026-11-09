# Support — GYTech PatientSim Pro

**Copyright © 2026 GYTech. All Rights Reserved.**

GYTech PatientSim Pro is an educational browser and desktop simulation. It is not
a medical device and does not provide clinical or emergency support.

## Where to get help

| Need | Channel |
|---|---|
| Bug report | GitHub issue tracker — use the bug report template |
| Feature request | GitHub issue tracker — use the feature request template |
| Documentation correction | GitHub issue template for documentation |
| Security vulnerability | Private reporting per [SECURITY.md](SECURITY.md); do not open a public issue |
| General usage | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Installation problem | [INSTALLATION.md](INSTALLATION.md) and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Desktop packaging/build | [docs/DESKTOP_APPLICATION.md](docs/DESKTOP_APPLICATION.md) and [docs/CROSS_PLATFORM_BUILD.md](docs/CROSS_PLATFORM_BUILD.md) |
| Update behavior | [docs/UPDATE_SYSTEM.md](docs/UPDATE_SYSTEM.md) |
| Scenario / physiology questions | [docs/SIMULATION_GUIDE.md](docs/SIMULATION_GUIDE.md) and [docs/ECG_GUIDE.md](docs/ECG_GUIDE.md) |

The repository URL is not yet confirmed. Before publication, replace
`<YOUR_GITHUB_REPOSITORY_URL>` in documentation with the approved URL. Do not
invent a GitHub organization, Discussions URL, or support email.

## Before opening an issue

1. Confirm you are running the latest reviewed version.
2. Check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
3. Capture the browser console output and, for desktop issues, the application
   log from **Help → Open Application Logs**.
4. State the browser or desktop package, operating system, viewport, and app
   version.
5. Describe whether the issue is clinical-simulation behavior, UI, installation,
   update notification, or platform compatibility.
6. Remove any real patient data from screenshots or logs.

## Known limitations

- Educational simulation only; no clinical validation.
- Chromium/Electron test coverage only.
- No physical device communication or electrical output.
- Native print dialogs, speech synthesis, and acoustic alarm output are not
  fully automated.
- Synchronized cardioversion uses validated simulated sync eligibility and
  markers; it does not claim real-world R-wave timing accuracy.
- CPR quality is a calculated teaching value, not a physical measurement.
- Browser/desktop localStorage is not a secure clinical record store.
- Windows desktop packages are unsigned; macOS packages are unsigned and not
  notarised. Linux/macOS packages were not built on the Windows host.
- The update channel targets the official `gytech2026/GYTech-PatientSim-Pro`
  repository, but no stable release has been published yet and no format
  auto-installs updates.
- No response-time guarantee has been approved.

## No emergency use

If this is a real clinical emergency, use appropriate emergency services,
trained personnel, and validated medical equipment. Do not use this project.
