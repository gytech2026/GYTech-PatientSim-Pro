# Test Harnesses

**Copyright 2026 GYTech All Right Reserved.**

These are development-only Electron/Chromium harnesses. They are not part of the
browser runtime.

| Harness | Purpose |
|---|---|
| `electron-harness.js` | Cold load, required DOM, canvases, failed requests |
| `interactive-harness.js` | Required functional flows and persistence reload |
| `deep-tests.js` | All scenarios, rhythms, pacing, sync, NIBP, CPR/ROSC, alarms |
| `ui-harness.js` | UI controls/modals, patient CRUD, responsive viewports |
| `capture-screenshots.js` | Genuine screenshots and original branding render |

## Run

```powershell
npm install
$env:ELECTRON_RUN_AS_NODE=$null
npm run test
npm run screenshots
```

Linux CI uses Xvfb:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:ui
```

Tests intentionally mutate browser-local simulation data. Generated artifacts
(`tests/*.json`, `tests/*.txt`, `tests/screenshots/`) are ignored by Git.

## Evidence

Release screenshots are committed under `assets/screenshots/`; testing results
are summarized in [TESTING_REPORT.md](../TESTING_REPORT.md).

No test certifies clinical validity. GitHub Actions execution status must be
checked on the official repository after publication.
