// Particles and weather: dust, fence splinters and sparks, sleepy Zs, hearts, confetti, moths at the lamps,
// fireflies in the dark, and rain when the storm comes.
import * as THREE from 'three';

class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.rgba = new Float32Array(max * 4); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.top = new Float32Array(max).fill(1e9);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = { uScale: { value: 600 } };
    this.mesh = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main() { vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, ${additive ? '0.0' : '0.25'}, d) * vC.a; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb${additive ? ' * a' : ''}, a); }`
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
  }
  // p: { x,y,z, vx,vy,vz, life, size, size2, r,g,b, a, grav, drag, top (dies above this height) }
  emit(p) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx || 0; this.vel[i * 3 + 1] = p.vy || 0; this.vel[i * 3 + 2] = p.vz || 0;
    this.life[i] = this.maxLife[i] = p.life || 1;
    this.rgba[i * 4] = p.r ?? 1; this.rgba[i * 4 + 1] = p.g ?? 1; this.rgba[i * 4 + 2] = p.b ?? 1; this.rgba[i * 4 + 3] = p.a ?? 1;
    this.s0[i] = p.size ?? 0.1; this.s1[i] = p.size2 ?? this.s0[i];
    this.grav[i] = p.grav ?? 0; this.drag[i] = p.drag ?? 0; this.top[i] = p.top ?? 1e9;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 - this.life[i] / this.maxLife[i], j = i * 3, d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j + 1] -= this.grav[i] * dt;
      this.vel[j] *= d; this.vel[j + 1] *= d; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] > this.top[i]) this.life[i] = 0;
      const fade = Math.min(1, k * 8) * Math.min(1, (1 - k) * 2.5);
      this.col[i * 4] = this.rgba[i * 4]; this.col[i * 4 + 1] = this.rgba[i * 4 + 1]; this.col[i * 4 + 2] = this.rgba[i * 4 + 2];
      this.col[i * 4 + 3] = this.life[i] > 0 ? this.rgba[i * 4 + 3] * fade : 0;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true;
  }
}


const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;

export class Fx {
  constructor(scene, world, quality) {
    this.scene = scene; this.world = world;
    this.soft = new Particles(quality === 'low' ? 900 : 2200, false);
    this.glow = new Particles(quality === 'low' ? 500 : 1200, true);
    this.group = new THREE.Group(); this.group.add(this.soft.mesh, this.glow.mesh); scene.add(this.group);
    this.acc = { rain: 0, moth: 0, fly: 0 };
    // Rain: short streaks that fall around the camera during storms
    const n = quality === 'low' ? 700 : 1800, pos = new Float32Array(n * 6);
    this.rainN = n; this.rainP = Array.from({ length: n }, () => [rnd(26), Math.random() * 22, rnd(26)]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.rain.frustumCulled = false; this.group.add(this.rain);
  }
  dust(x, y, z, n = 8, tint = [0.6, 0.55, 0.45]) { for (let i = 0; i < n; i++) this.soft.emit({ x: x + rnd(0.3), y: y + 0.1, z: z + rnd(0.3), vx: rnd(1.2), vy: 0.4 + Math.random() * 0.8, vz: rnd(1.2), life: 0.7 + Math.random() * 0.5, size: 0.2, size2: 0.9, r: tint[0], g: tint[1], b: tint[2], a: 0.3, drag: 2.5 }); }
  chips(x, y, z, n = 14, metal = false) {
    for (let i = 0; i < n; i++) (metal ? this.glow : this.soft).emit({ x, y, z, vx: rnd(3.5), vy: 1 + Math.random() * 3.5, vz: rnd(3.5), life: 0.5 + Math.random() * 0.5, size: metal ? 0.05 : 0.09, size2: 0.02, r: metal ? 1 : 0.62, g: metal ? 0.75 : 0.45, b: metal ? 0.3 : 0.28, a: 1, grav: 11 });
    this.dust(x, y - 0.5, z, 5);
  }
  zzz(x, y, z) { this.soft.emit({ x, y, z, vx: 0.25, vy: 0.7, vz: 0, life: 1.8, size: 0.16, size2: 0.4, r: 0.8, g: 0.9, b: 1, a: 0.7 }); }
  hearts(x, y, z, n = 6) { for (let i = 0; i < n; i++) this.glow.emit({ x: x + rnd(0.4), y: y + rnd(0.2), z: z + rnd(0.4), vx: rnd(0.4), vy: 0.8 + Math.random() * 0.6, vz: rnd(0.4), life: 1.2 + Math.random() * 0.6, size: 0.16, size2: 0.05, r: 1, g: 0.35, b: 0.55, a: 0.9 }); }
  stars(x, y, z) { for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28; this.glow.emit({ x: x + Math.cos(a) * 0.5, y, z: z + Math.sin(a) * 0.5, vx: -Math.sin(a) * 1.4, vy: 0.2, vz: Math.cos(a) * 1.4, life: 0.6, size: 0.13, size2: 0.03, r: 1, g: 0.9, b: 0.3, a: 1 }); } }
  confetti(x, y, z, n = 90) { const C = [[1, 0.3, 0.4], [0.3, 0.8, 1], [1, 0.85, 0.3], [0.5, 1, 0.5], [0.8, 0.5, 1]]; for (let i = 0; i < n; i++) { const c = C[i % C.length]; this.soft.emit({ x, y, z, vx: rnd(4), vy: 3 + Math.random() * 5, vz: rnd(4), life: 1.6 + Math.random() * 1.4, size: 0.1, size2: 0.08, r: c[0], g: c[1], b: c[2], a: 1, grav: 5, drag: 0.9 }); } }
  dart(x, y, z) { for (let i = 0; i < 8; i++) this.glow.emit({ x, y, z, vx: rnd(1.5), vy: rnd(1.5), vz: rnd(1.5), life: 0.35, size: 0.08, size2: 0.02, r: 0.6, g: 1, b: 0.7, a: 1 }); }
  muzzle(x, y, z) { this.soft.emit({ x, y, z, vy: 0.3, life: 0.5, size: 0.15, size2: 0.6, r: 0.8, g: 0.8, b: 0.8, a: 0.3, drag: 2 }); }

  // s: { cam, storm (0..1), viewH, fov, night }
  update(dt, s) {
    const scale = s.viewH / (2 * Math.tan(s.fov * Math.PI / 360));
    this.soft.uniforms.uScale.value = this.glow.uniforms.uScale.value = scale;
    const cam = s.cam, W = this.world;
    // Moths circle the nearest lit lamps; fireflies drift over the pond and the meadows
    this.acc.moth += dt * 14;
    while (this.acc.moth >= 1) {
      this.acc.moth -= 1;
      const l = W.lamps[Math.floor(Math.random() * W.lamps.length)];
      if (!l || !l.on || l.indoor || Math.hypot(l.x - cam.x, l.z - cam.z) > 60) continue;
      const a = Math.random() * 6.28, y = W.heightAt(l.x, l.z) + 4.6;
      this.glow.emit({ x: l.x + Math.cos(a) * 0.5, y: y + rnd(0.4), z: l.z + Math.sin(a) * 0.5, vx: -Math.sin(a) * 1.2, vy: rnd(0.4), vz: Math.cos(a) * 1.2, life: 0.9 + Math.random(), size: 0.045, r: 1, g: 0.93, b: 0.75, a: 0.8, drag: 0.6 });
    }
    this.acc.fly += dt * 6 * (1 - s.storm);
    while (this.acc.fly >= 1) { this.acc.fly -= 1; const x = cam.x + rnd(26), z = cam.z + rnd(26); if (W.pathDist(x, z) < 4 || W.litAt(x, z) > 0.3) continue; this.glow.emit({ x, y: W.heightAt(x, z) + 0.4 + Math.random() * 1.8, z, vx: rnd(0.4), vy: rnd(0.2), vz: rnd(0.4), life: 3 + Math.random() * 3, size: 0.07, r: 0.7, g: 1, b: 0.4, a: 0.8 }); }
    this.soft.update(dt); this.glow.update(dt);
    // Rain
    const k = this.rain.material; k.opacity += (s.storm * 0.42 - k.opacity) * Math.min(1, dt * 1.5);
    this.rain.visible = k.opacity > 0.02;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position, fall = 26 * dt;
      for (let i = 0; i < this.rainN; i++) { const d = this.rainP[i]; d[1] -= fall; if (d[1] < -2) { d[0] = rnd(26); d[1] = 18 + Math.random() * 6; d[2] = rnd(26); } p.setXYZ(i * 2, cam.x + d[0], cam.y + d[1], cam.z + d[2]); p.setXYZ(i * 2 + 1, cam.x + d[0] + 0.12, cam.y + d[1] - 0.8, cam.z + d[2]); }
      p.needsUpdate = true;
    }
  }
  dispose() { this.scene.remove(this.group); }
}
