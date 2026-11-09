# GitHub Repository Setup — GYTech PatientSim Pro

**Copyright 2026 GYTech All Right Reserved.**

This document prepares the repository for owner review. It does **not** create a
GitHub organization, repository, release, deployment, or remote. No account-level
action has been taken.

---

## 1. Recommended repository metadata

| Field | Recommended value |
|---|---|
| Owner / organization | GYTech — **confirm actual GitHub account handle** |
| Repository name | `GYTech-PatientSim-Pro` |
| Description | A professional browser-based patient vital signs monitor and defibrillator simulator featuring real-time ECG waveforms, physiological simulation, multiparameter monitoring, alarms, AED, manual defibrillation, synchronized cardioversion, pacing, and medical training scenarios. |
| Homepage | Leave blank until a verified deployment URL exists. Do not invent one. |
| Visibility | Public; visibility alone grants no rights — the Apache-2.0 [LICENSE](../LICENSE) does |
| Default branch | `main` |
| Topics | `patient-monitor`, `vital-signs`, `medical-simulation`, `ecg`, `ecg-monitor`, `defibrillator`, `aed-simulator`, `cardioversion`, `healthcare-technology`, `medical-education`, `javascript`, `html`, `css`, `simulation`, `gytech` |
| Social preview | `assets/branding/social-preview.png` (upload in repository settings) |
| License status | **Apache License 2.0** (`Apache-2.0`) — effective |
| Release | Candidate only; do not publish until owner approval and checks pass |

### Confirmed facts

- Application name: **GYTech PatientSim Pro**.
- Full title: **Advanced Patient Vital Signs Monitor & Defibrillator Simulator**.
- Year: 2026.
- Mandatory notice: `Copyright 2026 GYTech All Right Reserved.`
- Repository content is educational simulation only.

### Unconfirmed facts — do not invent

- GitHub organization URL or username.
- Company address, registration number, legal-entity status, or trademark status.
- Official support, security, or conduct contact.
- Verified deployment URL.
- DOI, ORCID, release date, or contributor names.
- Regulatory status, clinical validation, or certifications.

---

## 2. README and badges

The README uses only badges and statements that can be supported from this
repository:

- Version: 1.0.1 (current stable release).
- License: Apache License 2.0 (`Apache-2.0`).
- Documentation: present.
- Test status: descriptive local results only; no remote CI badge until the
  owner's workflow has actually run successfully.

Do not add “build passing”, coverage, stars, forks, contributors, or
release badges that imply a GitHub repository/CI state that does not yet exist.
The Apache-2.0 license badge is supported by the committed LICENSE and is
accurate.

---

## 3. GitHub Pages

The workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) is
manual by default.

1. Confirm `npm ci` and `npm run build:pages` locally.
2. Review `dist/` contents.
3. In GitHub: **Settings → Pages → Source: GitHub Actions**.
4. Ensure Actions has `pages: write` and `id-token: write` permissions.
5. Run **Deploy GitHub Pages** manually after owner approval.
6. Only then add the verified Pages URL to the repository homepage and README.

The build copies only the runtime app, icon/branding assets, and `.nojekyll` into
`dist/`. Screenshots and test artefacts are not part of the deployed app.

---

## 4. Desktop release setup

The desktop build workflow is
[`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml).
It is configured for native Windows, Ubuntu, and macOS runners. The repository now
exists at `https://github.com/gytech2026/GYTech-PatientSim-Pro`, but the workflow
has still not been executed on GitHub.

Before an authorised desktop release:

1. Confirm the official repository URL
   (`https://github.com/gytech2026/GYTech-PatientSim-Pro`).
2. `desktop/update-config.json` is set to `gytech2026/GYTech-PatientSim-Pro`; keep
   it in sync if the repository moves. Do not use a placeholder or fabricated URL.
3. Decide whether Windows code signing and macOS Developer ID signing/notarisation
   are available. If not, keep the unsigned warnings in the documentation and do
   not claim signing.
4. Create a protected GitHub environment named `release` with required reviewers
   for the publish job.
5. Run the desktop workflow manually for build validation before pushing a tag.
6. Verify Windows EXE/MSI/portable artefacts, Linux artefacts, macOS DMGs, and
   `SHA256SUMS.txt` from the workflow.
7. Only then push an authorised `v*` tag or run the publish workflow.
8. Test the official update channel with a real stable GitHub Release.

The workflow's `publish` job uses a GitHub environment. Configure it before any
release tag is pushed. The workflow itself does not create code-signing
credentials, contact details, or an official repository URL.

---

## 5. Publication checklist

- [ ] Owner confirms the official GitHub account/organization.
- [ ] Owner approves the final repository name and description.
- [x] Owner approves a LICENSE and replaces the pending notice (Apache-2.0 adopted).
- [ ] Owner provides support/security/conduct contact information.
- [ ] Owner reviews screenshots and branding.
- [ ] Owner reviews the medical disclaimer and disclaimers in the UI/About.
- [ ] CI workflows have run successfully on the owner's repository.
- [ ] Desktop workflow has produced and verified native Windows/Linux/macOS
      artefacts, or unbuilt platforms are explicitly marked unsupported.
- [ ] Owner decides on Windows signing and macOS notarisation.
- [ ] `desktop/update-config.json` contains the official repository, or live
      updates remain explicitly disabled.
- [ ] No secrets or real patient data are present.
- [ ] Third-party notices are accurate, including bundled Electron/Chromium.
- [ ] Release notes are approved.
- [ ] Release version and date are approved.
- [ ] Repository is created under the correct owner account.

---

## 6. Exact publishing commands (do not run until approved)

These commands are provided for the owner to run after the destination is
approved:

```powershell
git init
git add .
git commit -m "chore: initialize GYTech PatientSim Pro"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

Before running:

1. Replace `<YOUR_GITHUB_REPOSITORY_URL>` with the approved remote.
2. Confirm `.gitignore` excludes `node_modules/`, `dist/`, `release/`, and local test artefacts.
3. Inspect `git status` and `git diff --cached`.
4. Confirm no secrets, local paths, or real patient data are staged.
5. Confirm the owner approved publication.

No push, release, or deployment has been performed by this preparation process.

---

## 7. Release preparation

Release notes are provided at
[docs/RELEASE_NOTES_v1.0.1.md](RELEASE_NOTES_v1.0.1.md) for the published stable
release; the earlier [v1.0.0 notes](RELEASE_NOTES_v1.0.0.md) are retained as
history. Both tags and releases already exist and must not be moved or recreated.

Before any future authorised release:

- confirm the license remains Apache-2.0,
- update the version in `package.json`, `js/state.js`, and the docs,
- run the full test suite and repository validation,
- verify the update repository is configured,
- record signing/notarisation decisions,
- obtain owner approval.

Use a new semantic version tag only after the release criteria are satisfied; do
not reuse `v1.0.0` or `v1.0.1`.

---

## 8. Repository settings recommendations

- Enable private vulnerability reporting if available.
- Enable Dependabot alerts and security updates.
- Enable secret scanning / push protection if available.
- Protect `main` with required status checks after workflows run.
- Require pull request review for changes.
- Disable force pushes to `main`.
- Review Actions permissions and pin third-party actions.
- Set Pages deployment to the approved environment only.
- Add repository social preview from `assets/branding/social-preview.png`.
- Add topics from the list above.

---

## 9. Pending owner decisions

| Decision | Status |
|---|---|
| Permanent license | Apache License 2.0 (`Apache-2.0`) — adopted |
| GitHub organization/repository URL | Configured — `https://github.com/gytech2026/GYTech-PatientSim-Pro` |
| Official update repository | Configured — `gytech2026/GYTech-PatientSim-Pro`; v1.0.1 published |
| Official contact channels | Pending |
| Open-source vs source-available positioning | Open source under Apache-2.0 |
| Release version/date | Pending |
| GitHub Pages deployment | Pending |
| Final screenshot approval | Pending |
| Windows code signing | Pending — unsigned builds currently |
| macOS signing/notarisation | Pending — unsigned/unnotarised |
| Linux/macOS native build validation | Pending — not run on Windows host |
| Cross-version MSI upgrade / public upgrade test | NSIS synthetic test passed; public and MSI upgrade pending |
| Release publication | Pending |
| Legal/regulatory review | Recommended; no claim made |

---

Copyright 2026 GYTech All Right Reserved.
