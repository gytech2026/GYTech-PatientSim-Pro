# User Guide — GYTech PatientSim Pro

**Copyright 2026 GYTech All Right Reserved.**

> **Educational simulation only.** Not a medical device. Never use for real
> patient care. See [DISCLAIMER.md](../DISCLAIMER.md).

---

## 1. Interface overview

The workstation has five main regions:

1. **Top status bar** — patient identity, date/time, simulation state, battery,
   network, audio, and alarm status.
2. **Monitoring area** — ECG, SpO₂/pleth, capnography, respiration, arterial,
   CVP, PA, and ICP waveforms.
3. **Vital signs rail** — HR, PR, SpO₂, NIBP, SYS/DIA/MAP, RR, EtCO₂, temperature,
   invasive pressure values, BIS, and recent events.
4. **Defibrillator panel** — mode tabs, ECG display, energy/charge controls,
   AED analysis, sync, pacing, and safety checklist.
5. **Control dock** — patient, scenario, instructor, CPR, alarms, ECG, sensors,
   history, 12-lead, settings, and diagnostics.

An alarm banner appears between the top bar and workstation when an alarm is
active. A green border indicates the simulation is running; critical alarms use a
red banner.

---

## 2. First steps

1. Start the local server and open the application.
2. Click anywhere or **AUDIO** to enable browser audio.
3. Confirm a simulation patient is selected in the top bar.
4. Use **PATIENTS** to choose a sample patient or create one.
5. Use **SCENARIOS** to load a teaching state, or **INSTRUCTOR** to control
   parameters manually.
6. Open the defibrillator mode tabs to explore simulated therapy.
7. Review the safety disclaimer and stay within educational use.

---

## 3. Patient management

Select **PATIENTS**.

You can:

- Select a sample patient.
- Create a patient with name, ID, age, sex, height, weight, room, bed, status,
  admission date, history, and diagnosis.
- Edit the active patient profile.
- Duplicate a profile.
- Delete a profile after confirmation (at least one must remain).
- Reset the active patient's simulation baseline.

**Important:** switching patients resets transient patient-specific state,
including active scenarios, CPR, pacing, and defibrillator charge. This is a
safety behavior of the simulation workspace.

Patient profiles are stored in localStorage. Do not enter real patient data.

---

## 4. Monitoring and vital signs

### ECG / HR
The selected monitor lead is shown in the ECG label. The ECG rhythm field in
**ECG** changes morphology and timing. Heart rate changes the rhythm cycle.
Lead-off removes the valid trace and activates a technical alarm.

### SpO₂ / pleth
The pleth waveform reflects the simulated pulse rate and perfusion. If the SpO₂
sensor is disconnected or there is no valid pulse, the numeric reading becomes
unavailable and a technical condition is shown.

### NIBP
NIBP is intermittent. Use **SENSORS → NIBP** to:

- Select a manual-only or automatic interval.
- Trigger a measurement.
- Read the last measurement time and next countdown.

Cuff failure, no pulse, and sensor disconnection produce an unavailable state,
not a fabricated value.

### ETCO₂ / respiration
The capnogram pattern, respiratory rate, and EtCO₂ are linked in the physiology
model. Patterns available in the Instructor panel include normal,
hypoventilation, hyperventilation, apnea, rebreathing, obstruction, and
disconnected sampling line.

### Temperature
Temperature 1 and optional Temperature 2 are displayed with a difference. Units
switch in **SETTINGS**. Probe-off states show `--`.

### Invasive pressures / BIS
ART, CVP, PA, ICP, and BIS appear in the compact strip. Invasive channels must be
connected in **SENSORS** to show valid values and waveforms.

---

## 5. ECG settings

Open **ECG** to configure:

- Simulated rhythm.
- 3-lead, 5-lead, or 12-lead mode metadata.
- Monitor lead.
- Sweep speed.
- Gain.
- Grid.
- Noise, motion artifact, and baseline wander.
- Lead-off simulation.

The 12-lead view is educational and uses approximate lead morphology. It is not a
diagnostic ECG.

---

## 6. Alarms

Open **ALARMS** to:

- Adjust volume and test audio.
- Enable/disable alarm groups.
- Configure low/high limits.
- Review active alarms.
- Acknowledge active conditions.
- Silence audible annunciation for 120 seconds.

Acknowledgement and silence do **not** remove the underlying condition. Critical
visual alarms remain. Unacknowledged warning alarms escalate after 45 seconds.

Technical alarms include ECG lead-off, SpO₂ sensor-off, respiratory belt-off,
capnography line-off, NIBP cuff error, monitored IBP disconnection, low battery,
and simulated communication error.

---

## 7. Scenarios and instructor controls

### Scenarios
Open **SCENARIOS**, choose one of the 20 scenarios, and use:

- **START SCENARIO**
- **PAUSE**
- **RESUME**
- **RESET**
- **STOP**

The modal shows instructions, instructor notes, outcomes, current status, elapsed
time, and progression. Scenario transitions update related parameters together.

### Instructor
Open **INSTRUCTOR** to manually override:

- Heart rate and rhythm.
- Pulse/perfusion state.
- SpO₂, oxygenation state.
- Respiratory rate, EtCO₂, ventilation state.
- Systolic/diastolic pressure.
- Temperature.
- Capnogram and respiratory patterns.

Manually overridden values are marked. **CLEAR ALL MANUAL OVERRIDES** returns to
derived behavior. **TRIGGER CONFIGURED ROSC** is an explicit recovery action; it
is not automatic.

---

## 8. CPR

Open **CPR** to start simulated compressions, adjust rate/depth, pause/resume,
record ventilations, or add a manual compression. The application calculates a
teaching feedback score from the selected rate/depth. It does not measure real
compressions.

CPR can create partial simulated circulation during arrest, but it does not
automatically establish ROSC.

---

## 9. Defibrillator

See [DEFIBRILLATOR_GUIDE.md](DEFIBRILLATOR_GUIDE.md) for detailed workflows.

Never interpret displayed energy values or mode prompts as clinical guidance. The
module is software-only and generates no electrical output.

---

## 10. History and reports

Open **HISTORY** to filter/search simulation events. You can:

- Review timestamp, category, event type, description, parameter values, and
  patient.
- Export CSV.
- Print a simulation event report.
- Clear history after confirmation.

Open **12-LEAD** to record a PNG or print a 12-lead educational report.

All reports are marked simulation-only and are not clinical records.

---

## 11. Settings and diagnostics

**SETTINGS** controls theme, brightness, language (core navigation), simulation
speed, temperature/pressure units, alarm volume, battery simulation, grid, audio,
and reset defaults.

**DIAGNOSTICS** displays module/device status, runs a self-test, and can simulate a
network communication error.

---

## 12. Keyboard shortcuts

| Key | Action |
|---|---|
| `P` | Pause/resume simulation |
| `F` | Freeze/unfreeze displayed waveforms |
| `A` | Acknowledge alarms |
| `S` | Silence audible alarms for 120 s |
| `M` | Mute/unmute audio |
| `Esc` | Close modal/confirmation |

Shortcuts are ignored while editing form fields.

---

## 13. Data and privacy

The app stores simulation settings, patient profiles, and event history in
browser/desktop localStorage. Do not use real patient data. Clear browser site
data or use in-app controls to delete simulation data. See [PRIVACY.md](../PRIVACY.md).

---

## 14. Desktop application

In the installed desktop app, **Settings → Desktop Application** provides:

- **About** — product name, version, publisher, runtime, copyright, license
  status, data/log locations, and the medical disclaimer.
- **Notify me about stable updates** — enables or disables automatic update
  checks. Update checks are disabled when the owner has not configured an
  official repository.
- **Check Now** — checks the configured official GitHub stable-release channel.
  The live channel is not configured in this repository.
- **Export Data / Import Data** — move supported local simulation data as a JSON
  file. Import requires confirmation and replaces supported local data.

Update notifications show installed/latest versions and offer **Download
Update**, **View Release Notes**, **Remind Me Later**, and **Dismiss**. Download
opens the official GitHub Release page in your browser. The app never installs an
update silently.

Desktop data is stored under `%APPDATA%\GYTech PatientSim Pro` on Windows.
Uninstalling the application does not delete that folder. Use Export Data before
migrating. See [DESKTOP_APPLICATION.md](DESKTOP_APPLICATION.md),
[UPDATE_SYSTEM.md](UPDATE_SYSTEM.md), and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

Copyright © 2026 GYTech. All Rights Reserved.
