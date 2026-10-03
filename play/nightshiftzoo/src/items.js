// The things a keeper carries, as chunky toy versions of themselves. Each one points down -z (away from
// the hand holding it) and is about life size, so the same model works in your hands and in a friend's.
import * as THREE from 'three';
import { toon } from './materials.js';

export const ITEMS = [
  { id: 'torch', name: 'Torch', icon: '🔦', hint: 'F: on / off' },
  { id: 'wrench', name: 'Wrench', icon: '🔧', hint: 'Hold E on a fence to fix it' },
  { id: 'rifle', name: 'Dart Rifle', icon: '🎯', hint: 'Click: fire a sleepy dart' },
  { id: 'chicken', name: 'Squeaky Chicken', icon: '🐔', hint: 'Click: throw it. Animals love it.' }
];

export function makeItem(kind, feed) {
  const g = new THREE.Group();
  const add = (geo, color, x = 0, y = 0, z = 0, rx = 0, rz = 0, mat) => { const m = new THREE.Mesh(geo, mat || toon(color)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  if (kind === 'torch') {
    add(new THREE.CapsuleGeometry(0.035, 0.16, 4, 10), 0xffc93c, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.062, 0.04, 0.08, 14), 0x474c66, 0, 0, -0.15, Math.PI / 2);
    add(new THREE.CircleGeometry(0.052, 14), 0, 0, 0, -0.191, 0, 0, new THREE.MeshBasicMaterial({ color: 0xfff3c0 })).rotation.y = Math.PI;
    add(new THREE.SphereGeometry(0.014, 6, 5), 0xe5484d, 0, 0.038, -0.02);
  } else if (kind === 'wrench') {
    add(new THREE.CapsuleGeometry(0.022, 0.26, 4, 8), 0xe5484d, 0, 0, 0);
    add(new THREE.TorusGeometry(0.055, 0.022, 8, 14, Math.PI * 1.5), 0xb8c4d0, 0, 0.2, 0, 0, Math.PI * 0.75);
    add(new THREE.SphereGeometry(0.035, 8, 6), 0xb8c4d0, 0, -0.16, 0);
  } else if (kind === 'rifle') {
    add(new THREE.CapsuleGeometry(0.022, 0.5, 4, 8), 0x474c66, 0, 0.02, -0.28, Math.PI / 2);
    add(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), 0xbd7f45, 0, -0.01, 0.1, Math.PI / 2 - 0.15);
    add(new THREE.CapsuleGeometry(0.03, 0.08, 4, 8), 0xbd7f45, 0, -0.08, -0.02, 0.3);
    add(new THREE.CapsuleGeometry(0.02, 0.1, 4, 8), 0x2fb5a6, 0, 0.075, -0.12, Math.PI / 2);
    add(new THREE.SphereGeometry(0.035, 8, 6), 0xff6fa5, 0, 0.02, -0.57);
  } else if (kind === 'bucket') {
    add(new THREE.CylinderGeometry(0.17, 0.125, 0.25, 16, 1, true), 0x9aa8b8, 0, 0, 0).material = toon(0x9aa8b8, { side: THREE.DoubleSide });
    add(new THREE.CircleGeometry(0.125, 16), 0x7a8898, 0, -0.124, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), feed === 'hay' ? 0xf2cc50 : 0xe0564e, 0, 0.07, 0).scale.y = 0.5;
    add(new THREE.TorusGeometry(0.17, 0.012, 6, 16, Math.PI), 0x474c66, 0, 0.12, 0);
  } else if (kind === 'chicken') {
    add(new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), 0xffd23c, 0, 0, 0, Math.PI / 2 - 0.3);
    add(new THREE.SphereGeometry(0.058, 10, 8), 0xffd23c, 0, 0.11, -0.12);
    add(new THREE.ConeGeometry(0.025, 0.07, 8), 0xff7a1a, 0, 0.1, -0.19, -Math.PI / 2);
    add(new THREE.SphereGeometry(0.03, 8, 6), 0xe5484d, 0, 0.17, -0.11);
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.022, 8, 6), 0xffffff, s * 0.035, 0.13, -0.16); add(new THREE.SphereGeometry(0.01, 6, 5), 0x15151c, s * 0.04, 0.13, -0.18); add(new THREE.CapsuleGeometry(0.012, 0.09, 3, 6), 0xff7a1a, s * 0.03, -0.09, 0.08); }
  }
  return g;
}
