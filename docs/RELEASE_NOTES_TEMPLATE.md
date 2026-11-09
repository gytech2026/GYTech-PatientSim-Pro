# Release Notes Template

**Copyright © 2026 GYTech. All Rights Reserved.**

Use this template only for a release that was actually built, tested, and
authorized. Delete every placeholder before publishing.

```markdown
# Release Notes — GYTech PatientSim Pro vX.Y.Z

**Release date:** YYYY-MM-DD
**Channel:** stable / release candidate
**License:** Apache License 2.0 (`Apache-2.0`)
**Medical status:** educational simulation only; not a medical device

## Summary
Short description of the release and its intended audience.

## Added
- ...

## Changed
- ...

## Fixed
- ...

## Desktop packages actually built and tested
| Platform | Artefact | Validation |
|---|---|---|
| Windows x64 | Setup EXE / MSI / Portable ZIP | clean install, launch, uninstall |
| Linux x64 | AppImage / DEB / RPM | state actual result |
| macOS x64/arm64 | DMG | state actual result |

## Update channel
State whether the official update repository is configured. Do not claim a live
update channel until a real stable release has been checked successfully.

## Installation
Link to the actual release assets. Do not invent URLs.

## Checksums
Attach the generated `SHA256SUMS.txt` and verify at least one checksum.

## Known limitations
- Platform and signing limitations.
- Simulation limitations.
- Anything not tested.

## Medical disclaimer
This application is an educational simulation only. It is not a medical device
and must not be used for real patient monitoring, diagnosis, treatment, emergency
response, or clinical decision-making. It delivers no electrical output and must
not connect to or control real medical equipment.

## License and copyright
GYTech PatientSim Pro is licensed under the Apache License, Version 2.0
(SPDX: `Apache-2.0`). Include:
Copyright © 2026 GYTech. All Rights Reserved.
```
