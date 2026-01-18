let audioCtx;

function getAudioCtx() {
  audioCtx = audioCtx || new AudioContext();
  return audioCtx;
}

function playToneDoubleBeep() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const beep = (offset, freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + offset);
    gain.gain.setValueAtTime(0.12, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  };
  beep(0, 480);
  beep(0.18, 360);
}

function playToneCorrectBell() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const tones = [
    { freq: 880, dur: 0.32, gain: 0.18, offset: 0 },
    { freq: 1320, dur: 0.24, gain: 0.14, offset: 0.06 },
    { freq: 1760, dur: 0.18, gain: 0.1, offset: 0.12 }
  ];

  tones.forEach(t => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.freq, now + t.offset);
    gain.gain.setValueAtTime(t.gain, now + t.offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t.offset + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t.offset);
    osc.stop(now + t.offset + t.dur + 0.02);
  });
}

export function playWrongTone() {
  try {
    playToneDoubleBeep();
  } catch (err) {
    console.warn('Audio playback failed', err);
  }
}

export function playCorrectTone() {
  try {
    playToneCorrectBell();
  } catch (err) {
    console.warn('Audio playback failed', err);
  }
}
