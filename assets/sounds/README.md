# Synthesized audio assets

No external audio files are required. Alarm tones, charging tones, shock
simulation cues and the CPR metronome are generated at runtime using the Web
Audio API in `js/audio.js`. This avoids bundled media dependencies and ensures
that audible annunciation starts only after a user gesture, in line with modern
browser autoplay policies.

The AED controller may also use the browser's speech synthesis API for
simulated voice prompts when available. All prompts are educational and
software-generated.
