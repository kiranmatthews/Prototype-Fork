import * as THREE from 'three';
import type { CustomComponent } from './level';

export const CASTLE_TEXTURE_KINDS = ['castle-stone', 'castle-floor', 'castle-timber'] as const;
type CastleTexture = typeof CASTLE_TEXTURE_KINDS[number];
export function isCastleTexture(value: unknown): value is CastleTexture {
  return typeof value === 'string' && (CASTLE_TEXTURE_KINDS as readonly string[]).includes(value);
}

function noise(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function paint(kind: CastleTexture): THREE.DataTexture {
  const n = 256, bytes = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let rgb: number[];
    const grain = noise(x, y);
    if (kind === 'castle-timber') {
      const plank = Math.floor(x / 64), edge = Math.min(x % 64, 63 - x % 64);
      const streak = Math.sin(x * .75 + Math.sin(y * .035) * 1.7) * 7;
      const base = 1 + noise(plank, 8) * .25;
      rgb = [94, 59, 37].map((v, c) => edge < 2 ? [28, 22, 19][c] : v * base + streak + grain * 12);
      const knotX = 28 + plank * 64, knotY = 65 + (plank % 2) * 100;
      const knot = Math.hypot((x - knotX) * 1.5, (y - knotY) * .4);
      if (knot < 11) rgb = rgb.map(v => v * (.62 + .22 * Math.sin(knot * 1.8)));
    } else if (kind === 'castle-floor') {
      const row = Math.floor(y / 64), col = Math.floor((x + (row % 2) * 32) / 64);
      const fx = (x + (row % 2) * 32) % 64, fy = y % 64;
      const edge = Math.min(fx, 63 - fx, fy, 63 - fy);
      const light = (row + col) % 2 === 0;
      const base = light ? [129, 121, 102] : [74, 70, 70];
      const wear = (grain - .5) * 11 + noise(col, row) * 10;
      rgb = base.map(v => edge < 1.5 ? 32 : v + wear + (edge < 4 ? 7 : 0));
    } else {
      const row = Math.floor(y / 51.2), shift = row % 2 ? 42.67 : 0;
      const xx = (x + shift) % n, col = Math.floor(xx / 85.34);
      const seam = Math.min(xx % 85.34, 85.34 - xx % 85.34, y % 51.2, 51.2 - y % 51.2);
      const shade = noise(col, row) * 16 + grain * 12;
      rgb = [130, 124, 111].map(v => seam < 2 ? v * .32 : v + shade + (seam < 5 ? 12 : 0));
    }
    const at = (y * n + x) * 4;
    for (let c = 0; c < 3; c++) bytes[at + c] = Math.max(0, Math.min(255, rgb[c]));
    bytes[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, n, n, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  return texture;
}

const slots = new Map<CastleTexture, {value: THREE.Texture}>();
const ownedTextures = new Set<THREE.Texture>();
let materialRefs = 0, generation = 0;
type TextureStatus = 'idle' | 'loading' | 'ready' | 'fallback';
const ready = new Map<CastleTexture, Promise<void>>();
const status = new Map<CastleTexture, TextureStatus>();
const MESHY_PAINT: Record<CastleTexture, string> = {
  'castle-stone': 'ghost-train/meshy-castle-stone-v2.png',
  'castle-floor': 'ghost-train/meshy-castle-floor-v2.png',
  'castle-timber': 'ghost-train/meshy-castle-timber-v2.png',
};
function textureSlot(kind: CastleTexture): {value: THREE.Texture} {
  let slot = slots.get(kind);
  if (!slot) { slot = {value: paint(kind)}; ownedTextures.add(slot.value); slots.set(kind, slot); }
  if (!ready.has(kind)) {
    const target = slot;
    const requestedGeneration = generation;
    status.set(kind, 'loading');
    const pending = (async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + MESHY_PAINT[kind]);
        if (!response.ok) throw new Error(`Meshy material HTTP ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob());
        if (requestedGeneration !== generation || materialRefs === 0) { bitmap.close(); return; }
        const texture = new THREE.Texture(bitmap);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = 4;
        texture.userData.shared = true;
        texture.needsUpdate = true;
        ownedTextures.add(texture);
        target.value = texture;
        status.set(kind, 'ready');
      } catch { if (requestedGeneration === generation) status.set(kind, 'fallback'); }
    })();
    ready.set(kind, pending);
  }
  return slot;
}

/** A bounded three-texture vocabulary; metric projection survives curved
 * walls, merged room meshes and narrow stone mouldings without stretched UVs. */
export function createCastleMaterial(c: CustomComponent): THREE.MeshStandardMaterial {
  const kind = isCastleTexture(c.tex) ? c.tex : 'castle-stone';
  materialRefs++;
  const slot = textureSlot(kind);
  const stoneJoints = kind === 'castle-stone' ? textureSlot('castle-floor') : null;
  const material = new THREE.MeshStandardMaterial({
    color: c.color ?? '#ffffff', roughness: kind === 'castle-floor' ? .74 : .93,
    metalness: 0, emissive: c.emissive ?? '#000000',
    vertexColors: !!c.colors, opacity: c.opacity ?? 1,
    transparent: (c.opacity ?? 1) < 1, fog: c.fog !== false,
    side: c.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.userData.texKind = kind;
  material.userData.castleMaterial = true;
  let disposed = false;
  material.addEventListener('dispose', () => {
    if (disposed) return;
    disposed = true;
    if (--materialRefs > 0) return;
    generation++;
    for (const texture of ownedTextures) {
      texture.dispose();
      (texture.image as {close?: () => void})?.close?.();
    }
    ownedTextures.clear(); slots.clear(); ready.clear(); status.clear();
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uCastlePaint = slot;
    if (stoneJoints) shader.uniforms.uCastleStoneJoints = stoneJoints;
    shader.uniforms.uCastleTileSize = {value: kind === 'castle-floor' ? 2.4 : kind === 'castle-timber' ? 2.0 : 3.0};
    shader.vertexShader = 'varying vec3 vCastleWorld;\nvarying vec3 vCastleWorldNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 castleWorld = vec4(transformed, 1.0);
      vec3 castleNormal = objectNormal;
      #ifdef USE_INSTANCING
        castleWorld = instanceMatrix * castleWorld;
        castleNormal = mat3(instanceMatrix) * castleNormal;
      #endif
      vCastleWorld = (modelMatrix * castleWorld).xyz;
      vCastleWorldNormal = normalize(mat3(modelMatrix) * castleNormal);`);
    shader.fragmentShader = 'varying vec3 vCastleWorld;\nvarying vec3 vCastleWorldNormal;\nuniform sampler2D uCastlePaint;\nuniform float uCastleTileSize;\n' +
      (stoneJoints ? 'uniform sampler2D uCastleStoneJoints;\n' : '') + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 castleWeights = pow(abs(normalize(vCastleWorldNormal)), vec3(5.0));
      castleWeights /= max(dot(castleWeights, vec3(1.0)), .001);
      vec3 castlePaintX = texture2D(uCastlePaint, vCastleWorld.zy / uCastleTileSize).rgb;
      vec3 castlePaintY = texture2D(uCastlePaint, vCastleWorld.xz / uCastleTileSize).rgb;
      vec3 castlePaintZ = texture2D(uCastlePaint, vCastleWorld.xy / uCastleTileSize).rgb;
      vec3 castlePaint = castlePaintX * castleWeights.x + castlePaintY * castleWeights.y + castlePaintZ * castleWeights.z;
      ${stoneJoints ? `
      vec3 jointX = texture2D(uCastleStoneJoints, vCastleWorld.zy / 3.6).rgb;
      vec3 jointY = texture2D(uCastleStoneJoints, vCastleWorld.xz / 3.6).rgb;
      vec3 jointZ = texture2D(uCastleStoneJoints, vCastleWorld.xy / 3.6).rgb;
      vec3 jointPaint = jointX * castleWeights.x + jointY * castleWeights.y + jointZ * castleWeights.z;
      castlePaint = mix(castlePaint, jointPaint, .72);` : ''}
      diffuseColor.rgb *= castlePaint;
      float castleRelief = dot(castlePaint, vec3(.299, .587, .114));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 castleDx = dFdx(-vViewPosition), castleDy = dFdy(-vViewPosition);
      vec3 castleR1 = cross(castleDy, normal), castleR2 = cross(normal, castleDx);
      float castleDet = dot(castleDx, castleR1);
      vec3 castleGradient = sign(castleDet) * (dFdx(castleRelief) * castleR1 + dFdy(castleRelief) * castleR2);
      normal = normalize(abs(castleDet) * normal - castleGradient * .018);`);
  };
  material.customProgramCacheKey = () => `ghost-castle-metric-meshy-paint-v3:${kind}`;
  return material;
}
export async function prepareCastleTextures(): Promise<void> { await Promise.all(ready.values()); }
export function castleTextureDiagnostics() {
  return {stone: status.get('castle-stone') ?? 'idle', floor: status.get('castle-floor') ?? 'idle',
    timber: status.get('castle-timber') ?? 'idle', source: 'Meshy model albedo and original UVs',
    textureKinds: [...slots.keys()], materialRefs};
}
