// Shader tweaks that make the low-poly props sit in the world: real surface detail on walls and
// fences (projected from three sides so it needs no UVs), and plants that sway in the wind.
import * as THREE from 'three';
import { A } from './assets.js';
import { WORLD } from './config.js';

// Three flat bands of light and shade, so everything reads like a cartoon (or moulded plastic)
export const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
export const propUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
const VERT_WORLD = `
vec4 pw = vec4(transformed, 1.0); vec3 pn = objectNormal;
#ifdef USE_INSTANCING
pw = instanceMatrix * pw; pn = mat3(instanceMatrix) * pn;
#endif
pw = modelMatrix * pw; vPW = pw.xyz; vPN = normalize(mat3(modelMatrix) * pn);`;

// kind: 'tex' (surface detail from a texture set: opts.tex, opts.scale, opts.mix), 'plant' (sways), 'plain'
export function patchMaterial(src, kind, opts = {}) {
  const mat = src.clone();
  if (mat.map) mat.map.anisotropy = 8;
  if (kind === 'plain') return mat;
  const tex = kind === 'tex', set = A.tex[opts.tex || 'concrete'], scale = (opts.scale ?? 2.5).toFixed(2), mix = (opts.mix ?? 0.75).toFixed(2), hue = (opts.hue ?? 0.6).toFixed(2);
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, propUniforms);
    if (tex) Object.assign(sh.uniforms, { tD: { value: set.diff }, tN: { value: set.nor } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind;\nvarying vec3 vPW; varying vec3 vPN;');
    if (kind === 'plant') sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 base = vec3(0.0);
        #ifdef USE_INSTANCING
        base = instanceMatrix[3].xyz;
        #endif
        float ph = base.x * 0.37 + base.z * 0.21, k = max(position.y, 0.0), bend = k * k * ${(opts.sway ?? 0.02).toFixed(3)} * uWind;
        transformed.x += sin(uTime * 1.3 + ph) * bend; transformed.z += cos(uTime * 1.05 + ph * 1.7) * bend * 0.6; }`);
    sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>' + VERT_WORLD);
    if (!tex) { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW; varying vec3 vPN;'); return; }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tD, tN;\nvarying vec3 vPW; varying vec3 vPN;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 tn = normalize(vPN); vec3 bw = pow(abs(tn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 s = texture2D(tD, vPW.zy / ${scale}).rgb * bw.x + texture2D(tD, vPW.xz / ${scale}).rgb * bw.y + texture2D(tD, vPW.xy / ${scale}).rgb * bw.z;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  vec3 detail = mix(vec3(lum), s, ${hue}) * 1.9;
  diffuseColor.rgb *= mix(vec3(1.0), detail, ${mix}); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 tn = normalize(vPN); vec3 bw = pow(abs(tn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 rX = texture2D(tN, vPW.zy / ${scale}).xyz * 2.0 - 1.0, rY = texture2D(tN, vPW.xz / ${scale}).xyz * 2.0 - 1.0, rZ = texture2D(tN, vPW.xy / ${scale}).xyz * 2.0 - 1.0;
  vec3 nW = normalize(tn + (vec3(0.0, rX.y, rX.x) * bw.x + vec3(rY.x, 0.0, rY.y) * bw.y + vec3(rZ.x, rZ.y, 0.0) * bw.z) * 0.9);
  normal = normalize(mix(normal, (viewMatrix * vec4(nW, 0.0)).xyz, 0.85)); }`);
  };
  mat.customProgramCacheKey = () => `nsz-${kind}-${opts.tex || ''}-${scale}-${mix}-${hue}-${opts.sway ?? ''}`;
  return mat;
}
// A fresh textured material for built geometry (walls, floors, roofs)
export const texMat = (tex, color = 0xffffff, o = {}) => patchMaterial(new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.9, metalness: o.metalness ?? 0, vertexColors: !!o.vertexColors }), 'tex', { tex, ...o });

// Shared by the ground and everything standing on it: the lamp light map
export const lightUniforms = { tLight: { value: null }, uLampK: { value: 1 }, uLightHalf: { value: WORLD.size / 2 } };
export const withLight = mat => { // add the lamp light map to any material
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.() || 'std';
  mat.onBeforeCompile = sh => {
    prev?.(sh);
    Object.assign(sh.uniforms, lightUniforms);
    if (!/varying vec3 vPW/.test(sh.vertexShader)) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;').replace('#include <fog_vertex>', `#include <fog_vertex>
        { vec4 lw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          lw = instanceMatrix * lw;
          #endif
          vPW = (modelMatrix * lw).xyz; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;');
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tLight; uniform float uLampK, uLightHalf;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 lamp = texture2D(tLight, (vPW.xz + uLightHalf) / (uLightHalf * 2.0)).rgb; totalEmissiveRadiance += diffuseColor.rgb * lamp * lamp * uLampK * 2.6 * smoothstep(9.0, 0.0, vPW.y); }`);
  };
  mat.customProgramCacheKey = () => key + '+light';
  return mat;
};

// Flat cartoon colour in three bands (and lit by the lamps): what nearly everything in the zoo is made of
const toons = new Map();
export const toon = (color, o = {}) => { const k = color + JSON.stringify(o); if (!toons.has(k)) toons.set(k, withLight(new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o }))); return toons.get(k); };
