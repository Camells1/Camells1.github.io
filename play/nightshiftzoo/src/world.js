// The zoo: ground, paths, eight enclosures with breakable fences and gates, the entrance plaza,
// the Keepers' Lodge, feed store, generator shed, control tower, food court, playground, pond,
// hundreds of trees and props, and a light map so every lamp casts a pool of light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD, ZONES, PLACES, PATHS, NOTES, REVIVE } from './config.js';
import { rng, clamp, lerp, smooth, fbm } from './util.js';
import { A, instance } from './assets.js';
import { toy } from './toys.js';
import { patchMaterial, propUniforms, ramp, lightUniforms, withLight, toon } from './materials.js';
export { lightUniforms, withLight };

const TAU = Math.PI * 2, CHUNKS = 4, SEG = 4;
const FENCE = { wood: { h: 2.3, hp: 100 }, metal: { h: 3.4, hp: 170 }, heavy: { h: 5.2, hp: 320 } };
const EMPTY = [];


const templates = new Map();
let toyMat = null, plantMats = new Map();
// Every prop is one of our own toys (toys.js): one shape, colours baked in, cartoon shading
function template(name) {
  if (templates.has(name)) return templates.get(name);
  const t0 = toy(name); if (!t0) throw new Error('No such prop: ' + name);
  toyMat ||= withLight(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
  if (t0.sway && !plantMats.has(t0.sway)) plantMats.set(t0.sway, withLight(patchMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }), 'plant', { sway: t0.sway })));
  const t = { parts: [{ geometry: t0.geometry, material: t0.sway ? plantMats.get(t0.sway) : toyMat, matrix: new THREE.Matrix4() }], radius: t0.radius, height: 1, shadow: true };
  templates.set(name, t);
  return t;
}


// ---------------------------------------------------------------- bean trees
// Twenty-five trees made of beans and blobs: lollipops, clouds, tall beans, stacked pines, palms with
// coconuts, bare twisty ones, forked ones and blossom trees. A few of them are watching you.
const TREE_TYPES = 8, TREE_COUNT = 25;
function paint(geo, r, g, b) { const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
function blob(r, x, y, z, sy = 1, col = [0.86, 1, 0.8]) { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(1, sy, 1); g.translate(x, y, z); return paint(g, ...col); }
function stick(r, len, x, y, z, rx = 0, rz = 0, col = [0.5, 0.33, 0.22]) { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, len / 2 + r, 0); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return paint(g, ...col); }
function beanTree(i) {
  const R = rng(4000 + i * 131), type = i % TREE_TYPES, parts = [], leaf = [0.78 + R() * 0.2, 1, 0.72 + R() * 0.2], bark = [1.05 + R() * 0.2, 0.52 + R() * 0.08, 0.28 + R() * 0.06];   // strong, so the leaf tint can't turn it green
  const th = [0.42, 0.36, 0.3, 0.14, 0.62, 0.5, 0.34, 0.4][type] * (0.9 + R() * 0.2), tr = 0.05 + R() * 0.02, lean = (R() - 0.5) * 0.3;
  parts.push(stick(tr, th, 0, 0, 0, 0, lean, bark));
  const tx = -Math.sin(lean) * th, ty = Math.cos(lean) * th + tr;      // top of the trunk
  if (type === 0) parts.push(blob(0.3 + R() * 0.06, tx, ty + 0.24, 0, 0.92, leaf));
  else if (type === 1) { for (let k = 0; k < 5 + (i % 3); k++) { const a = k * 2.4, d = 0.12 + R() * 0.1; parts.push(blob(0.15 + R() * 0.1, tx + Math.cos(a) * d, ty + 0.14 + R() * 0.22, Math.sin(a) * d, 0.9, leaf)); } }
  else if (type === 2) { const g = new THREE.CapsuleGeometry(0.19 + R() * 0.04, 0.34, 6, 14); g.translate(tx, ty + 0.34, 0); parts.push(paint(g, ...leaf)); }
  else if (type === 3) { for (let k = 0; k < 4; k++) parts.push(blob(0.3 - k * 0.06, tx, ty + 0.1 + k * 0.2, 0, 0.62, leaf.map(c => c * (0.82 + k * 0.05)))); }
  else if (type === 4) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + R(); parts.push(stick(0.07, 0.34, tx, ty - 0.02, 0, Math.cos(a) * 1.9, Math.sin(a) * 1.9, leaf)); } for (let k = 0; k < 3; k++) parts.push(blob(0.05, tx + Math.cos(k * 2.1) * 0.07, ty - 0.03, Math.sin(k * 2.1) * 0.07, 1, [0.42, 0.28, 0.16])); }
  else if (type === 5) { for (let k = 0; k < 4; k++) { const a = k * 1.7 + R(); parts.push(stick(tr * 0.6, 0.2 + R() * 0.16, tx, ty - 0.05 - k * 0.06, 0, Math.cos(a) * 0.9, Math.sin(a) * 0.9, bark)); } if (i % 2) parts.push(blob(0.08, tx + 0.16, ty + 0.14, 0, 1, leaf)); }
  else if (type === 6) { for (const sd of [-1, 1]) { parts.push(stick(tr * 0.75, 0.24, tx, ty - 0.04, 0, 0, sd * -0.7, bark)); parts.push(blob(0.2 + R() * 0.05, tx + sd * 0.2, ty + 0.3, 0, 0.95, leaf)); } }
  else { for (let k = 0; k < 5; k++) { const a = k * 2.4; parts.push(blob(0.17 + R() * 0.07, tx + Math.cos(a) * 0.14, ty + 0.16 + R() * 0.18, Math.sin(a) * 0.14, 0.9, leaf)); } for (let k = 0; k < 14; k++) { const a = R() * TAU, e = R() * 1.3; parts.push(blob(0.035, tx + Math.cos(a) * Math.cos(e) * 0.3, ty + 0.26 + Math.sin(e) * 0.24, Math.sin(a) * Math.cos(e) * 0.3, 1, [1.6, 0.75, 1.1])); } }
  if (i % 6 === 0 && type !== 5 && type !== 4) { // this one has a face
    const ey = ty + 0.22, ez = type === 3 ? 0.27 : 0.26;
    for (const sd of [-1, 1]) { parts.push(blob(0.07, tx + sd * 0.1, ey, ez, 1, [3, 3, 3])); parts.push(blob(0.032, tx + sd * 0.1 + 0.012, ey - 0.01, ez + 0.055, 1, [0.02, 0.02, 0.02])); }
  }
  const geo = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); geo.computeVertexNormals();
  let top = 0; const p = geo.attributes.position; for (let k = 0; k < p.count; k++) top = Math.max(top, p.getY(k));
  geo.scale(1 / top, 1 / top, 1 / top);
  return geo;
}
let treeMat = null;
function registerTrees() {
  if (templates.has('bt:0')) return;
  treeMat = withLight(patchMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }), 'plant', { sway: 0.012 }));
  for (let i = 0; i < TREE_COUNT; i++) templates.set('bt:' + i, { parts: [{ geometry: beanTree(i), material: treeMat, matrix: new THREE.Matrix4() }], radius: 0.3, height: 1, shadow: true });
}
// which shapes of tree grow where
const TREES_BY_ZONE = { wolves: [3, 3, 3, 2], savanna: [4, 5, 4], meadow: [0, 7, 1, 7], foxes: [1, 6, 0], raptors: [4, 2, 1, 4], nighthouse: [5, 5, 0], valley: [5, 4], rex: [5] };

// ---------------------------------------------------------------- blocks for buildings
class Builder {
  constructor(world) { this.w = world; this.parts = new Map(); }
  _add(mat, geo, x, z) { const key = mat + '|' + this.w.chunkOf(x, z); if (!this.parts.has(key)) this.parts.set(key, []); this.parts.get(key).push(geo); }
  // A block standing on height y. o: { ry, walk, collide, under (open underneath) }
  box(mat, x, y, z, sx, sy, sz, o = {}) {
    const g = new THREE.BoxGeometry(sx, sy, sz); g.rotateY(o.ry || 0); g.translate(x, y + sy / 2, z); this._add(mat, g, x, z);
    if (o.collide !== false) this.w.addBox({ x, z, hx: sx / 2, hz: sz / 2, ry: o.ry || 0, top: y + sy, bottom: o.under ? y : undefined, walk: o.walk !== false });
  }
  cyl(mat, x, y, z, rTop, rBot, h, o = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 16); g.translate(x, y + h / 2, z); this._add(mat, g, x, z);
    if (o.collide !== false) this.w.addCollider({ x, z, r: Math.max(rTop, rBot), top: y + h, walk: o.walk !== false });
  }
  // A loaf-shaped roof: half a squashed cylinder lying along the building
  loaf(mat, x, y, z, w, d, rise, ry = 0) {
    const g = new THREE.CylinderGeometry(w / 2, w / 2, d, 20, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2); g.scale(1, rise / (w / 2), 1); g.rotateY(ry); g.translate(x, y, z); this._add(mat, g, x, z);
    this.w.addBox({ x, z, hx: w / 2, hz: d / 2, ry, top: y + rise, bottom: y, walk: false });
  }
  ball(mat, x, y, z, r, s) { const g = new THREE.SphereGeometry(r, 14, 10); if (s) g.scale(...s); g.translate(x, y, z); this._add(mat, g, x, z); }
  finish(mats) {
    for (const [key, list] of this.parts) { const [mat, chunk] = key.split('|'); const mesh = new THREE.Mesh(mergeGeometries(list), mats[mat]); mesh.castShadow = mesh.receiveShadow = true; this.w.chunks[+chunk].add(mesh); for (const g of list) g.dispose(); }
    this.parts.clear();
  }
}

export class World {
  constructor(scene, quality = 'medium') {
    this.scene = scene; this.quality = quality; this.density = quality === 'low' ? 0.55 : 1;
    this.group = new THREE.Group(); scene.add(this.group);
    this.cells = new Map(); this.placed = new Map(); this.chunks = [];
    this.lamps = []; this.segments = []; this.gates = []; this.troughs = []; this.points = []; this.notes = []; this.anim = [];
    const step = WORLD.size / CHUNKS;
    for (let ci = 0; ci < CHUNKS; ci++) for (let cj = 0; cj < CHUNKS; cj++) { const g = new THREE.Group(); g.userData.cx = -WORLD.size / 2 + (ci + 0.5) * step; g.userData.cz = -WORLD.size / 2 + (cj + 0.5) * step; this.chunks[ci * CHUNKS + cj] = g; this.group.add(g); }
    this.R = rng(8841);
    this.B = new Builder(this);
    this.mats = { brick: toon(0xc9563e), concrete: toon(0xddd6c8), planks: toon(0xbd7f45), iron: toon(0x6f93ab), rust: toon(0xc77f48), floor: toon(0xd3c9ba), dark: toon(0x474c66), paint: toon(0xe5484d), teal: toon(0x2fb5a6), cream: toon(0xf5e8c6), brickdark: toon(0x9c3f2e), yellow: toon(0xffc93c), glass: toon(0x9fdcff), white: toon(0xffffff) };

    // Level ground under each building (x, z, radius); everything else rolls with the hills
    this.pads = [[PLACES.plaza.x, PLACES.plaza.z, 40], [PLACES.hq.x, PLACES.hq.z, 13], [PLACES.store.x, PLACES.store.z, 11], [PLACES.generator.x, PLACES.generator.z, 9], [PLACES.tower.x, PLACES.tower.z, 9],
      [PLACES.yard.x, PLACES.yard.z, 20], [40, 128, 10], [PLACES.court.x, PLACES.court.z - 6, 20], [PLACES.play.x, PLACES.play.z + 3, 13], [0, 190, 22], [0, 224, 17, 0, 190], [-138, -174, 22]];   // (the road outside sits level with the gate)
    this._heights();
    this._zones();
    this._places();
    this._scatter();
    this._perimeter();
    this._ground();
    this._lightmap();
    this._build();
    this.B.finish(this.mats);
  }

  // ---------------------------------------------------------------- shape of the land
  pathDist(x, z) {
    let best = 1e9;
    for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  }
  // The look of the land at a point: ground colour, path colour, tree tint (blended between neighbouring zones)
  themeAt(x, z) {
    const n1 = fbm(x * 0.009 + 11, z * 0.009, 5, 2), n2 = fbm(x * 0.013, z * 0.013 + 7, 6, 2);
    // open parkland drifts between fresh green, yellow-green and blue-green
    const g = [0.30 + n1 * 0.22 + n2 * 0.05, 0.62 + n2 * 0.12, 0.26 - n1 * 0.12 + n2 * 0.1], tint = [0.9 + n1 * 0.3, 1, 0.8 - n1 * 0.3];
    let wsum = 1e-6, mix = [0, 0, 0], tmix = [0, 0, 0], zone = null, flowers = Math.max(0, n2 * 2.2 - 0.4);
    for (const zn of ZONES) {
      const dx = Math.max(Math.abs(x - zn.x) - zn.w / 2, 0), dz = Math.max(Math.abs(z - zn.z) - zn.d / 2, 0), d = Math.hypot(dx, dz);
      if (d > 46) continue;
      const w = d <= 0 ? 6 : (1 - d / 46) ** 2; if (d <= 0) zone = zn;
      wsum += w; for (let i = 0; i < 3; i++) { mix[i] += zn.theme.g[i] * w; tmix[i] += zn.theme.tint[i] * w; }
      if (zn.theme.flowers && d < 10) flowers = 1;
    }
    const k = Math.min(1, wsum * 1.2);
    const col = g.map((v, i) => lerp(v, mix[i] / wsum, k)), tcol = tint.map((v, i) => lerp(v, tmix[i] / wsum, k));
    // paths: lavender cobbles by the entrance, warm sand in the west, slate in the Paleo Wing, mossy in the north
    const path = z > 110 ? [0.74, 0.62, 0.86] : x > 60 ? [0.50, 0.58, 0.66] : z < -110 ? [0.46, 0.56, 0.44] : [0.84, 0.70, 0.50];
    return { col, tint: tcol, path, zone, flowers, tex: zone?.theme.tex };
  }
  zoneAt(x, z, pad = 0) { return ZONES.find(zn => Math.abs(x - zn.x) < zn.w / 2 + pad && Math.abs(z - zn.z) < zn.d / 2 + pad); }
  // The lie of the land: big rolling hills, a hollow for the pond, mountains beyond the wall
  hill(x, z) { return fbm(x * 0.0065 + 3.1, z * 0.0065, 7, 3) * 26 + fbm(x * 0.021, z * 0.021, 9, 3) * 5 + Math.sin(x * 0.011) * Math.cos(z * 0.013) * 5; }
  _heights() {
    const N = this.N = 260, S = WORLD.size; this.step = S / N;
    this.h = new Float32Array((N + 1) * (N + 1)); this.splat = new Float32Array((N + 1) * (N + 1) * 4); // forest, dry, mud, cobble
    this.gcol = new Float32Array((N + 1) * (N + 1) * 3); this.pcol = new Float32Array((N + 1) * (N + 1) * 4); // ground colour; path colour + flowers
    const pads = this.pads.map(([x, z, r, hx, hz]) => [x, z, r, this.hill(hx ?? x, hz ?? z)]);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = -S / 2 + i * this.step, z = -S / 2 + j * this.step, k = j * (N + 1) + i;
      const pd = this.pathDist(x, z);
      let h = this.hill(x, z), plaza = false;
      for (const [px, pz, pr, ph] of pads) { const d = Math.hypot(x - px, z - pz); if (d < pr * 1.7) { h = lerp(ph, h, smooth(pr * 0.75, pr * 1.7, d)); if (d < pr * 0.95 && pr > 15 && px !== -138) plaza = true; } }
      const pond = Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) / PLACES.lake.r;
      if (pond < 1.8) h = lerp(h, this.hill(PLACES.lake.x, PLACES.lake.z) - 2.2, smooth(1.8, 0.7, pond));
      const out = Math.max(Math.abs(x), Math.abs(z)) - WORLD.half; if (out > 0) h += smooth(0, 50, out) * 22 * (z > 0 ? smooth(18, 46, Math.abs(x)) : 1); // mountains beyond the wall (but not on the road in)
      this.h[k] = h;
      const n = fbm(x * 0.06, z * 0.06, 3, 2), th = this.themeAt(x, z);
      this.splat[k * 4] = th.tex === 'forest' ? 1 : clamp(n * 1.6, 0, 0.5);
      this.splat[k * 4 + 1] = th.tex === 'dry' ? 1 : 0;
      for (let c = 0; c < 3; c++) { this.gcol[k * 3 + c] = th.col[c]; this.pcol[k * 4 + c] = th.path[c]; }
      this.pcol[k * 4 + 3] = th.flowers;
      this.splat[k * 4 + 2] = pond < 1.25 ? smooth(1.25, 0.95, pond) : 0;
      this.splat[k * 4 + 3] = plaza ? 1 : smooth(2.6, 1.7, pd);
    }
    this.pondY = this.hill(PLACES.lake.x, PLACES.lake.z) - 1.15;
  }
  heightAt(x, z) {
    const N = this.N, S = WORLD.size, fx = clamp((x + S / 2) / this.step, 0, N - 0.001), fz = clamp((z + S / 2) / this.step, 0, N - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * (N + 1) + i;
    return lerp(lerp(this.h[k], this.h[k + 1], u), lerp(this.h[k + N + 1], this.h[k + N + 2], u), v);
  }
  footY(x, z, r = 0.6) { let y = this.heightAt(x, z); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; y = Math.min(y, this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return y; }
  surfaceAt(x, z) {
    if (this.pathDist(x, z) < 2.4 || this.pads.some(([px, pz, pr]) => pr > 15 && Math.hypot(x - px, z - pz) < pr * 0.95)) return 'stone';
    return this.zoneAt(x, z)?.ground === 'dry' ? 'sand' : 'grass';
  }
  chunkOf(x, z) { const st = WORLD.size / CHUNKS, h = WORLD.size / 2; return clamp(Math.floor((x + h) / st), 0, CHUNKS - 1) * CHUNKS + clamp(Math.floor((z + h) / st), 0, CHUNKS - 1); }

  _ground() {
    const N = this.N, S = WORLD.size, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, w = new Float32Array(pos.count * 4), gc = new Float32Array(pos.count * 3), pc = new Float32Array(pos.count * 4);
    for (let k = 0; k < pos.count; k++) {
      const i = Math.round((pos.getX(k) + S / 2) / this.step), j = Math.round((pos.getZ(k) + S / 2) / this.step), s = j * (N + 1) + i; pos.setY(k, this.h[s]);
      for (let c = 0; c < 4; c++) { w[k * 4 + c] = this.splat[s * 4 + c]; pc[k * 4 + c] = this.pcol[s * 4 + c]; } for (let c = 0; c < 3; c++) gc[k * 3 + c] = this.gcol[s * 3 + c];
    }
    geo.setAttribute('aW', new THREE.BufferAttribute(w, 4)); geo.setAttribute('aG', new THREE.BufferAttribute(gc, 3)); geo.setAttribute('aP', new THREE.BufferAttribute(pc, 4)); geo.computeVertexNormals();
    // Plastic toy ground: flat bright colours in cartoon bands, mown stripes, dotty flowers and chunky cobbles
    const mat = new THREE.MeshToonMaterial({ gradientMap: ramp });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, lightUniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aW; attribute vec3 aG; attribute vec4 aP; varying vec4 vW; varying vec3 vPW; varying vec3 vG; varying vec4 vP;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvW = aW; vG = aG; vP = aP; vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D tLight; uniform float uLampK, uLightHalf; varying vec4 vW; varying vec3 vPW; varying vec3 vG; varying vec4 vP;
float gh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), u.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), u.x), u.y); }`)
        .replace('#include <map_fragment>', `
vec2 uv = vPW.xz; float n = gn(uv * 0.35) * 0.6 + gn(uv * 1.7) * 0.4;
float wM = smoothstep(0.3, 0.7, vW.z + (n - 0.5) * 0.4), wC = smoothstep(0.45, 0.55, vW.w + (n - 0.5) * 0.12);
vec3 col = vG;
col *= mix(0.9, 1.07, step(0.5, gn(uv * 0.06 + 5.0)));                       // big flat patches of lighter and darker
col *= 1.0 + 0.07 * step(0.0, sin((uv.x + uv.y) * 0.8));                     // mown stripes
col *= mix(1.0, 0.86, step(0.82, gn(uv * 0.9)) * vW.x);                      // leaf litter blobs in the woods
float fl = step(0.86, gn(uv * 2.3)) * step(0.5, gn(uv * 7.0 + 3.0)) * clamp(vP.w, 0.0, 1.0);
vec3 fcol = mix(vec3(1.0, 0.45, 0.7), mix(vec3(1.0, 0.9, 0.3), vec3(1.0), step(0.5, gn(uv * 0.9 + 9.0))), step(0.45, gn(uv * 1.3)));
col = mix(col, fcol, fl);
col = mix(col, vec3(0.38, 0.28, 0.2), wM);
// paths: rounded cobbles laid like bricks, each a slightly different shade
vec2 cuv = uv / 1.15; cuv.x += 0.5 * mod(floor(cuv.y), 2.0);
vec2 ci = floor(cuv), cf = fract(cuv);
float stone = smoothstep(0.05, 0.13, min(min(cf.x, 1.0 - cf.x), min(cf.y, 1.0 - cf.y)));
vec3 pc = mix(vP.rgb * 0.5, vP.rgb * (0.86 + 0.26 * gh(ci)), stone);
pc += 0.10 * smoothstep(0.25, 0.0, length(cf - vec2(0.32, 0.3))) * stone;        // a little shine on each stone
col = mix(col, pc, wC);
diffuseColor.rgb *= col * col;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 lamp = texture2D(tLight, (vPW.xz + uLightHalf) / (uLightHalf * 2.0)).rgb; totalEmissiveRadiance += diffuseColor.rgb * lamp * lamp * uLampK * 2.6;`);
    };
    mat.customProgramCacheKey = () => 'nsz-ground';
    this.ground = new THREE.Mesh(geo, mat); this.ground.receiveShadow = true; this.group.add(this.ground);
    // The lily pond
    const water = new THREE.Mesh(new THREE.CircleGeometry(PLACES.lake.r * 1.18, 40), new THREE.MeshStandardMaterial({ color: 0x0c2a30, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.86 }));
    water.rotation.x = -Math.PI / 2; water.position.set(PLACES.lake.x, this.pondY, PLACES.lake.z); this.group.add(water);
  }

  // ---------------------------------------------------------------- colliders (circles and boxes in a 16 m grid)
  _key(i, j) { return i * 4096 + j; }
  addCollider(c) {
    const i0 = Math.floor((c.x - c.r - 1) / 16), i1 = Math.floor((c.x + c.r + 1) / 16), j0 = Math.floor((c.z - c.r - 1) / 16), j1 = Math.floor((c.z + c.r + 1) / 16);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this._key(i, j); if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(c); }
    return c;
  }
  addBox(o) { o.box = true; o.cs = Math.cos(o.ry || 0); o.sn = Math.sin(o.ry || 0); o.r = Math.hypot(o.hx, o.hz); return this.addCollider(o); }
  collidersAt(x, z) { return this.cells.get(this._key(Math.floor(x / 16), Math.floor(z / 16))) || EMPTY; }
  _inside(c, x, z, pad) {
    const dx = x - c.x, dz = z - c.z;
    if (!c.box) return dx * dx + dz * dz < (c.r + pad) * (c.r + pad);
    return Math.abs(dx * c.cs - dz * c.sn) < c.hx + pad && Math.abs(dx * c.sn + dz * c.cs) < c.hz + pad;
  }
  blocked(x, z, pad = 0.5) { return this.collidersAt(x, z).some(c => !c.off && this._inside(c, x, z, pad)); }
  standAt(x, z, y = Infinity) {
    let g = this.heightAt(x, z);
    for (const c of this.collidersAt(x, z)) { if (c.off || !c.walk || c.top > y + 0.55 || c.top <= g) continue; if (this._inside(c, x, z, 0)) g = c.top; }
    return g;
  }
  // Push a body (feet at height y) out of anything solid. vel is optional: it slides along what it hits
  push(p, y, pad, vel, tall = 1.7) {
    let hit = null;
    for (const c of this.collidersAt(p.x, p.z)) {
      if (c.off || y >= c.top - 0.35 || (c.walk && c.top - y <= 0.55) || (c.bottom != null && y + tall < c.bottom)) continue;
      const dx = p.x - c.x, dz = p.z - c.z; let nx, nz, move;
      if (c.box) {
        const lx = dx * c.cs - dz * c.sn, lz = dx * c.sn + dz * c.cs, ox = c.hx + pad - Math.abs(lx), oz = c.hz + pad - Math.abs(lz);
        if (ox <= 0 || oz <= 0) continue;
        if (ox < oz) { const sg = lx < 0 ? -1 : 1; nx = c.cs * sg; nz = -c.sn * sg; move = ox; } else { const sg = lz < 0 ? -1 : 1; nx = c.sn * sg; nz = c.cs * sg; move = oz; }
      } else { const d = Math.hypot(dx, dz), min = c.r + pad; if (d >= min || d < 1e-4) continue; nx = dx / d; nz = dz / d; move = min - d; }
      p.x += nx * move; p.z += nz * move; hit = c;
      if (vel) { const into = vel.x * nx + vel.z * nz; if (into < 0) { vel.x -= nx * into; vel.z -= nz * into; } }
    }
    return hit;
  }

  // How far a ray gets before it hits the ground or something solid (darts, thrown things, the camera)
  rayDist(ox, oy, oz, dx, dy, dz, range) {
    for (let t = 0.3; t < range; t += 0.3) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y < this.heightAt(x, z)) return t;
      for (const c of this.collidersAt(x, z)) if (!c.off && !c.thin && y < c.top && (c.bottom == null || y > c.bottom) && this._inside(c, x, z, 0)) return t;
    }
    return range;
  }

  // ---------------------------------------------------------------- placing models
  put(name, x, z, o = {}) {
    const t = template(name), size = o.size ?? 1, y = o.y ?? this.footY(x, z, Math.min(t.radius * size * 0.6, 3)) - size * (o.bury ?? 0.03);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tiltX ?? 0, o.ry ?? 0, o.tiltZ ?? 0, 'YXZ')), new THREE.Vector3(size, size, size));
    if (o.collide !== false) { const r = t.radius * size * (o.collide ?? 0.7); if (r > 0.12) this.addCollider({ x, z, r, top: y + size, walk: !!o.walk }); }
    if (o.tint) m.tint = o.tint;
    if (!this.placed.has(name)) this.placed.set(name, new Map());
    const by = this.placed.get(name), key = this.chunkOf(x, z); if (!by.has(key)) by.set(key, []); by.get(key).push(m);
    return { y, top: y + size };
  }
  _build() {
    const tmp = new THREE.Matrix4();
    for (const [name, byChunk] of this.placed) { const t = template(name);
      for (const [key, list] of byChunk) for (const part of t.parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        const col = new THREE.Color();
        list.forEach((m, i) => { im.setMatrixAt(i, tmp.multiplyMatrices(m, part.matrix)); if (list.some(q => q.tint)) im.setColorAt(i, m.tint ? col.setRGB(...m.tint, THREE.SRGBColorSpace) : col.setRGB(1, 1, 1)); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = t.shadow && this.quality !== 'low'; im.receiveShadow = true; this.chunks[key].add(im);
      } }
  }
  lamp(x, z, o = {}) { // a street light: the model, a glowing bulb and a pool on the light map
    const base = this.put('streetlight', x, z, { size: 4.7, ry: o.ry ?? this.R() * TAU, collide: false, bury: 0.01 });
    this.addCollider({ x, z, r: 0.3, top: base.top, walk: false });
    this.lamps.push({ x, z, r: o.r ?? 15, color: o.color || '255,200,130', zone: o.zone || null, on: true });
  }
  tree(x, z, o = {}) {
    registerTrees();
    const r = this.R, th = this.themeAt(x, z), types = (th.zone && TREES_BY_ZONE[th.zone.id]) || [0, 1, 2, 3, 6, 7, 1, 0];
    const type = types[Math.floor(r() * types.length)], variants = []; for (let i = type; i < TREE_COUNT; i += TREE_TYPES) variants.push(i);
    const size = (o.size ?? 8) * (0.7 + r() * 0.6) * (th.zone?.theme.big || 1), j = 0.82 + r() * 0.36; // every tree its own size and shade
    this.put('bt:' + variants[Math.floor(r() * variants.length)], x, z, { size, ry: r() * TAU, collide: false, bury: 0.01, tint: th.tint.map(c => Math.min(1.5, c * j)) });
    this.addCollider({ x, z, r: 0.07 * size + 0.15, top: this.heightAt(x, z) + size, walk: false });
  }

  // ---------------------------------------------------------------- enclosures
  _zones() {
    const r = this.R;
    for (const zn of ZONES) {
      // the gate goes on the side nearest a path; the trough just inside it
      const sides = [[zn.x, zn.z + zn.d / 2, 0], [zn.x, zn.z - zn.d / 2, Math.PI], [zn.x + zn.w / 2, zn.z, Math.PI / 2], [zn.x - zn.w / 2, zn.z, -Math.PI / 2]]; // x, z, outward angle (0 = +z)
      let best = 0, bd = 1e9; sides.forEach(([x, z, a], i) => { const d = this.pathDist(x + Math.sin(a) * 5, z + Math.cos(a) * 5); if (d < bd) { bd = d; best = i; } });
      const [gx, gz, ga] = sides[best]; zn.gx = gx; zn.gz = gz; zn.ga = ga;
      zn.tx = gx - Math.sin(ga) * 7 + Math.cos(ga) * 5; zn.tz = gz - Math.cos(ga) * 7 - Math.sin(ga) * 5;
    }
    // (heights were computed before the troughs were known: mud around them is painted by the splat on rebuild only, which is fine)
    const fenceParts = { wood: [], metal: [], heavy: [] };
    for (const zn of ZONES) {
      const F = FENCE[zn.fence], x0 = zn.x - zn.w / 2, x1 = zn.x + zn.w / 2, z0 = zn.z - zn.d / 2, z1 = zn.z + zn.d / 2;
      const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
      zn.segs = [];
      for (const [ax, az, bx, bz] of edges) {
        const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / SEG), sl = len / n, ry = Math.atan2(-(bz - az), bx - ax);
        for (let k = 0; k < n; k++) {
          const x = ax + (bx - ax) * (k + 0.5) / n, z = az + (bz - az) * (k + 0.5) / n, gate = Math.hypot(x - zn.gx, z - zn.gz) < sl * 0.55;
          const col = this.addBox({ x, z, hx: sl / 2, hz: 0.14, ry, top: this.heightAt(x, z) + F.h, walk: false, thin: true });
          const hx = (bx - ax) / len * sl / 2, hz = (bz - az) / len * sl / 2, yA = this.heightAt(x - hx, z - hz), yB = this.heightAt(x + hx, z + hz);
          const s = { id: this.segments.length, zone: zn.id, kind: zn.fence, x, z, y: (yA + yB) / 2 - 0.25, tilt: gate ? 0 : Math.atan2(yB - yA, sl), ry, len: sl, hp: F.hp, max: F.hp, broken: false, gate, open: false, col, lean: 0 };
          col.top = Math.max(yA, yB) + F.h;
          this.segments.push(s); zn.segs.push(s.id);
          if (gate) { zn.gate = s.id; this.gates.push(s); } else fenceParts[zn.fence].push(s);
        }
      }
      // trough, sign, two lamps, trees and rocks inside
      this.troughs.push({ zone: zn.id, x: zn.tx, z: zn.tz, y: this.footY(zn.tx, zn.tz, 1) });
      this.B.box('planks', zn.tx, this.footY(zn.tx, zn.tz, 1), zn.tz, 2.6, 0.55, 1.0, { ry: zn.ga, walk: true });
      const sx = zn.gx + Math.sin(zn.ga) * 2.2 + Math.cos(zn.ga) * 4.5, sz = zn.gz + Math.cos(zn.ga) * 2.2 - Math.sin(zn.ga) * 4.5;
      this._nameSign(zn.name, sx, sz, zn.ga);
      if (!zn.dark) { this.lamp(zn.gx + Math.sin(zn.ga) * 3 - Math.cos(zn.ga) * 6, zn.gz + Math.cos(zn.ga) * 3 + Math.sin(zn.ga) * 6, { zone: zn.id, r: 17 }); this.lamp(zn.x - Math.sin(zn.ga) * zn.d * 0.2, zn.z - Math.cos(zn.ga) * zn.d * 0.2, { zone: zn.id, r: 20 }); }
      for (let k = 0; k < zn.trees * this.density; k++) {
        const x = zn.x + (r() - 0.5) * (zn.w - 10), z = zn.z + (r() - 0.5) * (zn.d - 10); if (Math.hypot(x - zn.tx, z - zn.tz) < 6) continue;
        this.tree(x, z);
      }
      for (let k = 0; k < (zn.theme.rocks || 5); k++) { const x = zn.x + (r() - 0.5) * (zn.w - 8), z = zn.z + (r() - 0.5) * (zn.d - 8); if (Math.hypot(x - zn.tx, z - zn.tz) < 5) continue; this.put(['rock1', 'rock2', 'rock_large', 'rock1:1', 'rock2:1', 'rock_large:1'][k % 6], x, z, { size: (zn.theme.rocks ? 1.4 : 0.8) + r() * (zn.theme.rocks ? 3.4 : 1.6), ry: r() * TAU, bury: 0.3, walk: true, tint: zn.theme.g.map(c => 0.5 + c * 0.9) }); }
      // glowing mushrooms in the Night House, old bones in Rex Kingdom
      if (zn.theme.shrooms) for (let k = 0; k < 26; k++) { const x = zn.x + (r() - 0.5) * (zn.w - 6), z = zn.z + (r() - 0.5) * (zn.d - 6); this._shroom(x, z, 0.3 + r() * 0.6, k % 3); }
      if (zn.theme.bones) for (let k = 0; k < 9; k++) { const x = zn.x + (r() - 0.5) * (zn.w - 10), z = zn.z + (r() - 0.5) * (zn.d - 10); this._bones(x, z, 1 + r() * 1.6, r() * TAU); }
    }
    // Fences are instanced per kind so a broken panel can fall over on its own
    this.fenceMesh = {};
    const V = (r, h, x, y = 0, z = 0) => { const g = new THREE.CapsuleGeometry(r, Math.max(0.01, h - r * 2), 4, 10); g.translate(x, y + h / 2, z); return g; };          // upright
    const H = (r, len, y, x = 0, z = 0) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; };                 // lying along the fence
    const B = (r, x, y) => { const g = new THREE.SphereGeometry(r, 10, 8); g.translate(x, y, 0); return g; };
    const mk = (geos, mat) => new THREE.Mesh(mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g)), mat);
    const GEO = {
      wood: () => mk([V(0.17, 2.5, -2), V(0.17, 2.5, 2), ...[0.5, 1.05, 1.6, 2.1].map(y => H(0.09, 3.7, y)), ...[-1.2, -0.4, 0.4, 1.2].map(x => V(0.07, 2.2, x, 0.05, 0.06))], toon(0xb9773d)),
      metal: () => mk([V(0.12, 3.5, -2), V(0.12, 3.5, 2), B(0.2, -2, 3.55), B(0.2, 2, 3.55), H(0.07, 3.8, 0.3), H(0.07, 3.8, 3.2), H(0.05, 3.8, 1.75), ...Array.from({ length: 11 }, (_, i) => V(0.035, 2.9, -1.67 + i * 0.334, 0.3))], toon(0x5fb3b0)),
      heavy: () => mk([V(0.36, 5.3, -2), V(0.36, 5.3, 2), B(0.42, -2, 5.3), B(0.42, 2, 5.3), ...[0.6, 1.7, 2.8, 3.9, 4.9].map(y => H(0.12, 3.5, y)), ...Array.from({ length: 7 }, (_, i) => V(0.07, 4.5, -1.5 + i * 0.5, 0.5))], toon(0x6a6f8c))
    };
    for (const kind of Object.keys(fenceParts)) {
      const list = fenceParts[kind]; if (!list.length) continue;
      const src = GEO[kind](), im = new THREE.InstancedMesh(src.geometry, src.material, list.length);
      im.castShadow = this.quality !== 'low'; im.receiveShadow = true; im.frustumCulled = false; this.group.add(im);
      this.fenceMesh[kind] = im; list.forEach((s, i) => { s.inst = i; this._segMatrix(s); });
    }
    // Gates swing on a hinge, so each one is its own object
    for (const s of this.gates) {
      const F = FENCE[s.kind], g = new THREE.Group(), door = new THREE.Group(), half = s.len / 2;
      const bar = (sx, sy, sz, x, y, z, parent, mat) => { const up = sy >= sx, r = Math.min(sx, sy, sz) / 2 * 1.25, len = Math.max(0.01, (up ? sy : sx) - r * 2), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); if (!up) m.rotation.z = Math.PI / 2; m.position.set(x, y + sy / 2, z); m.castShadow = true; parent.add(m); };
      const mat = s.kind === 'wood' ? toon(0xd9a45a) : s.kind === 'metal' ? toon(0xffc94a) : toon(0xe5484d), hh = F.h;
      bar(0.3, hh + 0.5, 0.3, -half, 0, 0, g, this.mats.concrete); bar(0.3, hh + 0.5, 0.3, half, 0, 0, g, this.mats.concrete); bar(s.len + 0.6, 0.25, 0.3, 0, hh + 0.35, 0, g, this.mats.concrete);
      door.position.set(-half + 0.15, 0, 0);
      bar(s.len - 0.4, 0.12, 0.1, half - 0.15, 0.25, 0, door, mat); bar(s.len - 0.4, 0.12, 0.1, half - 0.15, hh - 0.25, 0, door, mat); bar(s.len - 0.4, 0.1, 0.08, half - 0.15, hh / 2, 0, door, mat);
      for (let x = 0.2; x < s.len - 0.4; x += 0.33) bar(0.05, hh - 0.4, 0.05, x, 0.25, 0, door, mat);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.16), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x30ff60, emissiveIntensity: 2 })); lock.position.set(s.len - 0.5, 1.2, 0.08); door.add(lock);
      g.add(door); g.position.set(s.x, s.y, s.z); g.rotation.y = s.ry; this.group.add(g); s.obj = g; s.door = door; s.lock = lock; s.swing = 0; s.locked = true;
    }
  }
  _segMatrix(s) {
    const im = this.fenceMesh[s.kind]; if (!im || s.inst == null) return;
    const e = new THREE.Euler(s.broken ? 1.42 * (s.dir || 1) : s.lean * 0.28 * (s.dir || 1), s.ry, s.tilt || 0, 'YXZ');
    im.setMatrixAt(s.inst, new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y + (s.broken ? 0.12 : 0), s.z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(s.len / 4, 1, 1)));
    im.instanceMatrix.needsUpdate = true;
  }
  // Fence state changed (damage, break, repair). dir: which way it falls (+1 / -1 along its normal)
  setSegment(id, hp, dir) {
    const s = this.segments[id]; if (!s || s.gate) return;
    s.hp = clamp(hp, 0, s.max); if (dir) s.dir = dir;
    s.broken = s.hp <= 0; s.lean = s.broken ? 1 : s.hp < s.max * 0.6 ? 1 - s.hp / (s.max * 0.6) : 0;
    s.col.off = s.broken; this._segMatrix(s);
  }
  setGate(id, open, locked) { const s = this.segments[id]; if (!s?.gate) return; s.open = open; s.locked = locked ?? s.locked; s.col.off = open; }

  _shroom(x, z, size, hue) {
    const col = [0x7af0ff, 0xc38bff, 0x8dffb0][hue], y = this.heightAt(x, z);
    this.glowMat ||= {}; const mat = this.glowMat[col] ||= new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.6 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.12, size * 0.16, size, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0f0, roughness: 0.8 })); stem.position.set(x, y + size / 2, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 12, 8, 0, TAU, 0, Math.PI / 2), mat); cap.position.set(x, y + size * 0.95, z); cap.scale.y = 0.7;
    this.chunks[this.chunkOf(x, z)].add(stem, cap);
    this.lamps.push({ x, z, r: 2.2 + size * 3, color: ['120,240,255', '195,140,255', '140,255,175'][hue], on: true, always: true, indoor: true });
  }
  _bones(x, z, size, ry) { // a rib cage: a spine with curved ribs
    this.boneMat ||= withLight(new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.7 }));
    const g = new THREE.Group(), y = this.heightAt(x, z);
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * size, 2.4 * size, 4, 8), this.boneMat); spine.rotation.z = Math.PI / 2; spine.position.y = 0.25 * size; g.add(spine);
    for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry((0.55 - Math.abs(i - 2.5) * 0.07) * size, 0.045 * size, 6, 14, Math.PI), this.boneMat); rib.position.set((-1 + i * 0.4) * size, 0.25 * size, 0); rib.rotation.y = Math.PI / 2; g.add(rib); }
    g.position.set(x, y, z); g.rotation.y = ry; g.traverse(m => { m.castShadow = true; }); this.chunks[this.chunkOf(x, z)].add(g);
    this.addCollider({ x, z, r: 0.9 * size, top: y + 0.8 * size, walk: true });
  }
  _nameSign(text, x, z, ang, o = {}) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const c = cv.getContext('2d');
    c.fillStyle = o.bg || '#3a2a1c'; c.fillRect(0, 0, 512, 160); c.strokeStyle = o.fg || '#f2d9a0'; c.lineWidth = 8; c.strokeRect(10, 10, 492, 140);
    c.fillStyle = o.fg || '#f2d9a0'; c.textAlign = 'center'; c.textBaseline = 'middle'; let px = 64; c.font = `700 ${px}px Bahnschrift, Segoe UI, sans-serif`;
    while (c.measureText(text.toUpperCase()).width > 460 && px > 24) { px -= 4; c.font = `700 ${px}px Bahnschrift, Segoe UI, sans-serif`; }
    c.fillText(text.toUpperCase(), 256, 84);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const y = this.footY(x, z, 0.5), g = new THREE.Group(), w = o.w ?? 3.2, h = w * 160 / 512;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), [this.mats.planks, this.mats.planks, this.mats.planks, this.mats.planks, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }), this.mats.planks]);
    board.position.y = (o.high ?? 1.9) + h / 2; board.castShadow = true; g.add(board);
    if (!o.hang) for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, (o.high ?? 1.9) + 0.1, 0.14), this.mats.planks); p.position.set(sx, ((o.high ?? 1.9) + 0.1) / 2, 0); g.add(p); }
    g.position.set(x, y, z); g.rotation.y = ang; this.group.add(g);
    if (!o.hang) this.addCollider({ x, z, r: 0.5, top: y + 3, walk: false });
    return g;
  }

  // ---------------------------------------------------------------- buildings and the plaza
  _hut(x, z, w, d, h, ry, wall, o = {}) { // a simple building with a doorway on its +z face and a pitched roof
    const B = this.B, y = this.footY(x, z, Math.max(w, d) / 2) - 0.15, c = Math.cos(ry), s = Math.sin(ry), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], t = 0.3, dw = o.door ?? 1.6;
    B.box('floor', x, y, z, w, 0.2, d, { ry, walk: true });
    for (const [lx, lz, sx, sz] of [[0, -d / 2 + t / 2, w, t], [-w / 2 + t / 2, 0, t, d], [w / 2 - t / 2, 0, t, d]]) { const [px, pz] = L(lx, lz); B.box(wall, px, y, pz, sx, h, sz, { ry, walk: false }); }
    const side = (w - dw) / 2; for (const sgn of [-1, 1]) { const [px, pz] = L(sgn * (dw / 2 + side / 2), d / 2 - t / 2); B.box(wall, px, y, pz, side, h, t, { ry, walk: false }); }
    { const [px, pz] = L(0, d / 2 - t / 2); B.box(wall, px, y + 2.3, pz, dw, h - 2.3, t, { ry, under: true, walk: false }); }
    B.box(o.roof || 'iron', x, y + h, z, w + 0.9, 0.3, d + 0.9, { ry, collide: false }); B.loaf(o.roof || 'iron', x, y + h + 0.3, z, w + 0.5, d + 0.5, Math.min(w, d) * 0.3, ry);
    // every building is watching you
    for (const sx of [-0.62, 0.62]) { const [ex, ez] = L(sx, d / 2 + 0.08), [px, pz] = L(sx * 0.9, d / 2 + 0.36); B.ball('white', ex, y + 2.78, ez, sx < 0 ? 0.36 : 0.42); B.ball('dark', px, y + 2.74, pz, sx < 0 ? 0.16 : 0.19); }
    this.lamps.push({ x, z, r: Math.max(w, d) * 0.9, color: o.light || '255,214,150', on: true, indoor: true });
    return { y: y + 0.2, L };
  }
  _places() {
    const B = this.B, r = this.R, P = PLACES, g = (x, z) => this.footY(x, z, 1);
    const point = (type, x, z, o = {}) => { const p = { type, x, z, y: o.y ?? g(x, z), r: o.r ?? 2.4, ...o }; this.points.push(p); return p; };
    for (const sx of [-12, 12]) { B.box('teal', sx, g(sx, 186), 186, 3.4, 2.7, 3, {}); B.box('cream', sx, g(sx, 186) + 2.7, 186, 4, 0.2, 3.6, { under: true, walk: false }); } // ticket booths
    // Fountain with the golden camel (touch it three times...)
    const fy = g(P.plaza.x, P.plaza.z); B.cyl('concrete', P.plaza.x, fy, P.plaza.z, 5.2, 5.4, 0.7, { seg: 24 }); B.cyl('concrete', P.plaza.x, fy + 0.7, P.plaza.z, 1.3, 1.5, 1.4, { seg: 16 });
    const fw = new THREE.Mesh(new THREE.CircleGeometry(4.9, 28), new THREE.MeshStandardMaterial({ color: 0x1a5a66, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.85 })); fw.rotation.x = -Math.PI / 2; fw.position.set(P.plaza.x, fy + 0.6, P.plaza.z); this.group.add(fw);
    this.camel = this._camel(P.plaza.x, fy + 2.1, P.plaza.z); point('camel', P.plaza.x, P.plaza.z, { r: 6.5, y: fy });
    this.lamps.push({ x: P.plaza.x, z: P.plaza.z, r: 16, color: '255,210,120', on: true });
    // Keepers' Lodge (safe room): shop board, med kit, bunk
    const hq = this._hut(P.hq.x, P.hq.z, 11, 9, 3.4, 0, 'planks', { roof: 'iron', door: 1.8 });
    this._nameSign("Keepers' Lodge", P.hq.x, P.hq.z + 5.2, 0, { w: 4.2, high: 3.0, bg: '#22301c' });
    point('shop', P.hq.x - 3.5, P.hq.z - 3.2, { y: hq.y }); B.box('planks', P.hq.x - 3.5, hq.y, P.hq.z - 3.8, 3, 1.0, 0.8, {});
    point('medkit', P.hq.x + 4.4, P.hq.z - 1, { y: hq.y }); B.box('paint', P.hq.x + 5, hq.y + 1.1, P.hq.z - 1, 0.25, 0.7, 0.9, { collide: false });
    point('darts', P.hq.x + 2.5, P.hq.z - 3.6, { y: hq.y }); B.box('dark', P.hq.x + 2.5, hq.y, P.hq.z - 3.9, 1.6, 2.0, 0.6, {});
    B.box('cream', P.hq.x - 0.5, hq.y, P.hq.z + 0.5, 2.2, 0.8, 1.2, { walk: true }); // table
    this.lodge = [P.hq.x, P.hq.z + 8]; this.spawn = [0, 229];
    // The Lodge bell: ring it to start the night early
    { const x = P.hq.x + 8, z = P.hq.z + 7, y = g(x, z), gold = toon(0xffc94a);
      B.cyl('planks', x, y, z, 0.16, 0.2, 2.6, { seg: 8, walk: false }); B.box('planks', x + 0.5, y + 2.4, z, 1.3, 0.16, 0.16, { collide: false });
      const bell = this.bell = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, TAU, 0, Math.PI * 0.6), gold), lip = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 18), gold), tongue = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.mats.dark);
      lip.rotation.x = Math.PI / 2; lip.position.y = -0.16; tongue.position.y = -0.3; bell.add(dome, lip, tongue); bell.position.set(x + 1, y + 2.0, z); this.group.add(bell); bell.userData.swing = 0;
      point('bell', x + 1, z + 0.6, { y, r: 2.2 }); }
    // Feed store: buckets of meat, hay and fish
    const st = this._hut(P.store.x, P.store.z, 9, 7, 3.2, 0.5, 'iron', { roof: 'rust', door: 2.2, light: '255,190,120' });
    this._nameSign('Feed Store', P.store.x + 3.4, P.store.z + 4.8, 0.5, { w: 3.4, high: 2.9 });
    for (const [i, kind] of ['meat', 'hay'].entries()) { const [x, z] = st.L(-2.4 + i * 4.8, -2); point('feed', x, z, { kind, y: st.y }); B.box('planks', x, st.y, z, 1.6, 0.9, 1.2, { ry: 0.5 }); this.put(kind === 'meat' ? 'bucket_fish' : 'bucket', x, z, { size: 0.5, y: st.y + 0.9, collide: false }); }
    for (let k = 0; k < 5; k++) this.put(k % 2 ? 'crate' : 'barrel', P.store.x - 6 + r() * 2, P.store.z - 2 + k * 1.3, { size: 1.1, ry: r() * TAU, walk: true });
    // Generator shed
    const gs = this._hut(P.generator.x, P.generator.z, 7, 6, 3, 0, 'iron', { roof: 'rust', door: 1.8, light: '255,120,90' });
    B.box('dark', P.generator.x, gs.y, P.generator.z - 1.2, 3, 1.5, 1.6, {}); B.cyl('rust', P.generator.x + 1.9, gs.y, P.generator.z - 1.4, 0.35, 0.35, 2.2, { seg: 10 });
    this.genLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0x40ff70 })); this.genLight.position.set(P.generator.x - 0.9, gs.y + 1.6, P.generator.z - 0.35); this.group.add(this.genLight);
    point('generator', P.generator.x, P.generator.z + 0.3, { y: gs.y }); this._nameSign('Generator', P.generator.x + 2.2, P.generator.z + 4, 0, { w: 3, high: 2.7, bg: '#3a1c1c' });
    point('fuel', P.yard.x - 4, P.yard.z - 3, {}); point('kits', P.yard.x + 3, P.yard.z + 2, {});
    // Maintenance yard: crates, dumpsters, repair kits and fuel
    this._hut(P.yard.x + 6, P.yard.z - 6, 8, 6, 3.2, -0.3, 'iron', { roof: 'rust', door: 2.4 });
    this._nameSign('Maintenance', P.yard.x - 6, P.yard.z + 7, 0, { w: 3.6, high: 2.6, bg: '#2c2c30' });
    B.box('paint', P.yard.x - 4, g(P.yard.x - 4, P.yard.z - 3), P.yard.z - 3.6, 1.6, 1.1, 0.8, {}); B.box('planks', P.yard.x + 3, g(P.yard.x + 3, P.yard.z + 2), P.yard.z + 2.6, 2.2, 0.9, 1, {});
    for (let k = 0; k < 9; k++) this.put(['crate', 'barrel', 'dumpster', 'barrier'][k % 4], P.yard.x - 9 + r() * 20, P.yard.z + 4 + r() * 9, { size: k % 4 === 2 ? 1.6 : 1.1, ry: r() * TAU, walk: true });
    // Control Tower: the ending is decided here
    const tw = this._hut(P.tower.x, P.tower.z, 7, 7, 4, Math.PI, 'concrete', { roof: 'dark', door: 1.6, light: '150,210,255' });
    B.box('concrete', P.tower.x, tw.y + 4.05, P.tower.z, 5, 7, 5, { under: true, walk: false }); B.box('dark', P.tower.x, tw.y + 11.05, P.tower.z, 6.4, 2.6, 6.4, { under: true, walk: false });
    B.box('dark', P.tower.x, tw.y, P.tower.z + 2.2, 4, 1.1, 0.9, {}); point('tower', P.tower.x, P.tower.z + 1, { y: tw.y, r: 3 });
    this._nameSign('Control Tower', P.tower.x - 5.5, P.tower.z - 4.6, Math.PI, { w: 3.6, high: 2.7, bg: '#1c2430' });
    this.towerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3a2a })); this.towerLamp.position.set(P.tower.x, tw.y + 14.3, P.tower.z); this.group.add(this.towerLamp);
    // Gift shop (the rubber chicken lives here) and a kickable vending machine
    const gf = this._hut(40, 128, 9, 7, 3.3, Math.PI, 'cream', { roof: 'paint', door: 2 });
    this._nameSign('Gift Shop', 40, 123.2, Math.PI, { w: 3.6, high: 3.0, bg: '#5a2a4a', fg: '#ffe0f0' });
    { const [x, z] = gf.L(-2.6, -1.8); point('chicken', x, z, { y: gf.y }); B.box('cream', x, gf.y, z, 1.2, 1, 1.2, {}); }
    for (const [x, z, ry] of [[-22, 132, 0.3], [58, -31, 2.2], [176, 60, -1.6]]) { const y = g(x, z); B.box('paint', x, y, z, 1.1, 2.1, 0.9, { ry }); point('vending', x + Math.sin(ry) * 1.2, z + Math.cos(ry) * 1.2, { y, r: 1.9, id: this.points.length }); this.lamps.push({ x, z, r: 5, color: '255,90,110', on: true }); }
    // Food court: three stalls and picnic benches
    for (let k = 0; k < 3; k++) { const x = P.court.x - 9 + k * 9, z = P.court.z - 12, y = g(x, z); B.box(['paint', 'teal', 'cream'][k], x, y, z, 5, 1.1, 2.6, {}); for (const sx of [-2.3, 2.3]) B.box('dark', x + sx, y, z - 1.1, 0.15, 3, 0.15, { collide: false }); B.box(['cream', 'paint', 'teal'][k], x, y + 2.9, z - 0.3, 5.8, 0.18, 4, { under: true, walk: false }); }
    for (let k = 0; k < 8; k++) this.put('bench', P.court.x - 10 + (k % 4) * 6.5, P.court.z - 2 + Math.floor(k / 4) * 5, { size: 1.0, ry: k % 2 ? 0 : Math.PI, walk: true });
    this.lamp(P.court.x, P.court.z - 5, { r: 18 });
    // Playground: slide, swings and a climbing frame (yes, you can climb it)
    { const x = P.play.x, z = P.play.z, y = g(x, z);
      B.box('teal', x, y, z, 3, 2.2, 3, { walk: true }); for (let j = 0; j < 5; j++) B.box('planks', x - 2.1 - j * 0.5, y, z, 0.5, 1.9 - j * 0.38, 1.2, { walk: true }); // steps
      for (let j = 0; j < 6; j++) B.box('paint', x + 2 + j * 0.6, y, z, 0.62, 2.0 - j * 0.34, 1.1, { walk: true });                                                    // slide
      for (const sx of [-2.4, 2.4]) B.box('dark', x + sx, y, z + 7, 0.18, 2.8, 0.18, { collide: false }); B.box('dark', x, y + 2.7, z + 7, 5.2, 0.16, 0.16, { under: true, collide: false });
      for (const sx of [-1.1, 1.1]) B.box('paint', x + sx, y + 0.6, z + 7, 0.7, 0.08, 0.35, { collide: false, under: true });
      this.lamp(x + 6, z + 3, { r: 14 }); }
    // The Night House: a dark hall on the north side of its enclosure, with a secret button inside
    { const zn = ZONES.find(q => q.id === 'nighthouse'), x = zn.x, z = zn.z - zn.d / 2 - 6, y = g(x, z);
      B.box('dark', x, y, z - 4, 30, 6, 0.6, {}); B.box('dark', x - 15, y, z, 0.6, 6, 8.6, {}); B.box('dark', x + 15, y, z, 0.6, 6, 8.6, {}); B.box('dark', x, y + 6, z, 31.5, 0.4, 9.5, { under: true, walk: false });
      this._nameSign('The Night House', zn.gx + Math.sin(zn.ga) * 2.5 - Math.cos(zn.ga) * 5, zn.gz + Math.cos(zn.ga) * 2.5 + Math.sin(zn.ga) * 5, zn.ga, { w: 4, bg: '#0c1020', fg: '#8fe8ff' });
      point('disco', x + 13, z - 2.6, { y, r: 2 }); B.box('paint', x + 13.6, y + 1.1, z - 3.4, 0.4, 0.4, 0.2, { collide: false }); this.discoAt = { x, y: y + 4.5, z }; }
    // Re-Bean-imators: glowing booths around the park that bring eaten friends back
    this.stations = REVIVE.map(([x, z], id) => {
      const y = g(x, z), grp = new THREE.Group(), white = this.mats.white, red = this.mats.paint;
      B.cyl('cream', x, y - 0.3, z, 2.3, 2.5, 0.5, { seg: 20, walk: true });
      const add = (geo, mat, px, py, pz, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.z = rz; m.castShadow = true; grp.add(m); return m; };
      for (const sx of [-1.9, 1.9]) { add(new THREE.CapsuleGeometry(0.2, 3.2, 4, 10), white, sx, 1.9, 0); this.addCollider({ x: x + sx, z, r: 0.28, top: y + 4, walk: false }); }
      add(new THREE.CapsuleGeometry(0.22, 3.8, 4, 10), white, 0, 3.75, 0, Math.PI / 2);
      add(new THREE.SphereGeometry(0.75, 16, 12), white, 0, 4.6, 0).scale.set(1, 1, 0.45);
      add(new THREE.BoxGeometry(0.9, 0.28, 0.2), red, 0, 4.6, 0.3); add(new THREE.BoxGeometry(0.28, 0.9, 0.2), red, 0, 4.6, 0.3); add(new THREE.BoxGeometry(0.9, 0.28, 0.2), red, 0, 4.6, -0.3); add(new THREE.BoxGeometry(0.28, 0.9, 0.2), red, 0, 4.6, -0.3);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 36), new THREE.MeshBasicMaterial({ color: 0x66ffa8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.45; grp.add(ring);
      grp.position.set(x, y + 0.2, z); grp.rotation.y = this.R() * TAU; this.group.add(grp);
      this.lamps.push({ x, z, r: 9, color: '110,255,170', on: true, always: true, indoor: true });
      point('revive', x, z, { y: y + 0.2, r: 2.6, id });
      return { id, x, z, y: y + 0.2, ring, cd: 0 };
    });
    // Seven garden gnomes are hiding around the zoo. Nobody knows why. Find them all.
    this.gnomes = [[-52, 144], [150, 158], [-196, 100], [-70, -28], [58, -52], [190, -180], [-196, -190]].map(([x, z], id) => {
      const y = g(x, z), grp = new THREE.Group(), add = (geo, mat, py, s) => { const m = new THREE.Mesh(geo, mat); m.position.y = py; if (s) m.scale.set(...s); m.castShadow = true; grp.add(m); return m; };
      add(new THREE.CapsuleGeometry(0.2, 0.2, 4, 10), this.mats.teal, 0.3); add(new THREE.SphereGeometry(0.2, 12, 10), toon(0xffd2b0), 0.62); add(new THREE.ConeGeometry(0.21, 0.5, 12), this.mats.paint, 1.0);
      add(new THREE.SphereGeometry(0.17, 10, 8), this.mats.white, 0.5, [1, 1.1, 0.7]).position.z = 0.1;
      for (const sx of [-0.08, 0.08]) { const e = add(new THREE.SphereGeometry(0.05, 8, 6), this.mats.white, 0.68); e.position.set(sx, 0.68, 0.17); const p = add(new THREE.SphereGeometry(0.025, 6, 5), this.mats.dark, 0.68); p.position.set(sx, 0.67, 0.21); }
      grp.position.set(x, y, z); grp.rotation.y = this.R() * TAU; this.group.add(grp);
      return { id, x, z, y, obj: grp, found: false };
    });
    // Notes to find (story), scattered where a keeper might leave them
    const spots = [[-58, 152], [-98, 136], [72, 150], [152, 146], [42, 126], [56, -44], [-74, -22], [62, 98], [-150, -110], [36, 174]];
    NOTES.forEach((text, i) => { const [x, z] = spots[i]; this.notes.push({ id: i, x, z, y: this.standAt(x, z) + 0.9, text }); });
  }
  _camel(x, y, z) { // the golden camel on the fountain, built from simple shapes
    const gold = toon(0xffc94a), g = new THREE.Group();
    const add = (geo, px, py, pz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, gold); m.position.set(px, py, pz); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); };
    add(new THREE.CapsuleGeometry(0.45, 1.3, 6, 12), 0, 1.3, 0, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.42, 12, 10), -0.3, 1.75, 0); add(new THREE.SphereGeometry(0.38, 12, 10), 0.35, 1.72, 0);         // two humps
    add(new THREE.CapsuleGeometry(0.16, 0.9, 5, 10), 1.05, 1.85, 0, 0, -0.5); add(new THREE.CapsuleGeometry(0.2, 0.35, 5, 10), 1.5, 2.35, 0, 0, Math.PI / 2); // neck, head
    for (const [lx, lz] of [[-0.6, -0.25], [-0.6, 0.25], [0.6, -0.25], [0.6, 0.25]]) add(new THREE.CylinderGeometry(0.09, 0.07, 1.1, 8), lx, 0.55, lz);
    for (const sz of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), this.mats.white), p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.mats.dark); e.position.set(1.55, 2.5, sz); p.position.set(1.63, 2.52, sz * 1.25); g.add(e, p); }
    g.position.set(x, y, z); g.scale.setScalar(1.3); this.group.add(g); return g;
  }

  // ---------------------------------------------------------------- everything along the paths
  _scatter() {
    const r = this.R, D = this.density, H = WORLD.half - 6;
    // Lamps, benches and bins along every path
    for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let t = 10; t < len - 6; t += 26) {
        const side = (Math.round(t / 26) % 2 ? 1 : -1) * 3.4, x = ax + (bx - ax) * t / len + nx * side, z = az + (bz - az) * t / len + nz * side;
        const gateway = z > 190 && Math.abs(x) < 12;   // keep the way in clear
        if (!gateway && !this.zoneAt(x, z, 1) && !this.blocked(x, z, 1.5)) this.lamp(x, z);
        const bx2 = x - nx * side * 2, bz2 = z - nz * side * 2 + 7;
        if (!gateway && r() < 0.55 && !this.zoneAt(bx2, bz2, 1.5) && !this.blocked(bx2, bz2, 1.5) && this.pathDist(bx2, bz2) > 2.4) { this.put('bench', bx2, bz2, { size: 1, ry: Math.atan2(nx * -side, nz * -side), walk: true }); this.put('trashcan', bx2 + 1.8, bz2 + 0.4, { size: 1.0, collide: 0.6 }); }
      }
    }
    // Trees, bushes and rocks everywhere that isn't a path, a building or an enclosure
    const free = (x, z, pad) => Math.abs(x) < H && Math.abs(z) < H && this.pathDist(x, z) > 3.4 + pad && !this.zoneAt(x, z, 2.5) && !this.blocked(x, z, 1.6 + pad) && Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) > PLACES.lake.r + 2 && !(Math.abs(x) < 125 && Math.abs(z - 152) < 20);
    for (let k = 0, tries = 0; k < 330 * D && tries < 9000; tries++) { const x = (r() - 0.5) * 2 * H, z = (r() - 0.5) * 2 * H; if (!free(x, z, 0.6)) continue; this.tree(x, z); k++; }
    for (let k = 0, tries = 0; k < 420 * D && tries < 9000; tries++) { const x = (r() - 0.5) * 2 * H, z = (r() - 0.5) * 2 * H; if (!free(x, z, 0)) continue; this.put(['bush', 'bush:1', 'bush:2', 'bush:3', 'bush_flowers', 'bush_flowers:1', 'hedge', 'hedge:1'][Math.floor(r() * 8)], x, z, { size: 0.9 + r() * 1.3, ry: r() * TAU, collide: false, bury: 0.08 }); k++; }
    for (let k = 0, tries = 0; k < 110 * D && tries < 4000; tries++) { const x = (r() - 0.5) * 2 * H, z = (r() - 0.5) * 2 * H; if (!free(x, z, 0)) continue; this.put(['rock1', 'rock2', 'rock_large', 'rock1:1', 'rock2:1', 'rock_large:1'][k % 6], x, z, { size: 0.6 + r() * 1.8, ry: r() * TAU, bury: 0.3, walk: true }); k++; }
    // Hills of trees outside the wall, so the zoo sits in a forest
    for (let k = 0; k < 150 * D; k++) { const a = r() * TAU, d = WORLD.half + 12 + r() * 40, x = Math.cos(a) * d * 1.3, z = Math.sin(a) * d * 1.3; if (Math.max(Math.abs(x), Math.abs(z)) < WORLD.half + 8 || Math.max(Math.abs(x), Math.abs(z)) > WORLD.size / 2 - 6) continue; registerTrees(); this.put('bt:' + [3, 11, 19, 2, 10][k % 5], x, z, { size: 11 + r() * 8, ry: r() * TAU, collide: false, tint: [0.5 + r() * 0.3, 0.9, 0.6 + r() * 0.2] }); }
    // Arrow signs at junctions
    for (const [x, z, ry] of [[4, 100, 0], [-76, 100, 1.2], [176, 100, -1.2], [-182, -86, 2], [38, -54, 0.4], [38, -136, 3]]) this.put('arrow_sign', x, z, { size: 2.2, ry, collide: 0.3 });
  }
  _perimeter() {
    const B = this.B, H = WORLD.half, hgt = WORLD.wall;
    for (let t = -H + 5; t < H; t += 10) for (const [x, z, ry] of [[t, -H, 0], [-H, t, Math.PI / 2], [H, t, Math.PI / 2], [t, H, 0]]) {
      if (ry === 0 && z > 0 && Math.abs(x) < 10) continue;                                   // the main gate
      const y = this.footY(x, z, 4) - 0.6;
      B.box('brick', x, y, z, 10.2, hgt + 0.6, 0.9, { ry, walk: false });
      B.box('cream', x, y + hgt + 0.6, z, 10.4, 0.5, 1.5, { ry, collide: false });
      B.cyl('brickdark', x - (ry ? 0 : 5), y, z - (ry ? 5 : 0), 0.85, 0.95, hgt + 1.8, { seg: 10, walk: false });
    }
    // The main gate: two tall towers, an arch with the zoo's name, and two big doors that slam shut behind the new keepers
    const gz = H, gy = this.footY(0, gz, 3);
    for (const sx of [-7.7, 7.7]) { B.box('brick', sx, gy - 0.6, gz, 4.6, 15, 3.4, { walk: false }); B.box('cream', sx, gy + 14.4, gz, 5.2, 0.6, 4, { collide: false }); }
    B.box('brick', 0, gy + 9, gz, 10.8, 2.6, 2.2, { under: true, walk: false });
    this._nameSign('Cedar Hollow Zoo', 0, gz + 1.25, 0, { w: 9, high: 8.9, bg: '#1c2a24', fg: '#ffd27a', hang: true }); this._nameSign('No exit until day 6', 0, gz - 1.25, Math.PI, { w: 7, high: 9.2, bg: '#3a1c1c', fg: '#ffb0a0', hang: true });
    const mg = this.mainGate = { x: 0, z: gz, y: gy, open: true, swing: 1, v: 0, doors: [], col: this.addBox({ x: 0, z: gz, hx: 5.4, hz: 0.35, ry: 0, top: gy + 9, walk: false, off: true }) };
    const red = toon(0xe5484d), gold = toon(0xffc94a);
    for (const sd of [-1, 1]) {
      const d = new THREE.Group(); d.position.set(sd * 5.4, gy, gz);
      const cap = (r, len, x, y, up, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); if (!up) m.rotation.z = Math.PI / 2; m.position.set(-sd * x, y, 0); m.castShadow = true; d.add(m); };
      for (let k = 0; k < 7; k++) cap(0.16, 7.6 + (3 - Math.abs(k - 3)) * 0.2, 0.45 + k * 0.78, 4.1, true, red);
      for (const y of [0.6, 4, 7.6]) cap(0.2, 5.0, 2.75, y, false, gold);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), gold); knob.position.set(-sd * 4.9, 3.6, 0); d.add(knob);
      this.group.add(d); mg.doors.push({ g: d, side: sd });
    }
    // Outside: the road in, walled on both sides, and the staff bus that dropped you off (it has already left you)
    const oy = this.footY(0, 224, 6);
    for (const sx of [-11, 11]) B.box('brick', sx, oy - 1.5, 222.5, 0.9, 6.5, 35, { walk: false });
    B.box('brick', 0, oy - 1.5, 240.4, 23, 6.5, 0.9, { walk: false });
    B.box('yellow', 0, oy + 0.55, 236.6, 9.5, 2.6, 2.9, { walk: false }); B.box('white', 0, oy + 3.15, 236.6, 9.1, 0.25, 2.7, { collide: false });
    for (let k = 0; k < 5; k++) B.box('glass', -3.6 + k * 1.8, oy + 1.9, 235.1, 1.3, 0.9, 0.12, { collide: false });
    for (const sx of [-3.2, 3.2]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 16), this.mats.dark); wh.rotation.x = Math.PI / 2; wh.position.set(sx, oy + 0.6, 235.2); this.group.add(wh); }
    for (const sz of [-0.7, 0.7]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), this.mats.white), p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.mats.dark); e.position.set(-4.75, oy + 1.5, 236.6 + sz); p.position.set(-5.1, oy + 1.45, 236.6 + sz * 1.05); this.group.add(e, p); }
    this._nameSign('Staff: 5 day shifts. No refunds.', 7.4, 214, -0.5, { w: 4.4, high: 2.0, bg: '#22301c' });
    this.lamp(-7.5, 216, { r: 14 }); this.lamp(7.5, 228, { r: 14 });
    // The north wall gate (it only opens in one of the endings)
    this.northGate = { x: 0, z: -H };
  }
  setMainGate(open) { const mg = this.mainGate; mg.open = open; mg.col.off = open; mg.v = 0; mg.slammed = false; }

  // ---------------------------------------------------------------- lamp light map
  _lightmap() {
    const cv = this.lightCanvas = document.createElement('canvas'); cv.width = cv.height = 1024;
    this.lightTex = new THREE.CanvasTexture(cv); this.lightTex.colorSpace = THREE.NoColorSpace; this.lightTex.flipY = false;
    lightUniforms.tLight.value = this.lightTex;
    // glowing bulbs on every street light, as one instanced mesh
    const out = this.lamps.filter(l => !l.indoor && !l.color.startsWith('255,90'));
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.36, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }), out.length);
    out.forEach((l, i) => { l.bulb = i; this.bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(l.x, this.heightAt(l.x, l.z) + 4.95, l.z)); });
    this.bulbs.frustumCulled = false; this.group.add(this.bulbs);
    this.drawLights(true);
  }
  // Redraw the light map. power: are the lamps on? Zone lamps listed in `dead` stay off (broken).
  drawLights(power, dead = new Set()) {
    const cv = this.lightCanvas, c = cv.getContext('2d'), S = WORLD.size, px = v => (v + S / 2) / S * cv.width;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'lighter';
    for (const l of this.lamps) {
      const on = l.always || (power && !(l.zone && dead.has(l.zone))); l.on = on;
      if (!on) continue;
      const x = px(l.x), y = px(l.z), rad = l.r / S * cv.width, g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${l.color},0.95)`); g.addColorStop(0.35, `rgba(${l.color},0.5)`); g.addColorStop(1, `rgba(${l.color},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    this.lightTex.needsUpdate = true;
    this.bulbs.material.color.set(power ? 0xffd9a0 : 0x221a12);
  }
  litAt(x, z) { let v = 0; for (const l of this.lamps) if (l.on) { const d = Math.hypot(l.x - x, l.z - z); if (d < l.r) v = Math.max(v, 1 - d / l.r); } return v; }

  // ---------------------------------------------------------------- per frame
  update(dt, time, cam, fogFar, wind = 1) {
    propUniforms.uTime.value = time; propUniforms.uWind.value = wind;
    const far = fogFar + 150, st = WORLD.size / CHUNKS;
    for (const c of this.chunks) { const dx = Math.max(Math.abs(cam.x - c.userData.cx) - st / 2, 0), dz = Math.max(Math.abs(cam.z - c.userData.cz) - st / 2, 0); c.visible = Math.hypot(dx, dz) < far; }
    for (const s of this.gates) { const want = s.open ? 1.75 : 0; s.swing += (want - s.swing) * Math.min(1, dt * 5); s.door.rotation.y = s.swing; s.lock.material.emissive.set(s.locked ? 0x30ff60 : 0xff4030); }
    this.camel.rotation.y += dt * (this.camelSpin || 0.15);
    // the main gate: creaks open slowly, slams shut fast
    const mg = this.mainGate;
    if (mg.open) mg.swing += (1 - mg.swing) * Math.min(1, dt * 1.4);
    else if (mg.swing > 0) { mg.v += dt * 11; mg.swing = Math.max(0, mg.swing - mg.v * dt); if (mg.swing === 0 && !mg.slammed) { mg.slammed = true; this.onSlam?.(); } }
    for (const d of mg.doors) d.g.rotation.y = -d.side * 1.9 * mg.swing;
    for (const st of this.stations) { st.cd = Math.max(0, st.cd - dt); st.ring.material.color.setHex(st.cd > 0 ? 0x556066 : 0x66ffa8); st.ring.position.y = 0.45 + (st.cd > 0 ? 0 : Math.sin(time * 2.4 + st.id) * 0.18); st.ring.rotation.z = time * 0.8; }
    const bl = this.bell; bl.userData.swing *= Math.max(0, 1 - dt * 1.6); bl.rotation.z = Math.sin(time * 11) * bl.userData.swing * 0.6;
  }
  dispose() { this.scene.remove(this.group); }
}
