// Everyone in this zoo is a bean. Keepers are upright beans with hats, mitts and a flappy mouth.
// Animals are beans too: a wolf bean with ears and a bushy tail, a striped zebra bean, a bull bean
// with a nose ring, a long-necked apatosaur bean, a tiny-armed Rex bean with a big wobbly jaw.
// All of them are built from simple shapes, wear googly eyes, and are animated by hand:
// waddles, hops, squash and stretch, chomps, howls, roars, dizzy spells and a victory dance.
import * as THREE from 'three';
import { toon } from './materials.js';
import { addOutline, GooglyEye } from './toon.js';
import { clamp, lerp } from './util.js';

const TAU = Math.PI * 2;
export { toon };

// A bean: a fat capsule with a slight kidney bend. axis 'y' stands up, 'z' lies down pointing forward.
function beanGeo(r, len, bend = 0.14, axis = 'y') {
  const g = new THREE.CapsuleGeometry(r, len, 10, 20), p = g.attributes.position, H = len / 2 + r;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / H; p.setZ(i, p.getZ(i) + bend * r * (1 - y * y) * 1.6 - bend * r * 0.6); }
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.computeVertexNormals(); return g;
}
const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg), ball = (r, s = 14) => new THREE.SphereGeometry(r, s, Math.max(8, s - 4)), cap = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 10);

// What makes each animal that animal. All sizes are in units of the animal's height h.
export const BEANS = {
  wolf:   { kind: 'quad', color: 0x8791a3, belly: 0xdfe3ea, ears: 'point', tail: 'bushy', snout: 0.2, teeth: 2, tongue: true },
  fox:    { kind: 'quad', color: 0xf0883a, belly: 0xffffff, ears: 'bigpoint', tail: 'bushytip', snout: 0.22, body: 1.25 },
  zebra:  { kind: 'quad', color: 0xf6f6f2, belly: 0xffffff, stripes: 0x16161c, ears: 'round', mane: 0x16161c, tail: 'tuft', snout: 0.24, legs: 1.25 },
  bull:   { kind: 'quad', color: 0x6f4631, belly: 0x8a5a40, horns: 'bull', ring: true, tail: 'tuft', snout: 0.28, wide: 1.2 },
  stag:   { kind: 'quad', color: 0xb37a48, belly: 0xe8cda8, antlers: true, ears: 'round', tail: 'stub', snout: 0.2, legs: 1.3 },
  deer:   { kind: 'quad', color: 0xcda06c, belly: 0xf3e3c8, spots: 0xffffff, ears: 'bigpoint', tail: 'stub', snout: 0.18, legs: 1.2 },
  trike:  { kind: 'quad', color: 0xc98f58, belly: 0xe8c79a, frill: 0x8d5fb5, horns: 'three', tail: 'thick', snout: 0.26, wide: 1.25, legs: 0.7 },
  stego:  { kind: 'quad', color: 0x5fa56c, belly: 0xbfe0a8, plates: 0xf08a3a, tail: 'spiked', snout: 0.16, legs: 0.7, small: 0.7 },
  para:   { kind: 'quad', color: 0xe3c349, belly: 0xf6eab0, crest: 0xd8463a, tail: 'thick', snout: 0.22, legs: 1.0 },
  apato:  { kind: 'quad', color: 0x7ea2c4, belly: 0xcfe0ee, neck: 2.2, tail: 'long', snout: 0.16, legs: 0.6, small: 0.55 },
  spider: { kind: 'bug', color: 0x3b2a4d, belly: 0x7a4fa0, eyes: 4, fangs: true },
  raptor: { kind: 'dino', color: 0x6dae49, belly: 0xe6da8c, stripes: 0x35602a, tail: 'long', teeth: 4, arms: 0.16, feather: 0xd8463a },
  trex:   { kind: 'dino', color: 0x4d8a3a, belly: 0xd9d18c, tail: 'thick', teeth: 7, arms: 0.1, jaw: 1.25, brow: true },
  // the keepers: you and your friends
  keeper0: { kind: 'up', color: 0xff8a3c, belly: 0xffd9b0, arms: 0.3, slim: 0.24, hat: 'cap' },
  keeper1: { kind: 'up', color: 0x35c4b0, belly: 0xc8f4ec, arms: 0.3, slim: 0.24, hat: 'safari' },
  keeper2: { kind: 'up', color: 0xff6fa5, belly: 0xffd6e6, arms: 0.3, slim: 0.24, hat: 'prop' },
  keeper3: { kind: 'up', color: 0xffd23c, belly: 0xfff3c0, arms: 0.3, slim: 0.24, hat: 'cone' },
  yeti:   { kind: 'up', color: 0xf3f7fb, belly: 0xbcd6ee, arms: 0.75, fur: true, teeth: 2, horns: 'nub' }
};

export class Bean {
  // sp: an animal from BEANS, h: its height in metres
  constructor(sp, h) {
    const B = this.B = BEANS[sp]; this.sp = sp; this.h = h;
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.legs = []; this.tail = []; this.arms = []; this.eyes = []; this.t = Math.random() * 10; this.phase = 0; this.sq = 0; this.sqV = 0; this.mouth = 0; this.pose = 0; this.spin = 0;
    const C = toon(B.color), Bel = toon(B.belly), dark = toon(0x1a1a22), white = toon(0xffffff), pink = toon(0xff8fa8);
    if (B.kind === 'quad' || B.kind === 'bug') this._quad(C, Bel, dark, white, pink);
    else this._upright(C, Bel, dark, white, pink);
    addOutline(this.root, 0.003);
  }

  _eyes(parent, x, y, z, r, n = 2) {
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), e = new GooglyEye(r * (row ? 0.6 : 1), side > 0 ? 1.12 : 0.95);
      e.group.position.set(side * (x + row * r * 0.9), y + row * r * 1.2, z - row * r * 0.5); parent.add(e.group); this.eyes.push(e);
    }
  }
  _tail(parent, kind, x, y, z, r, C, tip) {
    const n = kind === 'long' ? 7 : kind === 'thick' || kind === 'spiked' ? 5 : kind === 'bushy' || kind === 'bushytip' ? 4 : kind === 'stub' ? 1 : 3;
    let p = new THREE.Group(); p.position.set(x, y, z); parent.add(p);
    for (let i = 0; i < n; i++) {
      const k = i / n, rr = kind === 'bushy' || kind === 'bushytip' ? r * (0.75 + Math.sin(k * Math.PI) * 0.6) : kind === 'tuft' ? r * 0.28 : r * (1 - k * 0.75);
      const seg = new THREE.Group(); p.add(seg); if (i) seg.position.z = -rr * 1.25;
      mesh(ball(rr, 10), (kind === 'bushytip' && i === n - 1) || (kind === 'tuft' && i === n - 1) ? tip : C, seg).scale.set(1, 1, 1.35);
      if (kind === 'tuft' && i === n - 1) seg.children[0].scale.setScalar(2.4);
      if (kind === 'spiked' && i >= n - 2) for (const s of [-1, 1]) { const sp = mesh(cone(rr * 0.35, rr * 1.8, 6), tip, seg, s * rr * 0.7, rr * 0.5, 0); sp.rotation.z = -s * 0.9; }
      this.tail.push(seg); p = seg;
    }
  }

  // ---- four-legged beans (and the spider): a bean lying down on stubby legs, with a big head end
  _quad(C, Bel, dark, white, pink) {
    const B = this.B, h = this.h, bug = B.kind === 'bug', legL = h * (bug ? 0.3 : 0.4) * (B.legs || 1), r = h * (bug ? 0.42 : 0.33) * (B.wide || 1), L = h * (B.body || 1.0) * (bug ? 0.5 : 1.15);
    this.baseY = legL + r * 0.9; this.body.position.y = this.baseY;
    mesh(beanGeo(r, L, 0.1, 'z'), C, this.body);
    const belly = mesh(beanGeo(r * 0.82, L * 0.8, 0.1, 'z'), Bel, this.body, 0, -r * 0.24, 0); belly.userData.noOutline = true;
    // the head: the front of the bean, a bit bigger (or out on a long neck)
    this.head = new THREE.Group(); this.headK = B.small || 1;
    const hr = r * 1.0 * this.headK; let hx = 0, hy = r * 0.42, hz = L / 2 + r * 0.45;
    if (B.neck) { const n = B.neck * h * 0.42; const neck = mesh(cap(r * 0.42, n), C, this.body, 0, r * 0.3 + n / 2, L / 2 + r * 0.2); neck.rotation.x = 0.45; hy = r * 0.5 + n * 0.95; hz = L / 2 + r * 0.2 + n * 0.45; this.neck = neck; }
    this.head.position.set(hx, hy, hz); this.body.add(this.head); this.headRest = this.head.position.clone();
    mesh(ball(hr, 18), C, this.head).scale.set(1, 0.95, 1.05);
    if (B.snout) { mesh(ball(hr * 0.62, 14), B.belly === 0xffffff || B.snout > 0.2 ? Bel : C, this.head, 0, -hr * 0.22, hr * 0.78).scale.set(1.1, 0.8, 1.2); mesh(ball(hr * 0.2, 10), dark, this.head, 0, -hr * 0.05, hr * 1.42); }
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -hr * 0.45, hr * 0.55); this.head.add(this.jaw);
    const mouth = mesh(ball(hr * 0.5, 12), dark, this.jaw, 0, 0, hr * 0.3); mouth.scale.set(1, 0.3, 1.1); mouth.userData.noOutline = true; this.mouthMesh = mouth;
    for (let i = 0; i < (B.teeth || 0); i++) { const t = mesh(cone(hr * 0.09, hr * 0.26, 5), white, this.head, (i - (B.teeth - 1) / 2) * hr * 0.3, -hr * 0.42, hr * 1.15); t.rotation.x = Math.PI; t.userData.noOutline = true; }
    if (B.fangs) for (const s of [-1, 1]) { const t = mesh(cone(hr * 0.12, hr * 0.5, 6), white, this.head, s * hr * 0.3, -hr * 0.6, hr * 0.8); t.rotation.x = Math.PI; }
    if (B.tongue) { this.tongue = mesh(cap(hr * 0.13, hr * 0.35), pink, this.jaw, hr * 0.22, -hr * 0.12, hr * 0.75); this.tongue.rotation.x = 1.2; }
    if (B.ring) { const ring = mesh(new THREE.TorusGeometry(hr * 0.22, hr * 0.05, 8, 16), toon(0xffc94a), this.head, 0, -hr * 0.42, hr * 1.25); ring.rotation.x = 0.3; }
    this._eyes(this.head, hr * 0.48, hr * 0.4, hr * 0.62, hr * 0.4, B.eyes || 2);
    // ears, horns, antlers, frills, crests
    const E = B.ears; if (E) for (const s of [-1, 1]) {
      const big = E === 'bigpoint' ? 1.5 : 1, ear = E === 'round' ? mesh(ball(hr * 0.3, 10), C, this.head, s * hr * 0.75, hr * 0.75, -hr * 0.1) : mesh(cone(hr * 0.3 * big, hr * 0.75 * big, 8), C, this.head, s * hr * 0.6, hr * 0.95 * (0.8 + big * 0.2), -hr * 0.05);
      ear.rotation.z = -s * 0.35; (this.ears ||= []).push(ear);
    }
    if (B.horns === 'bull') for (const s of [-1, 1]) { const hn = mesh(cone(hr * 0.2, hr * 1.0, 8), white, this.head, s * hr * 0.9, hr * 0.7, 0); hn.rotation.z = -s * 1.0; }
    if (B.horns === 'three') { for (const s of [-1, 1]) { const hn = mesh(cone(hr * 0.16, hr * 1.2, 8), white, this.head, s * hr * 0.45, hr * 0.9, hr * 0.45); hn.rotation.x = 0.7; } const nose = mesh(cone(hr * 0.14, hr * 0.5, 8), white, this.head, 0, hr * 0.1, hr * 1.35); nose.rotation.x = 0.9; }
    if (B.frill) { const f = mesh(new THREE.CylinderGeometry(hr * 1.5, hr * 1.5, hr * 0.14, 18), toon(B.frill), this.head, 0, hr * 0.45, -hr * 0.55); f.rotation.x = Math.PI / 2 - 0.35; }
    if (B.crest) { const c = mesh(cap(hr * 0.22, hr * 1.3), toon(B.crest), this.head, 0, hr * 0.85, -hr * 0.6); c.rotation.x = -1.0; }
    if (B.antlers) for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * hr * 0.5, hr * 0.8, -hr * 0.1); a.rotation.z = -s * 0.4; this.head.add(a); mesh(cap(hr * 0.07, hr * 1.4), toon(0xe8dcc0), a, 0, hr * 0.7, 0); for (let i = 0; i < 3; i++) { const b = mesh(cap(hr * 0.055, hr * 0.5), toon(0xe8dcc0), a, s * hr * 0.25, hr * (0.5 + i * 0.4), 0); b.rotation.z = -s * 1.0; } }
    if (B.mane) for (let i = 0; i < 6; i++) mesh(cone(r * 0.16, r * 0.5, 6), toon(B.mane), this.body, 0, r * 0.95, L / 2 - i * r * 0.4);
    if (B.plates) for (let i = 0; i < 6; i++) { const pl = mesh(cone(r * 0.34, r * (0.6 + Math.sin(i / 5 * Math.PI) * 0.6), 4), toon(B.plates), this.body, 0, r * (1.05 + Math.sin(i / 5 * Math.PI) * 0.25), L / 2 - i * L / 5.5); pl.scale.x = 0.3; }
    if (B.stripes) for (let i = 0; i < 6; i++) { const st = mesh(new THREE.TorusGeometry(r * 1.005, r * 0.07, 6, 22), toon(B.stripes), this.body, 0, 0, -L / 2 + (i + 0.6) * L / 6); st.userData.noOutline = true; }
    if (B.spots) for (let i = 0; i < 9; i++) { const a = i * 2.4, sp = mesh(ball(r * 0.13, 8), toon(B.spots), this.body, Math.cos(a) * r * 0.86, r * 0.45 + Math.sin(i) * r * 0.2, -L / 2 + (i + 0.5) * L / 9); sp.userData.noOutline = true; sp.scale.y = 0.5; }
    if (B.tail) this._tail(this.body, B.tail, 0, r * 0.25, -L / 2 - r * 0.5, r * (B.tail === 'thick' || B.tail === 'spiked' || B.tail === 'long' ? 0.7 : 0.34), C, B.tail === 'tuft' ? toon(0x16161c) : B.tail === 'spiked' ? toon(0xf2efe6) : toon(0xffffff));
    // legs: four stubby pegs (eight spindly ones for the spider)
    const n = bug ? 8 : 4, lr = h * (bug ? 0.035 : 0.1) * (B.wide || 1);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), fz = bug ? (row - 1.5) * L * 0.42 : (row ? -1 : 1) * L * 0.36, g = new THREE.Group();
      g.position.set(side * r * (bug ? 0.9 : 0.62), -r * 0.5, fz); this.body.add(g);
      if (bug) { const up = mesh(cap(lr, h * 0.45), toon(0x1a1a22), g, side * h * 0.2, h * 0.08, 0); up.rotation.z = side * -1.0; const lo = mesh(cap(lr, h * 0.5), toon(0x1a1a22), g, side * h * 0.47, -h * 0.1, 0); lo.rotation.z = side * 0.5; }
      else { mesh(cap(lr, legL * 0.75), C, g, 0, -legL * 0.45, 0); mesh(ball(lr * 1.35, 10), toon(0x2a2a30), g, 0, -legL * 0.92, lr * 0.3).scale.set(1, 0.6, 1.3); }
      this.legs.push({ g, side, row, bug, rest: g.position.clone() });
    }
  }

  // ---- upright beans: the Yeti, and the dinosaurs that lean forward with a tail behind
  _upright(C, Bel, dark, white, pink) {
    const B = this.B, h = this.h, dino = B.kind === 'dino', r = h * (B.slim || (dino ? 0.24 : 0.3)), legL = h * 0.2;
    this.baseY = legL; this.body.position.y = legL; this.lean = dino ? 0.62 : 0;
    this.torso = new THREE.Group(); this.torso.rotation.x = this.lean; this.body.add(this.torso);
    const len = h - legL - r * 2;
    mesh(beanGeo(r, len, 0.16), C, this.torso, 0, len / 2 + r, 0);
    const belly = mesh(beanGeo(r * 0.8, len * 0.75, 0.16), Bel, this.torso, 0, len / 2 + r * 0.9, r * 0.28); belly.userData.noOutline = true;
    this.head = new THREE.Group(); this.head.position.set(0, len + r * 1.2, r * 0.1); this.torso.add(this.head); this.headRest = this.head.position.clone(); this.headK = 1;
    const hr = r * (dino ? 1.15 : 1.0);
    if (dino) { this.head.rotation.x = -this.lean; mesh(ball(hr, 18), C, this.head).scale.set(0.95, 0.9, 1.25); const sn = mesh(ball(hr * 0.75, 14), C, this.head, 0, hr * 0.05, hr * 0.95); sn.scale.set(0.9, 0.7, 1.3); }
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -hr * (dino ? 0.3 : 0.55), hr * (dino ? 0.5 : 0.75)); this.head.add(this.jaw);
    if (dino) { const lj = mesh(ball(hr * 0.72, 14), Bel, this.jaw, 0, -hr * 0.12, hr * 0.6); lj.scale.set(0.85, 0.42, 1.25 * (B.jaw || 1)); }
    const mouth = mesh(ball(hr * (dino ? 0.6 : 0.34), 12), dark, this.jaw, 0, dino ? hr * 0.02 : 0, hr * (dino ? 0.62 : 0.12)); mouth.scale.set(0.9, 0.22, dino ? 1.2 : 0.6); mouth.userData.noOutline = true; this.mouthMesh = mouth;
    for (let i = 0; i < (B.teeth || 0); i++) {
      const k = (i - (B.teeth - 1) / 2), t = mesh(cone(hr * 0.09, hr * 0.3, 5), white, this.head, k * hr * (dino ? 0.2 : 0.3), -hr * (dino ? 0.18 : 0.42), hr * (dino ? 1.5 - Math.abs(k) * 0.12 : 0.85)); t.rotation.x = Math.PI; t.userData.noOutline = true;
    }
    this._eyes(this.head, hr * 0.5, hr * (dino ? 0.5 : 0.3), hr * (dino ? 0.55 : 0.78), hr * (dino ? 0.42 : 0.36));
    if (B.hat) { // every keeper wears a silly hat
      const hat = new THREE.Group(); hat.position.set(0, hr * 0.62, 0); this.head.add(hat); this.hat = hat;
      if (B.hat === 'cap') { mesh(ball(hr * 0.72, 14), toon(0x2f7d4f), hat).scale.set(1, 0.6, 1); mesh(new THREE.CylinderGeometry(hr * 0.5, hr * 0.5, hr * 0.07, 14), toon(0x24603c), hat, 0, hr * 0.02, hr * 0.6).scale.set(1, 1, 1.2); mesh(ball(hr * 0.1, 8), toon(0xffc94a), hat, 0, hr * 0.42, 0); }
      else if (B.hat === 'safari') { mesh(new THREE.CylinderGeometry(hr * 1.15, hr * 1.15, hr * 0.07, 20), toon(0xd9b877), hat, 0, hr * 0.05, 0); mesh(ball(hr * 0.66, 14), toon(0xd9b877), hat, 0, hr * 0.05, 0).scale.set(1, 0.75, 1); mesh(new THREE.TorusGeometry(hr * 0.62, hr * 0.06, 6, 18), toon(0x7a4a2a), hat, 0, hr * 0.14, 0).rotation.x = Math.PI / 2; }
      else if (B.hat === 'prop') { mesh(ball(hr * 0.7, 14), toon(0x4a7dff), hat).scale.set(1, 0.6, 1); mesh(cap(hr * 0.04, hr * 0.25), toon(0xffc94a), hat, 0, hr * 0.55, 0); this.prop = new THREE.Group(); this.prop.position.y = hr * 0.72; hat.add(this.prop); for (const sd of [-1, 1]) mesh(ball(hr * 0.3, 8), toon(0xe5484d), this.prop, sd * hr * 0.3, 0, 0).scale.set(1, 0.12, 0.4); }
      else { mesh(new THREE.CylinderGeometry(hr * 0.7, hr * 0.7, hr * 0.08, 4), toon(0xff7a1a), hat, 0, hr * 0.02, 0); mesh(cone(hr * 0.5, hr * 1.3, 12), toon(0xff7a1a), hat, 0, hr * 0.68, 0); mesh(new THREE.CylinderGeometry(hr * 0.27, hr * 0.36, hr * 0.26, 12), toon(0xffffff), hat, 0, hr * 0.6, 0).userData.noOutline = true; }
    }
    if (B.brow) for (const s of [-1, 1]) { const b = mesh(cap(hr * 0.1, hr * 0.5), toon(0x2a4a20), this.head, s * hr * 0.5, hr * 1.0, hr * 0.62); b.rotation.z = Math.PI / 2 + s * 0.45; }
    if (B.feather) for (let i = 0; i < 3; i++) { const f = mesh(cone(hr * 0.12, hr * 0.7, 5), toon(B.feather), this.head, 0, hr * 0.95, -hr * 0.3 - i * hr * 0.3); f.rotation.x = -0.6; }
    if (B.horns === 'nub') for (const s of [-1, 1]) mesh(cone(hr * 0.16, hr * 0.4, 7), toon(0x9db4c8), this.head, s * hr * 0.55, hr * 0.9, 0);
    if (B.fur) for (let i = 0; i < 14; i++) { const a = i * 2.39, t = mesh(cone(r * 0.2, r * 0.5, 5), C, this.torso, Math.cos(a) * r * 0.95, r + (i / 14) * len, Math.sin(a) * r * 0.95); t.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); }
    if (B.stripes) for (let i = 0; i < 4; i++) { const st = mesh(new THREE.TorusGeometry(r * 1.01, r * 0.07, 6, 20, Math.PI), toon(B.stripes), this.torso, 0, r * 1.2 + i * len / 4.5, 0); st.rotation.set(Math.PI / 2, 0, Math.PI); st.userData.noOutline = true; }
    if (B.tail) this._tail(this.torso, B.tail, 0, r * 0.9, -r * 0.8, r * 0.75, C, C);
    const ar = h * (B.arms || 0.3); this.handY = -ar * 0.85;
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * r * 0.95, len * (dino ? 0.75 : 0.8) + r * 0.6, dino ? r * 0.5 : 0); this.torso.add(a);
      mesh(cap(ar * 0.2, ar * 0.6), C, a, 0, -ar * 0.4, 0); mesh(ball(ar * 0.3, 10), dino ? toon(0x2a2a30) : Bel, a, 0, -ar * 0.85, 0);
      this.arms.push({ g: a, side: s });
      const g = new THREE.Group(); g.position.set(s * r * 0.5, 0, dino ? r * 0.4 : 0); this.body.add(g);
      mesh(cap(h * 0.08, legL * 0.7), C, g, 0, -legL * 0.45, 0); mesh(ball(h * 0.11, 10), toon(0x2a2a30), g, 0, -legL * 0.9, h * 0.05).scale.set(1, 0.55, 1.5);
      this.legs.push({ g, side: s, row: 0, rest: g.position.clone() });
    }
  }

  // st: { speed, run (its top speed), act, asleep, dizzy, angry (0..1), look (world Vector3 dir or null), fwd (world Vector3) }
  update(dt, st) {
    const B = this.B, h = this.h, act = st.frozen ? this.lastAct : st.act; this.lastAct = act;
    if (st.frozen) return;                                            // a statue: nothing moves, not even the eyes
    this.t += dt;
    const sp = st.speed || 0, run = clamp(sp / (st.run || 6), 0, 1.3), moving = sp > 0.15;
    this.phase += dt * (4 + run * 9) * (moving ? 1 : 0);
    const ph = this.phase, t = this.t, quad = B.kind !== 'dino' && B.kind !== 'up';
    // a spring for squash and stretch: chomps, landings and rams kick it
    this.sqV += (-this.sq * 120 - this.sqV * 12) * dt; this.sq += this.sqV * dt;
    const breathe = Math.sin(t * 2) * 0.02, hop = moving ? Math.abs(Math.sin(ph)) * h * 0.06 * (0.5 + run) : 0;
    const want = { mouth: 0, pitch: 0, roll: 0, headP: 0, headY: 0, y: 0 };
    if (st.asleep) { want.roll = quad ? 1.45 : 0; want.pitch = quad ? 0 : -1.45; want.y = quad ? -this.baseY * 0.35 : -this.baseY * 0.2; want.mouth = 0.3 + Math.sin(t * 1.2) * 0.3; }
    else if (act === 'eat') { want.headP = 0.9 + Math.sin(t * 9) * 0.12; want.mouth = 0.5 + Math.sin(t * 9) * 0.5; }
    else if (act === 'howl') { want.headP = -1.1; want.pitch = -0.25; want.mouth = 0.9; }
    else if (act === 'roar') { want.headP = -0.45; want.mouth = 1; want.roll = Math.sin(t * 40) * 0.05; }
    else if (act === 'attack' || act === 'ram') { want.mouth = 1; want.headP = act === 'ram' ? 0.5 : -0.2; if (this.lastKick !== act + Math.floor(t)) { this.lastKick = act + Math.floor(t); this.sqV = 6; } }
    else if (act === 'windup') { want.pitch = 0.22; want.headP = 0.6; want.roll = Math.sin(t * 30) * 0.03; }
    else if (act === 'charge') { want.pitch = 0.3; want.headP = 0.5; }
    else if (act === 'sniff') { want.headP = 0.7 + Math.sin(t * 12) * 0.08; want.headY = Math.sin(t * 2.5) * 0.4; }
    else if (act === 'dance') { want.roll = Math.sin(t * 9) * 0.3; want.y = Math.abs(Math.sin(t * 9)) * h * 0.12; this.spin += dt * 3; want.mouth = 0.6; }
    // talking: the mouth flaps and the whole bean pumps up and down like a squeaky toy
    const talk = st.talk || 0;
    if (talk > 0.02 && !st.asleep) { want.mouth = Math.max(want.mouth, 0.25 + talk * 0.75 * Math.abs(Math.sin(t * 19))); want.headP += Math.sin(t * 15) * 0.3 * talk; }
    if (st.crouch && !st.asleep) { want.y -= h * 0.16; want.pitch += 0.3; }
    if (this.prop) this.prop.rotation.y += dt * (5 + sp * 4 + talk * 40);
    if (st.dizzy) { want.roll += Math.sin(t * 8) * 0.25; want.headY = Math.sin(t * 6) * 0.6; }
    if (act !== 'dance') this.spin *= Math.max(0, 1 - dt * 6);
    if (moving && !st.asleep) { want.roll += Math.sin(ph) * 0.07 * (0.6 + run); want.pitch += run * 0.12; }
    const k = Math.min(1, dt * 9);
    this.pose += ((st.asleep ? 1 : 0) - this.pose) * k;
    const b = this.body; b.rotation.z += (want.roll - b.rotation.z) * k; b.rotation.x += (want.pitch - b.rotation.x) * k; b.rotation.y = this.spin;
    b.position.y += (this.baseY + want.y + hop - b.position.y) * k;
    const s = 1 + this.sq * 0.25 + breathe + (talk > 0.02 ? Math.sin(t * 15) * 0.17 * talk : 0); b.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    // head: nod, turn toward whoever it's looking at, bob along while walking
    if (st.look && !st.asleep && !st.dizzy && act !== 'howl' && act !== 'eat') { const ly = Math.atan2(st.look.x, st.look.z) - Math.atan2(st.fwd.x, st.fwd.z); want.headY += clamp(Math.atan2(Math.sin(ly), Math.cos(ly)), -0.9, 0.9); want.headP += clamp(-st.look.y, -0.4, 0.4) * 0.6; }
    const hd = this.head; hd.rotation.y += (want.headY - hd.rotation.y) * k;
    const baseP = B.kind === 'dino' ? -this.lean : 0; hd.rotation.x += (baseP + want.headP - hd.rotation.x) * k;
    hd.position.y = this.headRest.y + (moving ? Math.sin(ph * 2) * h * 0.012 : 0);
    this.mouth += (want.mouth - this.mouth) * Math.min(1, dt * 14);
    this.jaw.rotation.x = this.mouth * 0.75; if (this.mouthMesh) this.mouthMesh.scale.y = 0.2 + this.mouth * 0.9;
    if (this.tongue) this.tongue.rotation.z = Math.sin(t * 7) * 0.2;
    if (this.ears) this.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 1.7 + i * 2) * 0.12 - (st.angry || 0) * 0.5; });
    // legs: trot in pairs; the spider ripples; sleeping animals tuck them in
    for (const l of this.legs) {
      const off = l.bug ? l.row * 1.6 + (l.side > 0 ? 0 : Math.PI) : (l.row ? Math.PI : 0) + (l.side > 0 ? 0 : Math.PI), a = ph + off;
      const lift = moving ? Math.max(0, Math.sin(a)) : 0, swing = moving ? Math.cos(a) : 0;
      l.g.position.y = l.rest.y + lift * h * 0.07; l.g.rotation.x = swing * 0.55 * (0.5 + run * 0.6) + (act === 'windup' && l.row === 0 && l.side > 0 ? Math.sin(t * 14) * 0.7 : 0);
      l.g.scale.y = 1 - this.pose * 0.5;
    }
    for (const a of this.arms) { const sw = Math.sin(ph + (a.side > 0 ? 0 : Math.PI)); a.g.rotation.x = (moving ? sw * 0.6 : 0) + (act === 'attack' ? -1.6 : act === 'dance' ? -2.6 + Math.sin(t * 9 + a.side) * 0.5 : act === 'roar' ? -1.0 : 0); a.g.rotation.z = a.side * (0.2 + (act === 'dance' || act === 'roar' ? 0.9 : 0)); }
    if (st.hold && this.arms[1] && !st.asleep) this.arms[1].g.rotation.x = -1.3 + Math.sin(ph) * 0.08;   // holding something out in front
    // tail: every segment follows the one before it, so it swishes; faster when worked up
    const wag = 2.2 + (st.angry || 0) * 4 + run * 3;
    this.tail.forEach((sg, i) => { sg.rotation.y = Math.sin(t * wag - i * 0.7) * (0.16 + (st.angry || 0) * 0.1); sg.rotation.x = Math.sin(t * 1.3 - i * 0.5) * 0.05 + (B.tail === 'bushy' || B.tail === 'bushytip' ? -0.15 : B.kind === 'dino' ? 0.05 : 0.1); });
    // eyes
    const fwd = st.fwd, dir = st.look || fwd;
    for (const e of this.eyes) e.update(dt, dir, fwd, { angry: st.angry || 0, out: st.asleep || !!st.dizzy, shake: Math.min(3, sp * 0.35) });
  }
}
