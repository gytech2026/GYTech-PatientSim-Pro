# Test Harnesses

**Copyright 2026 GYTech All Right Reserved.**

These are development-only Electron/Chromium harnesses. They are not part of the
browser runtime and are never packaged into the desktop application.

| Harness | Purpose |
|---|---|
| `electron-harness.js` | Cold load, required DOM, canvases, failed requests |
| `interactive-harness.js` | Required functional flows and persistence reload |
| `deep-tests.js` | All scenarios, rhythms, pacing, sync, NIBP, CPR/ROSC, alarms |
| `ui-harness.js` | UI controls/modals, patient CRUD, responsive viewports |
| `capture-screenshots.js` | Genuine screenshots and original branding render |

## Run

Every harness is started through `scripts/run-electron-test.mjs`, which launches
the real Electron binary, forwards its output and exit code, and clears
`ELECTRON_RUN_AS_NODE` for the child process:

```powershell
npm install
npm test
npm run screenshots
```

Running `electron tests/<harness>.js` directly bypasses this launcher; use the
npm scripts instead.

Linux CI uses Xvfb:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:ui
```

Tests intentionally mutate browser-local simulation data. Generated artifacts
(`tests/*.json`, `tests/*.txt`, `tests/screenshots/`) are ignored by Git.

## Linux CI and the Chromium sandbox

Chromium sets up its Linux process sandbox in the browser process before this
harness JavaScript is evaluated. On a GitHub-hosted Ubuntu runner the bundled
`chrome-sandbox` helper is not owned by root with mode `4755`, so Electron aborts
with:

```text
FATAL:setuid_sandbox_host.cc(163): The SUID sandbox helper binary was found,
but is not configured correctly.
```

`app.commandLine.appendSwitch('no-sandbox')` inside a harness runs after that
bootstrap and cannot prevent the abort. The switch must be on the Electron
command line itself, which is why the launcher exists.

`scripts/run-electron-test.mjs` adds `--no-sandbox` only when **all** of these
are true:

- the platform is Linux, where the SUID/namespace sandbox is the problem;
- the process is a CI run (`CI=true` or `GITHUB_ACTIONS=true`), or the developer
  explicitly sets `ELECTRON_TEST_NO_SANDBOX=1`.

The flag applies to the test process only. Production remains sandboxed:
`desktop/main.cjs` uses `sandbox: true`, `contextIsolation: true`,
`nodeIntegration: false`, and no `--no-sandbox` is added to `desktop:dev` or to
packaged builds.

A developer on Linux whose machine has no configured SUID sandbox can run the
same tests locally with:

```bash
ELECTRON_TEST_NO_SANDBOX=1 xvfb-run -a --server-args="-screen 0 1920x1080x24" npm run test:load
```

Set that variable only for a local test invocation; it is not needed on a normal
desktop and must not be added to production launch scripts.

## Evidence

Release screenshots are committed under `assets/screenshots/`; testing results
are summarized in [TESTING_REPORT.md](../TESTING_REPORT.md).

No test certifies clinical validity. GitHub Actions execution status must be
checked on the official repository after publication.
