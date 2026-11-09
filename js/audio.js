/*
 * GYTech PatientSim Pro
 * Advanced Patient Vital Signs Monitor & Defibrillator Simulator
 *
 * Copyright 2026 GYTech All Right Reserved.
 *
 * Educational simulation software only.
 */

/**
 * Web Audio alarm and CPR annunciation.
 * Exactly one alarm scheduler exists; tones are short and never layered into an
 * uncontrolled loop. Audio starts only after explicit user interaction.
 */
import { store } from './state.js';

const PRIORITY_RANK = { critical: 3, warning: 2, technical: 1 };

export class AudioManager {
  constructor(storeRef = store) {
    this.store = storeRef;
    this.context = null;
    this.master = null;
    this.unlocked = false;
    this.alarmTimer = null;
    this.cprTimer = null;
    this.cprClickTimer = null;
    this.currentHighest = null;
    this.activeNodes = new Set();
    this.lastSequenceAt = 0;
    this.announcementEnabled = true;
    this.speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.statusListeners = new Set();
  }

  attachInteractionUnlock() {
    const unlock = (event) => {
      // The audio button manages its own first-click unlock/toggle semantics.
      if (event?.target instanceof Element && event.target.closest('#btnAudio')) return;
      this.ensureContext().catch(() => {});
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.getVolume();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      try { await this.context.resume(); } catch { return false; }
    }
    this.unlocked = this.context.state === 'running';
    this.emitStatus();
    return this.unlocked;
  }

  getVolume() {
    if (!this.store.settings.audioAlerts) return 0;
    return Math.max(0, Math.min(1, this.store.settings.alarmVolume)) * 0.36;
  }

  emitStatus() {
    const payload = {
      unlocked: this.unlocked,
      running: this.context?.state === 'running',
      muted: !this.store.settings.audioAlerts,
    };
    for (const listener of this.statusListeners) listener(payload);
  }

  subscribeStatus(listener) {
    this.statusListeners.add(listener);
    listener({
      unlocked: this.unlocked,
      running: this.context?.state === 'running',
      muted: !this.store.settings.audioAlerts,
    });
    return () => this.statusListeners.delete(listener);
  }

  tone({ frequency = 880, duration = 0.11, type = 'sine', gain = 0.22, delay = 0 }) {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const startAt = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(gain, startAt + 0.012);
    envelope.gain.setValueAtTime(gain, startAt + Math.max(0.015, duration - 0.03));
    envelope.gain.linearRampToValueAtTime(0, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
    this.activeNodes.add(oscillator);
    oscillator.addEventListener('ended', () => {
      this.activeNodes.delete(oscillator);
      try { oscillator.disconnect(); envelope.disconnect(); } catch { /* already disconnected */ }
    }, { once: true });
  }

  setAlarms(payload) {
    this.currentHighest = payload?.highest || null;
    const activeAlarms = (payload?.alarms || []).filter((alarm) => !alarm.acknowledged);
    const highest = activeAlarms.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0] || null;
    this.currentHighest = highest;
    const silenced = payload?.silenced || Date.now() < this.store.sim.alarmSilenceUntil;
    if (!highest || silenced || !this.store.settings.audioAlerts || !this.unlocked) {
      this.stopAlarmLoop();
      return;
    }
    if (this.alarmTimer) return;
    const play = () => {
      if (!this.context || this.context.state !== 'running') return;
      const stillSilenced = Date.now() < this.store.sim.alarmSilenceUntil;
      const current = this.currentHighest;
      if (!current || stillSilenced || !this.store.settings.audioAlerts) {
        this.stopAlarmLoop();
        return;
      }
      if (current.priority === 'critical') {
        this.tone({ frequency: 988, duration: 0.12, gain: 0.28, delay: 0 });
        this.tone({ frequency: 988, duration: 0.12, gain: 0.28, delay: 0.18 });
        this.tone({ frequency: 988, duration: 0.12, gain: 0.28, delay: 0.36 });
      } else if (current.priority === 'warning') {
        this.tone({ frequency: 740, duration: 0.12, type: 'triangle', gain: 0.22, delay: 0 });
        this.tone({ frequency: 740, duration: 0.12, type: 'triangle', gain: 0.22, delay: 0.19 });
      } else {
        this.tone({ frequency: 560, duration: 0.1, type: 'sine', gain: 0.14, delay: 0 });
      }
      this.emitStatus();
    };
    play();
    const interval = highest.priority === 'critical' ? 1450 : highest.priority === 'warning' ? 2600 : 4200;
    this.alarmTimer = setInterval(play, interval);
    this.emitStatus();
  }

  stopAlarmLoop() {
    if (this.alarmTimer) {
      clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
  }

  setCPRMetronome(active, rate = 110, { metronome = true } = {}) {
    if (this.cprTimer) {
      clearInterval(this.cprTimer);
      this.cprTimer = null;
    }
    if (!active || !metronome || !this.unlocked || !this.store.settings.audioAlerts) return;
    const interval = Math.max(250, (60 / Math.max(60, Math.min(180, rate))) * 1000);
    const click = () => {
      if (this.currentHighest && !this.isSilenced()) return;
      if (this.isSilenced()) return;
      this.tone({ frequency: 1080, duration: 0.035, type: 'square', gain: 0.06 });
    };
    click();
    this.cprTimer = setInterval(click, interval);
  }

  stopCPRMetronome() {
    if (this.cprTimer) {
      clearInterval(this.cprTimer);
      this.cprTimer = null;
    }
  }

  isSilenced() {
    return Date.now() < this.store.sim.alarmSilenceUntil;
  }

  announce(text, { force = false } = {}) {
    if (!this.speechAvailable || !text || (!force && !this.store.settings.audioAlerts)) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 0.92;
      utterance.volume = Math.max(0.2, this.store.settings.alarmVolume);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.warn('[GYTech PatientSim Pro] Speech synthesis unavailable.', error);
      return false;
    }
  }

  chargingTone() {
    this.tone({ frequency: 640, duration: 0.18, type: 'sawtooth', gain: 0.12 });
  }

  chargeCompleteTone() {
    this.tone({ frequency: 880, duration: 0.16, gain: 0.2 });
    this.tone({ frequency: 1180, duration: 0.2, gain: 0.2, delay: 0.18 });
  }

  shockTone() {
    this.tone({ frequency: 160, duration: 0.3, type: 'sawtooth', gain: 0.3 });
    this.tone({ frequency: 90, duration: 0.4, type: 'square', gain: 0.16, delay: 0.05 });
  }

  disarmTone() {
    this.tone({ frequency: 440, duration: 0.12, type: 'triangle', gain: 0.14 });
    this.tone({ frequency: 330, duration: 0.15, type: 'triangle', gain: 0.12, delay: 0.16 });
  }

  setMuted(muted) {
    this.store.updateSettings({
      audioAlerts: !muted,
      alarmToggles: { ...this.store.settings.alarmToggles, audio: !muted },
    });
    if (this.master) this.master.gain.value = this.getVolume();
    if (muted) {
      this.stopAlarmLoop();
      this.stopCPRMetronome();
      if (this.speechAvailable) window.speechSynthesis.cancel();
    }
    this.emitStatus();
  }

  updateVolume() {
    if (this.master) this.master.gain.value = this.getVolume();
  }
}

export const audioManager = new AudioManager(store);
