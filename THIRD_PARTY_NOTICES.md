# Third-Party Notices and Asset Audit

**Audit status:** reviewed for the 1.0.0 repository preparation.  
**Project:** GYTech PatientSim Pro  
**Copyright of original project materials:** Copyright © 2026 GYTech. All Rights Reserved.

> GYTech does not claim ownership of any third-party software, standards,
> trademarks, fonts, or other externally licensed materials. This file records
> verified or likely third-party components and is not a replacement for the
> complete license files supplied by those projects.

---

## 1. Runtime dependencies

### Browser edition

**None.** The browser application in `index.html`, `css/`, and `js/` uses standards
implemented by the browser: HTML5, CSS3, JavaScript modules, Canvas 2D, SVG,
Web Audio API, Web Speech API, localStorage, `requestAnimationFrame`, and
`setInterval`. Browser APIs are not bundled third-party libraries.

No runtime npm packages, CSS frameworks, icon libraries, analytics, tracking
scripts, CDNs, external web fonts, stock images, or bundled audio files are used
by the browser edition.

### Desktop edition

The Electron desktop package **distributes Electron 34.1.1 and its Chromium
runtime**. Their MIT, BSD-style, and bundled-component licence notices are
included by electron-builder in the generated application output
(`LICENSE.electron.txt` and `LICENSES.chromium.html`). The Electron MIT text is
also preserved in [legal/electron-LICENSE.txt](legal/electron-LICENSE.txt).

No other runtime npm packages are bundled. `electron-builder`, Node.js, npm, WiX,
and NSIS are development/build tools; they are not application runtime
dependencies except for platform installer tooling used during the build.

---

## 2. Development and test tooling

These tools are used to develop, capture screenshots, build the desktop packages,
or run tests. Electron/Chromium are runtime components of the desktop packages;
the build tools themselves are not application code.

| Component | Version | Copyright / maintainer | License | Source | Usage |
|---|---|---|---|---|---|
| Electron | 34.1.1 | Electron contributors / OpenJS Foundation | MIT | <https://github.com/electron/electron> / [license copy](legal/electron-LICENSE.txt) | Desktop runtime and automated tests |
| Chromium components embedded in Electron | As distributed with Electron 34.1.1 | Chromium project and its contributors | BSD-style and multiple third-party licenses | <https://www.chromium.org/Home/> / `LICENSES.chromium.html` generated in the package | Desktop renderer runtime |
| electron-builder | 26.18.1 | electron-builder contributors | MIT | <https://www.electron.build/> | Development-only packaging/build tool |
| NSIS / WiX tooling | Downloaded by electron-builder | NSIS and WiX contributors | See the licences distributed with those build tools | Tool distributions used only to build installers | Installer generation only |
| Node.js | User-installed, >=18 for development tooling | OpenJS Foundation and Node.js contributors | MIT and component licenses | <https://nodejs.org/> | Development static server, validation, tests, and build |
| npm | User-installed | npm, Inc. / contributors | Artistic License 2.0 | <https://docs.npmjs.com/> | Development package management |

The Electron MIT license text is reproduced unmodified in
[`legal/electron-LICENSE.txt`](legal/electron-LICENSE.txt). The complete Chromium
and bundled-component licence texts are included in the packaged application
output as `LICENSES.chromium.html`; the distributor must preserve them.

Before publishing a packaged desktop build that embeds Electron, the distributor
must include the complete Electron and Chromium licence notices and comply with
their distribution obligations.

---

## 3. Fonts

The interface uses system font stacks such as Segoe UI, Cascadia Mono, and
Consolas. No font files are bundled or redistributed by GYTech. Rendering
depends on the fonts installed on the user's device.

---

## 4. Icons, imagery, audio, and screenshots

| Asset group | Origin | Ownership / licence status | Usage |
|---|---|---|---|
| `assets/icons/gytech-patientsim-mark.svg` | Original GYTech artwork created for this project | Original project material; licensing pending owner approval | Favicon and application mark |
| `build/icon.ico`, `build/icon.icns`, `build/icon.png`, `build/icons/*.png` | Rendered from the original GYTech application mark | Original project material; licensing pending owner approval | Windows, macOS, and Linux desktop icons |
| `assets/branding/gytech-logo.svg` | Original GYTech artwork created for this project | Original project material; licensing pending owner approval | Branding |
| `assets/branding/gytech-banner.svg` | Original GYTech artwork created for this project | Original project material; licensing pending owner approval | README banner |
| `assets/branding/gytech-banner.png` | Rendered from the original GYTech banner | Original project material; licensing pending owner approval | README banner |
| `assets/branding/social-preview.png` | Rendered from original GYTech branding | Original project material; licensing pending owner approval | GitHub social preview |
| `assets/screenshots/*.png` | Captured from the running GYTech PatientSim Pro application | Original GYTech screenshots; licensing pending owner approval | Documentation |
| Waveforms and chart graphics | Generated live at runtime by project code | Original project code; licensing pending owner approval | Application UI |
| Alarm tones, metronome, and charge tones | Synthesized at runtime by project code | Original project code; licensing pending owner approval | Application audio |
| Stock photography | None used | Not applicable | Not applicable |

No icons, logos, screenshots, or branding from Philips, GE Healthcare, Mindray,
ZOLL, or any other medical equipment manufacturer are included. No endorsement,
partnership, or affiliation with such manufacturers is claimed.

---

## 5. Standards and vocabulary

The application uses general educational concepts and terminology related to
patient monitoring, electrocardiography, defibrillation, CPR, and clinical
simulation. References to such concepts do not reproduce proprietary clinical
guidelines and do not imply endorsement by any professional society,
regulator, hospital, or manufacturer.

---

## 6. Documentation references

Documentation may link to external resources such as Apache, Open Source
Initiative, Creative Commons, Contributor Covenant, Keep a Changelog, Semantic
Versioning, Electron, or GitHub. Those external materials remain under their own
terms. GYTech does not claim ownership of them.

---

## 7. Change control

Any new dependency, font, icon, image, audio recording, dataset, or copied
documentation must be added to this file with:

- Name and version where applicable.
- Copyright holder or maintainer.
- License.
- Source URL.
- Usage location.

A contribution containing unattributed third-party material must not be merged.

---

Copyright 2026 GYTech All Right Reserved.
