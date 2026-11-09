# Alarm Guide — GYTech PatientSim Pro

**Copyright 2026 GYTech All Right Reserved.**

> Alarm behavior is simulated for education. It is not validated as a clinical
> alarm system. See [DISCLAIMER.md](../DISCLAIMER.md).

---

## 1. Alarm priorities

| Priority | Examples | Visual behavior | Audible behavior |
|---|---|---|---|
| CRITICAL | Asystole, VF, pulseless VT, PEA/no pulse, apnea, severe desaturation, severe hypotension | Red banner, critical top status, persistent until condition clears | Critical tone pattern while unsilenced |
| WARNING | High/low HR, low SpO₂, high/low RR, abnormal EtCO₂, high/low BP, abnormal temperature | Amber banner/status | Warning tone pattern |
| TECHNICAL | ECG lead-off, SpO₂ sensor off, belt off, capno line off, NIBP cuff error, monitored IBP disconnected, low battery, communication error | Blue/technical banner/status | Technical tone pattern |

Simulated alarms are evaluated every 280 ms by `js/alarms.js`.

## 2. Limits and toggles

Alarm limits are configured in **ALARMS**:

- Heart rate
- SpO₂
- Respiratory rate
- EtCO₂
- Systolic pressure
- Diastolic pressure
- MAP
- Temperature

Each parameter has an enabled checkbox. Group toggles allow disabling critical,
parameter, or technical categories. Limit inputs are range-validated.

Alarm thresholds are teaching ranges, not universal clinical thresholds.

## 3. Acknowledge

**ACKNOWLEDGE** marks active alarms as acknowledged and stops their audible
annunciation. The visual condition remains until resolved. The active list shows
ACK status.

## 4. Silence

**SILENCE 120s** suppresses audible alarm annunciation for 120 seconds while
leaving visual alarms active. Silence does not clear or resolve the underlying
condition. When the silence period expires, remaining unacknowledged alarms may
be audible again.

## 5. Escalation

An unacknowledged warning that persists for 45 seconds is escalated to critical
and remains escalated while the condition persists. The escalation is recorded in
the event history.

## 6. Resolving alarms

An alarm clears only when its underlying condition no longer exists in the
simulation. Acknowledging or silencing an alarm does not alter the physiological
state. The banner and active list update after the next alarm evaluation.

## 7. Technical alarm behavior

- ECG lead-off is treated as a technical condition and the HR may become
  unavailable.
- SpO₂/pleth values are suppressed rather than fabricated when the sensor is
  disconnected.
- NIBP measurement failure and cuff error are reported separately from a valid
  reading.
- Monitored IBP disconnection triggers a technical condition.
- Low battery is reported; a depleted battery blocks simulated therapy.
- The simulated network error can be toggled in Diagnostics.

## 8. Audio safety

- Audio starts only after a user interaction due to browser autoplay policy.
- A single scheduler plays the highest-priority unacknowledged alarm pattern.
- The CPR metronome suppresses its click while an audible alarm is active.
- The project makes no claim of acoustic calibration or clinical alarm
  compliance.

## 9. Limitations

- No IEC 60601-1-8 or other alarm-standard certification.
- No real sensor input.
- No alarm escalation to remote staff.
- No guarantee of alarm delivery across browsers/devices.
- Thresholds and priorities are teaching models and must not be treated as
  clinical guidance.

---

Copyright 2026 GYTech All Right Reserved.
