// You: first-person movement that feels good. Quick acceleration and friction, air control, coyote time
// and buffered jumps, sprinting on stamina, crouching (quieter, harder to spot), a slide when you crouch
// at a sprint, climbing onto anything waist-high or a bit more, and getting knocked flying by a bull.
import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { clamp } from './util.js';

const ease = t => t * t * (3 - 2 * t);

export class Player {
  constructor(world, upgrades) {
    this.world = world; this.up = upgrades;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.pitch = 0;
    this.reset();
  }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get eye() { return PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * this.crouchK; }
  get armor() { return 1 - 0.2 * (this.up.vest || 0); }

  reset() {
    const [x, z] = this.world.spawn;
    this.pos.set(x, this.world.standAt(x, z) + 0.05, z); this.vel.set(0, 0, 0);
    this.hp = PLAYER.health; this.stamina = PLAYER.stamina; this.down = false; this.downT = 0;
    this.grounded = true; this.coyote = 0; this.jumpBuf = 0; this.mantle = null; this.crouch = false; this.crouchK = 0; this.slide = 0;
    this.stepPhase = 0; this.sprinting = false; this.regenWait = 0; this.hurtT = 0; this.surface = 'stone'; this.stun = 0;
  }
  hurt(dmg, kx = 0, kz = 0) {
    if (this.down) return;
    this.hp -= dmg * this.armor; this.hurtT = 0.5;
    this.vel.x += kx * 9; this.vel.z += kz * 9; this.vel.y = Math.max(this.vel.y, 3.5); this.grounded = false; this.stun = 0.25;
    if (this.hp <= 0) { this.hp = 0; this.down = true; this.downT = 0; }
  }
  revive(hp = 45) { this.down = false; this.hp = hp; this.hurtT = 0; }

  // input: { mx, mz, yaw, pitch, sprint, jump (held), jumpHit, crouch (held), slow (carrying something heavy) }
  // Returns what happened: { step, jumped, landed, mantled, slid }
  update(dt, input) {
    const ev = {}, P = PLAYER, w = this.world;
    this.yaw = input.yaw; this.pitch = input.pitch;
    this.hurtT = Math.max(0, this.hurtT - dt); this.stun = Math.max(0, this.stun - dt);
    if (this.down) { this.downT += dt; input = { ...input, mx: 0, mz: 0, jump: false, jumpHit: false, sprint: false, crouch: true }; }
    if (this.mantle) {
      const m = this.mantle; m.t += dt / 0.4;
      const k = Math.min(1, m.t), up = ease(Math.min(1, k * 1.6)), fwd = ease(clamp((k - 0.35) / 0.65, 0, 1));
      this.pos.set(m.fx + (m.tx - m.fx) * fwd, m.fy + (m.ty - m.fy) * up, m.fz + (m.tz - m.fz) * fwd); this.vel.set(0, 0, 0);
      if (k >= 1) { this.mantle = null; this.grounded = true; }
      return ev;
    }
    const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw), fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let wx = fx * input.mz + rx * input.mx, wz = fz * input.mz + rz * input.mx;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const moving = wl > 0.05 && this.stun <= 0;
    if (!moving || this.stun > 0) { wx = wz = 0; }

    // Crouch and slide
    const wasCrouch = this.crouch;
    this.crouch = !!input.crouch && this.grounded || this.slide > 0;
    if (input.crouch && !wasCrouch && this.grounded && this.sprinting && this.speed > P.sprint * 0.8 && this.slide <= 0) {
      this.slide = P.slideTime; const k = P.slideSpeed / (this.speed || 1); this.vel.x *= k; this.vel.z *= k; ev.slid = true;
    }
    this.slide = Math.max(0, this.slide - dt);
    this.crouchK += ((this.crouch ? 1 : 0) - this.crouchK) * Math.min(1, dt * 12);

    this.sprinting = input.sprint && moving && input.mz > 0 && this.stamina > 1 && !this.crouch && !input.slow;
    const boots = 1 + 0.1 * (this.up.boots || 0);
    if (this.sprinting) { this.stamina -= 13 / boots * dt; this.regenWait = 0.8; }
    else if ((this.regenWait -= dt) <= 0) this.stamina += (this.speed < 0.5 ? 30 : 20) * dt;
    this.stamina = clamp(this.stamina, 0, P.stamina);

    this.coyote = this.grounded ? P.coyote : this.coyote - dt;
    this.jumpBuf = input.jumpHit ? P.jumpBuffer : this.jumpBuf - dt;

    let max = this.crouch ? P.crouch : this.sprinting ? P.sprint * boots : P.walk;
    if (input.slow) max *= 0.82; if (input.mz < 0) max *= 0.8;
    if (this.slide > 0) {
      const sp = this.speed, drop = 5.5 * dt; if (sp > 0.01) { const k = Math.max(0, sp - drop) / sp; this.vel.x *= k; this.vel.z *= k; } // slides coast, then slow
      this._accel(wx, wz, 3, 6 * dt);
    } else if (this.grounded) {
      const sp = this.speed;
      if (sp > 0.001) { const drop = Math.max(sp, 2.2) * P.friction * dt, k = Math.max(0, sp - drop) / sp; this.vel.x *= k; this.vel.z *= k; }
      this._accel(wx, wz, max, P.accel * dt);
    } else this._accel(wx, wz, Math.min(max, 3.4), P.airAccel * dt);
    this.vel.y -= P.gravity * dt;
    if (this.vel.y > 0 && !input.jump) this.vel.y -= P.gravity * dt * 0.9;       // short hop if you let go early
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.down) { this.vel.y = P.jump; this.grounded = false; this.coyote = 0; this.jumpBuf = 0; this.slide = 0; ev.jumped = true; }
    // Grab a ledge in front of you
    if ((input.jumpHit || (input.jump && !this.grounded)) && input.mz > 0 && !this.down) {
      const ax = this.pos.x + fx * 0.8, az = this.pos.z + fz * 0.8, top = w.standAt(ax, az, this.pos.y + 1.7), rise = top - this.pos.y;
      if (rise > 0.6 && rise < 2.3 && top > w.heightAt(ax, az) + 0.3) { this.mantle = { t: 0, fx: this.pos.x, fy: this.pos.y, fz: this.pos.z, tx: ax, ty: top + 0.02, tz: az }; ev.mantled = true; return ev; }
    }

    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    w.push(this.pos, this.pos.y, 0.42, this.vel, this.crouch ? 1.1 : 1.75);
    const lim = WORLD.half - 1.2; this.pos.x = clamp(this.pos.x, -lim, lim); this.pos.z = clamp(this.pos.z, -lim, Math.abs(this.pos.x) < 10.4 ? 239 : lim);
    this.pos.y += this.vel.y * dt;
    const g = w.standAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= g) {
      if (!this.grounded && this.vel.y < -3.5) { ev.landed = -this.vel.y; if (this.vel.y < -15) this.hurt((-this.vel.y - 15) * 4); }
      this.pos.y = g; this.vel.y = 0; this.grounded = true;
    } else if (this.grounded && this.pos.y - g < 0.45 && this.vel.y <= 0) { this.pos.y = g; this.vel.y = 0; }
    else this.grounded = false;

    if (this.grounded && this.speed > 1 && this.slide <= 0) {
      const before = Math.floor(this.stepPhase / Math.PI);
      this.stepPhase += this.speed * dt * (this.sprinting ? 1.25 : this.crouch ? 2.2 : 1.6);
      if (Math.floor(this.stepPhase / Math.PI) !== before) { ev.step = true; this.surface = g > w.heightAt(this.pos.x, this.pos.z) + 0.15 ? 'wood' : w.surfaceAt(this.pos.x, this.pos.z); }
    }
    return ev;
  }
  _accel(wx, wz, max, amount) {
    const cur = this.vel.x * wx + this.vel.z * wz, add = max - cur;
    if (add <= 0) return;
    const a = Math.min(amount, add); this.vel.x += wx * a; this.vel.z += wz * a;
  }
}
