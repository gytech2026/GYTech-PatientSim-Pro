# Contributing to GYTech PatientSim Pro

Thank you for considering a contribution. This project is an educational
medical-simulation application. Contributions must preserve its safety
boundaries, software quality, and honest documentation.

**Copyright 2026 GYTech All Right Reserved.**

> GYTech PatientSim Pro is open source under the **Apache License 2.0**
> (`Apache-2.0`). By submitting a contribution you agree that it is licensed
> under the same license, as described in
> [Section 14](#14-licensing-and-copyright-requirements). See [LICENSE](LICENSE)
> and [LICENSE-FAQ.md](LICENSE-FAQ.md).

---

## 1. Contribution principles

- Keep the simulator educational and software-only.
- Never imply clinical validity, medical-device certification, or regulatory approval.
- Prefer focused, reviewable changes over unrelated rewrites.
- Preserve working features unless a documented migration is approved.
- Add tests and documentation with behavior changes.
- Do not introduce stock medical branding, manufacturer logos, or unlicensed assets.
- Do not add real patient data, credentials, or secrets.

## 2. Repository setup

Prerequisites:

- Node.js 18 or later.
- npm.
- A modern Chromium-based browser for normal use and the existing test harnesses.

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd GYTech-PatientSim-Pro
npm install
npm start
```

Open `http://127.0.0.1:8080/`. Electron is installed as a development-only
dependency for the automated test harnesses; it is not used by the runtime
application.

## 3. Development environment

- Use UTF-8 files and LF line endings as defined by `.editorconfig` and `.gitattributes`.
- Do not introduce runtime frameworks or CDN dependencies without owner review.
- Keep browser support in mind: standard ES modules, Canvas 2D, CSS Grid/Flexbox,
  Web Audio, Web Speech, and localStorage.
- Use the existing static server rather than opening `index.html` via `file://`.

## 4. Branch naming

Use descriptive branches:

```text
feature/<short-name>
bugfix/<short-name>
documentation/<short-name>
refactor/<short-name>
security/<short-name>
testing/<short-name>
```

Examples: `feature/alarm-audit`, `bugfix/nibp-countdown`, `security/csp-headers`.

## 5. Commit message conventions

Use Conventional Commits-style prefixes:

```text
feat: add simulated perfusion trend
fix: prevent charge initiation without pads
docs: clarify synchronized cardioversion limitations
style: normalize waveform card spacing
refactor: isolate ECG lead morphology
test: cover NIBP sensor failure
chore: update Electron dev dependency
security: tighten content security policy
```

Write present-tense, specific messages. Do not claim a test or security result
that was not produced.

## 6. Coding standards

### JavaScript

- ES modules, no bundler required.
- Prefer `const`; use `let` only where reassignment is needed.
- Validate device, patient, and parameter state before transitions.
- Keep one authoritative state store; avoid unrelated globals.
- Keep simulation state separate from DOM state.
- Use explicit units and include `null`/unavailable states instead of fabricated values.
- Guard browser-only APIs behind availability checks where appropriate.
- Avoid adding animation loops; use the existing simulation loop.
- Do not introduce `eval`, dynamic script injection, or unsanitized HTML.
- Escape user-supplied values inserted into HTML.

### CSS

- Use the established CSS custom properties in `css/main.css`.
- Respect responsive breakpoints and vital-sign readability.
- Prefer component classes over page-specific selectors.
- Do not use external CSS frameworks or remote font imports.
- Verify contrast in dark, high-contrast, and night themes.

### HTML

- Keep IDs unique and accessible labels on controls.
- Do not add inline event handlers.
- Maintain CSP compatibility: no inline scripts, no remote resources.
- Add ARIA labels where a visual control is ambiguous.
- Keep screenshots and documentation links internally consistent.

### Copyright headers

New original source files must include the GYTech header:

```text
/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */
```

Do not add this header to third-party files.

## 7. Documentation standards

- Use Markdown with descriptive headings and working relative links.
- Keep installation commands generic, not tied to a local workstation path.
- Label implemented, partial, and planned features truthfully.
- Update `CHANGELOG.md` under `[Unreleased]`.
- Update screenshots when the UI changes.
- Do not use images from other medical manufacturers.
- Do not invent repository URLs, contributors, licenses, releases, or clinical claims.

## 8. Testing requirements

Before submitting a pull request, run what your environment supports:

```powershell
npm run validate
npm run check:secrets
npm run test
```

The Electron test suites require a display. On Linux CI, use `xvfb-run`.
Browser tests are Chromium/Electron only unless a contributor adds verified
cross-browser coverage. State exactly what was run and what was not run.

At minimum, test the affected behavior and surrounding safety boundaries:

- patient switching and state reset,
- waveform continuity and sensor-off states,
- alarm activation, silence, acknowledge, and escalation,
- NIBP intermittent measurement/failure,
- defibrillator transitions and interlocks,
- pacing capture/failure states,
- CPR counters and no automatic ROSC,
- persistence reload, and
- responsive layout when UI changes.

## 9. Bug reporting

Use the GitHub bug report template and include:

- A clear title and description.
- Steps to reproduce.
- Expected and actual behavior.
- Browser and operating system.
- Console errors.
- Application version.
- Screenshots or recordings when relevant.
- Whether any simulated patient state or device state is involved.

**Do not include real patient data or unpatched vulnerability details in a
public issue.**

## 10. Feature proposals

Use the feature request template. Explain the educational value, safety impact,
affected modules, implementation approach, and whether the feature can be
implemented within the browser-only simulation boundary. Owners decide product
direction and release scope.

## 11. Pull request workflow

1. Open or reference an issue for non-trivial work.
2. Create a scoped branch.
3. Implement and test.
4. Update docs, screenshots, changelog, and third-party notices if needed.
5. Open the pull request using the template.
6. Address review comments.
7. Merge only after applicable checks pass and the owner accepts the change.

## 12. Code review

Reviewers should check:

- Functional correctness and state transitions.
- Safety boundaries and disclaimers.
- Pulse/perfusion and waveform consistency.
- Accessibility and responsive behavior.
- No fabricated clinical claims.
- Input validation and CSP/XSS safety.
- Test evidence and documentation accuracy.
- Licensing and asset provenance.

## 13. Merge requirements

- No unresolved critical or high-severity review issue.
- No known secret or real patient data in the diff.
- Applicable tests pass or the limitation is documented.
- Documentation remains accurate.
- Licensing status is not misrepresented.
- Medical simulation implications are reviewed.

## 14. Licensing and copyright requirements

By submitting a contribution, you confirm that you have the right to submit it
and that it does not knowingly include incompatible third-party material. Unless
you explicitly state otherwise, contributions intentionally submitted for
inclusion in this project are licensed under the Apache License 2.0, per Section
5 of [LICENSE](LICENSE) ("inbound = outbound"). You retain copyright in your
contribution and grant the project and its recipients the rights granted by that
license.

A merged pull request does not guarantee inclusion in a release and does not
transfer copyright.

The project does not currently require a Contributor License Agreement or a
Developer Certificate of Origin sign-off. Do not sign or claim a CLA that GYTech
has not published. If a CLA or DCO policy is adopted later, it will be published
in this repository.

## 15. Medical simulation safety requirements

Every PR touching physiological simulation or therapy controls must consider:

- Does a pulse exist? Is perfusion represented consistently?
- Is a rhythm classified using rhythm **and** pulse state?
- Does an AED recommendation ever imply shock for a non-shockable rhythm?
- Is synchronized cardioversion gated by valid simulated synchronization?
- Is pacing clearly separate from defibrillation?
- Does a shock ever imply automatic ROSC?
- Are CPR effects clearly simulated and not claimed as physical measurement?
- Are sensor-off states shown as unavailable rather than fabricated?
- Are all educational disclaimers still accurate?

---

Copyright 2026 GYTech All Right Reserved.
