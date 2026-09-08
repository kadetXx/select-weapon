// synthesized HUD sounds via Web Audio -- zero asset weight, nothing to load
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip({ freq, freqEnd, duration, type = "sine", gain = 0.12, delay = 0 }) {
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

export function playHover() {
  blip({ freq: 1100, duration: 0.045, type: "sine", gain: 0.05 });
}

export function playSelect() {
  blip({ freq: 520, freqEnd: 780, duration: 0.07, type: "triangle", gain: 0.11 });
}

export function playSwitchLR() {
  blip({ freq: 340, freqEnd: 230, duration: 0.09, type: "square", gain: 0.13 });
}

export function playDenied() {
  blip({ freq: 180, duration: 0.1, type: "sawtooth", gain: 0.1 });
  blip({ freq: 150, duration: 0.12, type: "sawtooth", gain: 0.08, delay: 0.03 });
}
