/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Temperature helpers: display conversion, probe status and difference.
 * Internal simulation storage is always Celsius.
 */
import {
  convertTempFromC, convertTempToC, formatTemp, tempUnitLabel,
} from './utilities.js';

export {
  convertTempFromC, convertTempToC, formatTemp, tempUnitLabel,
};

export const getTemperatureStatus = (sim) => {
  if (!sim.sensors.temp) {
    return { available: false, label: 'PROBE OFF', tone: 'off' };
  }
  if (sim.tempC >= 39.5) return { available: true, label: 'HIGH', tone: 'critical' };
  if (sim.tempC >= 38.0) return { available: true, label: 'ELEVATED', tone: 'warn' };
  if (sim.tempC < 35.0) return { available: true, label: 'LOW', tone: 'warn' };
  return { available: true, label: 'NORMAL', tone: 'ok' };
};

export const getTemperatureDifference = (sim) => {
  if (!sim.sensors.temp || !sim.sensors.temp2) return null;
  return Math.abs(sim.tempC - sim.temp2C);
};
