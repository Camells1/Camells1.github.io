// Everything you hear. Recorded samples for footsteps, knocks and clanks; everything with a voice is
// made on the spot from oscillators and noise, so each howl, roar and squeak comes out a bit different.
// Sounds in the world get quieter with distance and move left and right as you turn.
import { A } from './assets.js';
import { clamp } from './util.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Sound {
  constructor(ctx) {
    this.ctx = ctx; this.ear = { x: 0, y: 0, z: 0, yaw: 0 };
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; this.master.connect(comp); comp.connect(ctx.destination);
    // one second of white noise, reused for hisses, rain, wind, thumps and roars
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.loops = {}; this.t = 0; this.beat = 0; this.bird = 3; this.cricket = 0; this.thunderT = 20;
    this._loop('wind', 'lowpass', 420, 0); this._loop('rain', 'highpass', 2600, 0); this._loop('hum', 'bandpass', 95, 0, 9);
  }
  setVolume(v) { this.master.gain.value = v; }
  listen(x, y, z, yaw) { Object.assign(this.ear, { x, y, z, yaw }); }
  _loop(name, type, freq, vol, q = 0.7) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(); this.loops[name] = { g, f };
  }
  // Where a sound at (x, z) should sit: [volume 0..1, pan -1..1]. No position = right in your head.
  _place(o) {
    if (o.x == null) return [1, 0];
    const e = this.ear, dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz, (o.y ?? e.y) - e.y), range = o.range || 45;
    if (d > range) return [0, 0];
    const k = 1 - d / range, rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    return [k * k, d < 0.5 ? 0 : clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8];
  }
  _out(o) { // gain + pan for one sound; returns the node to connect into
    const [k, pan] = this._place(o); if (k <= 0.003) return null;
    const c = this.ctx, g = c.createGain(), p = c.createStereoPanner(); g.gain.value = (o.vol ?? 1) * k; p.pan.value = pan; g.connect(p); p.connect(this.master);
    return g;
  }
  // A recorded sample. o: { vol, rate, x, y, z, range, delay }
  play(name, o = {}) {
    const buf = A.sounds[name]; if (!buf) return;
    const out = this._out(o); if (!out) return;
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = (o.rate || 1) * rnd(0.95, 1.05); s.connect(out); s.start(this.ctx.currentTime + (o.delay || 0));
  }
  // A pitched voice. f: [[time 0..1, Hz], ...]. o: { type, dur, vol, vib (Hz depth), vibRate, lp, x, z, range, delay }
  tone(f, o = {}) {
    const out = this._out(o); if (!out) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.5, osc = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f[0][1], t0); for (const [t, hz] of f) osc.frequency.linearRampToValueAtTime(hz, t0 + t * dur);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vibRate || 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    lp.type = 'lowpass'; lp.frequency.value = o.lp || 6000;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + Math.min(0.08, dur * (o.attack ?? 0.2))); g.gain.setValueAtTime(1, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(lp); lp.connect(g); g.connect(out); osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  // A burst of filtered noise. o: { type, freq, freq2 (sweeps to), q, dur, vol, am (tremolo Hz), x, z, range, delay }
  noise(o = {}) {
    const out = this._out(o); if (!out) return;
    const c = this.ctx, t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.4, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.freq || 800, t0); if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let last = g;
    if (o.am) { const l = c.createOscillator(), lg = c.createGain(), ag = c.createGain(); l.frequency.value = o.am; lg.gain.value = 0.5; ag.gain.value = 0.5; l.connect(lg); lg.connect(ag.gain); g.connect(ag); l.start(t0); l.stop(t0 + dur + 0.1); last = ag; }
    s.connect(f); f.connect(g); last.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- the zoo's voices
  voice(kind, x, y, z, big = 1) {
    const p = { x, y, z, range: 70 + big * 25 }, j = rnd(0.9, 1.12);
    if (kind === 'howl') this.tone([[0, 300 * j], [0.25, 520 * j], [0.7, 500 * j], [1, 330 * j]], { ...p, type: 'triangle', dur: 2.3, vol: 0.5, vib: 9, vibRate: 5, lp: 1800 });
    else if (kind === 'yip') for (let i = 0; i < 3; i++) this.tone([[0, 700 * j], [0.5, 1150 * j], [1, 800 * j]], { ...p, type: 'triangle', dur: 0.13, vol: 0.4, delay: i * 0.16 });
    else if (kind === 'bray') this.tone([[0, 260 * j], [0.2, 430 * j], [0.4, 280 * j], [0.6, 440 * j], [1, 240 * j]], { ...p, type: 'sawtooth', dur: 0.9, vol: 0.3, lp: 1600 });
    else if (kind === 'snort') for (let i = 0; i < 2; i++) this.noise({ ...p, type: 'bandpass', freq: 190 * j, q: 2, dur: 0.3, vol: 1.3, delay: i * 0.34 });
    else if (kind === 'bellow') { this.tone([[0, 120 * j], [0.3, 150 * j], [1, 85 * j]], { ...p, type: 'sawtooth', dur: 1.4, vol: 0.5, lp: 700, vib: 4, vibRate: 9 }); this.noise({ ...p, freq: 300, dur: 1.2, vol: 0.5 }); }
    else if (kind === 'screech') this.tone([[0, 900 * j], [0.3, 1700 * j], [0.6, 1300 * j], [1, 700 * j]], { ...p, type: 'sawtooth', dur: 0.6, vol: 0.32, vib: 120, vibRate: 28, lp: 4200 });
    else if (kind === 'horn') { this.tone([[0, 170 * j], [0.4, 185 * j], [1, 150 * j]], { ...p, type: 'sawtooth', dur: 1.8, vol: 0.4, lp: 900, attack: 0.5 }); this.tone([[0, 255 * j], [0.4, 277 * j], [1, 225 * j]], { ...p, type: 'triangle', dur: 1.8, vol: 0.35, attack: 0.5 }); }
    else if (kind === 'moan') this.tone([[0, 150 * j], [0.5, 120 * j], [1, 95 * j]], { ...p, type: 'sawtooth', dur: 2.4, vol: 0.45, lp: 520, vib: 7, vibRate: 3.5, attack: 0.4 });
    else if (kind === 'hiss') this.noise({ ...p, type: 'highpass', freq: 3800, dur: 0.8, vol: 0.6, am: 30 });
    else if (kind === 'roar') { this.noise({ ...p, range: 160, freq: 520, freq2: 160, dur: 2.6, vol: 2.4, am: 27 }); this.tone([[0, 85], [0.2, 70], [1, 42]], { ...p, range: 160, type: 'sawtooth', dur: 2.6, vol: 0.9, lp: 380, vib: 6, vibRate: 24 }); }
    else if (kind === 'snore') this.noise({ ...p, range: 22, type: 'bandpass', freq: 240, freq2: 120, q: 3, dur: 0.9, vol: 0.9, am: 22 });
  }
  squeak(x, y, z) { this.tone([[0, 520], [0.35, 1500], [0.6, 900], [1, 1300]], { x, y, z, range: 60, type: 'sawtooth', dur: 0.34, vol: 0.35, lp: 3600 }); }
  step(surface, vol = 0.3, o = {}) { this.play(`step_${surface}00${Math.floor(Math.random() * 5)}`, { vol, ...o }); }
  // The main gates: a tearing creak, then the loudest clang in the county, then it rings
  slam(x, y, z) {
    const p = { x, y, z, range: 260 };
    this.play('impactMetal_light_000', { ...p, vol: 2.2, rate: 0.45 }); this.play('impactBell_heavy_000', { ...p, vol: 1.8, rate: 0.5 }); this.play('impactWood_heavy_000', { ...p, vol: 2, rate: 0.6 }); this.play('impactPlank_medium_000', { ...p, vol: 1.6, rate: 0.5 });
    this.tone([[0, 70], [1, 28]], { ...p, dur: 1.5, vol: 1.6, attack: 0.02 }); this.noise({ ...p, freq: 900, freq2: 90, dur: 1.3, vol: 2.2 });
    this.tone([[0, 196], [1, 190]], { ...p, type: 'triangle', dur: 3.2, vol: 0.3, attack: 0.02, vib: 3, vibRate: 7 }); this.tone([[0, 293], [1, 287]], { ...p, type: 'sine', dur: 2.6, vol: 0.18, attack: 0.02 });
    this.play('latch', { ...p, vol: 1.5, rate: 0.6, delay: 0.5 }); this.play('metalClick', { ...p, vol: 1.4, rate: 0.5, delay: 0.75 });
  }
  creak(x, y, z) { this.play('creak1', { x, y, z, range: 80, vol: 1.2, rate: 0.6 }); this.play('creak2', { x, y, z, range: 80, vol: 1, rate: 0.5, delay: 0.5 }); }
  crash(x, y, z, metal) { this.play(metal ? 'impactMetal_light_001' : 'impactWood_heavy_000', { x, y, z, range: 90, vol: 1.6, rate: 0.7 }); this.play('impactPunch_heavy_000', { x, y, z, range: 90, vol: 1.2, rate: 0.7 }); this.noise({ x, y, z, range: 90, freq: 600, freq2: 100, dur: 0.5, vol: 1 }); }
  thud(x, y, z, vol = 1) { this.play('impactSoft_heavy_000', { x, y, z, range: 60, vol, rate: 0.8 }); }
  bell(x, y, z) { for (const [hz, v, d] of [[523, 0.5, 2.6], [1046, 0.25, 1.6], [1318, 0.18, 1.2], [784, 0.2, 2]]) this.tone([[0, hz], [1, hz * 0.995]], { x, y, z, range: 250, dur: d, vol: v, attack: 0.01 }); }
  dart() { this.noise({ type: 'highpass', freq: 1800, freq2: 500, dur: 0.16, vol: 0.9 }); this.tone([[0, 900], [1, 260]], { dur: 0.12, vol: 0.25, type: 'triangle' }); }
  pop(x, y, z) { this.tone([[0, 300], [1, 900]], { x, y, z, range: 50, dur: 0.12, vol: 0.4, type: 'triangle' }); this.noise({ x, y, z, range: 50, type: 'highpass', freq: 2000, dur: 0.1, vol: 0.4 }); }
  radio() { this.noise({ type: 'bandpass', freq: 2200, q: 1.5, dur: 0.14, vol: 0.35 }); this.tone([[0, 1250], [1, 1250]], { dur: 0.07, vol: 0.12, type: 'square', delay: 0.12 }); }
  ui(kind = 'click') { this.play('ui_' + kind, { vol: 0.5 }); }
  coins() { this.play(Math.random() < 0.5 ? 'coins1' : 'coins2', { vol: 0.6 }); }
  thunder() { this.noise({ freq: 1400, freq2: 60, dur: 3.4, vol: rnd(1.4, 2.4), am: 9 }); this.tone([[0, 60], [1, 30]], { dur: 2.5, vol: 0.8, attack: 0.03 }); }
  alarm(x, y, z) { for (let i = 0; i < 3; i++) this.tone([[0, 880], [0.5, 660], [1, 880]], { x, y, z, range: 200, type: 'square', dur: 0.4, vol: 0.14, delay: i * 0.45, lp: 2400 }); }
  // little tunes
  jingle(kind) {
    const N = { dawn: [[523, 0], [659, 0.14], [784, 0.28], [1046, 0.42], [1318, 0.62]], night: [[440, 0], [392, 0.3], [330, 0.6], [247, 0.95]], win: [[523, 0], [523, 0.13], [523, 0.26], [698, 0.4], [880, 0.62], [784, 0.82], [1046, 1.0]],
      sad: [[466, 0], [440, 0.45], [415, 0.9], [392, 1.35]], buy: [[784, 0], [1046, 0.09], [1568, 0.18]], task: [[660, 0], [990, 0.1]] }[kind] || [];
    for (const [hz, d] of N) kind === 'sad' ? this.tone([[0, hz], [0.7, hz], [1, hz * 0.9]], { type: 'sawtooth', dur: kind === 'sad' && d > 1.3 ? 1.4 : 0.42, vol: 0.2, lp: 900, vib: d > 1.3 ? 14 : 0, vibRate: 5, delay: d })
      : this.tone([[0, hz], [1, hz]], { type: 'triangle', dur: kind === 'night' ? 0.7 : 0.32, vol: 0.22, delay: d });
  }

  // ---------------------------------------------------------------- the background: wind, crickets, birds, rain, the generator, your heart
  // s: { dt, night (0..1), storm (0..1), power, genDist (m to the generator), fear (0..1) }
  update(s) {
    const t = this.ctx.currentTime, L = this.loops; this.t += s.dt;
    L.wind.g.gain.setTargetAtTime(0.05 + s.storm * 0.22 + Math.sin(this.t * 0.31) * 0.02, t, 0.5); L.wind.f.frequency.setTargetAtTime(380 + s.storm * 500 + Math.sin(this.t * 0.2) * 120, t, 0.5);
    L.rain.g.gain.setTargetAtTime(s.storm * 0.11, t, 0.8);
    L.hum.g.gain.setTargetAtTime(s.power ? clamp(1 - s.genDist / 26, 0, 1) * 0.5 : 0, t, 0.2);
    if ((this.cricket -= s.dt) <= 0 && s.night > 0.5 && s.storm < 0.7) { this.cricket = rnd(0.25, 0.9); const n = 2 + Math.floor(Math.random() * 3), hz = rnd(3900, 4600), pan = rnd(-0.8, 0.8); for (let i = 0; i < n; i++) this._chirp(hz, 0.035, 0.035 * s.night, pan, i * 0.07); }
    if ((this.bird -= s.dt) <= 0 && s.night < 0.3) { this.bird = rnd(1.2, 5); const hz = rnd(2200, 3600), pan = rnd(-0.9, 0.9), n = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) this._chirp(hz * rnd(0.9, 1.2), 0.09, 0.05, pan, i * 0.13, hz * rnd(1.1, 1.5)); }
    if (s.storm > 0.4 && (this.thunderT -= s.dt) <= 0) { this.thunderT = rnd(9, 26) / s.storm; this.flash = 1; this.thunder(); }
    this.flash = Math.max(0, (this.flash || 0) - s.dt * 3);
    if (s.fear > 0.05 && (this.beat -= s.dt) <= 0) { this.beat = 0.95 - s.fear * 0.5; for (const d of [0, 0.16]) this.tone([[0, 62], [1, 38]], { dur: 0.16, vol: 0.5 * s.fear, attack: 0.05, delay: d }); }
  }
  _chirp(hz, dur, vol, pan, delay, hz2) {
    const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.frequency.setValueAtTime(hz, t0); if (hz2) o.frequency.linearRampToValueAtTime(hz2, t0 + dur); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.linearRampToValueAtTime(0, t0 + dur); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
}
