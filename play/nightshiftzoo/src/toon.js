// The cartoon look: black outlines around characters and animals, and big googly eyes that
// wobble, follow whoever they're looking at, go red when something is angry and turn into
// crosses when it's knocked out.
import * as THREE from 'three';

export const toonUniforms = { uAspect: { value: 1 } };
const outlineMat = (skinned, thick) => new THREE.ShaderMaterial({
  side: THREE.BackSide, fog: true,
  uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uT: { value: thick }, uAspect: toonUniforms.uAspect },
  vertexShader: `
    #include <common>
    #include <skinning_pars_vertex>
    #include <fog_pars_vertex>
    uniform float uT, uAspect;
    void main() {
      #include <skinbase_vertex>
      #include <beginnormal_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      vec3 n = normalize(normalMatrix * objectNormal);
      // push the back faces outward on screen: a line that stays about the same width near or far
      gl_Position.xy += normalize(n.xy + vec2(1e-5)) * uT * clamp(gl_Position.w, 2.0, 16.0) * vec2(1.0 / uAspect, 1.0);
      #include <fog_vertex>
    }`,
  fragmentShader: `
    #include <common>
    #include <fog_pars_fragment>
    void main() {
      gl_FragColor = vec4(0.03, 0.02, 0.05, 1.0);
      #include <fog_fragment>
    }`
});
const cache = new Map();
// Give every mesh under root a dark outline. thick is in screen units (0.003 is a nice line).
export function addOutline(root, thick = 0.0032) {
  const list = [];
  root.traverse(m => { if (m.isMesh && m.visible && !m.userData.noOutline) list.push(m); });
  for (const m of list) {
    const key = (m.isSkinnedMesh ? 's' : 'm') + thick;
    if (!cache.has(key)) cache.set(key, outlineMat(m.isSkinnedMesh, thick));
    let o;
    if (m.isSkinnedMesh) { o = new THREE.SkinnedMesh(m.geometry, cache.get(key)); o.bind(m.skeleton, m.bindMatrix); o.frustumCulled = false; }
    else o = new THREE.Mesh(m.geometry, cache.get(key));
    o.position.copy(m.position); o.quaternion.copy(m.quaternion); o.scale.copy(m.scale); o.userData.noOutline = true; o.userData.outline = true;
    m.parent.add(o);
  }
}

const WHITE = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.32 });
export const setEyeGlow = v => { WHITE.emissiveIntensity = v; };   // at night every eye in the zoo shines
const eyeGeo = new THREE.SphereGeometry(1, 18, 14), pupilGeo = new THREE.SphereGeometry(1, 12, 10), barGeo = new THREE.BoxGeometry(1.5, 0.3, 0.3);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

// One googly eye. Add eye.group to a bone or a head; call eye.update every frame.
export class GooglyEye {
  constructor(radius, big = 1) {
    this.group = new THREE.Group(); this.group.scale.setScalar(radius * big);
    this.pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0f });
    this.ball = new THREE.Mesh(eyeGeo, WHITE); this.pupil = new THREE.Mesh(pupilGeo, this.pupilMat); this.pupil.scale.setScalar(0.46);
    this.cross = new THREE.Group(); for (const r of [0.78, -0.78]) { const b = new THREE.Mesh(barGeo, this.pupilMat); b.rotation.z = r; this.cross.add(b); } this.cross.visible = false;
    for (const m of [this.ball, this.pupil, ...this.cross.children]) m.userData.noOutline = true;
    this.group.add(this.ball, this.pupil, this.cross);
    this.look = new THREE.Vector3(0, 0, 1); this.vel = new THREE.Vector3(); this.derp = new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, 0);
  }
  // dir: where to look, in world space (unit vector). fwd: the face's forward in world space.
  // o: { angry (0..1), out (knocked out or asleep), shake (extra wobble from moving) }
  update(dt, dir, fwd, o = {}) {
    this.group.getWorldQuaternion(_q).invert();
    this.cross.visible = !!o.out; this.pupil.visible = !o.out;
    if (o.out) { _v.copy(fwd).applyQuaternion(_q).normalize(); this.cross.position.copy(_v).multiplyScalar(0.92); this.cross.lookAt(_v.multiplyScalar(3)); return; }
    // a springy pupil: it overshoots and wobbles, like a real googly eye
    _v.copy(dir).applyQuaternion(_q).add(this.derp).normalize();
    // never roll round the back of the eyeball: keep it on the front half
    const f = fwd.clone().applyQuaternion(_q).normalize(), d = _v.dot(f); if (d < 0.25) _v.addScaledVector(f, 0.25 - d).normalize();
    this.vel.addScaledVector(_v.clone().sub(this.look), dt * 90).multiplyScalar(Math.max(0, 1 - dt * 7));
    if (o.shake) this.vel.x += (Math.random() - 0.5) * o.shake * dt * 40, this.vel.y += (Math.random() - 0.5) * o.shake * dt * 40;
    this.look.addScaledVector(this.vel, dt).normalize();
    this.pupil.position.copy(this.look).multiplyScalar(0.62);
    const angry = o.angry || 0; this.pupil.scale.setScalar(0.46 - angry * 0.2); this.pupilMat.color.setRGB(0.04 + angry * 0.9, 0.04, 0.06);
  }
}
