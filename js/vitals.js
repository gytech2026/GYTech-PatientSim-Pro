/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Vital-sign display helpers.
 * Converts the authoritative physiology values into unit-aware, display-safe
 * values without introducing independent random measurements.
 */
import {
  formatPressure, formatTemp, pressureUnitLabel, tempUnitLabel,
} from './utilities.js';

export const getDisplayUnits = (settings) => ({
  pressure: pressureUnitLabel(settings.pressureUnit),
  temperature: tempUnitLabel(settings.tempUnit),
  pressureCode: settings.pressureUnit,
  temperatureCode: settings.tempUnit,
});

export const formatPressurePair = (sys, dia, unit = 'mmHg') => {
  if (!Number.isFinite(Number(sys))) return '--/--';
  const systolic = formatPressure(sys, unit);
  if (!Number.isFinite(Number(dia))) return `${systolic}/--`;
  return `${systolic}/${formatPressure(dia, unit)}`;
};

export const temperatureDifferenceDisplay = (vitals, unit = 'C') => {
  if (vitals.tempC === null || vitals.temp2C === null) return '--';
  const differenceC = Math.abs(vitals.tempC - vitals.temp2C);
  if (unit === 'F') return (differenceC * 9 / 5).toFixed(1);
  return differenceC.toFixed(1);
};

export const formatTemperatureDisplay = (vitals, unit = 'C') => formatTemp(vitals.tempC, unit);

export const getAvailabilityFlags = (vitals, sim) => ({
  hr: vitals.hr !== null,
  spo2: vitals.spo2 !== null,
  nibp: vitals.nibp !== null,
  rr: vitals.rr !== null,
  etco2: vitals.etco2 !== null,
  temperature: vitals.tempC !== null,
  ibp: vitals.ibp !== null,
  cvp: vitals.cvp !== null,
  pa: vitals.pa !== null,
  icp: vitals.icp !== null,
  bis: vitals.bis !== null,
  ecgSensor: Boolean(sim.sensors.ecg && !sim.ecg.leadOff),
  spo2Sensor: Boolean(sim.sensors.spo2),
  nibpCuff: Boolean(sim.sensors.nibp),
  capno: Boolean(sim.sensors.capno),
  respiratory: Boolean(sim.sensors.resp),
});

export const getDisplayModel = (vitals, settings) => {
  const units = getDisplayUnits(settings);
  return {
    units,
    hr: vitals.hr === null ? '---' : String(Math.round(vitals.hr)),
    pr: vitals.pr === null ? '--' : String(Math.round(vitals.pr)),
    spo2: vitals.spo2 === null ? '---' : String(Math.round(vitals.spo2)),
    rr: vitals.rr === null ? '--' : String(Math.round(vitals.rr)),
    etco2: vitals.etco2 === null ? '--' : String(Math.round(vitals.etco2)),
    temperature: formatTemp(vitals.tempC, units.temperatureCode),
    temperature2: formatTemp(vitals.temp2C, units.temperatureCode),
    temperatureDifference: temperatureDifferenceDisplay(vitals, units.temperatureCode),
    nibp: vitals.nibp ? formatPressurePair(vitals.nibp.sys, vitals.nibp.dia, units.pressureCode) : '---/--',
    sys: vitals.nibp ? formatPressure(vitals.nibp.sys, units.pressureCode) : '--',
    dia: vitals.nibp ? formatPressure(vitals.nibp.dia, units.pressureCode) : '--',
    map: vitals.nibp ? formatPressure(vitals.nibp.map, units.pressureCode) : '--',
    art: vitals.ibp ? formatPressurePair(vitals.ibp.sys, vitals.ibp.dia, units.pressureCode) : '--',
    cvp: vitals.cvp === null ? '--' : formatPressure(vitals.cvp, units.pressureCode),
    pa: vitals.pa ? formatPressurePair(vitals.pa.sys, vitals.pa.dia, units.pressureCode) : '--',
    icp: vitals.icp === null ? '--' : formatPressure(vitals.icp, units.pressureCode),
    bis: vitals.bis === null ? '--' : String(vitals.bis),
  };
};
