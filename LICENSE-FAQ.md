# License FAQ — GYTech PatientSim Pro

**Status: PENDING OWNER APPROVAL. This document is not legal advice.**

Copyright 2026 GYTech All Right Reserved.

This FAQ explains the difference between copyright ownership, open-source
licensing, source-available licensing, proprietary licensing, and third-party
dependency licensing. It compares candidate licenses for owner review. It does
not grant permission to use GYTech PatientSim Pro unless an approved license is
published.

---

## 1. What is the current license status?

No permanent license has been selected or approved. The repository currently
contains a clearly marked [LICENSE](LICENSE) status notice and a non-effective
draft candidate at
[`legal/LICENSE-APACHE-2.0-PROPOSED.txt`](legal/LICENSE-APACHE-2.0-PROPOSED.txt).

Until GYTech approves and publishes a license:

- The project is **not** described as OSI-approved open source.
- Source code being visible in a repository does **not** grant reuse rights.
- All rights remain reserved, except where mandatory law or a separate written
  permission applies.

The owner must make the final legal decision. Legal counsel should review the
choice before publication.

---

## 2. Copyright ownership vs. a license

**Copyright** is the legal exclusivity in original expression: source code,
documentation, artwork, and other original materials. GYTech retains copyright
ownership of its original contributions regardless of which license is later
selected.

**A license** is a grant of specific permissions under conditions. A copyright
owner can license some rights while retaining ownership. A license does not
transfer copyright unless it explicitly says it does (this project does not
propose a copyright assignment).

**Public visibility** is not a license. A public GitHub repository without a
license remains reserved by default, even though the code can be read.

---

## 3. Licensing models

| Model | What it generally means | Effect on this project if selected |
|---|---|---|
| Open-source license | Grants permissions that meet an OSI-approved definition, including free redistribution and access to source under stated conditions. | GYTech remains copyright owner; users receive the rights in the approved license. |
| Source-available license | Source is visible, but some uses are restricted or require commercial permission. It is not necessarily OSI open source. | Would need to be labeled source-available, not open source. |
| Proprietary license | Rights are controlled by contract; redistribution and modification are usually restricted. | Would require a carefully drafted commercial or evaluation agreement. |
| Public domain / CC0-style waiver | Rights are waived to the extent legally possible. | Not recommended for a project that may need attribution, patent clarity, or medical-safety notices. |

### GYTech PatientSim Pro position

- GYTech retains copyright ownership.
- Permissions expressly granted under a later approved LICENSE will be
  exceptions to rights otherwise reserved.
- Third-party components remain under their own licenses and are not claimed by
  GYTech.

---

## 4. Candidate license comparison

The table is a high-level comparison for discussion, not legal advice.

| Topic | MIT | Apache-2.0 | GPL-3.0 | AGPL-3.0 | Custom GYTech proprietary |
|---|---|---|---|---|---|
| Commercial use | Permitted | Permitted | Permitted under GPL conditions | Permitted under AGPL conditions | Defined by custom terms |
| Modification | Permitted | Permitted | Permitted; derivative distribution generally must be GPL | Permitted; network-use source obligations may apply | Usually restricted or requires permission |
| Distribution | Permitted with notice | Permitted with license/notice obligations | Permitted under copyleft terms | Permitted under strong network copyleft terms | Restricted by agreement |
| Private use | Permitted | Permitted | Permitted | Permitted | Defined by agreement |
| Patent grant | No express patent grant | **Express patent grant** | Patent provisions included | Patent provisions included | Custom; must be negotiated/drafted |
| Source disclosure | Not required | Not required for distributed binaries beyond license/notice requirements | Required for distributed modified versions | Required, including certain network-use scenarios | Defined by custom terms |
| Attribution | Copyright/license notice required | Copyright, license, NOTICE, and modification notices | Notices and corresponding source required | Notices and corresponding source required | Defined by custom terms |
| Liability/warranty | Broad disclaimer | Broad disclaimer | Broad disclaimer | Broad disclaimer | Must be drafted |
| OSI-approved | Yes | Yes | Yes | Yes | No |
| Best fit for GYTech collaboration | Simple, permissive | **Recommended candidate**, patent grant and clear contribution terms | Strong copyleft; may deter some medical-software integrators | Strong network copyleft; may deter commercial deployment | Only if a deliberate commercial/evaluation strategy exists |

### Recommendation

**Apache License 2.0 is the recommended candidate for owner review** if GYTech
wants a collaborative, permissive project with an explicit patent grant and a
clear NOTICE mechanism. It is not effective in this repository until the owner
approves it and the canonical text is published.

Reasons to consider Apache-2.0:

- Permissive use, modification, distribution, and commercial use.
- Express patent grant and patent-termination language.
- NOTICE-file attribution mechanics.
- Familiar to corporate and research collaborators.
- Compatible with many downstream uses.

Reasons to consider GPL-3.0 or AGPL-3.0 instead:

- The owner wants reciprocal source disclosure for distributed modifications
  (GPL) or for network use (AGPL).
- The owner prioritizes community code sharing over broad permissive adoption.

Reasons to consider a custom proprietary or source-available license:

- The owner wants to control commercial deployment, hosted use, or derivative
  products.
- A commercial or institutional licensing program exists.

A custom license must not be advertised as OSI-approved open source if it does
not meet the Open Source Definition.

---

## 5. What must happen before an approved license is published?

1. GYTech chooses a license model and approves the exact text.
2. Legal counsel reviews the choice, contribution terms, and any medical or
   regulatory implications.
3. The approved canonical text replaces [LICENSE](LICENSE).
4. The copyright line is inserted exactly where required:
   `Copyright 2026 GYTech All Right Reserved.`
5. `package.json`, `CITATION.cff`, README badges, NOTICE, and
   THIRD_PARTY_NOTICES are updated consistently.
6. The repository is checked for incompatible third-party assets.
7. The owner authorizes publication.

Potential legal risks — including patient-safety, regulatory, trademark, export,
and medical-device claims — are separate from the software license and require
owner review. **No license makes this software clinically valid or a medical
device.**

---

## 6. Third-party dependencies

The application uses no runtime JavaScript libraries, CSS frameworks, external
fonts, stock imagery, or bundled audio files. Tests use Electron as a
development-only tool. Electron and Chromium are not owned by GYTech and retain
their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

If a future contribution introduces a dependency or asset, the contributor must
document its source and license before merge.

---

## 7. Frequently asked questions

### Can I use this in a commercial product now?

No. No license has been approved. Obtain written permission from GYTech or wait
for an approved license.

### Can I fork it on GitHub?

Platform terms may allow a fork within the platform, but that does not grant a
license to use, modify, or distribute the content outside the platform or
beyond platform terms. The absence of an approved license is intentional and
must not be interpreted as permission.

### Does the pending status affect the medical disclaimer?

No. The medical disclaimer applies regardless of the eventual license. The
software is an educational simulation and is not a medical device.

### Does Apache-2.0 require a NOTICE file?

It requires preservation of applicable NOTICE attribution when redistributing.
This repository includes a [NOTICE](NOTICE) file. The final approved license and
NOTICE should be reviewed together.

### Is this legal advice?

No. This FAQ is an engineering and repository-management document prepared for
owner review. Consult qualified legal counsel before publishing a license.

---

Copyright 2026 GYTech All Right Reserved.
