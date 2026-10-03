// Night Shift Zoo. Two to four keepers walk in through the main gate, it slams shut behind them, and it
// does not open again for five days and five nights. Feed the animals, fix what they break, keep the
// lights on, bring your friends back when they get eaten, and decide what happens to the zoo at the end.
// The host runs the clock, the fences and the animals; everybody runs their own keeper.
import * as THREE from 'three';
import { VERSION, WORLD, ZONES, PLACES, SPECIES, UPGRADES, NIGHTS, RADIO, ENDINGS, SHIFT } from './config.js';
import { loadAll, A } from './assets.js';
import { World, lightUniforms } from './world.js';
import { Animals, RADIUS } from './animals.js';
import { Sky } from './sky.js';
import { Fx } from './fx.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { Voice } from './voice.js';
import { Sound } from './audio.js';
import { Bean } from './beans.js';
import { ITEMS, makeItem } from './items.js';
import { toonUniforms, setEyeGlow } from './toon.js';
import { clean, ok } from './filter.js';
import { clamp, lerp, smooth, angDiff } from './util.js';
import { $, show, COLORS, HATS, toast, banner, radio, setTasks, setTeam, setBar, setHotbar, chatLine, drawMap } from './hud.js';

const SET = Object.assign({ name: '', hat: 0, vol: 70, sens: 100, quality: 'medium', voice: 'ptt', vox: 60, pttKey: 'KeyV', radioKey: 'KeyB', help: true }, JSON.parse(localStorage.getItem('nsz') || '{}'));
const save = () => localStorage.setItem('nsz', JSON.stringify(SET));
const keyName = code => code.replace(/^Key|^Digit/, '').replace(/^Arrow/, '').replace('Left', ' L').replace('Right', ' R').replace(/^Numpad/, 'Num ').trim();
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- renderer, scene, lights
const canvas = $('c'), renderer = new THREE.WebGLRenderer({ canvas, antialias: SET.quality !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, SET.quality === 'high' ? 2 : SET.quality === 'low' ? 0.85 : 1.25));
renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = SET.quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(74, 1, 0.08, 1500); camera.rotation.order = 'YXZ';
scene.fog = new THREE.Fog(0x9fd0ff, 30, 500);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a9a6a, 1), sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(SET.quality === 'high' ? 4096 : 2048, SET.quality === 'high' ? 4096 : 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 420 }); sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.16;
const torch = new THREE.SpotLight(0xfff0d0, 0, 60, 0.52, 0.5, 1.4); camera.add(torch, torch.target); torch.target.position.set(0, 0, -1);
const disco = new THREE.PointLight(0xff40ff, 0, 60, 1.2);
scene.add(hemi, sun, sun.target, camera, disco);
const sky = new Sky(); scene.add(sky.mesh);
// what you hold is drawn on top of the world so it can never poke through a wall
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.02, 10), vm = new THREE.Group(), vmHemi = new THREE.HemisphereLight(0xffffff, 0x8a8aa0, 1.3), vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
vmCam.position.set(0, 500, 0); vm.position.copy(vmCam.position); vmSun.position.set(0.4, 501, 0.6); vmSun.target = vm; vmScene.add(vm, vmHemi, vmSun);

const actx = new (window.AudioContext || window.webkitAudioContext)();
let world, animals, fx, player, sound, input, net = null, voice = null, myId = 'h', isHost = true, started = false;
const players = new Map();          // id -> { id, name, hat, x, y, z, yaw, pitch, hp, down, item, carry, light, crouch, dance, radio, speed, tl }
const G = { phase: 'menu' };
const fresh = () => Object.assign(G, { phase: 'lobby', day: 1, t: 0, dur: 1, zones: Object.fromEntries(ZONES.map(z => [z.id, { hunger: 0.5, agit: 0, fed: 0, breach: null, hit: false }])), power: true, money: 0, up: G.up ? Object.assign(G.up, Object.fromEntries(UPGRADES.map(u => [u.id, 0]))) : Object.fromEntries(UPGRADES.map(u => [u.id, 0])),
  tower: null, storm: 0, chicken: null, disco: 0, notes: [], gnomes: [], camel: 0, fired: 0, shut: false, shutT: 0, said: false, wipeT: 0, ending: null, stats: { deaths: 0, fed: 0, fixed: 0, darts: 0, tagged: 0, wipes: 0 } });
// my own keeper
const me = { item: 0, carry: null, light: false, batt: 100, darts: 4, chickenCd: 0, hasChicken: false, medUsed: false, dance: false, radio: false, deadBy: '', deadShown: false, vendCd: 0 };
let shake = 0, hurtFlash = 0, time = 0, holdT = 0, holdKey = '', holdDone = false, repT = 0, vmKick = 0, vmSwap = 0, sendT = 0, stateT = 0, animT = 0, slowT = 0, orbit = 0, lookYaw = Math.PI, lookPitch = 0, meBean = null, vmItem = null, vmKey = '', chickenObj = null, overlay = null;

// ---------------------------------------------------------------- small helpers
const isIn = () => ['intro', 'day', 'night', 'end'].includes(G.phase);
const openZones = () => ZONES.filter(z => z.night <= G.day);
const maxDarts = () => 4 + 2 * (G.up.darts || 0);
const nameOf = id => players.get(id)?.name || 'Someone';
function nightK() {
  const d = SHIFT.dusk;
  if (G.phase === 'day') return smooth(G.dur - d, G.dur, G.t) * 0.8;
  if (G.phase === 'night') return Math.min(0.8 + 0.2 * smooth(0, 8, G.t), 1 - smooth(G.dur - d, G.dur, G.t) * 0.92);
  return 0;
}
function clockText() {
  const hour = G.phase === 'night' ? 20 + 10 * G.t / G.dur : G.phase === 'day' ? 8 + 12 * G.t / G.dur : G.phase === 'end' ? 6 : 8;
  const h24 = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 6) * 10;
  return `${h24 % 12 || 12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
// Tell everyone something happened (the host decides; guests just hear about it). to: only this player.
function ev(d, to) {
  if (to) { if (to === myId) handleEv(d); else net?.sendTo(to, { type: 'ev', ...d }); return; }
  handleEv(d); net?.send({ type: 'ev', ...d });
}
// Ask the host to do something
function act(k, d = {}) { if (isHost) doAct(myId, k, d); else net.sendTo('h', { type: 'act', k, ...d }); }

// ---------------------------------------------------------------- the host: clock, zones, events
function startGame() {
  fresh(); resetWorld(); G.phase = 'intro'; animals.spawn(1);
  [...players.keys()].forEach((id, i) => ev({ k: 'start', i }, id));
  ev({ k: 'radio', key: 'intro' });
}
function startDay(day) {
  const first = G.phase === 'intro';
  if (!first) { // pay for the night just survived
    const clean = openZones().filter(z => !G.zones[z.id].hit).length, pay = 30 + 20 * G.day + 12 * clean;
    G.money += pay; ev({ k: 'toast', text: `Pay day! $${pay} (${clean} enclosure${clean === 1 ? '' : 's'} never breached)`, kind: 'good', snd: 'coins' });
  }
  G.day = day; G.phase = 'day'; G.t = 0; G.dur = SHIFT.day[day - 1]; G.fired = 0; G.storm = 0;
  if (!G.power) ev({ k: 'power', on: true });
  if (!first) animals.spawn(day, false);
  for (const z of ZONES) { const zs = G.zones[z.id]; zs.agit = Math.min(zs.agit, 0.2); }
  ev({ k: 'phase', phase: 'day', day, dur: G.dur });
  reviveAll(world.lodge[0], world.lodge[1]);
  ev({ k: 'radio', key: first ? 'd1' : 'dawn' }); if (!first) ev({ k: 'radio', key: 'd' + day });
}
function startNight() {
  G.phase = 'night'; G.t = 0; G.dur = SHIFT.night[G.day - 1]; G.fired = 0; G.storm = NIGHTS[G.day - 1].storm || 0;
  for (const z of ZONES) G.zones[z.id].hit = false;
  ev({ k: 'phase', phase: 'night', day: G.day, dur: G.dur }); ev({ k: 'radio', key: NIGHTS[G.day - 1].radio });
}
function endGame() {
  G.phase = 'end'; G.ending = G.tower || 'out'; G.storm = 0;
  if (!G.power) ev({ k: 'power', on: true });
  if (G.ending === 'free' || G.ending === 'truth') animals.clear(); else for (const a of animals.list.values()) if (a.out) { animals.tag(a.id) || sendHome(a); a.state = 'calm'; a.sleep = 0; }
  reviveAll(PLACES.plaza.x, PLACES.plaza.z + 12);
  ev({ k: 'gate0', open: true }); ev({ k: 'phase', phase: 'end', day: G.day, dur: 1, ending: G.ending, stats: G.stats });
}
function sendHome(a) { const zn = ZONES.find(z => z.id === a.zone); a.x = zn.x + rnd(-6, 6); a.z = zn.z + rnd(-6, 6); a.out = false; a.lured = false; a.charge = 0; a.windup = 0; }
function reviveAll(x, z) { const ids = [...players.values()].filter(p => p.down).map(p => p.id); if (ids.length) ev({ k: 'revive', ids, x, z }); }
// Everyone got eaten: the night starts again
function wipe() {
  G.stats.wipes++; G.wipeT = 0;
  for (const a of animals.list.values()) { if (a.out) sendHome(a); a.state = 'calm'; a.sleep = 0; }
  for (const s of world.segments) { if (s.gate) { if (s.open) ev({ k: 'gate', id: s.id, open: false, locked: true }); } else if (s.hp < s.max * 0.5) ev({ k: 'seg', id: s.id, hp: s.max * 0.5 }); }
  for (const z of ZONES) Object.assign(G.zones[z.id], { agit: 0.1, breach: null });
  if (!G.power) ev({ k: 'power', on: true });
  if (G.phase === 'night') { G.t = 0; G.fired = 0; }
  ev({ k: 'wipe' }); reviveAll(world.lodge[0], world.lodge[1]); ev({ k: 'radio', key: 'wipe' });
}
function fire([, kind, key]) {
  const open = openZones();
  if (kind === 'radio') ev({ k: 'radio', key });
  else if (kind === 'power') { if (G.power) { ev({ k: 'power', on: false }); ev({ k: 'radio', key: 'power' }); } }
  else if (kind === 'gates') { const pick = open.filter(z => z.fence !== 'wood').concat(open).slice(0, 2); for (const z of pick) ev({ k: 'gate', id: z.gate, open: true, locked: false }); ev({ k: 'radio', key: 'gates' }); }
  else if (kind === 'yeti') { const z = ZONES.find(q => q.id === 'nighthouse'); ev({ k: 'gate', id: z.gate, open: true, locked: false }); ev({ k: 'radio', key: 'yeti' }); }
  else if (kind === 'stampede') { G.zones.valley.agit = 1; ev({ k: 'radio', key: 'stampede' }); }
  else if (kind === 'rex') { const z = ZONES.find(q => q.id === 'rex'), id = z.segs.find(i => !world.segments[i].gate && Math.abs(world.segments[i].x - z.x) < 20); G.zones.rex.agit = 1; ev({ k: 'seg', id, hp: 0, dir: 1, snd: 2 }); ev({ k: 'radio', key: 'rex' }); }
}
function hostTick(dt) {
  const list = [...players.values()];
  if (G.phase === 'intro') {
    G.t += dt;
    if (!G.shut) { const inside = list.every(p => p.z < 196); if (inside || G.t > 70) { if (!inside) ev({ k: 'yoink' }); G.shut = true; ev({ k: 'gate0', open: false }); } }
    else { G.shutT += dt; if (G.shutT > 2.6 && !G.said) { G.said = true; ev({ k: 'radio', key: 'slam' }); } if (G.shutT > 12) startDay(1); }
  } else if (G.phase === 'day') { G.t += dt; if (G.t >= G.dur) startNight(); }
  else if (G.phase === 'night') {
    G.t += dt; const N = NIGHTS[G.day - 1], hour = 20 + 10 * G.t / G.dur;
    while (G.fired < N.events.length && hour >= N.events[G.fired][0]) fire(N.events[G.fired++]);
    if (G.t >= G.dur) { if (G.day >= SHIFT.days) endGame(); else startDay(G.day + 1); }
  }
  if (!isIn()) return;
  // how hungry and how worked up each enclosure is
  const night = G.phase === 'night', level = night ? NIGHTS[G.day - 1].agitation : 0.4;
  for (const zn of openZones()) {
    const zs = G.zones[zn.id];
    zs.hunger = Math.min(1, zs.hunger + dt / 400); zs.fed = Math.max(0, zs.fed - dt); zs.lit = G.power && !zn.dark;
    if (night && G.t > 15) zs.agit += dt * 0.0046 * level * (1 + zs.hunger * 1.6) * (G.power ? 1 : 1.9) - (zs.fed > 0 ? dt * 0.012 : 0);
    else zs.agit -= dt * 0.03;
    zs.agit = clamp(zs.agit, 0, 1);
    const br = zn.segs.find(i => { const s = world.segments[i]; return s.gate ? s.open : s.broken; });
    if (br != null && zs.breach == null) { zs.hit = true; ev({ k: 'toast', text: `🚨 ${zn.name}: ${world.segments[br].gate ? 'the gate is open' : 'the fence is down'}!`, kind: 'bad', snd: 'alarm' }); }
    zs.breach = br ?? null;
  }
  if (G.chicken && (G.chicken.t -= dt) <= 0) G.chicken = null;
  G.disco = Math.max(0, G.disco - dt);
  animals.simulate({ dt, time, day: !night, level, zones: G.zones, chicken: G.chicken,
    players: list.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, speed: p.speed || 0, crouch: p.crouch, light: p.light, lyaw: p.yaw, carry: p.carry, dance: p.dance, down: p.down || G.phase === 'end' })),
    hurt: (id, dmg, a, kx, kz) => ev({ k: 'hurt', dmg, kx, kz, sp: a.sp }, id),
    ram: (id, dmg, dir) => { const s = world.segments[id]; if (!s || s.gate || s.broken) return; const hp = s.hp - dmg; ev({ k: 'seg', id, hp, dir, snd: hp <= 0 ? 2 : 1 }); },
    take: (id, a) => { if (G.up.yoke) return; ev({ k: 'take' }, id); ev({ k: 'toast', text: `🦊 A fox stole ${nameOf(id)}'s bucket!`, kind: 'bad' }); },
    back: a => ev({ k: 'toast', text: `${SPECIES[a.sp].name} is back home. Shut the gate!`, kind: 'good' }),
    openGate: id => { ev({ k: 'gate', id, open: true, locked: false }); ev({ k: 'toast', text: '🦖 Something just opened a gate by itself.', kind: 'bad' }); } });
  if (G.disco > 0) for (const a of animals.list.values()) if (a.state !== 'sleep' && Math.hypot(a.x - world.discoAt.x, a.z - world.discoAt.z) < 90) { a.act = 'dance'; a.actT = 0.3; }
  // everybody down: after a moment the night starts over
  if (list.length && list.every(p => p.down) && G.phase !== 'end') { G.wipeT += dt; if (G.wipeT > 5) wipe(); } else G.wipeT = 0;
  // tell the guests
  if (net) {
    if ((stateT -= dt) <= 0) { stateT = 0.25; net.send({ type: 'state', s: packState() }); }
    if ((animT -= dt) <= 0) { animT = 0.11; net.send({ type: 'animals', list: animals.snapshot() }); }
  }
}
const packState = () => ({ phase: G.phase, day: G.day, t: +G.t.toFixed(2), dur: G.dur, z: Object.fromEntries(ZONES.map(z => { const s = G.zones[z.id]; return [z.id, [+s.hunger.toFixed(2), +s.agit.toFixed(2), s.breach]]; })), power: G.power, money: G.money, up: G.up, tower: G.tower, storm: G.storm, disco: G.disco > 0 ? 1 : 0 });
function applyState(s) {
  if (s.phase !== G.phase || s.day !== G.day) { G.phase = s.phase; G.day = s.day; }
  G.dur = s.dur; if (Math.abs(G.t - s.t) > 0.6) G.t = s.t;
  for (const id in s.z) { const [hunger, agit, breach] = s.z[id]; Object.assign(G.zones[id], { hunger, agit, breach }); }
  G.money = s.money; Object.assign(G.up, s.up); G.tower = s.tower; G.storm = s.storm; G.disco = s.disco ? 1 : 0;
  if (s.power !== G.power) { G.power = s.power; world.drawLights(G.power); }
}
// What a keeper asked for
function doAct(pid, k, d) {
  const who = nameOf(pid);
  if (k === 'feed') { const zs = G.zones[d.zone]; if (!zs) return; zs.hunger = 0; zs.fed = 75; zs.agit = Math.max(0, zs.agit - 0.35); G.stats.fed++; G.money += 4; const zn = ZONES.find(z => z.id === d.zone); ev({ k: 'fed', zone: d.zone, text: `${who} fed ${zn.name}. +$4` }); }
  else if (k === 'repair') { const s = world.segments[d.id]; if (!s || s.gate || s.hp >= s.max) return; const hp = Math.min(s.max, s.hp + Math.min(d.amt, s.max * 0.3)); ev({ k: 'seg', id: d.id, hp, snd: 3 }); if (hp >= s.max) { G.stats.fixed++; G.money += 3; ev({ k: 'toast', text: `${who} fixed a fence. +$3`, kind: 'good' }); } }
  else if (k === 'dart') { G.stats.darts++; const a = animals.dart(d.id); if (a && a.state !== 'sleep') net?.send({ type: 'ev', k: 'afx', fx: 'hit', id: a.id }); }
  else if (k === 'tag') { const a = animals.list.get(d.id); if (!a || a.state !== 'sleep' || !a.out) return; const from = [a.x, a.y, a.z]; animals.tag(d.id); G.stats.tagged++; G.money += 6; ev({ k: 'poof', x: from[0], y: from[1] + 1, z: from[2] }); ev({ k: 'toast', text: `${who} sent the ${SPECIES[a.sp].name} home. +$6`, kind: 'good' }); }
  else if (k === 'gen') { if (!G.power) { ev({ k: 'power', on: true }); ev({ k: 'toast', text: `${who} got the lights back on!`, kind: 'good' }); } }
  else if (k === 'gate') { const s = world.segments[d.id]; if (s?.gate) ev({ k: 'gate', id: d.id, open: !!d.open, locked: !d.open }); }
  else if (k === 'buy') { const u = UPGRADES.find(q => q.id === d.id), lvl = G.up[d.id] || 0; if (!u || lvl >= u.max || G.money < u.cost * (lvl + 1)) return; G.money -= u.cost * (lvl + 1); G.up[d.id] = lvl + 1; ev({ k: 'toast', text: `${who} bought ${u.name}${u.max > 1 ? ' ' + (lvl + 1) : ''} for the crew`, kind: 'good', snd: 'buy' }); if (net) net.send({ type: 'state', s: packState() }); }
  else if (k === 'revive') { const st = world.stations[d.id]; if (!st || st.cd > 0) return; const ids = [...players.values()].filter(p => p.down).map(p => p.id); if (!ids.length) return; ev({ k: 'station', id: d.id }); ev({ k: 'revive', ids, x: st.x, z: st.z }); ev({ k: 'toast', text: `💚 ${who} re-bean-imated ${ids.map(nameOf).join(' and ')}!`, kind: 'good' }); }
  else if (k === 'bell') { if (G.phase === 'day' && G.t < G.dur - SHIFT.dusk) { G.t = G.dur - SHIFT.dusk; ev({ k: 'bell' }); ev({ k: 'toast', text: `🔔 ${who} rang the bell. Night is coming.` }); if (net) net.send({ type: 'state', s: packState() }); } }
  else if (k === 'chicken') { G.chicken = { x: d.x, z: d.z, t: 14 }; ev({ k: 'squeak', x: d.x, z: d.z }); }
  else if (k === 'tower') { if (G.tower || G.day < SHIFT.days || G.phase !== 'night' || !ENDINGS[d.c]) return; G.tower = d.c; ev({ k: 'toast', text: `🗼 ${who} threw the switch. Now survive until dawn.`, kind: 'egg', snd: 'alarm' }); }
  else if (k === 'note') { if (!G.notes.includes(d.id)) { G.notes.push(d.id); ev({ k: 'note', id: d.id, n: G.notes.length, who }); } }
  else if (k === 'gnome') { if (!G.gnomes.includes(d.id)) { G.gnomes.push(d.id); const all = G.gnomes.length === world.gnomes.length; if (all) G.money += 70; ev({ k: 'gnome', id: d.id, n: G.gnomes.length, who, all }); } }
  else if (k === 'camel') { G.camel++; if (G.camel === 3) G.money += 25; ev({ k: 'camel', n: G.camel }); }
  else if (k === 'vend') { const r = Math.random(), res = r < 0.55 ? 0 : r < 0.9 ? 1 : 2; if (res === 2) G.money += 15; ev({ k: 'vend', res, who }, pid); if (res === 2) ev({ k: 'toast', text: `🥤 ${who} kicked $15 out of a vending machine`, kind: 'egg' }); }
  else if (k === 'disco') { G.disco = 14; ev({ k: 'disco' }); }
  else if (k === 'died') { G.stats.deaths++; ev({ k: 'toast', text: `💀 ${who} got eaten by ${d.by ? 'a ' + d.by : 'the zoo'}`, kind: 'bad' }); }
}

// ---------------------------------------------------------------- things everyone sees and hears
function handleEv(d) {
  const k = d.k;
  if (k === 'start') beginShift(d.i);
  else if (k === 'phase') {
    G.phase = d.phase; G.day = d.day; G.t = 0; G.dur = d.dur; me.medUsed = false;
    if (d.phase === 'day') { me.darts = maxDarts(); banner('DAY ' + d.day, d.day === 1 ? 'Feed them. Fix things. Get ready.' : 'You lived! Get ready for tonight.', '#ffc93c'); sound.jingle('dawn'); }
    else if (d.phase === 'night') { const N = NIGHTS[d.day - 1]; banner('NIGHT ' + d.day, N.title + ': ' + N.sub, '#b8a6ff'); sound.jingle('night'); }
    else if (d.phase === 'end') { G.ending = d.ending; G.stats = d.stats; banner('6:00 AM', 'The gates are opening...', '#8fe0a0'); sound.jingle('win'); fx.confetti(player.pos.x, player.pos.y + 3, player.pos.z, 160); setTimeout(showEnding, 6000); }
  }
  else if (k === 'gate0') { world.setMainGate(d.open); if (d.open) sound.creak(0, world.mainGate.y + 3, WORLD.half); }
  else if (k === 'seg') {
    const s = world.segments[d.id]; if (!s) return; world.setSegment(d.id, d.hp, d.dir);
    if (d.snd === 1) { sound.thud(s.x, s.y + 1, s.z, 1.1); fx.chips(s.x, s.y + 1.2, s.z, 8, s.kind !== 'wood'); }
    else if (d.snd === 2) { sound.crash(s.x, s.y + 1, s.z, s.kind !== 'wood'); fx.chips(s.x, s.y + 1.2, s.z, 30, s.kind !== 'wood'); fx.dust(s.x, s.y, s.z, 20); bump(s.x, s.z, 0.5, 50); }
    else if (d.snd === 3) { sound.play(s.kind === 'wood' ? 'chop' : 'impactMetal_light_000', { x: s.x, y: s.y, z: s.z, vol: 0.7, rate: 1.2 }); fx.chips(s.x, s.y + 1.2, s.z, 5, s.kind !== 'wood'); }
  }
  else if (k === 'gate') { const s = world.segments[d.id]; world.setGate(d.id, d.open, d.locked); sound.play(d.open ? 'doorOpen_1' : 'doorClose_1', { x: s.x, y: s.y, z: s.z, vol: 1, range: 60 }); if (!d.open) sound.play('latch', { x: s.x, y: s.y, z: s.z, vol: 0.9, delay: 0.25 }); }
  else if (k === 'power') { G.power = d.on; world.drawLights(d.on); world.genLight.material.color.setHex(d.on ? 0x40ff70 : 0xff3030); sound.tone(d.on ? [[0, 60], [1, 220]] : [[0, 220], [1, 40]], { dur: 1.3, vol: 0.4, type: 'sawtooth', lp: 900 }); if (!d.on) toast('⚡ The power is out! Restart the generator.', 'bad'); }
  else if (k === 'radio') { const r = RADIO[d.key]; if (r) radio(r[0], r[1], () => sound.radio()); }
  else if (k === 'toast') { toast(d.text, d.kind); if (d.snd === 'coins') sound.coins(); else if (d.snd === 'alarm') sound.alarm(); else if (d.snd === 'buy') sound.jingle('buy'); }
  else if (k === 'fed') { const tr = world.troughs.find(t => t.zone === d.zone); toast('🪣 ' + d.text, 'good'); sound.play('splash01', { x: tr.x, y: tr.y, z: tr.z, vol: 0.8, rate: 0.8 }); fx.hearts(tr.x, tr.y + 1, tr.z, 8); sound.jingle('task'); }
  else if (k === 'hurt') hurtMe(d.dmg, d.kx, d.kz, d.sp);
  else if (k === 'take') { me.carry = null; sound.voice('yip', player.pos.x, player.pos.y, player.pos.z); }
  else if (k === 'station') world.stations[d.id].cd = 45;
  else if (k === 'revive') {
    d.ids.forEach((id, i) => { const p = players.get(id); if (p) p.down = false; });
    fx.confetti(d.x, world.heightAt(d.x, d.z) + 2, d.z, 70); sound.pop(d.x, world.heightAt(d.x, d.z), d.z); sound.jingle('task');
    const i = d.ids.indexOf(myId); if (i >= 0) { player.revive(60); const a = i * 1.6; player.pos.set(d.x + Math.cos(a) * 1.2, 0, d.z + Math.sin(a) * 1.2); player.pos.y = world.standAt(player.pos.x, player.pos.z) + 0.1; player.vel.set(0, 0, 0); me.deadShown = false; show('dead', false); meBean.root.visible = false; toast('💚 You have been re-bean-imated!', 'good'); }
  }
  else if (k === 'afx') { const a = animals.list.get(d.id); if (a) animalFx(d.fx, a, true); }
  else if (k === 'poof') { fx.confetti(d.x, d.y, d.z, 40); sound.pop(d.x, d.y, d.z); }
  else if (k === 'squeak') { G.chickenAt = { x: d.x, z: d.z, t: 14 }; }
  else if (k === 'yoink') { if (player.pos.z > 196) { player.pos.set(rnd(-3, 3), 0, 190); player.pos.y = world.standAt(player.pos.x, 190) + 0.1; toast('The gate got bored of waiting and pulled you in.', 'egg'); } }
  else if (k === 'wipe') { banner('EVERYONE GOT EATEN', 'Take two. Try not to do that again.', '#ff5d73'); sound.jingle('sad'); me.darts = maxDarts(); me.batt = 100; }
  else if (k === 'note') { if (!G.notes.includes(d.id)) G.notes.push(d.id); toast(`📝 ${d.who} found a note (${d.n}/10)`, 'egg'); if (d.n === 10) toast("📰 You have all of Vance's notes. The Control Tower has a third option now.", 'egg'); }
  else if (k === 'gnome') { if (!G.gnomes.includes(d.id)) G.gnomes.push(d.id); const g = world.gnomes[d.id]; g.obj.visible = false; fx.confetti(g.x, g.y + 0.6, g.z, 30); sound.pop(g.x, g.y, g.z); toast(`🧙 ${d.who} found a gnome (${d.n}/${world.gnomes.length})`, 'egg'); if (d.all) { toast('🧙 The gnomes are pleased. +$70', 'egg'); sound.jingle('win'); } }
  else if (k === 'camel') { const P = PLACES.plaza; world.camelSpin = 0.15 + d.n * 2.5; sound.bell(P.x, world.heightAt(P.x, P.z) + 3, P.z); if (d.n === 3) { fx.confetti(P.x, world.heightAt(P.x, P.z) + 5, P.z, 200); toast('🐪 The golden camel approves. +$25', 'egg'); sound.jingle('win'); } setTimeout(() => { world.camelSpin = 0.15; }, 4000); }
  else if (k === 'vend') { sound.thud(player.pos.x, player.pos.y, player.pos.z, 1.2); bump(player.pos.x, player.pos.z, 0.25, 5); if (d.res === 1) { player.hp = Math.min(100, player.hp + 25); toast('🥤 A can of BEAN JUICE rolls out. +25 ❤️', 'good'); sound.play('glass_002', { vol: 0.6 }); } else if (d.res === 0) toast('The machine ate your dignity and gave nothing back.'); else sound.coins(); }
  else if (k === 'disco') { G.disco = 14; toast('🪩 You found the disco button!', 'egg'); }
  else if (k === 'bell') { world.bell.userData.swing = 1; sound.bell(world.bell.position.x, world.bell.position.y, world.bell.position.z); }
}
function bump(x, z, power, range) { const d = Math.hypot(x - player.pos.x, z - player.pos.z); if (d < range) shake = Math.max(shake, power * (1 - d / range)); }
function animalFx(kind, a, fromNet) {
  const S = SPECIES[a.sp], y = a.y + S.size * 0.6;
  if (isHost && !fromNet && net && ['voice', 'crash', 'escape', 'wake'].includes(kind)) net.send({ type: 'ev', k: 'afx', fx: kind, id: a.id });
  if (kind === 'voice') sound.voice(S.voice, a.x, y, a.z, S.size / 3);
  else if (kind === 'crash') { sound.crash(a.x, y, a.z, false); fx.dust(a.x, a.y, a.z, 14); bump(a.x, a.z, 0.5, 40); }
  else if (kind === 'escape') { sound.voice(S.voice, a.x, y, a.z, S.size / 3); toast(`⚠️ A ${S.name} is loose!`, 'bad'); }
  else if (kind === 'hit') { fx.dart(a.x, y, a.z); sound.play('hit001', { x: a.x, y, z: a.z, vol: 0.7 }); }
  else if (kind === 'sleep') { fx.dart(a.x, y, a.z); sound.thud(a.x, a.y, a.z, 0.8 + S.size * 0.2); fx.dust(a.x, a.y, a.z, 10); }
  else if (kind === 'zzz') { fx.zzz(a.x, a.y + S.size * 0.9, a.z); if (Math.random() < 0.4) sound.voice('snore', a.x, y, a.z); }
  else if (kind === 'stars') fx.stars(a.x, a.y + S.size * 1.05, a.z);
  else if (kind === 'wake') sound.voice(S.voice, a.x, y, a.z, S.size / 3);
}
function hurtMe(dmg, kx = 0, kz = 0, sp) {
  if (player.down || G.phase === 'end' || !started) return;
  player.hurt(dmg, kx, kz); shake = Math.max(shake, 0.6); hurtFlash = 1; me.deadBy = SPECIES[sp]?.name || '';
  sound.play('bite00' + Math.floor(Math.random() * 3), { vol: 0.9 }); sound.play('impactPunch_heavy_001', { vol: 0.7 });
}
function onDeath() {
  me.deadShown = true; me.carry = null; me.light = false; me.dance = false; orbit = player.yaw;
  $('dead-by').textContent = me.deadBy ? `Cause of death: one ${me.deadBy}.` : 'Cause of death: gravity.';
  $('dead-tip').textContent = players.size > 1 ? 'A friend can bring you back at any Re-Bean-imator 💚' : 'Nobody is coming. The night will start over.';
  show('dead'); sound.jingle('sad'); act('died', { by: me.deadBy }); closeOverlay();
  meBean.root.visible = true;
}

// ---------------------------------------------------------------- starting and stopping a shift
function resetWorld() {
  for (const s of world.segments) { if (s.gate) world.setGate(s.id, false, true); else world.setSegment(s.id, s.max, 1); }
  world.setMainGate(true); world.mainGate.swing = 1; world.drawLights(true); world.genLight.material.color.setHex(0x40ff70);
  for (const g of world.gnomes) g.obj.visible = true; for (const st of world.stations) st.cd = 0;
  animals.clear();
}
function beginShift(i) {
  started = true; show('menu', false); show('lobby', false); show('hud'); show('end-over', false); show('dead', false); $('chat-log').innerHTML = '';
  if (!isHost) { fresh(); resetWorld(); } G.phase = G.phase === 'lobby' ? 'intro' : G.phase;
  player.reset(); player.pos.set(-4.5 + i * 3, 0, 229 + (i % 2) * 2); player.pos.y = world.standAt(player.pos.x, player.pos.z) + 0.05; lookYaw = 0; lookPitch = 0;
  Object.assign(me, { item: 0, carry: null, light: false, batt: 100, darts: maxDarts(), chickenCd: 0, hasChicken: false, medUsed: false, dance: false, deadShown: false, deadBy: '' });
  if (meBean) scene.remove(meBean.root); meBean = new Bean('keeper' + (players.get(myId)?.hat ?? SET.hat), 1.7); meBean.root.visible = false; scene.add(meBean.root);
  buildHands(); banner('CEDAR HOLLOW ZOO', 'Walk in through the main gate', '#ffc93c');
  sound.jingle('dawn'); input.lock();
}
function joinMidGame() { // someone who arrives late starts at the Lodge
  beginShift(players.size); const [x, z] = world.lodge; player.pos.set(x + rnd(-2, 2), world.standAt(x, z) + 0.1, z + rnd(0, 2));
}
function leave(msg) {
  started = false; G.phase = 'menu'; input.unlock(); closeOverlay();
  try { voice?.stop(); } catch (_) {} voice = null; try { net?.destroy(); } catch (_) {} net = null; isHost = true; myId = 'h';
  for (const p of players.values()) dropKeeper(p); players.clear(); animals.clear(); if (meBean) meBean.root.visible = false;
  show('hud', false); show('lobby', false); show('pause-over', false); show('end-over', false); show('menu'); $('menu-msg').textContent = msg || '';
}
function showEnding() {
  if (G.phase !== 'end') return;
  const E = ENDINGS[G.ending] || ENDINGS.out, st = G.stats;
  $('end-title').textContent = E.title; $('end-title').style.color = E.color; $('end-text').textContent = E.text;
  $('end-stats').innerHTML = [['Days survived', 5], ['Times eaten', st.deaths], ['Troughs filled', st.fed], ['Fences fixed', st.fixed], ['Darts fired', st.darts], ['Animals sent home', st.tagged], ['Whole-crew wipes', st.wipes], ['Gnomes found', `${G.gnomes.length}/7`], ['Notes read', `${G.notes.length}/10`], ['Money left', '$' + G.money]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  openOverlay('end-over');
}

// ---------------------------------------------------------------- other keepers
function addPlayer(id, name, hat) {
  const used = new Set([...players.values()].map(p => p.hat)); let h = hat % 4; while (used.has(h)) h = (h + 1) % 4;   // everyone gets their own colour and hat
  const [lx, lz] = world.spawn;
  const p = { id, name: clean(String(name || 'Keeper').slice(0, 14)) || 'Keeper', hat: h, x: lx, y: 0, z: lz, yaw: 0, pitch: 0, hp: 100, down: false, item: 0, carry: null, light: false, crouch: false, dance: false, radio: false, speed: 0, tl: 0 };
  p.tx = p.x; p.ty = p.y; p.tz = p.z; p.tyaw = 0; players.set(id, p); return p;
}
function makeKeeper(p) {
  p.bean = new Bean('keeper' + p.hat, 1.7); scene.add(p.bean.root);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.font = '800 34px Bahnschrift, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 8; c.strokeStyle = '#1b1630'; c.strokeText(p.name, 128, 34); c.fillStyle = COLORS[p.hat]; c.fillText(p.name, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  p.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false })); p.tag.scale.set(1.7, 0.42, 1); p.tag.position.y = 2.45; p.bean.root.add(p.tag);
  p.spot = new THREE.SpotLight(0xfff0d0, 0, 40, 0.5, 0.5, 1.4); p.spot.position.set(0, 1.4, 0.3); p.spot.target.position.set(0, 1.2, 6); p.bean.root.add(p.spot, p.spot.target);
}
function dropKeeper(p) { if (p.bean) { scene.remove(p.bean.root); p.tag.material.map.dispose(); p.bean = null; } }
function updateKeepers(dt) {
  const _look = new THREE.Vector3(), _fwd = new THREE.Vector3();
  for (const p of players.values()) {
    if (p.id === myId) continue;
    if (!p.bean) makeKeeper(p);
    const k = Math.min(1, dt * 12), px = p.x, pz = p.z;
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.yaw += angDiff(p.tyaw, p.yaw) * k;
    p.bean.root.position.set(p.x, p.y, p.z); p.bean.root.rotation.y = p.yaw + Math.PI; p.bean.root.visible = started;
    _fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); _look.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    p.talk = Math.max(clamp((voice?.level(p.id) || 0) * 7, 0, 1), p.tl || 0);
    const key = p.down ? '' : p.carry ? 'bucket:' + p.carry : ITEMS[p.item]?.id || '';
    if (key !== p.heldKey) { p.heldKey = key; if (p.held) p.held.parent.remove(p.held); p.held = null; if (key) { const [kind, feed] = key.split(':'); p.held = makeItem(kind, feed); p.held.scale.setScalar(1.5); p.held.position.set(0, p.bean.handY, 0.05); p.held.rotation.set(1.3, Math.PI, 0); p.bean.arms[1].g.add(p.held); } }
    p.bean.update(dt, { speed: p.speed, run: 7.6, act: p.dance ? 'dance' : '', asleep: p.down, talk: p.talk, look: _look, fwd: _fwd, hold: !!p.held, crouch: p.crouch });
    p.spot.intensity = p.light && !p.down ? 45 : 0; p.tag.visible = !p.down || true;
    // their footsteps
    p.stepD = (p.stepD || 0) + Math.hypot(p.x - px, p.z - pz); if (p.stepD > 1.9 && !p.crouch) { p.stepD = 0; sound.step(world.surfaceAt(p.x, p.z), 0.35, { x: p.x, y: p.y, z: p.z, range: 28 }); }
  }
}

// ---------------------------------------------------------------- hands and what's in them
let handL, handR;
function buildHands() {
  vm.clear(); vmKey = '';
  const mat = new THREE.MeshToonMaterial({ color: COLORS[players.get(myId)?.hat ?? 0] });
  handR = new THREE.Group(); handL = new THREE.Group();
  for (const [g, s] of [[handR, 1], [handL, -1]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat); m.scale.set(1, 0.9, 1.15); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2, 4, 10), mat); arm.rotation.x = Math.PI / 2 - 0.75; arm.position.set(s * 0.035, -0.13, 0.13); g.add(m, arm); vm.add(g); }
}
function updateHands(dt, moving) {
  const key = player.down ? '' : me.carry ? 'bucket:' + me.carry : ITEMS[me.item].id === 'chicken' && (!me.hasChicken || me.chickenCd > 0) ? '' : ITEMS[me.item].id;
  if (key !== vmKey) { vmKey = key; vmSwap = 1; if (vmItem) handR.remove(vmItem); vmItem = null; if (key) { const [kind, feed] = key.split(':'); vmItem = makeItem(kind, feed); vmItem.scale.setScalar(1.25); vmItem.position.set(-0.02, 0.1, -0.05); if (kind === 'bucket') vmItem.position.set(-0.02, -0.2, -0.02); if (kind === 'wrench') vmItem.rotation.x = -0.5; handR.add(vmItem); } }
  vmSwap = Math.max(0, vmSwap - dt * 4); vmKick = Math.max(0, vmKick - dt * 5);
  const bob = moving ? Math.sin(player.stepPhase) * 0.012 * Math.min(1, player.speed / 4) : 0, bob2 = moving ? Math.abs(Math.cos(player.stepPhase)) * 0.012 : 0, br = Math.sin(time * 1.6) * 0.004;
  const kick = Math.sin(vmKick * Math.PI), wr = vmKey === 'wrench', two = vmKey === 'rifle' || vmKey.startsWith('bucket');
  handR.position.set(0.3 + bob, -0.33 - bob2 + br - vmSwap * 0.35 - (wr ? kick * 0.08 : 0), -0.66 + (vmKey === 'rifle' ? kick * 0.09 : wr ? -kick * 0.16 : -kick * 0.2));
  handR.rotation.set((wr ? -kick * 1.1 : kick * 0.25) + player.vel.y * 0.01, -0.12, 0);
  handL.position.set(-0.3 + bob + (two ? 0.22 : 0), -0.36 - bob2 - br - vmSwap * 0.2 + (two ? 0.03 : -0.2), -0.62 - (two ? 0.14 : 0));
  handL.visible = handR.visible = !player.down;
  vm.rotation.set(0, 0, 0);
}

// ---------------------------------------------------------------- what's in front of me
function pointAction(pt) {
  const T = pt.type;
  if (T === 'shop') return { text: "Open the Keepers' Shop", run: () => { fillShop(); openOverlay('shop-over'); } };
  if (T === 'medkit') return me.medUsed ? { text: 'First aid kit: restocked at sunrise and sunset', dis: true } : player.hp < 99 ? { text: 'Patch yourself up', hold: 1, run: () => { player.hp = 100; me.medUsed = true; sound.play('cloth', { vol: 0.8 }); toast('All patched up. ❤️', 'good'); } } : null;
  if (T === 'darts') return me.darts < maxDarts() ? { text: 'Grab more darts', run: () => { me.darts = maxDarts(); sound.play('metalClick', { vol: 0.8 }); } } : null;
  if (T === 'feed') return me.carry ? null : { text: `Fill a bucket with ${pt.kind}`, run: () => { me.carry = pt.kind; sound.play('leather', { vol: 0.8 }); } };
  if (T === 'generator') return G.power ? null : { text: 'Restart the generator', hold: 3, run: () => act('gen') };
  if (T === 'tower') return G.tower ? { text: 'The switch has been thrown', dis: true } : G.day >= SHIFT.days && G.phase === 'night' ? { text: 'Use the control desk', run: () => { show('tw-truth', G.notes.length >= 10); openOverlay('tower-over'); } } : { text: 'Control desk: locked until the last night', dis: true };
  if (T === 'chicken') return me.hasChicken ? null : { text: 'Take a squeaky chicken', run: () => { me.hasChicken = true; me.item = 3; sound.squeak(); toast('🐔 Squeaky chicken acquired. Press 4, then click to throw it.', 'egg'); } };
  if (T === 'vending') return me.vendCd > 0 ? null : { text: 'Kick the vending machine', run: () => { me.vendCd = 12; act('vend'); } };
  if (T === 'camel') return { text: 'Pat the golden camel', run: () => act('camel') };
  if (T === 'disco') return G.disco > 0 ? null : { text: 'Press the mystery button', run: () => act('disco') };
  if (T === 'bell') return G.phase === 'day' && G.t > 12 && G.t < G.dur - SHIFT.dusk - 1 ? { text: 'Ring the bell: bring on the night', hold: 1.5, run: () => act('bell') } : null;
  if (T === 'revive') { if (![...players.values()].some(p => p.down && p.id !== myId)) return null; const st = world.stations[pt.id]; return st.cd > 0 ? { text: `Re-Bean-imator recharging (${Math.ceil(st.cd)}s)`, dis: true } : { text: 'Re-bean-imate your friends', hold: 3.5, run: () => act('revive', { id: pt.id }) }; }
  return null;
}
function findTarget() {
  const p = player.pos, fxd = -Math.sin(player.yaw), fzd = -Math.cos(player.yaw);
  let best = null, bd = 1e9;
  const consider = (x, z, range, make, y) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > range || d >= bd || (y != null && Math.abs(y - p.y) > 3)) return; if (d > 1.1 && (dx * fxd + dz * fzd) / d < 0.25) return; const t = make(); if (t) { best = t; bd = d; } };
  for (const pt of world.points) consider(pt.x, pt.z, pt.r, () => pointAction(pt), pt.y);
  for (const n of world.notes) if (!G.notes.includes(n.id)) consider(n.x, n.z, 2.6, () => ({ text: 'Read the note', run: () => { $('note-title').textContent = `📝 Note ${n.id + 1} of 10`; $('note-text').textContent = n.text; openOverlay('note-over'); sound.play('cloth', { vol: 0.6 }); act('note', { id: n.id }); } }));
  for (const g of world.gnomes) if (g.obj.visible) consider(g.x, g.z, 2.4, () => ({ text: 'Pick up the gnome', run: () => act('gnome', { id: g.id }) }));
  for (const zn of openZones()) {
    if (Math.abs(p.x - zn.x) > zn.w / 2 + 6 || Math.abs(p.z - zn.z) > zn.d / 2 + 6) continue;
    const tr = world.troughs.find(t => t.zone === zn.id);
    if (me.carry) consider(tr.x, tr.z, 3.4, () => me.carry === zn.feed ? { text: `Fill the trough (${zn.name})`, hold: 1.2, run: () => { me.carry = null; act('feed', { zone: zn.id }); } } : { text: `They don't eat ${me.carry} here. They want ${zn.feed}.`, dis: true });
    for (const id of zn.segs) { const s = world.segments[id]; if (s.gate) consider(s.x, s.z, 3.6, () => ({ text: s.open ? 'Close and lock the gate' : 'Open the gate', key: 'gate' + id + s.open, run: () => act('gate', { id, open: !s.open }) })); else if (s.hp < s.max) consider(s.x, s.z, 3.6, () => ({ text: s.broken ? 'Hold to rebuild the fence' : 'Hold to patch the fence', seg: s, key: 'seg' + id })); }
  }
  for (const a of animals.list.values()) if (a.state === 'sleep' && a.out) consider(a.x, a.z, RADIUS[a.sp] + 2.6, () => ({ text: `Tag the ${SPECIES[a.sp].name} to send it home`, hold: 1, run: () => act('tag', { id: a.id }), key: 'tag' + a.id }));
  return best;
}
function interact(dt) {
  const t = player.down || overlay ? null : findTarget(), E = input.keys.KeyE;
  show('prompt', !!t); if (!t) { holdT = 0; return; }
  const key = t.key || t.text; if (key !== holdKey) { holdKey = key; holdT = 0; holdDone = false; }
  $('prompt-text').innerHTML = t.dis ? t.text : `<kbd>E</kbd>${t.text}`; $('prompt').style.opacity = t.dis ? 0.7 : 1;
  let prog = 0;
  if (t.dis) { /* just a notice */ }
  else if (t.seg) { // fixing a fence: keep holding
    prog = t.seg.hp / t.seg.max;
    if (E) { if (ITEMS[me.item].id !== 'wrench') me.item = 1; repT += dt; if (repT > 0.28) { repT = 0; vmKick = 1; act('repair', { id: t.seg.id, amt: t.seg.max * 0.085 * (1 + 0.4 * (G.up.belt || 0)) }); } }
  } else if (t.hold) {
    if (!E) holdDone = false;
    if (E && !holdDone) { holdT += dt; if (holdT >= t.hold) { holdT = 0; holdDone = true; t.run(); } } else holdT = Math.max(0, holdT - dt * 2);
    prog = holdT / t.hold;
  } else if (input.hit('KeyE')) t.run();
  $('hold').style.display = t.seg || t.hold ? '' : 'none'; $('hold').firstChild.style.width = Math.round(prog * 100) + '%';
}
function useItem() {
  const it = ITEMS[me.item].id, o = camera.position, d = camera.getWorldDirection(new THREE.Vector3());
  if (me.carry) return;
  if (it === 'torch') { toggleTorch(); }
  else if (it === 'rifle') {
    if (me.darts <= 0) { sound.ui('error'); toast('Out of darts. There are more in the Lodge locker.'); return; }
    if (vmKick > 0.2) return;
    me.darts--; vmKick = 1; sound.dart(); shake = Math.max(shake, 0.12);
    const max = world.rayDist(o.x, o.y, o.z, d.x, d.y, d.z, 70), a = animals.rayHit(o.x, o.y, o.z, d.x, d.y, d.z, max);
    fx.muzzle(o.x + d.x * 0.9, o.y + d.y * 0.9 - 0.1, o.z + d.z * 0.9);
    if (a) act('dart', { id: a.id }); else { fx.dart(o.x + d.x * max, o.y + d.y * max, o.z + d.z * max); if (isHost) G.stats.darts++; }
  } else if (it === 'chicken' && me.hasChicken && me.chickenCd <= 0) {
    const flat = Math.hypot(d.x, d.z) || 1, reach = Math.min(16, world.rayDist(o.x, o.y, o.z, d.x / flat, 0, d.z / flat, 16) - 0.6);
    me.chickenCd = 26; vmKick = 1; sound.play('swing1', { vol: 0.8 }); act('chicken', { x: o.x + d.x / flat * reach, z: o.z + d.z / flat * reach });
  }
}
function toggleTorch() { if (me.batt < 3 && !me.light) { toast('Torch battery is flat. Give it a moment.'); return; } me.light = !me.light; sound.play('metalClick', { vol: 0.5, rate: me.light ? 1.2 : 0.9 }); }

// ---------------------------------------------------------------- overlays (shop, notes, tower, pause, map)
function openOverlay(id) { closeOverlay(); overlay = id; show(id); input.unlock(); }
function closeOverlay(relock = true) { if (!overlay) return; show(overlay, false); const was = overlay; overlay = null; if (relock && started && was !== 'end-over') input.lock(); }
function fillShop() {
  $('shop-money').textContent = '$' + G.money;
  $('shop-list').innerHTML = UPGRADES.map(u => { const lvl = G.up[u.id] || 0, cost = u.cost * (lvl + 1), full = lvl >= u.max; return `<div class="up"><span class="ic">${u.icon}</span><span class="tx"><b>${u.name} ${'★'.repeat(lvl)}${'☆'.repeat(u.max - lvl)}</b>${u.desc}</span><button class="btn small green" data-buy="${u.id}" ${full || G.money < cost ? 'disabled' : ''}>${full ? 'MAX' : '$' + cost}</button></div>`; }).join('');
}
function tasks() {
  const list = [], open = openZones(), loose = animals.loose().length;
  if (G.phase === 'intro') return ['First day', [{ text: 'Walk in through the main gate', done: player.pos.z < 196 }, { text: 'Wait for the rest of the crew', done: G.shut }]];
  if (G.phase === 'end') return ['Shift over', [{ text: 'Survive 5 days and 5 nights', done: true }, { text: 'Walk out of the main gate (or stay, weirdo)' }]];
  if (G.phase === 'day') {
    for (const z of open) list.push({ text: `Feed ${z.name} (${z.feed})`, done: G.zones[z.id].hunger < 0.4 });
    const broken = world.segments.filter(s => !s.gate && s.hp < s.max * 0.7 && ZONES.find(z => z.id === s.zone).night <= G.day).length;
    list.push({ text: broken ? `Fix the fences (${broken} left)` : 'Fences all fixed', done: !broken });
    if (loose) list.push({ text: `Round up loose animals (${loose})`, bad: true });
    list.push({ text: 'Ring the Lodge bell when ready for night' });
    return [`Day ${G.day} jobs`, list];
  }
  list.push({ text: 'Stay alive until 6 AM' });
  if (!G.power) list.push({ text: 'POWER OUT: restart the generator', bad: true });
  for (const z of open) { const zs = G.zones[z.id]; if (zs.breach != null) list.push({ text: `${z.name}: ${world.segments[zs.breach].gate ? 'gate open' : 'fence down'}`, bad: true }); else if (zs.agit > 0.55) list.push({ text: `${z.name} is angry: feed them`, bad: true }); }
  if (loose) list.push({ text: `${loose} animal${loose > 1 ? 's' : ''} loose: dart and tag`, bad: true });
  if (G.day >= SHIFT.days) list.push({ text: 'Reach the Control Tower and choose', done: !!G.tower });
  if ([...players.values()].some(p => p.down)) list.push({ text: 'A friend is down: get to a Re-Bean-imator 💚', bad: true });
  return [`Night ${G.day}`, list];
}

// ---------------------------------------------------------------- one frame
function frame(dt) {
  time += dt;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) { renderer.setSize(W, H, false); camera.aspect = vmCam.aspect = W / H; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); }
  toonUniforms.uAspect.value = camera.aspect;
  if (!started) return menuFrame(dt);

  // ---- me
  const locked = input.locked && !overlay, typing = document.activeElement === $('chat-in');
  if (locked) { const s = 0.0022 * SET.sens / 100; if (player.down) { orbit -= input.dx * s; } else { lookYaw -= input.dx * s; } lookPitch = clamp(lookPitch - input.dy * s, -1.5, 1.5); }
  const K = input.keys, ctl = locked && !typing;
  const inp = { yaw: lookYaw, pitch: lookPitch, mx: ctl ? (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) : 0, mz: ctl ? (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0) : 0, sprint: ctl && (K.ShiftLeft || K.ShiftRight), jump: ctl && K.Space, jumpHit: ctl && input.hit('Space'), crouch: ctl && (K.ControlLeft || K.KeyC), slow: !!me.carry && !G.up.yoke };
  const e = player.update(dt, inp);
  // bodies are solid: you can't walk through an animal or a friend
  for (const a of animals.list.values()) { const min = RADIUS[a.sp] + 0.42, dx = player.pos.x - a.x, dz = player.pos.z - a.z; if (Math.abs(dx) < min && Math.abs(dz) < min && player.pos.y < a.y + SPECIES[a.sp].size) { const d = Math.hypot(dx, dz); if (d < min && d > 0.001) { player.pos.x += dx / d * (min - d); player.pos.z += dz / d * (min - d); world.push(player.pos, player.pos.y, 0.42, player.vel, 1.75); } } }
  for (const p of players.values()) if (p.id !== myId && !p.down) { const dx = player.pos.x - p.x, dz = player.pos.z - p.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001 && Math.abs(player.pos.y - p.y) < 1.6) { player.pos.x += dx / d * (0.8 - d) * 0.5; player.pos.z += dz / d * (0.8 - d) * 0.5; world.push(player.pos, player.pos.y, 0.42, player.vel, 1.75); } }
  if (e.step) sound.step(player.surface, player.crouch ? 0.1 : player.sprinting ? 0.42 : 0.28);
  if (e.jumped) sound.play('cloth', { vol: 0.35, rate: 1.3 }); if (e.landed) { sound.thud(undefined, 0, 0, Math.min(1, e.landed / 12)); if (e.landed > 6) fx.dust(player.pos.x, player.pos.y, player.pos.z, 6); }
  if (e.slid) sound.play('leather', { vol: 0.6, rate: 0.7 }); if (e.mantled) sound.play('cloth', { vol: 0.5 });
  if (player.down && !me.deadShown) onDeath();
  if (ctl && !player.down) {
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) { if (i === 3 && !me.hasChicken) toast('You do not own a squeaky chicken. Yet. Try the Gift Shop.'); else { me.item = i; sound.ui('click'); } }
    if (input.hit('KeyF')) toggleTorch();
    if (input.hit('KeyQ') && me.carry) { me.carry = null; sound.play('ui_drop', { vol: 0.7 }); }
    if (input.mouse.left && !me.clicked) { me.clicked = true; useItem(); } if (!input.mouse.left) me.clicked = false;
    me.dance = !!K.KeyG;
    if (input.hit('KeyH')) { SET.help = !SET.help; save(); show('help', SET.help); }
  }
  if (input.hit('Enter') && !overlay && started) { const ci = $('chat-in'); if (typing) { const t = clean(ci.value.trim()); if (t) { chatLine(nameOf(myId), t, COLORS[players.get(myId).hat]); net?.send({ type: 'chat', text: t }); } ci.value = ''; ci.blur(); show('chat-in', false); input.lock(); } else { show('chat-in'); ci.focus(); } }
  const mapOn = !!K.Tab && !overlay; show('map-over', mapOn);
  // torch battery
  if (me.light) { me.batt -= dt * 100 / (170 * (1 + 0.6 * (G.up.torch || 0))); if (me.batt <= 0) { me.batt = 0; me.light = false; toast('🔦 Torch battery is flat!', 'bad'); } } else me.batt = Math.min(100, me.batt + dt * 100 / 70);
  me.chickenCd = Math.max(0, me.chickenCd - dt); me.vendCd = Math.max(0, me.vendCd - dt);
  // voice
  const talking = ctl && (K[SET.pttKey] || K[SET.radioKey]); me.radio = !!(ctl && K[SET.radioKey]);
  if (voice) { voice.setTalking(!!talking); const pm = new Map(); for (const p of players.values()) pm.set(p.id, { x: p.x, y: p.y + 1.5, z: p.z, radio: p.radio }); voice.update({ x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: lookYaw }, pm, SET.vol / 100 * 1.5); }
  const myLevel = voice ? clamp((voice.localLevel || 0) * 7, 0, 1) : 0;
  $('mic').classList.toggle('on', myLevel > 0.12); $('mic-text').textContent = !voice ? 'solo' : !voice.micOk ? 'no mic' : me.radio ? 'RADIO' : SET.voice === 'open' ? `mic on (${keyName(SET.radioKey)}: radio)` : SET.voice === 'vox' ? `voice activated (${keyName(SET.radioKey)}: radio)` : `${keyName(SET.pttKey)}: talk  ${keyName(SET.radioKey)}: radio`;
  // my own record (the host reads it for the animals; friends see it)
  const mp = players.get(myId); Object.assign(mp, { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: lookYaw, pitch: lookPitch, hp: player.hp, down: player.down, item: me.item, carry: me.carry, light: me.light, crouch: player.crouch, dance: me.dance, radio: me.radio, speed: player.speed, tl: myLevel });
  if (net && (sendT -= dt) <= 0) { sendT = 0.08; net.send({ type: 'pos', p: [+mp.x.toFixed(2), +mp.y.toFixed(2), +mp.z.toFixed(2), +mp.yaw.toFixed(3), +mp.pitch.toFixed(2), Math.round(mp.hp), mp.down ? 1 : 0, mp.item, mp.carry, mp.light ? 1 : 0, mp.crouch ? 1 : 0, mp.dance ? 1 : 0, mp.radio ? 1 : 0, +mp.speed.toFixed(1), +myLevel.toFixed(2)] }); }

  // ---- the world
  if (isHost) hostTick(dt); else if (G.phase === 'day' || G.phase === 'night' || G.phase === 'intro') G.t += dt;
  interact(dt);
  updateKeepers(dt);
  const k = nightK(), storm = G.storm * (G.phase === 'night' ? smooth(0, 40, G.t) : 0);
  // camera: your eyes, or circling your poor flattened bean when you're down
  shake = Math.max(0, shake - dt * 1.6);
  const sx = (Math.random() - 0.5) * shake * 0.5, sy = (Math.random() - 0.5) * shake * 0.5;
  if (player.down) {
    meBean.root.position.copy(player.pos); meBean.root.rotation.y = lookYaw + Math.PI; meBean.update(dt, { speed: 0, run: 7, act: '', asleep: true, fwd: new THREE.Vector3(0, 0, 1), look: null });
    const cp = clamp(lookPitch, -1.2, -0.1), dx = Math.sin(orbit) * Math.cos(cp), dy = -Math.sin(cp), dz = Math.cos(orbit) * Math.cos(cp), dist = Math.min(5, world.rayDist(player.pos.x, player.pos.y + 1, player.pos.z, dx, dy, dz, 5) - 0.3);
    camera.position.set(player.pos.x + dx * dist, player.pos.y + 1 + dy * dist, player.pos.z + dz * dist); camera.rotation.set(cp, orbit, 0);
  } else {
    const bob = player.grounded && player.speed > 1 ? Math.sin(player.stepPhase * 2) * 0.035 * Math.min(1, player.speed / 5) : 0;
    camera.position.set(player.pos.x, player.pos.y + player.eye + bob, player.pos.z);
    camera.rotation.set(lookPitch + sy, lookYaw + sx, (player.slide > 0 ? -0.06 : 0) + sx * 0.5 + (me.dance ? Math.sin(time * 9) * 0.12 : 0));
  }
  const fovWant = 74 + (player.sprinting ? 7 : 0) + (player.slide > 0 ? 5 : 0); if (Math.abs(camera.fov - fovWant) > 0.05) { camera.fov += (fovWant - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
  sound.listen(camera.position.x, camera.position.y, camera.position.z, player.down ? orbit : lookYaw);
  light(dt, k, storm);
  torch.intensity = me.light && !player.down ? (95 + 30 * (G.up.torch || 0)) * (me.batt < 15 ? 0.6 + Math.random() * 0.4 : 1) : 0;
  animals.update(dt, time, camera.position, [...players.values()].filter(p => !p.down), isHost);
  // the ground shakes when the big ones walk
  let fear = 0;
  for (const a of animals.list.values()) {
    const S = SPECIES[a.sp], d = Math.hypot(a.x - player.pos.x, a.z - player.pos.z);
    if (a.out && a.state !== 'sleep' && S.dmg > 0) fear = Math.max(fear, 1 - d / 28);
    if (S.size >= 3 && a.speed > 0.4 && d < 90) { a.stomp = (a.stomp || 0) - dt * a.speed / S.size * 2.2; if (a.stomp <= 0) { a.stomp = 1; sound.thud(a.x, a.y, a.z, 0.5 + S.size * 0.18); bump(a.x, a.z, S.size * 0.035, 45); } }
  }
  if (G.chickenAt) { const c = G.chickenAt; c.t -= dt; if (!chickenObj) { chickenObj = makeItem('chicken'); chickenObj.scale.setScalar(2.4); scene.add(chickenObj); } chickenObj.visible = true; chickenObj.position.set(c.x, world.heightAt(c.x, c.z) + 0.25 + Math.abs(Math.sin(time * 7)) * 0.3, c.z); chickenObj.rotation.y = time * 3; if (Math.floor(c.t * 1.4) !== Math.floor((c.t + dt) * 1.4)) sound.squeak(c.x, 0, c.z); if (c.t <= 0) { G.chickenAt = null; chickenObj.visible = false; } }
  if (G.disco > 0 && world.discoAt) { disco.position.set(world.discoAt.x, world.discoAt.y, world.discoAt.z); disco.color.setHSL((time * 0.7) % 1, 1, 0.55); disco.intensity = 500; if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) sound.tone([[0, Math.floor(time * 4) % 4 ? 110 : 82], [1, 60]], { x: disco.position.x, y: disco.position.y, z: disco.position.z, range: 120, dur: 0.2, vol: 0.7, type: 'square', lp: 500 }); if (!isHost) G.disco = Math.max(0.01, G.disco); } else disco.intensity = 0;
  world.update(dt, time, camera.position, scene.fog.far, 1 + storm * 2);
  fx.update(dt, { cam: camera.position, storm, viewH: canvas.height, fov: camera.fov });
  sound.update({ dt, night: k, storm, power: G.power, genDist: Math.hypot(player.pos.x - PLACES.generator.x, player.pos.z - PLACES.generator.z), fear: player.down ? 0 : clamp(fear, 0, 1) });
  updateHands(dt, player.grounded && player.speed > 0.6);

  // ---- HUD
  hurtFlash = Math.max(0, hurtFlash - dt * 1.4); $('hurt').style.opacity = Math.max(hurtFlash, player.hp < 30 && !player.down ? 0.25 + Math.sin(time * 5) * 0.1 : 0); $('flash').style.opacity = (sound.flash || 0) * 0.5;
  if ((slowT -= dt) <= 0) {
    slowT = 0.2;
    $('clock-time').textContent = clockText(); $('clock-day').textContent = G.phase === 'intro' ? 'First morning' : G.phase === 'end' ? 'Day 6: free to go' : `${G.phase === 'night' ? '🌙 Night' : '☀️ Day'} ${G.day} of 5`; $('clock').classList.toggle('night', G.phase === 'night'); $('clock-bar').firstChild.style.width = (G.phase === 'day' || G.phase === 'night' ? G.t / G.dur * 100 : 0) + '%';
    $('money').textContent = '$' + G.money; setTasks(...tasks());
    setTeam([...players.values()].map(p => ({ name: p.name, color: COLORS[p.hat], hp: p.hp, down: p.down, talk: p.id === myId ? myLevel > 0.12 : p.talk > 0.12, radio: p.radio, me: p.id === myId })));
    setBar('hp', player.hp); setBar('stam', player.stamina); setBar('batt', me.batt);
    setHotbar(ITEMS.map((it, i) => ({ icon: it.icon, on: me.item === i && !me.carry, off: i === 3 && (!me.hasChicken || me.chickenCd > 0), count: i === 2 ? me.darts : i === 3 && me.chickenCd > 0 ? Math.ceil(me.chickenCd) : null })));
    show('carry', !!me.carry); if (me.carry) $('carry').textContent = `🪣 Carrying ${me.carry}  (Q: drop)`;
    if (overlay === 'shop-over') $('shop-money').textContent = '$' + G.money;
    if (mapOn) drawMap($('map'), { day: G.day, time, zones: G.zones, stations: world.stations, loose: G.up.radio ? animals.loose() : null, players: [...players.values()].map(p => ({ x: p.x, z: p.z, yaw: p.yaw, color: COLORS[p.hat], name: p.name, me: p.id === myId, down: p.down })) });
  }
  render();
}
function light(dt, k, storm) {
  const st = sky.update(time, k, G.phase === 'night' && G.t > G.dur / 2 ? 'flood' : 'day', camera, storm), fl = sound?.flash || 0;
  sun.color.copy(st.keyColor); sun.intensity = st.keyIntensity * lerp(0.86, 0.75, k) * (1 - storm * 0.4);
  sun.position.copy(camera.position).addScaledVector(st.keyDir, 180); sun.target.position.copy(camera.position);
  hemi.color.setRGB(lerp(0.81, 0.33, k), lerp(0.91, 0.38, k), lerp(1, 0.86, k)); hemi.groundColor.setRGB(lerp(0.54, 0.16, k), lerp(0.6, 0.12, k), lerp(0.42, 0.32, k)); hemi.intensity = lerp(1.05, 0.5, k) + fl * 3;
  scene.fog.color.copy(st.fog).multiplyScalar(lerp(1, 1.25, k)); scene.fog.near = lerp(60, 14, k); scene.fog.far = lerp(520, 190 - storm * 50, k);
  scene.environmentIntensity = lerp(0.5, 0.15, k); lightUniforms.uLampK.value = smooth(0.25, 0.7, k); setEyeGlow(0.32 + k * 1.4);
  vmHemi.intensity = lerp(1.3, 0.55, k) + (me.light ? 0.5 : 0); vmSun.intensity = lerp(1.6, 0.3, k);
}
function render() {
  renderer.clear(); renderer.render(scene, camera);
  if (started && !player.down) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
// Behind the menu: a slow circle round the fountain on a sunny morning
function menuFrame(dt) {
  const P = PLACES.plaza, a = time * 0.06, y = world.heightAt(P.x, P.z);
  camera.position.set(P.x + Math.sin(a) * 34, y + 11, P.z + Math.cos(a) * 34); camera.lookAt(P.x, y + 3, P.z);
  light(dt, 0, 0); world.update(dt, time, camera.position, scene.fog.far); fx.update(dt, { cam: camera.position, storm: 0, viewH: canvas.height, fov: camera.fov });
  sound.listen(camera.position.x, camera.position.y, camera.position.z, a + Math.PI); sound.update({ dt, night: 0, storm: 0, power: false, genDist: 99, fear: 0 });
  const eyes = document.querySelectorAll('#menu .eye i'); eyes.forEach((el, i) => { el.style.transform = `translate(${Math.sin(time * 1.3 + i) * 9}px, ${Math.cos(time * 1.7 + i * 2) * 9}px)`; });
  render();
}

// ---------------------------------------------------------------- co-op wiring
function wireNet() {
  net.on('pos', (d, from) => { const p = players.get(from), a = d.p; if (!p || !Array.isArray(a)) return; [p.tx, p.ty, p.tz, p.tyaw, p.pitch, p.hp] = a; p.down = !!a[6]; p.item = a[7] | 0; p.carry = a[8] === 'meat' || a[8] === 'hay' ? a[8] : null; p.light = !!a[9]; p.crouch = !!a[10]; p.dance = !!a[11]; p.radio = !!a[12]; p.speed = +a[13] || 0; p.tl = +a[14] || 0; if (isHost) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.yaw = p.tyaw; } });
  net.on('act', (d, from) => { if (isHost) doAct(from, d.k, d); });
  net.on('ev', d => handleEv(d));
  net.on('state', d => applyState(d.s));
  net.on('animals', d => animals.apply(d.list));
  net.on('chat', (d, from) => { const p = players.get(from); if (p) chatLine(p.name, clean(String(d.text || '').slice(0, 120)), COLORS[p.hat]); });
  net.on('joined', d => { if (!players.has(d.id)) { const p = addPlayer(d.id, d.name, d.hat); p.hat = d.hat; lobbyList(); toast(`${p.name} clocked in`, 'good'); } });
  net.on('left', d => { const p = players.get(d.id); if (p) { toast(`${p.name} clocked out`); dropKeeper(p); players.delete(d.id); voice?.removePlayer(d.id); lobbyList(); } });
  net.on('vready', (d, from) => { if (!voice?.local) return; voice.addPlayer(from, d.peerId, true); net.sendTo(from, { type: 'vhere', peerId: net.peer.id }); });
  net.on('vhere', (d, from) => { if (voice?.local) voice.addPlayer(from, d.peerId, true); });
  net.onJoin = (id, hello) => {
    const p = addPlayer(id, ok(hello.name) ? hello.name : 'Keeper', hello.hat | 0);
    net.sendTo(id, { type: 'welcome', you: id, players: [...players.values()].map(q => ({ id: q.id, name: q.name, hat: q.hat })), started: G.phase !== 'lobby', s: packState(),
      segs: world.segments.filter(s => !s.gate && s.hp < s.max).map(s => [s.id, s.hp, s.dir || 1]), gates: world.gates.filter(s => s.open).map(s => s.id), shut: !world.mainGate.open, notes: G.notes, gnomes: G.gnomes });
    net.send({ type: 'joined', id, name: p.name, hat: p.hat }); lobbyList(); toast(`${p.name} clocked in`, 'good');
  };
  net.onLeave = id => { const p = players.get(id); if (!p) return; toast(`${p.name} clocked out`); dropKeeper(p); players.delete(id); voice?.removePlayer(id); net.send({ type: 'left', id }); lobbyList(); };
  net.onClose = () => leave('Lost the connection to the host.');
}
const voxGate = () => 0.012 + (100 - SET.vox) / 100 * 0.1;   // the sensitivity slider: further right = opens for quieter voices
async function startVoice() {
  voice = new Voice(); voice.voxGate = voxGate(); await voice.start(net.peer, myId, SET.voice);
  net.send({ type: 'vready', peerId: net.peer.id });
}
function lobbyList() {
  if (G.phase !== 'lobby') return;
  const list = [...players.values()];
  $('lobby-list').innerHTML = [0, 1, 2, 3].map(i => list[i] ? `<div class="slot"><span class="dot" style="background:${COLORS[list[i].hat]}"></span>${HATS[list[i].hat]} ${list[i].name}${list[i].id === myId ? ' (you)' : ''}${list[i].id === 'h' ? ' ⭐' : ''}</div>` : '<div class="slot empty">Waiting for a keeper...</div>').join('');
  $('btn-start').classList.toggle('hide', !isHost); $('btn-start').textContent = list.length < 2 ? 'Start alone (2-4 keepers is better)' : `Start the shift (${list.length} keepers)`;
  $('lobby-msg').textContent = isHost ? '' : 'Waiting for the host to start...';
}
async function host() {
  const name = myName(); if (!name) return;
  $('menu-msg').textContent = 'Opening the staff room...';
  try { net = new Net(); const code = await net.host(); isHost = true; myId = 'h'; wireNet(); fresh(); players.clear(); addPlayer('h', name, SET.hat); $('room-code').textContent = code; show('menu', false); show('lobby'); lobbyList(); startVoice(); $('menu-msg').textContent = ''; }
  catch (e) { net = null; $('menu-msg').textContent = e.message || 'Could not host.'; }
}
async function join() {
  const name = myName(), code = $('join-code').value.trim().toUpperCase(); if (!name) return; if (code.length !== 5) { $('menu-msg').textContent = 'Room codes are 5 letters.'; return; }
  $('menu-msg').textContent = 'Knocking on the staff room door...';
  try {
    net = new Net(); const w = await net.join(code, { name, hat: SET.hat }); isHost = false; myId = w.you; wireNet(); fresh(); players.clear();
    for (const q of w.players) addPlayer(q.id, q.name, q.hat).hat = q.hat;
    $('room-code').textContent = code; show('menu', false); $('menu-msg').textContent = ''; startVoice();
    if (w.started) { joinMidGame(); applyState(w.s); for (const [id, hp, dir] of w.segs) world.setSegment(id, hp, dir); for (const id of w.gates) world.setGate(id, true, false); G.notes = w.notes; G.gnomes = w.gnomes; for (const id of w.gnomes) world.gnomes[id].obj.visible = false; world.setMainGate(!w.shut); if (w.shut) { world.mainGate.swing = 0; world.mainGate.slammed = true; } }
    else { show('lobby'); lobbyList(); }
  } catch (e) { net = null; $('menu-msg').textContent = e.message || 'Could not join.'; }
}
function solo() { const name = myName(); if (!name) return; net = null; isHost = true; myId = 'h'; fresh(); players.clear(); addPlayer('h', name, SET.hat); startGame(); }
function myName() {
  const n = $('name').value.trim(); if (n.length < 2) { $('menu-msg').textContent = 'Type a keeper name first (2+ letters).'; return null; }
  if (!ok(n)) { $('menu-msg').textContent = 'Pick a different name, please.'; return null; }
  SET.name = n; save(); actx.resume(); return n;
}

// ---------------------------------------------------------------- menus
function wireMenus() {
  $('ver').textContent = VERSION; $('name').value = SET.name;
  $('hats').innerHTML = HATS.map((h, i) => `<div class="hat ${i === SET.hat ? 'on' : ''}" data-hat="${i}" style="background:${COLORS[i]}">${h}</div>`).join('');
  $('hats').onclick = e => { const h = e.target.closest('[data-hat]'); if (!h) return; SET.hat = +h.dataset.hat; save(); document.querySelectorAll('.hat').forEach((el, i) => el.classList.toggle('on', i === SET.hat)); sound.ui('click'); };
  $('btn-host').onclick = host; $('btn-join').onclick = join; $('btn-solo').onclick = solo; $('join-code').onkeydown = e => { if (e.key === 'Enter') join(); e.stopPropagation(); };
  $('btn-quit').onclick = () => window.electronAPI?.quit ? window.electronAPI.quit() : window.close();
  $('btn-start').onclick = () => { if (isHost && G.phase === 'lobby') startGame(); };
  $('btn-leave').onclick = () => leave(); $('btn-leave2').onclick = () => leave(); $('btn-end').onclick = () => leave();
  $('btn-resume').onclick = () => closeOverlay();
  const openSet = () => { $('set-vol').value = SET.vol; $('set-sens').value = SET.sens; $('set-quality').value = SET.quality; $('set-voice').value = SET.voice; $('set-vox').value = SET.vox; show('settings-over'); };
  // key binds: click the button, then press the key you want
  let binding = null;
  const showKeys = () => { for (const k of ['pttKey', 'radioKey']) { $('bind-' + k).textContent = binding === k ? 'Press a key...' : keyName(SET[k]); $('k-' + k).textContent = keyName(SET[k]); } };
  for (const k of ['pttKey', 'radioKey']) $('bind-' + k).onclick = e => { binding = k; showKeys(); e.target.blur(); };
  addEventListener('keydown', e => { if (!binding) return; e.preventDefault(); e.stopImmediatePropagation(); if (e.code !== 'Escape') { const other = binding === 'pttKey' ? 'radioKey' : 'pttKey'; if (SET[other] === e.code) SET[other] = SET[binding]; SET[binding] = e.code; save(); } binding = null; showKeys(); }, true);
  showKeys();
  $('btn-settings').onclick = openSet; $('btn-settings2').onclick = openSet;
  $('set-vol').oninput = e => { SET.vol = +e.target.value; sound.setVolume(SET.vol / 100); save(); }; $('set-sens').oninput = e => { SET.sens = +e.target.value; save(); };
  $('set-quality').onchange = e => { SET.quality = e.target.value; save(); }; $('set-voice').onchange = e => { SET.voice = e.target.value; voice?.setMode(SET.voice); save(); }; $('set-vox').oninput = e => { SET.vox = +e.target.value; if (voice) voice.voxGate = voxGate(); save(); };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { const o = e.target.closest('.over'); if (o.id === 'settings-over') show('settings-over', false); else closeOverlay(); sound.ui('click'); }
    const b = e.target.closest('[data-buy]'); if (b) { act('buy', { id: b.dataset.buy }); setTimeout(fillShop, 150); setTimeout(fillShop, 600); }
  });
  for (const [id, c] of [['tw-seal', 'seal'], ['tw-free', 'free'], ['tw-truth', 'truth']]) $(id).onclick = () => { act('tower', { c }); closeOverlay(); };
  canvas.addEventListener('click', () => { actx.resume(); if (started && !overlay) input.lock(); });
  input.onLockChange = on => { if (!on && started && !overlay && document.activeElement !== $('chat-in') && G.phase !== 'menu') openOverlay('pause-over'); };
  addEventListener('keydown', e => { if (e.code === 'Tab') e.preventDefault(); if (e.code === 'Escape' && overlay && overlay !== 'end-over') closeOverlay(overlay !== 'pause-over'); });
  $('chat-in').addEventListener('keydown', e => { if (e.code !== 'Enter') e.stopPropagation(); });
  $('name').addEventListener('keydown', e => e.stopPropagation());
  show('help', SET.help);
}

// ---------------------------------------------------------------- boot
(async function boot() {
  try {
    await loadAll(renderer, actx, k => { $('loadbar').firstChild.style.width = Math.round(k * 100) + '%'; });
    $('loadtext').textContent = 'Planting 25 kinds of bean tree...'; await new Promise(r => setTimeout(r, 30));
    scene.environment = A.env;
    world = new World(scene, SET.quality); animals = new Animals(scene, world); fx = new Fx(scene, world, SET.quality); sound = new Sound(actx); sound.setVolume(SET.vol / 100);
    input = new Input(canvas); fresh(); G.phase = 'menu'; player = new Player(world, G.up);
    animals.onFx = (kind, a) => animalFx(kind, a, false);
    world.onSlam = () => { const g = world.mainGate; sound.slam(g.x, g.y + 3, g.z); bump(g.x, g.z, 1.6, 120); fx.dust(g.x, g.y, g.z - 1, 40); fx.dust(g.x - 3, g.y, g.z - 1, 20); fx.dust(g.x + 3, g.y, g.z - 1, 20); banner('SLAM!', 'See you in five days.', '#ff5d73'); };
    wireMenus(); show('loading', false); show('menu');
    let last = performance.now();
    const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); input.endFrame(); };
    requestAnimationFrame(loop);
    // for testing
    window.__nsz = { G, SET, me, players, get player() { return player; }, get world() { return world; }, get animals() { return animals; }, get sound() { return sound; }, get input() { return input; }, get voice() { return voice; }, get net() { return net; }, camera, renderer, scene, act, ev, startNight, startDay, endGame, wipe, hurtMe, solo, host, addPlayer, openOverlay, closeOverlay, findTarget, get dbg() { return { holdT, holdKey, holdDone, overlay, started }; },
      step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { frame(dt); input.endFrame(); } }, tp(x, z) { player.pos.set(x, world.standAt(x, z) + 0.1, z); player.vel.set(0, 0, 0); }, look(yaw, pitch = 0) { lookYaw = yaw; lookPitch = pitch; } };
  } catch (e) { console.error(e); $('loadtext').textContent = 'Something broke: ' + (e.message || e); }
})();
