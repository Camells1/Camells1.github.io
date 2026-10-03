// Everything drawn on top of the game: the clock, the clipboard, toasts, radio calls, the map.
import { ZONES, PLACES, PATHS, WORLD, REVIVE } from './config.js';
import { esc } from './util.js';

export const $ = id => document.getElementById(id);
export const show = (id, on = true) => $(id).classList.toggle('hide', !on);
export const COLORS = ['#ff8a3c', '#35c4b0', '#ff6fa5', '#ffd23c'];
export const HATS = ['🧢', '🤠', '🚁', '🚧'];

export function toast(text, kind = '') {
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast card ' + kind; el.textContent = text; box.prepend(el);
  while (box.children.length > 5) box.lastChild.remove();
  setTimeout(() => el.remove(), 6000);
}
let bannerT = 0;
export function banner(title, sub = '', color = '#fff') {
  $('banner-title').textContent = title; $('banner-title').style.color = color; $('banner-sub').textContent = sub;
  const b = $('banner'); b.classList.add('hide'); void b.offsetWidth; b.classList.remove('hide');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.add('hide'), 4200);
}
// Radio calls queue up and type themselves out
const queue = []; let busy = false;
export function radio(who, text, beep) {
  queue.push([who, text, beep]); if (!busy) next();
}
function next() {
  const q = queue.shift(); if (!q) { busy = false; show('radio', false); return; }
  busy = true; const [who, text, beep] = q; beep?.();
  show('radio'); $('radio-who').textContent = '📻 ' + who + ':'; const el = $('radio-text'); el.textContent = '';
  let i = 0; const iv = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(iv); setTimeout(next, 2200 + text.length * 28); } }, 24);
}
let lastTasks = '';
export function setTasks(title, list) {
  const html = list.map(t => `<li class="${t.done ? 'done' : t.bad ? 'bad' : ''}">${esc(t.text)}</li>`).join('');
  if (html === lastTasks) return; lastTasks = html; $('tasks').innerHTML = html; $('board-title').textContent = title;
}
let lastTeam = '';
export function setTeam(list) {
  const html = list.map(p => `<div class="mate card ${p.down ? 'dead' : ''} ${p.talk ? 'talk' : ''}"><span class="dot" style="background:${p.color}"></span><span>${p.down ? '💀' : ''}${esc(p.name)}${p.me ? ' (you)' : ''}</span><span class="hpb"><i style="width:${Math.round(p.hp)}%"></i></span><span class="mic">${p.radio ? '📻' : '🎤'}</span></div>`).join('');
  if (html !== lastTeam) { lastTeam = html; $('team').innerHTML = html; }
}
export function setBar(id, v) { $(id).querySelector('i').style.width = Math.max(0, Math.min(100, v)) + '%'; }
let lastBar = '';
export function setHotbar(items) {
  const html = items.map((it, i) => `<div class="item card ${it.on ? 'on' : ''} ${it.off ? 'off' : ''}"><small>${i + 1}</small>${it.icon}${it.count != null ? `<em>${it.count}</em>` : ''}</div>`).join('');
  if (html !== lastBar) { lastBar = html; $('hotbar').innerHTML = html; }
}
export function chatLine(name, text, color = '#ffc93c') {
  const log = $('chat-log'), el = document.createElement('div'); el.innerHTML = `<b style="color:${color}">${esc(name)}:</b> ${esc(text)}`; log.append(el);
  while (log.children.length > 6) log.firstChild.remove(); setTimeout(() => el.remove(), 14000);
}

// The park map. s: { day, zones: {id: {breach, hunger}}, players: [{x, z, yaw, color, name, me, down}], loose: [{x, z}] | null, stations: [{x, z, cd}], time }
export function drawMap(cv, s) {
  const c = cv.getContext('2d'), W = cv.width, k = W / (WORLD.half * 2 + 60), X = x => (x + WORLD.half + 30) * k, Z = z => (z + WORLD.half + 12) * k;
  c.fillStyle = '#8fd67c'; c.fillRect(0, 0, W, W);
  c.strokeStyle = '#c9563e'; c.lineWidth = 6; c.strokeRect(X(-WORLD.half), Z(-WORLD.half), WORLD.half * 2 * k, WORLD.half * 2 * k);
  c.strokeStyle = '#e9d3a6'; c.lineWidth = 7; c.lineCap = c.lineJoin = 'round';
  for (const p of PATHS) { c.beginPath(); p.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))); c.stroke(); }
  c.fillStyle = '#5bc8ff'; c.beginPath(); c.arc(X(PLACES.lake.x), Z(PLACES.lake.z), PLACES.lake.r * k, 0, 7); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const zn of ZONES) {
    const open = zn.night <= s.day, zs = s.zones[zn.id], x = X(zn.x - zn.w / 2), z = Z(zn.z - zn.d / 2), w = zn.w * k, d = zn.d * k;
    c.fillStyle = open ? `rgb(${zn.theme.g.map(v => Math.round(Math.min(1, v * 1.25 + 0.12) * 255)).join(',')})` : '#9aa39a'; c.fillRect(x, z, w, d);
    const alarm = open && zs?.breach != null && Math.floor(s.time * 3) % 2;
    c.strokeStyle = alarm ? '#ff2a4a' : '#1b1630'; c.lineWidth = alarm ? 6 : 3; c.strokeRect(x, z, w, d);
    c.fillStyle = '#1b1630'; c.font = '800 12px Bahnschrift, sans-serif'; c.fillText(open ? zn.name : '🔒 Day ' + zn.night, x + w / 2, z + d / 2 - (open ? 7 : 0));
    if (open && zs) { c.font = '13px sans-serif'; c.fillText((zs.breach != null ? '🚨' : '') + (zs.hunger > 0.6 ? '🍽️' : '') + (zs.agit > 0.55 ? '😡' : zs.agit > 0.3 ? '😠' : '🙂'), x + w / 2, z + d / 2 + 9); }
  }
  c.font = '17px sans-serif';
  for (const [key, icon] of [['hq', '🏠'], ['store', '🪣'], ['generator', '⚡'], ['tower', '🗼'], ['court', '🍔'], ['play', '🛝'], ['gate', '🚪']]) c.fillText(icon, X(PLACES[key].x), Z(PLACES[key].z));
  c.fillText('🎁', X(40), Z(128));
  for (const st of s.stations) { c.globalAlpha = st.cd > 0 ? 0.4 : 1; c.fillText('💚', X(st.x), Z(st.z)); } c.globalAlpha = 1;
  if (s.loose) { c.fillStyle = '#ff2a4a'; for (const a of s.loose) { c.beginPath(); c.arc(X(a.x), Z(a.z), 4, 0, 7); c.fill(); } }
  for (const p of s.players) {
    c.save(); c.translate(X(p.x), Z(p.z)); c.fillStyle = p.color; c.strokeStyle = '#1b1630'; c.lineWidth = 2.5;
    if (p.me) { c.rotate(-p.yaw); c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); }
    else { c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#1b1630'; c.font = '800 11px Bahnschrift, sans-serif'; c.fillText((p.down ? '💀 ' : '') + p.name, 0, -13); }
    c.restore();
  }
}
