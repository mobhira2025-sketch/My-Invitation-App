let audioCtx: AudioContext | null = null;

function getOrCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Call inside a user click/tap handler to unlock Web Audio playback.
 */
export function unlockAudio(): void {
  try {
    getOrCreateContext();
  } catch {
    // Ignore audio errors on restricted environments
  }
}

/**
 * Pleasant ascending celebratory chime for TRUE – NOT LYING.
 */
export function playTrueSound(enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getOrCreateContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.075 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.075 + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.36);
    });
  } catch {
    // Fail silently if audio cannot play
  }
}

/**
 * Dramatic two-beep game-show detection alarm for LIE – CAUGHT!
 */
export function playLieSound(enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getOrCreateContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const beeps = [
      { start: 0, end: 0.16, freqStart: 420, freqEnd: 310 },
      { start: 0.21, end: 0.44, freqStart: 380, freqEnd: 210 },
    ];

    beeps.forEach((beep) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(beep.freqStart, now + beep.start);
      osc.frequency.linearRampToValueAtTime(beep.freqEnd, now + beep.end);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now + beep.start);

      gain.gain.setValueAtTime(0.0001, now + beep.start);
      gain.gain.exponentialRampToValueAtTime(0.15, now + beep.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + beep.end);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + beep.start);
      osc.stop(now + beep.end + 0.02);
    });
  } catch {
    // Fail silently if audio cannot play
  }
}
