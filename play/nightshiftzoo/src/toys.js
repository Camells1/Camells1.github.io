// Every object in the zoo is a chunky toy: bushes made of blobs, lamp posts with eyes and little arms,
// bins with their mouths open, pill-shaped barrels, pebble rocks. Each builder returns one merged shape
// with its colours baked in, one unit tall, standing on y = 0 and facing +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './util.js';

const TAU = Math.PI * 2;
const C = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const WHITE = [2.4, 2.4, 2.4], BLACK = [0.015, 0.015, 0.02];
function paint(g, col) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col[0]; a[i * 3 + 1] = col[1]; a[i * 3 + 2] = col[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const place = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const ball = (r, x, y, z, col, s) => { const g = new THREE.SphereGeometry(r, 14, 10); if (s) g.scale(...s); return paint(place(g, x, y, z), col); };
const cap = (r, len, x, y, z, col, rx = 0, rz = 0, ry = 0) => paint(place(new THREE.CapsuleGeometry(r, len, 4, 12), x, y, z, rx, ry, rz), col);
const cyl = (rt, rb, h, x, y, z, col, rx = 0, rz = 0) => paint(place(new THREE.CylinderGeometry(rt, rb, h, 16), x, y, z, rx, 0, rz), col);
const cone = (r, h, x, y, z, col, rx = 0, rz = 0) => paint(place(new THREE.ConeGeometry(r, h, 12), x, y, z, rx, 0, rz), col);
const torus = (R, r, x, y, z, col, rx = Math.PI / 2) => paint(place(new THREE.TorusGeometry(R, r, 8, 20), x, y, z, rx), col);
// A box with every edge rounded off, like a bar of soap
function rbox(sx, sy, sz, x, y, z, col, ry = 0, rz = 0) {
  const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position, e = 0.3;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, Math.sign(p.getX(i)) * Math.abs(p.getX(i)) ** e * sx / 2, Math.sign(p.getY(i)) * Math.abs(p.getY(i)) ** e * sy / 2, Math.sign(p.getZ(i)) * Math.abs(p.getZ(i)) ** e * sz / 2);
  g.computeVertexNormals(); return paint(place(g, x, y, z, 0, ry, rz), col);
}
// Two googly eyes looking out along +z, one pupil a bit off because nobody here is quite right
const eyes = (x, y, z, r, gap) => [ball(r, x - gap, y, z, WHITE), ball(r * 1.12, x + gap, y, z, WHITE), ball(r * 0.46, x - gap + r * 0.15, y - r * 0.1, z + r * 0.72, BLACK), ball(r * 0.5, x + gap - r * 0.1, y + r * 0.18, z + r * 0.8, BLACK)];

const GREENS = [0x5fd06a, 0x43b869, 0x8bdc5a, 0x35b58a];
function bush(seed, flowers, face) {
  const R = rng(700 + seed * 31), parts = [], n = 5 + Math.floor(R() * 3), base = C(GREENS[seed % GREENS.length]);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + R(), d = i ? 0.22 + R() * 0.2 : 0, r = i ? 0.24 + R() * 0.16 : 0.42, k = 0.85 + R() * 0.3; parts.push(ball(r, Math.cos(a) * d, r * 0.85 + (i ? R() * 0.12 : 0.1), Math.sin(a) * d, base.map(c => c * k), [1, 0.88, 1])); }
  if (flowers) for (let i = 0; i < 11; i++) { const a = R() * TAU, e = 0.3 + R() * 1.0, d = 0.5; parts.push(ball(0.065, Math.cos(a) * Math.cos(e) * d, 0.3 + Math.sin(e) * 0.42, Math.sin(a) * Math.cos(e) * d, C([0xff6fa5, 0xffd23c, 0xffffff, 0xc38bff][i % 4]).map(c => c * 1.3))); }
  if (face) parts.push(...eyes(0, 0.5, 0.4, 0.1, 0.13));
  return parts;
}
const ROCK = [0x9c95ad, 0x8b93a8, 0xa9a0b4];
function rock(seed, n, face) {
  const R = rng(900 + seed * 17), parts = [];
  for (let i = 0; i < n; i++) {
    const r = i ? 0.3 + R() * 0.15 : 0.5, g = new THREE.SphereGeometry(r, 14, 10), p = g.attributes.position, ph = R() * 9;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), b = 1 + 0.09 * Math.sin(x * 7 + ph) * Math.cos(z * 6 + y * 5); p.setXYZ(k, x * b, y * b * 0.68, z * b * 0.9); }
    g.computeVertexNormals(); const a = R() * TAU, d = i ? 0.42 : 0;
    parts.push(paint(place(g, Math.cos(a) * d, r * 0.5, Math.sin(a) * d), C(ROCK[(seed + i) % 3]).map(c => c * (0.9 + R() * 0.2))));
  }
  if (face) parts.push(...eyes(0, 0.42, 0.4, 0.075, 0.12));
  return parts;
}

// name -> { build(): geometries, sway: plants that move in the wind }
const TOYS = {
  bush: { sway: 0.03, build: v => bush(v, false, v === 2) },
  bush_flowers: { sway: 0.03, build: v => bush(v + 5, true, false) },
  hedge: { sway: 0.012, build: v => [rbox(1.7, 0.85, 0.8, 0, 0.44, 0, C(0x3fae5c)), ball(0.3, -0.5, 0.86, 0, C(0x52c46c)), ball(0.36, 0.1, 0.9, 0.05, C(0x52c46c)), ball(0.26, 0.6, 0.84, -0.05, C(0x52c46c)), ...(v % 2 ? eyes(0, 0.55, 0.37, 0.09, 0.14) : [])] },
  // a lamp post who is trying its best: little arms, worried eyes, a cup that holds the glowing bulb
  streetlight: { build: () => [ball(0.36, 0, 0.16, 0, C(0x4a4fb8), [1, 0.5, 1]), cap(0.12, 3.9, 0, 2.2, 0, C(0x6a6ff0)), torus(0.15, 0.05, 0, 1.0, 0, C(0xffc93c)), torus(0.15, 0.05, 0, 4.1, 0, C(0xffc93c)),
    cone(0.44, 0.5, 0, 4.45, 0, C(0xffc93c), Math.PI), ...eyes(0, 3.55, 0.1, 0.1, 0.1), cap(0.05, 0.42, -0.3, 3.0, 0, C(0x6a6ff0), 0, 0.9), cap(0.05, 0.42, 0.3, 3.0, 0, C(0x6a6ff0), 0, -0.9), ball(0.08, -0.5, 3.14, 0, C(0xffc93c)), ball(0.08, 0.5, 3.14, 0, C(0xffc93c))] },
  bench: { build: () => [...[-0.15, 0, 0.15].map(z => cap(0.065, 1.5, 0, 0.47, z, C(0x35c4b0), 0, Math.PI / 2)), ...[0.74, 0.94].map(y => cap(0.065, 1.5, 0, y, -0.27, C(0x35c4b0), 0, Math.PI / 2)),
    ...[-0.68, 0.68].flatMap(x => [cap(0.07, 0.34, x, 0.22, 0.12, C(0xff6fa5)), cap(0.07, 0.88, x, 0.5, -0.27, C(0xff6fa5)), cap(0.06, 0.3, x, 0.6, -0.08, C(0xff6fa5), Math.PI / 2)])] },
  // a bin that is always hungry
  trashcan: { build: () => [cyl(0.32, 0.27, 0.8, 0, 0.4, 0, C(0xff8a3c)), ball(0.35, 0, 0.84, -0.03, C(0xe5682a), [1, 0.42, 1]), ball(0.07, 0, 1.0, -0.03, C(0xffc93c)), ball(0.2, 0, 0.36, 0.25, BLACK, [1, 0.7, 0.4]), ...eyes(0, 0.63, 0.29, 0.085, 0.11)] },
  crate: { build: () => [rbox(1, 1, 1, 0, 0.5, 0, C(0xe0aa5e)), rbox(1.05, 0.13, 1.05, 0, 0.2, 0, C(0xb9773d)), rbox(1.05, 0.13, 1.05, 0, 0.8, 0, C(0xb9773d)), rbox(0.13, 1.03, 1.05, -0.36, 0.5, 0, C(0xb9773d)), rbox(0.13, 1.03, 1.05, 0.36, 0.5, 0, C(0xb9773d))] },
  barrel: { build: () => [cap(0.42, 0.34, 0, 0.59, 0, C(0xd0854c)), torus(0.43, 0.04, 0, 0.36, 0, C(0x6f7a9a)), torus(0.43, 0.04, 0, 0.82, 0, C(0x6f7a9a)), ball(0.3, 0, 1.12, 0, C(0xa9683a), [1, 0.25, 1])] },
  dumpster: { build: () => [rbox(1.9, 1.0, 1.15, 0, 0.62, 0, C(0x4fb873)), rbox(2.0, 0.16, 1.25, 0, 1.24, -0.04, C(0x2f8a52), 0, 0.09), ...eyes(0.1, 1.12, 0.5, 0.12, 0.17), ...[[-0.7, 0.45], [0.7, 0.45], [-0.7, -0.45], [0.7, -0.45]].map(([x, z]) => ball(0.13, x, 0.13, z, C(0x33384a)))] },
  barrier: { build: () => [...[-0.75, 0.75].flatMap(x => [cap(0.055, 0.8, x, 0.46, 0, C(0xf2f2f2)), rbox(0.16, 0.1, 0.6, x, 0.05, 0, C(0x474c66))]), ...[0, 1, 2, 3, 4].map(i => rbox(0.36, 0.26, 0.1, -0.68 + i * 0.34, 0.74, 0, C(i % 2 ? 0xffffff : 0xe5484d)))] },
  arrow_sign: { build: () => [cap(0.05, 0.9, 0, 0.5, 0, C(0xbd7f45)), ball(0.12, 0, 0.06, 0, C(0x8a5a30), [1, 0.5, 1]), rbox(0.62, 0.24, 0.08, -0.05, 0.84, 0, C(0xffc93c)), cone(0.24, 0.3, 0.4, 0.84, 0, C(0xffc93c), 0, -Math.PI / 2), ball(0.05, 0, 1.0, 0, C(0xe5484d))] },
  rock1: { build: v => rock(1 + v, 1, false) },
  rock2: { build: v => rock(5 + v, 2, true) },
  rock_large: { build: v => rock(9 + v, 3, false) },
  bucket: { build: () => [cyl(0.5, 0.38, 0.8, 0, 0.4, 0, C(0x9aa8b8)), ball(0.46, 0, 0.8, 0, C(0xf2cc50), [1, 0.4, 1]), torus(0.5, 0.03, 0, 0.82, 0, C(0x6f7a9a))] },
  bucket_fish: { build: () => [cyl(0.5, 0.38, 0.8, 0, 0.4, 0, C(0x9aa8b8)), ball(0.46, 0, 0.8, 0, C(0xe0564e), [1, 0.4, 1]), torus(0.5, 0.03, 0, 0.82, 0, C(0x6f7a9a)), ball(0.16, 0.12, 0.98, 0.1, C(0xf0a0a0), [1, 0.6, 1.4])] }
};

// The finished toy: { geometry (one unit tall), radius (how wide, in units of its height), sway } or null if we don't make that
export function toy(name) {
  const [base, v] = name.split(':'), def = TOYS[base]; if (!def) return null;
  const geo = mergeGeometries(def.build(+(v || 0)).map(g => g.index ? g.toNonIndexed() : g)); geo.computeBoundingBox();
  const b = geo.boundingBox, h = b.max.y - b.min.y, k = 1 / h;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(k, k, k);
  return { geometry: geo, radius: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * k / 2, sway: def.sway || 0 };
}
