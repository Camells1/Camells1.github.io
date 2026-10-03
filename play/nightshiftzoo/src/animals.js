// The animals. By day they're ordinary. At night their eyes shine and they get ideas.
// Each kind has its own brain: wolf and raptor packs hunt, bulls and the triceratops charge,
// herds bolt and can be led home with a feed bucket, the fox steals your bucket, the Yeti only
// moves when nobody is looking, and the Rex hunts whatever moves or shines a light.
// On top of the models' own clips there are hand-made animations: heads that follow you, tails that
// sway, howls, sniffing, fence-ramming lunges, roars, dizzy spells, sleeping, and the Yeti's dance.
import * as THREE from 'three';
import { ZONES, SPECIES, PATHS } from './config.js';
import { Bean } from './beans.js';
import { clamp, lerp, angDiff } from './util.js';

const TAU = Math.PI * 2;
const RAM = { wolf: 9, fox: 3, zebra: 6, bull: 22, stag: 16, deer: 0, raptor: 14, trike: 45, stego: 30, para: 8, apato: 0, yeti: 40, spider: 4, trex: 90 };
export const RADIUS = { wolf: 0.5, fox: 0.35, zebra: 0.7, bull: 0.9, stag: 0.8, deer: 0.6, raptor: 0.6, trike: 1.6, stego: 1.7, para: 1.3, apato: 3, yeti: 0.9, spider: 0.5, trex: 2.2 };
// How much bigger than life each head is (cartoon proportions)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3();

export class Animals {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.list = new Map();
    this.group = new THREE.Group(); scene.add(this.group);
    this.onFx = null; // (kind, animal) for sounds and particles
  }

  // Put the animals of every open zone in their enclosures
  // day: every zone that has opened by this day. fresh = false only adds the zones that open today
  spawn(day, fresh = true) {
    if (fresh) this.clear();
    const R = (() => { let s = 1234567; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 | 0) >>> 0) / 4294967296; })();
    ZONES.forEach(zn => {
      if (zn.night > day || (!fresh && zn.night !== day)) return;
      for (const [sp, n] of [[zn.species, zn.count], ...(zn.also || [])]) for (let k = 0; k < n; k++) {
        const x = zn.x + (R() - 0.5) * (zn.w - 12), z = zn.z + (R() - 0.5) * (zn.d - 12);
        this.add({ id: `${zn.id}-${sp}-${k}`, sp, zone: zn.id, x, z, yaw: R() * TAU });
      }
    });
  }
  add(o) {
    const S = SPECIES[o.sp];
    const a = { state: 'calm', t: 0, tx: o.x, tz: o.z, wait: Math.random() * 3, y: this.world.heightAt(o.x, o.z), speed: 0, hp: S.hp, sleep: 0, cd: 0, stuck: 0, seen: false, act: '', actT: 0, flee: 0, lit: 0, target: null, obj: null, head: 0, headP: 0, dizzy: 0, out: false, ...o };
    this.list.set(a.id, a);
    return a;
  }
  clear() { for (const a of this.list.values()) this._release(a); this.list.clear(); }

  // ---------------------------------------------------------------- brains (the host runs these)
  // ctx: { dt, time, players [{ id, x, y, z, speed, crouch, light, lyaw, lpitch, carry, dance, down }], zones {id: { agit, fed, lit, breach }},
  //        level (night agitation factor), hurt(id, dmg, a, kx, kz), ram(segId, dmg, dir), take(playerId), back(a), chicken {x, z} | null }
  simulate(ctx) {
    const { dt } = ctx, W = this.world, all = [...this.list.values()];
    // bodies are solid: animals shoulder each other aside instead of walking through one another
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dz = b.z - a.z, min = RADIUS[a.sp] + RADIUS[b.sp];
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz); if (d >= min) continue;
      const nx = d > 0.01 ? dx / d : 1, nz = d > 0.01 ? dz / d : 0, push = min - d, wa = a.state === 'sleep' ? 0 : b.state === 'sleep' ? 1 : RADIUS[b.sp] / min, wb = b.state === 'sleep' ? 0 : 1 - wa;
      a.x -= nx * push * wa; a.z -= nz * push * wa; b.x += nx * push * wb; b.z += nz * push * wb;
      if (wa) W.push(a, a.y, RADIUS[a.sp], null, 1.2); if (wb) W.push(b, b.y, RADIUS[b.sp], null, 1.2);
    }
    for (const a of this.list.values()) {
      const S = SPECIES[a.sp], zn = ZONES.find(z => z.id === a.zone), zs = ctx.zones[a.zone] || { agit: 0 }, rad = RADIUS[a.sp];
      a.t += dt; a.cd -= dt; a.actT -= dt; if (a.actT <= 0) a.act = '';
      a.dizzy = Math.max(0, a.dizzy - dt);
      if (a.state === 'sleep') { a.sleep -= dt; a.speed = 0; if (a.sleep <= 0) { a.state = a.out ? 'loose' : 'calm'; this.onFx?.('wake', a); } continue; }
      // nearest player and whether a torch is on this animal
      let near = null, nd = 1e9, lit = false, watched = false;
      for (const p of ctx.players) {
        if (p.down) continue;
        const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
        if (d < nd) { nd = d; near = p; }
        const fx = -Math.sin(p.lyaw), fz = -Math.cos(p.lyaw), dot = d > 0.1 ? (-dx * fx - dz * fz) / d : 1;
        if (d < 34 && dot > 0.5) watched = true;
        if (p.light && d < 26 && dot > 0.82) lit = true;
      }
      a.lit = lit ? Math.min(1, a.lit + dt * 4) : Math.max(0, a.lit - dt * 2); a.seen = watched;
      let gx = a.tx, gz = a.tz, sp = 0, face = null;
      const inside = Math.abs(a.x - zn.x) < zn.w / 2 - 0.6 && Math.abs(a.z - zn.z) < zn.d / 2 - 0.6;
      const bucket = near && near.carry && nd < 16 ? near : null;

      if (!a.out) {
        // ---- in the enclosure
        const breach = zs.breach != null ? W.segments[zs.breach] : null;
        if (breach && (zs.agit > 0.35 || S.kind === 'pack' || S.kind === 'apex' || S.kind === 'stalker') && S.kind !== 'giant') {
          // a way out: head for it and step through
          const nx = Math.sign(breach.x - zn.x) * (Math.abs(breach.x - zn.x) > zn.w / 2 - 1 ? 1 : 0), nz = Math.sign(breach.z - zn.z) * (Math.abs(breach.z - zn.z) > zn.d / 2 - 1 ? 1 : 0);
          gx = breach.x + nx * 7; gz = breach.z + nz * 7; sp = S.run * 0.8; a.state = 'escape';
          if (!inside && Math.hypot(a.x - gx, a.z - gz) < 3) { a.out = true; a.state = 'loose'; a.t = 0; this.onFx?.('escape', a); }
        } else if (zs.fed > 0 && S.anims.eat && Math.hypot(a.x - zn.tx, a.z - zn.tz) < 30 && a.id.charCodeAt(a.id.length - 1) % 2 === 0) {
          gx = zn.tx + Math.cos(a.t * 0.1 + a.x) * 1.8; gz = zn.tz + Math.sin(a.t * 0.1 + a.z) * 1.8; sp = S.walk; a.state = 'eat';
          if (Math.hypot(a.x - gx, a.z - gz) < 1.6) { sp = 0; a.act = 'eat'; a.actT = 0.3; face = Math.atan2(zn.tx - a.x, zn.tz - a.z); }
        } else if (zs.agit > 0.55 && RAM[a.sp] > 0) {
          // pace to a fence panel and hit it
          a.state = 'agit';
          if (a.seg == null || a.wait <= 0) { const ids = zn.segs.filter(i => !W.segments[i].gate || (S.clever && !W.segments[i].locked)); const weak = ids.filter(i => W.segments[i].hp < W.segments[i].max && !W.segments[i].broken), from = weak.length && Math.random() < 0.7 ? weak : ids; a.seg = from[Math.floor(Math.random() * from.length)]; a.wait = 14 + Math.random() * 10; } // they go for the panel that's already giving way
          a.wait -= dt;
          const s = W.segments[a.seg], ix = Math.sign(zn.x - s.x) * (Math.abs(s.x - zn.x) > zn.w / 2 - 1 ? 1 : 0), iz = Math.sign(zn.z - s.z) * (Math.abs(s.z - zn.z) > zn.d / 2 - 1 ? 1 : 0);
          gx = s.x + ix * (rad + 1.1); gz = s.z + iz * (rad + 1.1); sp = S.walk * 1.6;
          if (Math.hypot(a.x - gx, a.z - gz) < 1.2) {
            sp = 0; face = Math.atan2(s.x - a.x, s.z - a.z);
            if (a.cd <= 0) { a.cd = 1.5 + Math.random() * 0.8; a.act = 'ram'; a.actT = 0.7; ctx.ram(s.id, RAM[a.sp] * (0.6 + ctx.level * 0.5) * (zs.lit ? 0.6 : 1), ix || iz ? -(ix + iz) : 1, a); if (s.gate && S.clever && !s.locked) ctx.openGate(s.id, a); }
          }
        } else {
          a.state = 'calm';
          a.wait -= dt;
          if (a.wait <= 0 || Math.hypot(a.x - a.tx, a.z - a.tz) < 1) {
            a.tx = zn.x + (Math.random() - 0.5) * (zn.w - 8); a.tz = zn.z + (Math.random() - 0.5) * (zn.d - 8); a.wait = 5 + Math.random() * 9;
            if (Math.random() < 0.3 && S.voice === 'howl' && zs.agit > 0.25) { a.act = 'howl'; a.actT = 3; this.onFx?.('voice', a); }
          }
          // curious: come and stare at a keeper standing by the fence
          if (near && nd < 20 && S.kind !== 'herd' && S.kind !== 'giant') { gx = lerp(a.x, near.x, 0.6); gz = lerp(a.z, near.z, 0.6); sp = S.walk; if (nd < 9) { sp = 0; face = Math.atan2(near.x - a.x, near.z - a.z); } }
          else { gx = a.tx; gz = a.tz; sp = a.wait > 4 ? S.walk : 0; }
        }
        // stay inside the fence
        if (a.state !== 'escape') { gx = clamp(gx, zn.x - zn.w / 2 + rad + 0.6, zn.x + zn.w / 2 - rad - 0.6); gz = clamp(gz, zn.z - zn.d / 2 + rad + 0.6, zn.z + zn.d / 2 - rad - 0.6); }
      } else {
        // ---- loose in the park
        a.state = 'loose';
        if (inside && (a.lured || zs.agit < 0.5) && a.t > 3) { a.out = false; a.state = 'calm'; a.lured = false; ctx.back(a); continue; }
        const roam = () => { a.wait -= dt; if (a.wait <= 0 || Math.hypot(a.x - a.tx, a.z - a.tz) < 3) { const live = ctx.players.filter(q => !q.down), smell = S.dmg > 0 && S.kind !== 'herd' && !ctx.day && live.length && Math.random() < 0.6; // at night the hunters can smell you
          if (smell) { const q = live[Math.floor(Math.random() * live.length)]; a.tx = q.x + (Math.random() - 0.5) * 36; a.tz = q.z + (Math.random() - 0.5) * 36; } else { const p = PATHS[Math.floor(Math.random() * PATHS.length)], q = p[Math.floor(Math.random() * p.length)]; a.tx = q[0] + (Math.random() - 0.5) * 8; a.tz = q[1] + (Math.random() - 0.5) * 8; } a.wait = 14; } gx = a.tx; gz = a.tz; sp = S.walk * 1.3; };
        const hunt = (range, speed) => {
          if (!near || nd > range) return false;
          gx = near.x; gz = near.z; sp = speed;
          if (nd < rad + 1.3) { sp = 0; face = Math.atan2(near.x - a.x, near.z - a.z); if (a.cd <= 0) { a.cd = 1.3; a.act = 'attack'; a.actT = 0.6; ctx.hurt(near.id, S.dmg, a, (near.x - a.x) / (nd || 1), (near.z - a.z) / (nd || 1)); } }
          return true;
        };
        const sense = (near ? (near.crouch && near.speed < 1 ? 0.45 : near.speed > 6 ? 1.3 : 1) : 1) * (ctx.day ? 0.4 : 1); // sleepy by day
        if (ctx.chicken && Math.hypot(ctx.chicken.x - a.x, ctx.chicken.z - a.z) < 30 && S.kind !== 'stalker') {
          gx = ctx.chicken.x; gz = ctx.chicken.z; sp = Math.hypot(gx - a.x, gz - a.z) > 2.5 ? S.walk * 1.5 : 0; face = sp ? null : Math.atan2(gx - a.x, gz - a.z); a.act = sp ? a.act : 'sniff'; a.actT = 0.3; // a squeaking rubber chicken beats everything
        } else if (bucket && (S.kind === 'herd' || S.kind === 'charger' || S.kind === 'giant') && bucket.carry === zn.feed) {
          a.lured = true; gx = bucket.x; gz = bucket.z; sp = nd > 3.5 ? S.walk * 2.2 : 0; face = sp ? null : Math.atan2(bucket.x - a.x, bucket.z - a.z); // follow the bucket home
        } else if (S.kind === 'pack') {
          if (a.lit > 0.5 && a.sp !== 'raptor') { a.flee = 1.2; }
          if (a.flee > 0 && near) { a.flee -= dt; gx = a.x - (near.x - a.x); gz = a.z - (near.z - a.z); sp = S.run * 0.7; }
          else if (!hunt(36 * sense, S.run)) roam();
          else if (nd > 7) { const side = (a.id.charCodeAt(a.id.length - 1) % 2 ? 1 : -1) * Math.min(6, nd * 0.4), ax = (near.z - a.z) / nd, az = -(near.x - a.x) / nd; gx += ax * side; gz += az * side; } // flank
        } else if (S.kind === 'charger') {
          if (a.charge > 0) {          // committed: runs straight until it hits something
            a.charge -= dt; gx = a.x + Math.sin(a.cyaw) * 10; gz = a.z + Math.cos(a.cyaw) * 10; sp = S.run * 1.35; a.act = 'charge'; a.actT = 0.2;
            for (const p of ctx.players) if (!p.down && Math.hypot(p.x - a.x, p.z - a.z) < rad + 1.0 && a.cd <= 0) { a.cd = 1.5; ctx.hurt(p.id, S.dmg, a, Math.sin(a.cyaw), Math.cos(a.cyaw)); }
            if (a.charge <= 0) { a.wait = 2.5; }
          } else if (a.windup > 0) { a.windup -= dt; sp = 0; face = a.cyaw; a.act = 'windup'; a.actT = 0.2; if (a.windup <= 0) a.charge = 2.4; }
          else if (near && nd < 28 * sense && a.wait <= 0) { a.windup = 1.15; a.cyaw = Math.atan2(near.x - a.x, near.z - a.z); this.onFx?.('voice', a); }
          else { a.wait -= dt; roam(); a.wait = Math.max(a.wait, -1); }
        } else if (S.kind === 'herd' || S.kind === 'giant') {
          if (near && nd < 14) { gx = a.x - (near.x - a.x) * 3; gz = a.z - (near.z - a.z) * 3; sp = S.run; if (nd < rad + 0.9 && a.cd <= 0 && S.dmg) { a.cd = 2; ctx.hurt(near.id, S.dmg, a, (near.x - a.x) / nd, (near.z - a.z) / nd); } }
          else roam();
        } else if (S.kind === 'thief') {
          const mark = ctx.players.find(p => !p.down && p.carry && Math.hypot(p.x - a.x, p.z - a.z) < 40);
          if (mark) { gx = mark.x; gz = mark.z; sp = S.run; if (Math.hypot(mark.x - a.x, mark.z - a.z) < 1.3 && a.cd <= 0) { a.cd = 6; ctx.take(mark.id, a); a.flee = 4; } }
          else roam();
          if (a.flee > 0 && near) { a.flee -= dt; gx = a.x - (near.x - a.x) * 4; gz = a.z - (near.z - a.z) * 4; sp = S.run; }
        } else if (S.kind === 'stalker') {
          // The Yeti: frozen solid while watched or lit. If you dance at it, it dances back.
          const dancer = ctx.players.find(p => p.dance && Math.hypot(p.x - a.x, p.z - a.z) < 14);
          if (dancer) { sp = 0; a.act = 'dance'; a.actT = 0.4; face = Math.atan2(dancer.x - a.x, dancer.z - a.z); }
          else if (a.seen || a.lit > 0.2) { sp = 0; a.act = 'freeze'; a.actT = 0.25; }
          else if (!hunt(70 * (ctx.day ? 0.3 : 1), S.run)) roam();
        } else if (S.kind === 'apex') {
          // The Rex: goes for whoever is moving or shining a light. Stand still in the dark and it loses you.
          let prey = null, pd = 1e9; for (const p of ctx.players) { if (p.down) continue; const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < (ctx.day ? 24 : 70) && (p.speed > 1.2 || p.light) && d < pd) { pd = d; prey = p; } }
          if (prey) { near = prey; nd = pd; hunt(70, pd > 18 ? S.run : S.run * 0.75); if (a.t % 9 < dt) { a.act = 'roar'; a.actT = 2; this.onFx?.('voice', a); } }
          else { roam(); if (Math.random() < dt * 0.08) { a.act = 'roar'; a.actT = 2.2; this.onFx?.('voice', a); } }
        }
      }

      // ---- move
      const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz);
      if (a.dizzy > 0) sp = 0;
      if (sp > 0 && d > 0.4) {
        const want = Math.atan2(dx, dz), turn = S.kind === 'charger' && a.charge > 0 ? 0.6 : 5;
        a.yaw += angDiff(want, a.yaw) * Math.min(1, dt * turn);
        const px = a.x, pz = a.z, fwd = Math.max(0.25, Math.cos(angDiff(want, a.yaw)));
        a.x += Math.sin(a.yaw) * sp * fwd * dt; a.z += Math.cos(a.yaw) * sp * fwd * dt;
        const hit = W.push(a, a.y, rad, null, 1.2);
        if (hit && a.charge > 0) { // a charger hits a wall: big bang, then it sees stars
          a.charge = 0; a.dizzy = 2.4; a.wait = 3; this.onFx?.('crash', a);
          const seg = W.segments.find(s => s.col === hit); if (seg && !seg.gate) ctx.ram(seg.id, RAM[a.sp] * 2.2, 1, a);
        }
        const moved = Math.hypot(a.x - px, a.z - pz);
        a.stuck = moved < sp * dt * 0.25 ? a.stuck + dt : 0;
        if (a.stuck > 1.2) { a.yaw += 1.6 + Math.random(); a.stuck = 0; a.wait = 0; }
        a.speed = moved / dt;
      } else { a.speed = 0; if (face != null) a.yaw += angDiff(face, a.yaw) * Math.min(1, dt * 6); }
      a.y = W.heightAt(a.x, a.z);
    }
  }

  // Tranquiliser dart. Big animals need more than one.
  dart(id) { const a = this.list.get(id); if (!a || a.state === 'sleep') return null; a.hp -= 1; this.onFx?.('hit', a); if (a.hp <= 0) { a.state = 'sleep'; a.sleep = 32; a.hp = SPECIES[a.sp].hp; a.charge = 0; a.windup = 0; this.onFx?.('sleep', a); } else if (a.out) a.flee = 2; return a; }
  // The cart crew takes a sleeping animal home
  tag(id) { const a = this.list.get(id); if (!a || a.state !== 'sleep') return false; const zn = ZONES.find(z => z.id === a.zone); a.x = zn.x + (Math.random() - 0.5) * 10; a.z = zn.z + (Math.random() - 0.5) * 10; a.out = false; a.state = 'sleep'; a.sleep = 10; a.lured = false; return true; }
  loose() { return [...this.list.values()].filter(a => a.out); }
  // What a ray from the dart rifle hits first (returns the animal or null)
  rayHit(ox, oy, oz, dx, dy, dz, range = 60) {
    let best = null, bt = range;
    for (const a of this.list.values()) {
      const S = SPECIES[a.sp], r = RADIUS[a.sp] + 0.35, cx = a.x - ox, cy = a.y + S.size * 0.5 - oy, cz = a.z - oz, t = cx * dx + cy * dy + cz * dz;
      if (t < 0 || t > bt) continue;
      const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
      if (px * px + pz * pz < r * r && Math.abs(py) < S.size * 0.6) { bt = t; best = a; }
    }
    return best;
  }

  // ---------------------------------------------------------------- co-op: the host sends, guests copy
  snapshot() { return [...this.list.values()].map(a => [a.id, +a.x.toFixed(2), +a.z.toFixed(2), +a.yaw.toFixed(2), a.state === 'sleep' ? 's' : a.out ? 'o' : 'i', a.act, +a.speed.toFixed(1), a.lit > 0.4 ? 1 : 0]); }
  apply(list) {
    const seen = new Set();
    for (const [id, x, z, yaw, st, act, speed, lit] of list) {
      seen.add(id);
      let a = this.list.get(id);
      if (!a) { const [zone, sp] = id.split('-'); a = this.add({ id, sp, zone, x, z, yaw }); }
      a.nx = x; a.nz = z; a.nyaw = yaw; a.out = st !== 'i'; a.state = st === 's' ? 'sleep' : st === 'o' ? 'loose' : 'calm'; if (act) { a.act = act; a.actT = 0.35; } a.speed = speed; a.lit = lit;
    }
    for (const id of [...this.list.keys()]) if (!seen.has(id)) { this._release(this.list.get(id)); this.list.delete(id); }
  }

  // ---------------------------------------------------------------- bodies and animation
  _acquire(a) {
    const bean = new Bean(a.sp, SPECIES[a.sp].size);
    a.obj = { bean, root: bean.root, zzz: 0, lunge: 0, angry: 0 };
    a.vx = a.x; a.vz = a.z; a.vyaw = a.yaw;
    this.group.add(bean.root);
  }
  _release(a) { if (a?.obj) { this.group.remove(a.obj.root); a.obj = null; } }

  // cam: camera position. look: [{x, y, z}] the keepers to watch. isHost: guests glide toward the host's positions
  update(dt, time, cam, look, isHost) {
    for (const a of this.list.values()) {
      const S = SPECIES[a.sp];
      if (!isHost && a.nx != null) { a.x += (a.nx - a.x) * Math.min(1, dt * 10); a.z += (a.nz - a.z) * Math.min(1, dt * 10); a.yaw += angDiff(a.nyaw, a.yaw) * Math.min(1, dt * 10); a.y = this.world.heightAt(a.x, a.z); if (a.state === 'sleep' && !a.sleeping) this.onFx?.('sleep', a); }
      const d = Math.hypot(a.x - cam.x, a.z - cam.z), near = d < (S.size > 3 ? 200 : 120);
      if (near && !a.obj) this._acquire(a); else if (!near && a.obj && d > (S.size > 3 ? 220 : 135)) this._release(a);
      const o = a.obj; if (!o) continue;
      a.vx += (a.x - a.vx) * Math.min(1, dt * 14); a.vz += (a.z - a.vz) * Math.min(1, dt * 14); a.vyaw += angDiff(a.yaw, a.vyaw) * Math.min(1, dt * 10);
      const asleep = a.state === 'sleep'; a.sleeping = asleep;
      if (a.act === 'ram' && o.lastAct !== 'ram') o.lunge = 1; o.lastAct = a.act;
      o.lunge = Math.max(0, o.lunge - dt * 3.5);
      const lunge = Math.sin(o.lunge * Math.PI) * 0.6, shake = a.act === 'roar' || a.act === 'windup' ? Math.sin(time * 38) * 0.03 : 0;
      o.root.position.set(a.vx + Math.sin(a.vyaw) * lunge + shake, a.y, a.vz + Math.cos(a.vyaw) * lunge);
      o.root.rotation.y = a.vyaw;
      // who to stare at
      const who = look.reduce((b, p) => { const dd = Math.hypot(p.x - a.x, p.z - a.z); return dd < (b?.d ?? 34) ? { p, d: dd } : b; }, null);
      const fwd = new THREE.Vector3(Math.sin(a.vyaw), 0, Math.cos(a.vyaw));
      const dir = who ? new THREE.Vector3(who.p.x - a.x, who.p.y + 1.4 - (a.y + S.size * 0.8), who.p.z - a.z).normalize() : null;
      o.angry += ((a.state === 'agit' || a.out ? 1 : 0) - o.angry) * Math.min(1, dt * 3);
      o.bean.update(dt, { speed: a.speed, run: S.run, act: a.act, asleep, dizzy: a.dizzy > 0, angry: o.angry, look: dir, fwd, frozen: a.act === 'freeze' });
      if (asleep) { o.zzz -= dt; if (o.zzz <= 0) { o.zzz = 1.2; this.onFx?.('zzz', a); } }
      else if (a.dizzy > 0 && Math.random() < dt * 5) this.onFx?.('stars', a);
    }
  }
  dispose() { this.clear(); this.scene.remove(this.group); }
}
