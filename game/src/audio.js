// WebAudio sound and music: everything is synthesized — engine hum, sirens,
// gunshots, crashes, cash, and two procedural radio stations (Verde FM and
// Tide 101) with different melodic patterns. No audio files, no network.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let step = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    const station = () => RADIO[createAudio.currentStation || 0];
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const st = station();
      const note = st.pattern[step % st.pattern.length];
      step += 1;
      const freq = st.base * Math.pow(2, note / 12);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(g); g.connect(musicGain);
      osc.start(); osc.stop(ctx.currentTime + 0.26);
      if (step % 4 === 0) {
        const bass = ctx.createOscillator();
        bass.type = 'sine';
        bass.frequency.value = st.base / 2;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.6, ctx.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        bass.connect(bg); bg.connect(musicGain);
        bass.start(); bass.stop(ctx.currentTime + 0.42);
      }
    }, 240);
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || !ctx || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(master);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol) {
    if (!ensure() || !ctx || ctx.state !== 'running') return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(master);
    src.start();
  }

  return {
    start,
    setStation(i) { createAudio.currentStation = i; step = 0; },
    engine(speed, moving) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 45 + speed * 2.4;
      engineGain.gain.value = moving ? 0.05 + Math.min(0.08, speed * 0.0012) : 0.015;
    },
    gunshot(vol) { noise(0.14, 0.5 * (vol || 1)); },
    crash() { noise(0.3, 0.55); blip(70, 0.25, 'sawtooth', 0.3); },
    honk() { blip(392, 0.22, 'square', 0.16); },
    sirenBurst() { blip(720, 0.3, 'sine', 0.22); setTimeout(() => blip(540, 0.3, 'sine', 0.22), 320); },
    cash() { blip(880, 0.1, 'sine', 0.25); setTimeout(() => blip(1320, 0.16, 'sine', 0.25), 110); },
    stage() { blip(660, 0.1, 'triangle', 0.25); setTimeout(() => blip(990, 0.14, 'triangle', 0.25), 100); },
    carjack() { blip(220, 0.2, 'sawtooth', 0.2); },
    click() { blip(520, 0.06, 'square', 0.12); },
    stop() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; started = false; },
  };
}
createAudio.currentStation = 0;
