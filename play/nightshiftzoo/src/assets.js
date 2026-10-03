// Loads every model, texture, the night sky lighting and the sounds before the game starts.
// All assets are CC0 (see assets/SOURCES.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const A = { models: {}, tex: {}, env: null, sounds: {} };

const MODELS = [];   // every model in the game is now built by hand in code (beans.js, toys.js, items.js)
// Texture sets: [name, file id] (each has _diff, _nor, _rough)
const TEXTURES = [];   // and every surface is flat cartoon colour
const SOUNDS = [...['grass', 'sand', 'stone', 'wood'].flatMap(s => [0, 1, 2, 3, 4].map(n => `step_${s}00${n}.ogg`)),
  ...[0, 1, 2].flatMap(n => [`hit00${n}.ogg`, `bite00${n}.ogg`, `bell00${n}.ogg`]),
  'creak1.ogg', 'creak2.ogg', 'latch.ogg', 'coins1.ogg', 'coins2.ogg', 'swing1.ogg', 'swing2.ogg', 'cloth.ogg', 'leather.ogg', 'chop.ogg',
  'ui_click.ogg', 'ui_confirm.ogg', 'ui_error.ogg', 'ui_bong.ogg', 'ui_drop.ogg', 'splash01.ogg', 'splash02.ogg',
  'doorOpen_1.ogg', 'doorClose_1.ogg', 'engineCircular_000.ogg', 'forceField_000.ogg', 'glass_002.ogg',
  'impactMetal_light_000.ogg', 'impactMetal_light_001.ogg', 'impactPlank_medium_000.ogg', 'impactPunch_heavy_000.ogg', 'impactPunch_heavy_001.ogg', 'impactWood_heavy_000.ogg',
  'impactSoft_heavy_000.ogg', 'impactBell_heavy_000.ogg', 'metalClick.ogg'];

export async function loadAll(renderer, audioCtx, onProgress) {
  const gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const total = MODELS.length + TEXTURES.length * 3 + SOUNDS.length + 1;
  let done = 0;
  const tick = () => onProgress?.(++done / total);
  const models = MODELS.map(name => gltf.loadAsync(`assets/models/${name}.glb`).then(g => { A.models[name] = g; tick(); }));
  const texs = TEXTURES.flatMap(([name, id]) => ['diff', 'nor', 'rough'].map(kind => texLoader.loadAsync(`assets/tex/${id}_${kind}.jpg`).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace;
    (A.tex[name] ||= {})[kind] = t; tick();
  })));
  const env = new RGBELoader().loadAsync('assets/env/night_1k.hdr').then(hdr => {
    const pm = new THREE.PMREMGenerator(renderer);
    A.env = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose(); tick();
  });
  const sounds = SOUNDS.map(f => fetch(`assets/sfx/${f}`).then(r => r.arrayBuffer()).then(b => audioCtx.decodeAudioData(b)).then(buf => { A.sounds[f.replace(/\.\w+$/, '')] = buf; tick(); }).catch(() => tick()));
  await Promise.all([...models, ...texs, env, ...sounds]);
}

// Measure a model. Rigged models only know where their bones are after a world-matrix update.
export function measure(obj) {
  obj.updateMatrixWorld(true);
  obj.traverse(o => { if (o.isSkinnedMesh) { o.boundingBox = null; o.boundingSphere = null; } });
  let box = new THREE.Box3().setFromObject(obj);
  if (![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) {
    box = new THREE.Box3(); const tmp = new THREE.Box3();
    obj.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); if (o.isSkinnedMesh) { o.boundingBox = null; o.boundingSphere = null; } });
  }
  return box;
}

// A ready-to-place copy of a model, scaled so its height (or longest side) is `size` metres,
// standing on y = 0 and centred on x/z. Rigged models are cloned with their own skeletons.
export function instance(name, size, by = 'height') {
  const g = A.models[name];
  const obj = (g.animations?.length ? SkeletonUtils.clone(g.scene) : g.scene.clone(true));
  const box = measure(obj), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = size / (by === 'height' ? dim.y : Math.max(dim.x, dim.y, dim.z));
  obj.scale.multiplyScalar(k);
  obj.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const root = new THREE.Group(); root.add(obj);
  root.userData.radius = Math.max(dim.x, dim.z) * k / 2; root.userData.height = dim.y * k; root.userData.length = Math.max(dim.x, dim.z) * k;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !o.isSkinnedMesh; } });
  return root;
}
export const clip = (model, name) => A.models[model].animations.find(c => c.name.split('|').pop() === name);
