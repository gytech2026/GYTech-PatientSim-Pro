# Security Policy — GYTech PatientSim Pro

**Project status:** release preparation; open source under the Apache License 2.0
(`Apache-2.0`).  
**Security contact:** `[GYTECH_SECURITY_CONTACT]` — configurable placeholder. No
official security email address has been supplied or invented.

---

## 1. Supported versions

| Version | Status | Security support |
|---|---|---|
| 1.0.x (release candidate) | Preparation / unpublished | Best effort while the repository is under owner review |
| < 1.0 | Not released | Not supported |

No security certification, audit certification, or regulatory approval is
claimed. A public support window must be established by the owner before a
production release.

## 2. Reporting a vulnerability

**Do not open a public issue for an unpatched vulnerability.**

Report security concerns privately through the official reporting channel once
published. Until an official channel exists, contact the project owner through a
private repository-host mechanism and request a secure handoff.

A useful report includes:

- Affected version/commit.
- Description and impact.
- Reproduction steps or proof of concept.
- Browser/operating-system details.
- Whether browser storage, CSP, scripts, or third-party material are involved.
- Suggested mitigation, if known.
- Whether public disclosure is already planned.

Do not include real patient data, credentials, or exploit details in public
spaces.

## 3. Responsible disclosure

- Allow reasonable time for triage and remediation before public disclosure.
- Do not access, modify, or exfiltrate data that is not yours.
- Do not target hosted infrastructure or accounts beyond the minimum needed to
  demonstrate an issue.
- Good-faith research will be acknowledged when the reporter consents.
- No response-time or bounty promise is made until the owner approves one.

## 4. Security response process

1. Acknowledge receipt through the approved channel.
2. Triage severity and affected components.
3. Coordinate a fix and tests without publicising unpatched details.
4. Prepare a release note and credit if the reporter agrees.
5. Publish the fix and advisory after remediation or as required by law.
6. Review whether similar patterns exist elsewhere.

## 5. Architecture and threat model

GYTech PatientSim Pro is a client-side application with an optional Electron
desktop shell:

- No backend application server is bundled.
- No authentication, cloud account, telemetry, analytics, or advertising code.
- No real medical device connectivity.
- No external asset CDNs or remote fonts.
- Browser state is held in memory and localStorage; the desktop shell stores the
  same local profile under the operating-system user-data directory.
- Reports and screenshots are generated locally.

Deployment infrastructure (such as GitHub Pages) is outside the application
code and has its own provider security model.

### Desktop security boundaries

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Preload exposes only frozen, purpose-specific functions.
- Renderer files are served through `app://gytech` with an explicit path allowlist.
- Navigation away from the application is blocked; new windows are denied.
- External links are restricted to `https://github.com` and
  `https://www.github.com`.
- Permissions (camera, microphone, geolocation, USB) are denied.
- Production DevTools are disabled and common DevTools shortcuts are suppressed.
- The application does not sign downloads or execute installer files. Update
  buttons only open the official GitHub Release page.
- Code signing and macOS notarisation are not configured; unsigned binaries must
  not be described as signed.

## 6. Browser storage

- Simulation patient profiles, settings, and event history are stored in
  `localStorage` under `gytech.patientsim.*` keys.
- Data is unencrypted and accessible to scripts running in the same origin.
- Do not enter real patient data, personal health information, secrets, or
  credentials.
- Clearing browser site data or using the application controls can delete local
  simulation records.
- The application does not promise secure storage or multi-user isolation.

## 7. Input validation and XSS

- Patient fields and event text are escaped before insertion into HTML templates.
- The application uses a restrictive Content Security Policy meta tag and a
  desktop response-header CSP:
  `default-src 'self'; script-src 'self'; ... object-src 'none'`.
- Inline event handlers and remote scripts are not used.
- Contributors must avoid unsanitized `innerHTML` and must validate state and
  numeric bounds before transitions.
- Report any suspected DOM-based or stored XSS issue privately.

CSP delivery limitations:

- Meta-tag CSP cannot enforce frame-ancestors reliably.
- A production host should add HTTP response headers where possible.
- The optional print report opens a separate generated document; reviewers
  should treat it as a separate security surface.

## 8. Desktop updates

- The update source is fixed to the public repository
  `gytech2026/GYTech-PatientSim-Pro`; no other host or server is configurable.
- No GitHub token, credential, or account is required or stored for public
  release checks.
- Update metadata is fetched in the main process only.
- The endpoint is the official GitHub Releases API for the configured repository.
- Only stable, non-draft, non-prerelease semantic versions are accepted.
- The release page must be an `https://github.com/...` URL.
- The application never downloads, executes, or installs an update automatically.
- The download button opens the release page in the system browser after host
  validation.
- Network errors are caught; startup and simulation remain functional offline.

## 9. Dependency security

- Runtime: no third-party JavaScript libraries.
- Development/test: Electron 34.1.1 (and its Chromium components) is declared
  as a development dependency. It is not part of the browser deployment.
- The repository's `security.yml` workflow performs a basic secret scan,
  dependency audit, and static analysis where the runner supports it.
- Dependabot is configured for npm and GitHub Actions after publication.
- Dependencies and assets must be documented in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 10. Secrets

No credentials or API keys should be committed. Use `.gitignore`, environment
secrets in CI, and provider secret scanning. The local `npm run check:secrets`
script is a basic check, not a full secret-management system.

## 11. Security limitations

- Browser-based simulations cannot guarantee resistance to a compromised
  browser, extension, operating system, or hosting provider.
- The application is not designed for hostile multi-tenant use.
- Local reports and downloads are the user's responsibility.
- Simulated patient data is not real PHI and must not be treated as such.
- Audit findings and remediation status should be reviewed before any formal
  production deployment.
- **No security review makes this software a medical device or clinically valid.**

---

Copyright 2026 GYTech All Right Reserved.
