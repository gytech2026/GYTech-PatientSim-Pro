GYTech PatientSim Pro — Portable Edition
Version 1.0.0
Copyright © 2026 GYTech. All Rights Reserved.

HOW TO RUN
1. Extract the complete ZIP to a folder. Do not run the executable from inside
   the ZIP archive.
2. Open the extracted folder and run:
   GYTech PatientSim Pro.exe
3. No installer or administrator permission is required.

REQUIREMENTS
- Windows 10 or Windows 11, 64-bit.
- This portable package includes the Electron runtime. It does not require
  Node.js or a separate WebView runtime.
- Microsoft Edge WebView2 is not used by this Electron build.

LOCAL DATA
- Application settings and simulation data are stored under your Windows user
  profile, not in this extracted folder:
  %APPDATA%\GYTech PatientSim Pro
- Portable mode does not make the data profile portable. Use the application's
  Settings > Desktop Application > Export Data / Import Data controls to move
  supported local data between computers.
- Removing this extracted folder does not remove the local application data.
  Delete the %APPDATA%\GYTech PatientSim Pro folder manually only when you
  intentionally want to remove local settings, patients, and event history.

UPDATES
- This build checks for stable releases from the official GitHub repository
  (gytech2026/GYTech-PatientSim-Pro). Update checks notify you; they never
  download or install silently.
- No automatic installation is available for the portable edition. Download any
  update manually from https://github.com/gytech2026/GYTech-PatientSim-Pro/releases.

SECURITY
- The executable is not digitally signed unless the publisher signs a later
  release. Windows SmartScreen may warn about an unsigned application.
- This is an educational simulator, not a medical device. It has no physical
  electrical output and must not be connected to real medical equipment.

UNINSTALLING THE PORTABLE EDITION
- Close the application and delete the extracted folder.
- Optionally delete %APPDATA%\GYTech PatientSim Pro to remove local data.

Support and documentation: see the repository INSTALLATION.md and docs/ folder.
