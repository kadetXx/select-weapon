// synthesized HUD sounds via Web Audio -- zero asset weight, nothing to load
let ctx = null;
let noiseBuffer = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function getNoiseBuffer(audioCtx) {
  if (!noiseBuffer) {
    const length = Math.floor(audioCtx.sampleRate * 0.03);
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function tone({ freq, freqEnd, duration, type = "sine", gain = 0.12, delay = 0 }) {
  const audioCtx = getCtx();
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function click({ duration = 0.02, gain = 0.16, freq = 3000, delay = 0 }) {
  const audioCtx = getCtx();
  const start = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource();
  src.buffer = getNoiseBuffer(audioCtx);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = freq;
  const amp = audioCtx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(amp).connect(audioCtx.destination);
  src.start(start);
  src.stop(start + duration + 0.01);
}

export function playHover() {
  tone({ freq: 1100, duration: 0.045, type: "sine", gain: 0.05 });
}

// shared "confirm" sound for tabs, weapon cards, and LB/RB -- a crisp
// filtered-noise transient plus a tonal blip reads far more like a game
// menu select than a plain oscillator sweep
export function playSelect() {
  click({ duration: 0.02, gain: 0.16, freq: 3000 });
  tone({ freq: 600, freqEnd: 950, duration: 0.07, type: "square", gain: 0.1, delay: 0.008 });
}

export function playDenied() {
  tone({ freq: 180, duration: 0.1, type: "sawtooth", gain: 0.1 });
  tone({ freq: 150, duration: 0.12, type: "sawtooth", gain: 0.08, delay: 0.03 });
}
