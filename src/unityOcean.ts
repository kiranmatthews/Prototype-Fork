/**
 * Unity coastline/ocean port.
 *
 * Provenance: this module is a clean Three.js implementation from the audited
 * MatrixRex Unity material and OceanPlaneGenerator values.  It deliberately
 * does not reuse the former four-wave/swash/wet-sand CoastWater simulation.
 * The same two Gerstner equations are evaluated in the GPU and by the public
 * CPU sampler so rendering and gameplay queries cannot drift apart.
 */
import * as THREE from "three";

const TAU = Math.PI * 2;
const GRAVITY = 9.8;
const SHORE_SAMPLE_METRES = 2;
const SHORE_OVERLAP = 6;
const OCEAN_WIDTH = 120;
const LATERAL_SEGMENTS = 128;
const COVERAGE_MARGIN = 800;
const COVERAGE_CELL = 16;
const RIBBON_Y_OFFSET = 0;
const COVERAGE_Y_OFFSET = -0.04;
const HORIZON_DISTANCES = [105, 130, 800] as const;
const HORIZON_ALPHAS = [0, 1, 1] as const;

export interface ShoreSample {
  x: number;
  z: number;
  sx: number;
  sz: number;
  beachSlope: number;
  bedSlope: number;
}

export interface CoastWaterOpts {
  shore: ShoreSample[];
  seaLevel: number;
  shoreDirX: number;
  shoreDirZ: number;
  course: { x: number; z: number }[];
  /** Retained only for drop-in constructor compatibility; shading uses depth. */
  terrainHeight: (x: number, z: number) => number;
  quality?: OceanQuality;
}

export type OceanQuality = "full" | "lite";

export interface OceanColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface UnityOceanParams {
  wave1Length: number;
  wave1Height: number;
  wave1Speed: number;
  wave1DirX: number;
  wave1DirZ: number;
  wave1Sharpness: number;
  wave2Length: number;
  wave2Height: number;
  wave2Speed: number;
  wave2DirX: number;
  wave2DirZ: number;
  wave2Sharpness: number;
  shallow: OceanColor;
  deep: OceanColor;
  depthDistance: number;
  distanceStart: number;
  distanceFade: number;
  shoreFadeSmoothness: number;
  peak: OceanColor;
  normalStrength: number;
  normalPan: number;
  normalScale: number;
  normalDistanceStrength: number;
  shadow: OceanColor;
  specular: OceanColor;
  specularSpread: number;
  specularHardness: number;
  specularSize: number;
  refractionStrength: number;
  refractionDistance: number;
  refractionFade: number;
  reflectionStrength: number;
  reflectionFresnel: number;
  reflectionDistortion: number;
  causticsDepth: number;
  causticsPan: number;
  causticsScale: number;
  causticsStrength: number;
  causticsDistortion: number;
  causticsDistortionScale: number;
  causticsStart: number;
  causticsFade: number;
  intersection: OceanColor;
  intersectionWidth: number;
  intersectionDissolve: number;
  intersectionScale: number;
  intersectionTile: number;
  intersectionPanX: number;
  intersectionPanY: number;
  intersectionDistortion: number;
  intersectionSmoothness: number;
  intersectionInvert: number;
  intersectionGradient: number;
  intersectionEdgeFade: number;
  shorelineEnabled: number;
  shorelineAlpha: number;
}

export const UNITY_OCEAN_DEFAULTS: UnityOceanParams = {
  wave1Length: 59.3,
  wave1Height: 0.01,
  wave1Speed: 0.1,
  wave1DirX: 1,
  wave1DirZ: 0,
  wave1Sharpness: 1,
  wave2Length: 45.8,
  wave2Height: 0.015,
  wave2Speed: 0.15,
  wave2DirX: -0.49,
  wave2DirZ: 1,
  wave2Sharpness: 0.699,
  shallow: { r: 0.02352938, g: 0.82328343, b: 0.9882353, a: 0.688 },
  deep: { r: 0, g: 0.2462014, b: 0.503, a: 1 },
  depthDistance: 0.3,
  distanceStart: 0,
  distanceFade: 10,
  shoreFadeSmoothness: 0.033,
  peak: { r: 0.542453, g: 0.850634, b: 1, a: 0.47 },
  normalStrength: 7.79,
  normalPan: 0.31,
  normalScale: 0.32,
  normalDistanceStrength: 7.04,
  shadow: { r: 0, g: 0, b: 0, a: 0.649 },
  specular: { r: 14.27, g: 22.6274, b: 24.66, a: 1 },
  specularSpread: 0.145,
  specularHardness: 0.928,
  specularSize: 0.288,
  refractionStrength: 0.63,
  refractionDistance: 0.53,
  refractionFade: 0.01,
  reflectionStrength: 1,
  reflectionFresnel: 17.8,
  reflectionDistortion: 1.42,
  causticsDepth: -4,
  causticsPan: 1.11,
  causticsScale: 2,
  causticsStrength: 1.28,
  causticsDistortion: 1,
  causticsDistortionScale: 3,
  causticsStart: 0,
  causticsFade: 32.01,
  intersection: { r: 1, g: 1, b: 1, a: 1 },
  intersectionWidth: 0.95,
  intersectionDissolve: 2,
  intersectionScale: 4.16,
  intersectionTile: 1,
  intersectionPanX: 0.4,
  intersectionPanY: 0.02,
  intersectionDistortion: 0,
  intersectionSmoothness: 1,
  intersectionInvert: 0,
  intersectionGradient: 1,
  intersectionEdgeFade: 1,
  shorelineEnabled: 1,
  shorelineAlpha: 0,
};

/** Compatibility names for integrations that previously imported these. */
export type WaterParams = UnityOceanParams;
export const WATER_DEFAULTS = UNITY_OCEAN_DEFAULTS;

export interface SurfaceSample {
  height: number;
  nx: number;
  ny: number;
  nz: number;
  depth: number;
  shorePhase: number;
  shoreInfluence: number;
  displacementX: number;
  displacementZ: number;
}

export interface OceanDebug {
  water: boolean;
  horizon: boolean;
  reflection: boolean;
  prepass: boolean;
  refraction: boolean;
  caustics: boolean;
  intersection: boolean;
  freeze: boolean;
  wireframe: boolean;
}

export interface OceanStats {
  verts: number;
  tris: number;
  shoreSamples: number;
  reflectionWidth: number;
  reflectionHeight: number;
  prepassWidth: number;
  prepassHeight: number;
  reflectionRenders: number;
  prepassRenders: number;
  quality: OceanQuality;
}

interface DenseShoreSample extends ShoreSample {
  arc: number;
}

interface WaveEvaluation {
  height: number;
  dx: number;
  dz: number;
  nx: number;
  ny: number;
  nz: number;
}

const OCEAN_VERTEX = /* glsl */ `
attribute float aShoreDistance;
uniform float uTime;
uniform float uSeaLevel;
uniform vec4 uWave1;
uniform vec2 uWave1Dir;
uniform vec4 uWave2;
uniform vec2 uWave2Dir;
varying vec3 vWorld;
varying vec3 vWaveNormal;
varying float vShoreDistance;
varying float vViewDepth;
varying vec4 vClipPosition;
#include <fog_pars_vertex>

void unityGerstner(
  vec2 worldXZ,
  vec4 wave,
  vec2 rawDirection,
  inout vec3 displacement,
  inout vec3 normalSum
) {
  float k = 6.283185307179586 / wave.x;
  vec2 direction = normalize(rawDirection);
  float phi = dot(worldXZ, direction * k)
    - sqrt(9.8 * k) * uTime * wave.z;
  // Exact audited Unity displacement:
  // (0,H*cos(phi),0) - normalize(dir)*(sharp/k)*sin(phi)
  displacement.y += wave.y * cos(phi);
  displacement.xz -= direction * (wave.w / k) * sin(phi);
  // Exact audited Unity normal contribution; the two bands are summed.
  normalSum += vec3(
    direction.x * k * wave.y * sin(phi),
    1.0 - wave.w * cos(phi),
    direction.y * k * wave.y * sin(phi)
  );
}

void main() {
  vec4 baseWorld = modelMatrix * vec4(position, 1.0);
  vec3 displacement = vec3(0.0);
  vec3 normalSum = vec3(0.0);
  unityGerstner(baseWorld.xz, uWave1, uWave1Dir, displacement, normalSum);
  unityGerstner(baseWorld.xz, uWave2, uWave2Dir, displacement, normalSum);
  // Unity's production waves run roughly along its beach. The web coast
  // curves through arbitrary world headings, so applying the 9-13m Gerstner
  // horizontal term directly at a fixed shore edge can fold individual edge
  // triangles onto the sand. Ease only that horizontal term in over the first
  // 14m of water; vertical wave/normal/foam timing remains exact.
  displacement.xz *= smoothstep(0.0, 14.0, aShoreDistance);
  vec4 world = baseWorld;
  world.xyz += displacement;
  // Meshes are authored at sea level. Keep the uniform in the interface for
  // reflection/depth consumers and protect against transformed authoring.
  world.y += uSeaLevel - (modelMatrix * vec4(0.0, uSeaLevel, 0.0, 1.0)).y;
  vWorld = world.xyz;
  vWaveNormal = normalize(normalSum);
  vShoreDistance = aShoreDistance;
  vec4 mvPosition = viewMatrix * world;
  vViewDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  vClipPosition = gl_Position;
  #include <fog_vertex>
}
`;

const OCEAN_FRAGMENT = /* glsl */ `
uniform sampler2D uNormalMap;
uniform sampler2D uShoreNoise;
uniform sampler2D uIntersectionNoise;
uniform sampler2D uCausticsDistortionMap;
uniform sampler2D uCausticsMap;
uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uReflection;
uniform mat4 uReflectionMatrix;
uniform vec2 uViewport;
uniform float uCameraNear;
uniform float uCameraFar;
uniform mat4 uInverseProjection;
uniform mat4 uInverseView;
uniform float uTime;
uniform float uHasPrepass;
uniform float uHasReflection;
uniform float uRefractionOn;
uniform float uCausticsOn;
uniform float uIntersectionOn;

uniform vec4 uShallow;
uniform vec4 uDeep;
uniform float uDepthDistance;
uniform float uDistanceStart;
uniform float uDistanceFade;
uniform float uShoreFadeSmoothness;
uniform vec4 uPeak;
uniform float uNormalStrength;
uniform float uNormalPan;
uniform float uNormalScale;
uniform float uNormalDistanceStrength;
uniform vec4 uShadow;
uniform vec4 uSpecular;
uniform float uSpecularSpread;
uniform float uSpecularHardness;
uniform float uSpecularSize;
uniform float uRefractionStrength;
uniform float uRefractionDistance;
uniform float uRefractionFade;
uniform float uReflectionStrength;
uniform float uReflectionFresnel;
uniform float uReflectionDistortion;
uniform float uCausticsDepth;
uniform float uCausticsPan;
uniform float uCausticsScale;
uniform float uCausticsStrength;
uniform float uCausticsDistortion;
uniform float uCausticsDistortionScale;
uniform float uCausticsStart;
uniform float uCausticsFade;
uniform vec4 uIntersection;
uniform float uIntersectionWidth;
uniform float uIntersectionDissolve;
uniform float uIntersectionScale;
uniform float uIntersectionTile;
uniform vec2 uIntersectionPan;
uniform float uIntersectionDistortion;
uniform float uIntersectionSmoothness;
uniform float uIntersectionInvert;
uniform float uIntersectionGradient;
uniform float uIntersectionEdgeFade;
uniform float uShorelineEnabled;
uniform float uShorelineAlpha;

varying vec3 vWorld;
varying vec3 vWaveNormal;
varying float vShoreDistance;
varying float vViewDepth;
varying vec4 vClipPosition;
#include <fog_pars_fragment>
#include <packing>

float saturate(float x) { return clamp(x, 0.0, 1.0); }

void main() {
  vec2 screenUv = vClipPosition.xy / max(abs(vClipPosition.w), 0.0001);
  screenUv = screenUv * 0.5 + 0.5;
  float sampledDepth = texture2D(uSceneDepth, screenUv).x;
  float sceneViewZ = perspectiveDepthToViewZ(
    sampledDepth, uCameraNear, uCameraFar);
  float waterViewZ = -vViewDepth;
  float eyeThickness = uHasPrepass > 0.5
    ? max(0.0, waterViewZ - sceneViewZ)
    : uCameraFar;
  vec4 sceneClip = vec4(screenUv * 2.0 - 1.0, sampledDepth * 2.0 - 1.0, 1.0);
  vec4 sceneView = uInverseProjection * sceneClip;
  sceneView /= max(abs(sceneView.w), 0.0001);
  vec3 sceneWorld = (uInverseView * sceneView).xyz;
  float thickness = uHasPrepass > 0.5 && sampledDepth < 0.9999
    ? max(0.0, vWorld.y - sceneWorld.y)
    : uCameraFar;

  vec2 normalUv = vWorld.xz * uNormalScale;
  vec2 panA = vec2(0.73, 0.29) * uTime * uNormalPan;
  vec2 panB = vec2(-0.21, 0.91) * uTime * uNormalPan;
  vec3 mapA = texture2D(uNormalMap, normalUv + panA).xyz * 2.0 - 1.0;
  vec3 mapB = texture2D(uNormalMap, normalUv * 0.73 + panB).xyz * 2.0 - 1.0;
  float cameraDistance = distance(cameraPosition, vWorld);
  float distanceNormal = mix(
    uNormalStrength,
    uNormalDistanceStrength,
    smoothstep(uDistanceStart, uDistanceStart + max(uDistanceFade, 0.0001), cameraDistance));
  // Shader Graph's normal-strength node operates on an unpacked tangent
  // normal; its authored 7.79 is not a raw world-slope multiplier. The 0.12
  // conversion preserves the Unity streak amplitude without tipping broad
  // bands past grazing, which would turn planar-reflection samples black.
  vec2 detailSlope = (mapA.xy + mapB.xy) * 0.5 * distanceNormal * 0.12;
  vec3 N = normalize(vWaveNormal + vec3(detailSlope.x, 0.0, detailSlope.y));
  vec3 V = normalize(cameraPosition - vWorld);

  float depthMix = smoothstep(0.0, max(uDepthDistance, 0.0001), thickness);
  float distanceMix = smoothstep(
    uDistanceStart,
    uDistanceStart + max(uDistanceFade, 0.0001),
    cameraDistance);
  depthMix = max(depthMix, distanceMix * 0.12);
  vec4 waterColor = mix(uShallow, uDeep, depthMix);
  float crest = saturate(1.0 - N.y);
  waterColor.rgb = mix(waterColor.rgb, uPeak.rgb, crest * uPeak.a);

  vec2 refractOffset = N.xz * uRefractionStrength * 0.01;
  float refractWindow = 1.0 - smoothstep(
    uRefractionDistance,
    uRefractionDistance + max(uRefractionFade, 0.0001),
    eyeThickness);
  vec2 refractUv = clamp(screenUv + refractOffset * refractWindow, 0.001, 0.999);
  vec3 sceneColor = texture2D(uSceneColor, refractUv).rgb;
  if (uHasPrepass > 0.5 && uRefractionOn > 0.5) {
    waterColor.rgb = mix(waterColor.rgb, sceneColor, refractWindow * 0.62);
  }

  vec2 distortionUv = vWorld.xz / max(uCausticsDistortionScale, 0.0001)
    + vec2(uTime * uCausticsPan * 0.07, -uTime * uCausticsPan * 0.05);
  vec2 causticDistortion =
    (texture2D(uCausticsDistortionMap, distortionUv).rg * 2.0 - 1.0)
    * uCausticsDistortion * 0.08;
  vec2 causticUv = vWorld.xz / max(uCausticsScale, 0.0001)
    + causticDistortion + vec2(uTime * uCausticsPan * 0.025);
  float causticPattern = texture2D(uCausticsMap, causticUv).r;
  float causticDepth = 1.0 - smoothstep(0.0, max(-uCausticsDepth, 0.0001), thickness);
  float causticDistance = 1.0 - smoothstep(
    uCausticsStart,
    uCausticsStart + max(uCausticsFade, 0.0001),
    cameraDistance);
  if (uHasPrepass > 0.5 && uCausticsOn > 0.5) {
    waterColor.rgb += vec3(causticPattern * causticDepth * causticDistance
      * uCausticsStrength * 0.22);
  }

  vec4 reflectionClip = uReflectionMatrix * vec4(vWorld, 1.0);
  vec2 reflectionUv = reflectionClip.xy / max(abs(reflectionClip.w), 0.0001);
  reflectionUv = reflectionUv * 0.5 + 0.5;
  reflectionUv += N.xz * uReflectionDistortion * 0.012;
  reflectionUv = clamp(reflectionUv, 0.001, 0.999);
  vec3 reflectionColor = texture2D(uReflection, reflectionUv).rgb;
  float fresnel = pow(1.0 - saturate(dot(N, V)), uReflectionFresnel);
  if (uHasReflection > 0.5) {
    waterColor.rgb = mix(
      waterColor.rgb,
      reflectionColor,
      saturate(fresnel * uReflectionStrength));
  }

  vec3 lightDir = normalize(vec3(0.35, 0.85, 0.25));
  vec3 halfVector = normalize(lightDir + V);
  float specDot = saturate(dot(N, halfVector));
  float specExponent = mix(8.0, 256.0, uSpecularHardness);
  float specularTerm = pow(specDot, specExponent);
  specularTerm = smoothstep(
    max(0.0, 1.0 - uSpecularSize - uSpecularSpread),
    max(0.0001, 1.0 - uSpecularSize),
    specularTerm);
  waterColor.rgb += uSpecular.rgb * specularTerm * 0.025;
  waterColor.rgb = mix(waterColor.rgb, uShadow.rgb, uShadow.a * (1.0 - N.y));

  vec2 intersectionUv = vWorld.xz / max(uIntersectionScale, 0.0001)
    * uIntersectionTile + uIntersectionPan * uTime;
  vec2 intersectionWarp =
    (texture2D(uShoreNoise, intersectionUv * 0.63).rg * 2.0 - 1.0)
    * uIntersectionDistortion;
  float intersectionNoise = texture2D(
    uIntersectionNoise, intersectionUv + intersectionWarp).r;
  float gradient = 1.0 - smoothstep(
    0.0, max(uIntersectionWidth, 0.0001), thickness);
  gradient = mix(1.0, gradient, uIntersectionGradient);
  float dissolve = pow(max(intersectionNoise, 0.0001), uIntersectionDissolve);
  float edge = pow(gradient, max(uIntersectionSmoothness, 0.0001));
  float intersectionMask = saturate(edge * dissolve * uIntersectionEdgeFade);
  intersectionMask = mix(intersectionMask, 1.0 - intersectionMask, uIntersectionInvert);
  if (uHasPrepass > 0.5 && uIntersectionOn > 0.5) {
    waterColor.rgb = mix(waterColor.rgb, uIntersection.rgb,
      intersectionMask * uIntersection.a);
  }

  // Unity's shoreline channel is enabled but authored with alpha exactly 0.
  float shoreline = texture2D(uShoreNoise,
    vec2(vShoreDistance * 0.08 + uTime * 0.03, vWorld.x * 0.015)).r;
  waterColor.rgb = mix(waterColor.rgb, vec3(1.0),
    shoreline * uShorelineEnabled * uShorelineAlpha);

  float shoreAlpha = uHasPrepass > 0.5
    ? smoothstep(0.0, max(uShoreFadeSmoothness, 0.0001), thickness)
    : 1.0;
  gl_FragColor = vec4(waterColor.rgb, waterColor.a * shoreAlpha);
  #include <fog_fragment>
  #include <colorspace_fragment>
}
`;

const HORIZON_VERTEX = /* glsl */ `
attribute float aHorizon;
attribute float aAlpha;
uniform float uTime;
varying float vHorizon;
varying float vAlpha;
varying vec2 vWorldXZ;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vHorizon = aHorizon;
  vAlpha = aAlpha;
  vWorldXZ = world.xz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const HORIZON_FRAGMENT = /* glsl */ `
uniform vec3 uNearColor;
uniform vec3 uFarFogColor;
uniform float uTime;
varying float vHorizon;
varying float vAlpha;
varying vec2 vWorldXZ;
#include <fog_pars_fragment>
void main() {
  float horizon = clamp(vHorizon * 1.12, 0.0, 1.0);
  vec3 color = mix(uNearColor, uFarFogColor, horizon);
  float ripple = sin(vWorldXZ.x * 0.037 + uTime * 0.17)
    + sin(vWorldXZ.y * 0.029 - uTime * 0.11);
  color += ripple * 0.008 * (1.0 - horizon);
  gl_FragColor = vec4(color, vAlpha);
  #include <fog_fragment>
  #include <colorspace_fragment>
}
`;

function cloneParams(source: UnityOceanParams): UnityOceanParams {
  return {
    ...source,
    shallow: { ...source.shallow },
    deep: { ...source.deep },
    peak: { ...source.peak },
    shadow: { ...source.shadow },
    specular: { ...source.specular },
    intersection: { ...source.intersection },
  };
}

function unit2(x: number, z: number, fallbackX = 1, fallbackZ = 0): [number, number] {
  const length = Math.hypot(x, z);
  if (length < 1e-7) return [fallbackX, fallbackZ];
  return [x / length, z / length];
}

function evaluateWavePair(
  x: number,
  z: number,
  time: number,
  p: UnityOceanParams,
): WaveEvaluation {
  let height = 0;
  let dx = 0;
  let dz = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const waves: [number, number, number, number, number, number][] = [
    [p.wave1Length, p.wave1Height, p.wave1Speed, p.wave1DirX, p.wave1DirZ, p.wave1Sharpness],
    [p.wave2Length, p.wave2Height, p.wave2Speed, p.wave2DirX, p.wave2DirZ, p.wave2Sharpness],
  ];
  for (const [length, waveHeight, speed, rawX, rawZ, sharpness] of waves) {
    const k = TAU / Math.max(length, 1e-5);
    const [dirX, dirZ] = unit2(rawX, rawZ);
    const phi = (x * dirX + z * dirZ) * k - Math.sqrt(GRAVITY * k) * time * speed;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    height += waveHeight * cosPhi;
    dx -= dirX * (sharpness / k) * sinPhi;
    dz -= dirZ * (sharpness / k) * sinPhi;
    nx += dirX * k * waveHeight * sinPhi;
    ny += 1 - sharpness * cosPhi;
    nz += dirZ * k * waveHeight * sinPhi;
  }
  const normalLength = Math.hypot(nx, ny, nz) || 1;
  return {
    height,
    dx,
    dz,
    nx: nx / normalLength,
    ny: ny / normalLength,
    nz: nz / normalLength,
  };
}

function resampleShore(
  coarse: ShoreSample[],
  fallbackX: number,
  fallbackZ: number,
  sampleMetres = SHORE_SAMPLE_METRES,
): DenseShoreSample[] {
  if (coarse.length === 0) {
    return [
      { x: -1, z: 0, sx: fallbackX, sz: fallbackZ, beachSlope: 0, bedSlope: 0, arc: 0 },
      { x: 1, z: 0, sx: fallbackX, sz: fallbackZ, beachSlope: 0, bedSlope: 0, arc: 2 },
    ];
  }
  if (coarse.length === 1) {
    const c = coarse[0];
    const tangentX = -fallbackZ;
    const tangentZ = fallbackX;
    return [
      { ...c, x: c.x - tangentX, z: c.z - tangentZ, sx: fallbackX, sz: fallbackZ, arc: 0 },
      { ...c, x: c.x + tangentX, z: c.z + tangentZ, sx: fallbackX, sz: fallbackZ, arc: 2 },
    ];
  }
  const cumulative = [0];
  for (let i = 1; i < coarse.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(
      coarse[i].x - coarse[i - 1].x,
      coarse[i].z - coarse[i - 1].z,
    ));
  }
  const total = cumulative[cumulative.length - 1];
  const count = Math.max(2, Math.ceil(total / sampleMetres) + 1);
  const dense: DenseShoreSample[] = [];
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const arc = (i / (count - 1)) * total;
    while (segment < cumulative.length - 2 && cumulative[segment + 1] < arc) segment++;
    const a = coarse[segment];
    const b = coarse[Math.min(segment + 1, coarse.length - 1)];
    const segmentLength = cumulative[segment + 1] - cumulative[segment] || 1;
    const t = THREE.MathUtils.clamp((arc - cumulative[segment]) / segmentLength, 0, 1);
    dense.push({
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      z: THREE.MathUtils.lerp(a.z, b.z, t),
      sx: THREE.MathUtils.lerp(a.sx, b.sx, t),
      sz: THREE.MathUtils.lerp(a.sz, b.sz, t),
      beachSlope: THREE.MathUtils.lerp(a.beachSlope, b.beachSlope, t),
      bedSlope: THREE.MathUtils.lerp(a.bedSlope, b.bedSlope, t),
      arc,
    });
  }
  // Recompute local seaward normals from the resampled curve, choosing the
  // perpendicular that agrees with the authored/global sea direction.
  for (let i = 0; i < dense.length; i++) {
    const before = dense[Math.max(0, i - 1)];
    const after = dense[Math.min(dense.length - 1, i + 1)];
    const [tx, tz] = unit2(after.x - before.x, after.z - before.z, -fallbackZ, fallbackX);
    let sx = tz;
    let sz = -tx;
    const authored = unit2(dense[i].sx, dense[i].sz, fallbackX, fallbackZ);
    const refX = Math.abs(authored[0]) + Math.abs(authored[1]) > 0 ? authored[0] : fallbackX;
    const refZ = Math.abs(authored[0]) + Math.abs(authored[1]) > 0 ? authored[1] : fallbackZ;
    if (sx * refX + sz * refZ < 0) {
      sx = -sx;
      sz = -sz;
    }
    dense[i].sx = sx;
    dense[i].sz = sz;
  }
  return dense;
}

function setOceanAttributes(geometry: THREE.BufferGeometry, shoreDistances: Float32Array): void {
  geometry.setAttribute("aShoreDistance", new THREE.BufferAttribute(shoreDistances, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 16;
}

function makeRibbonGeometry(
  shore: DenseShoreSample[],
  seaLevel: number,
  lateralSegments = LATERAL_SEGMENTS,
): THREE.BufferGeometry {
  const rows = lateralSegments + 1;
  const count = shore.length * rows;
  const positions = new Float32Array(count * 3);
  const shoreDistances = new Float32Array(count);
  for (let i = 0; i < shore.length; i++) {
    const sample = shore[i];
    for (let r = 0; r < rows; r++) {
      const d = -SHORE_OVERLAP + (r / lateralSegments) * (OCEAN_WIDTH + SHORE_OVERLAP);
      const vertex = i * rows + r;
      positions[vertex * 3] = sample.x + sample.sx * d;
      positions[vertex * 3 + 1] = seaLevel + RIBBON_Y_OFFSET;
      positions[vertex * 3 + 2] = sample.z + sample.sz * d;
      shoreDistances[vertex] = d;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < shore.length - 1; i++) {
    for (let r = 0; r < lateralSegments; r++) {
      const a = i * rows + r;
      const b = a + rows;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  setOceanAttributes(geometry, shoreDistances);
  return geometry;
}

function makeCoverageGeometry(
  course: { x: number; z: number }[],
  shore: DenseShoreSample[],
  seaLevel: number,
  cell = COVERAGE_CELL,
): THREE.BufferGeometry {
  const points: { x: number; z: number }[] = [...course, ...shore];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  if (!Number.isFinite(minX)) {
    minX = minZ = -100;
    maxX = maxZ = 100;
  }
  minX -= COVERAGE_MARGIN;
  maxX += COVERAGE_MARGIN;
  minZ -= COVERAGE_MARGIN;
  maxZ += COVERAGE_MARGIN;
  // Cap only pathological authored bounds; spacing grows rather than silently
  // truncating the 800m coverage contract.
  const columns = Math.min(321, Math.ceil((maxX - minX) / cell) + 1);
  const rows = Math.min(321, Math.ceil((maxZ - minZ) / cell) + 1);
  const count = columns * rows;
  const positions = new Float32Array(count * 3);
  const shoreDistances = new Float32Array(count);
  shoreDistances.fill(999);
  for (let row = 0; row < rows; row++) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, row / Math.max(1, rows - 1));
    for (let column = 0; column < columns; column++) {
      const x = THREE.MathUtils.lerp(minX, maxX, column / Math.max(1, columns - 1));
      const vertex = row * columns + column;
      positions[vertex * 3] = x;
      positions[vertex * 3 + 1] = seaLevel + COVERAGE_Y_OFFSET;
      positions[vertex * 3 + 2] = z;
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  setOceanAttributes(geometry, shoreDistances);
  return geometry;
}

function makeHorizonGeometry(shore: DenseShoreSample[], seaLevel: number): THREE.BufferGeometry {
  const rows = HORIZON_DISTANCES.length;
  const count = shore.length * rows;
  const positions = new Float32Array(count * 3);
  const horizon = new Float32Array(count);
  const alpha = new Float32Array(count);
  for (let i = 0; i < shore.length; i++) {
    const sample = shore[i];
    for (let r = 0; r < rows; r++) {
      const distance = HORIZON_DISTANCES[r];
      const vertex = i * rows + r;
      positions[vertex * 3] = sample.x + sample.sx * distance;
      positions[vertex * 3 + 1] = seaLevel;
      positions[vertex * 3 + 2] = sample.z + sample.sz * distance;
      horizon[vertex] = (distance - HORIZON_DISTANCES[0])
        / (HORIZON_DISTANCES[2] - HORIZON_DISTANCES[0]);
      alpha[vertex] = HORIZON_ALPHAS[r];
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < shore.length - 1; i++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = i * rows + r;
      const b = a + rows;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aHorizon", new THREE.BufferAttribute(horizon, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function rgbaUniform(color: OceanColor): THREE.Vector4 {
  return new THREE.Vector4(color.r, color.g, color.b, color.a);
}

function solidTexture(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class UnityOcean {
  readonly group = new THREE.Group();
  readonly params = cloneParams(UNITY_OCEAN_DEFAULTS);
  readonly debug: OceanDebug;
  readonly stats: OceanStats;
  readonly seaLevel: number;
  readonly shore: DenseShoreSample[];

  quality: OceanQuality;
  reflectionScale = 0.3;
  prepassScale = 1;

  private readonly oceanMaterial: THREE.ShaderMaterial;
  private readonly horizonMaterial: THREE.ShaderMaterial;
  private readonly ribbon: THREE.Mesh;
  private readonly coverage: THREE.Mesh;
  private readonly horizon: THREE.Mesh;
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly fallbackColor = solidTexture(0, 63, 128);
  private readonly fallbackDepth = solidTexture(255, 255, 255);
  private readonly reflectionMatrix = new THREE.Matrix4();
  private reflectionCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;
  private reflectedSource: THREE.Camera | null = null;
  private reflectionRenderTarget: THREE.WebGLRenderTarget | null = null;
  private prepassRenderTarget: THREE.WebGLRenderTarget | null = null;
  private bufferWidth = 1;
  private bufferHeight = 1;
  private bufferPixelRatio = 1;
  private time = 0;
  private disposed = false;
  private currentSkyUrl = "";
  private pendingTextureLoads = 0;
  private textureLoadFailed = false;

  constructor(opts: CoastWaterOpts) {
    this.seaLevel = opts.seaLevel;
    this.quality = opts.quality ?? detectQuality();
    const lite = this.quality === "lite";
    const fallbackDirection = unit2(opts.shoreDirX, opts.shoreDirZ);
    this.shore = resampleShore(
      opts.shore,
      fallbackDirection[0],
      fallbackDirection[1],
      lite ? 8 : SHORE_SAMPLE_METRES,
    );
    const renderShore = lite
      ? this.shore.filter(
          (_, index) => index % 2 === 0 || index === this.shore.length - 1,
        )
      : this.shore;
    this.debug = {
      water: true,
      horizon: true,
      reflection: !lite,
      prepass: !lite,
      refraction: !lite,
      caustics: !lite,
      intersection: !lite,
      freeze: false,
      wireframe: false,
    };
    if (lite) {
      this.reflectionScale = 0.15;
      this.prepassScale = 0.5;
    }

    this.ownedTextures.push(this.fallbackColor, this.fallbackDepth);
    const normalMap = this.loadTexture("normal-2.png", false);
    const shoreNoise = this.loadTexture("noise-1.png", false);
    const intersectionNoise = this.loadTexture("noise-3.png", false);
    const causticsDistortion = this.loadTexture("noise-4.png", false);
    const caustics = this.loadTexture("caustic-1.png", false);

    this.oceanMaterial = new THREE.ShaderMaterial({
      name: "Unity MatrixRex ocean",
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
      fog: true,
      transparent: true,
      // MatrixRex's transparent beach forward pass is SrcAlpha blend,
      // ZWrite Off, Cull Back.
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSeaLevel: { value: this.seaLevel },
          uWave1: { value: new THREE.Vector4() },
          uWave1Dir: { value: new THREE.Vector2() },
          uWave2: { value: new THREE.Vector4() },
          uWave2Dir: { value: new THREE.Vector2() },
          uNormalMap: { value: normalMap },
          uShoreNoise: { value: shoreNoise },
          uIntersectionNoise: { value: intersectionNoise },
          uCausticsDistortionMap: { value: causticsDistortion },
          uCausticsMap: { value: caustics },
          uSceneColor: { value: this.fallbackColor },
          uSceneDepth: { value: this.fallbackDepth },
          uReflection: { value: this.fallbackColor },
          uReflectionMatrix: { value: this.reflectionMatrix },
          uViewport: { value: new THREE.Vector2(1, 1) },
          uCameraNear: { value: 0.1 },
          uCameraFar: { value: 1000 },
          uInverseProjection: { value: new THREE.Matrix4() },
          uInverseView: { value: new THREE.Matrix4() },
          uHasPrepass: { value: 0 },
          uHasReflection: { value: 0 },
          uRefractionOn: { value: 0 },
          uCausticsOn: { value: 0 },
          uIntersectionOn: { value: 0 },
          uShallow: { value: rgbaUniform(this.params.shallow) },
          uDeep: { value: rgbaUniform(this.params.deep) },
          uDepthDistance: { value: this.params.depthDistance },
          uDistanceStart: { value: this.params.distanceStart },
          uDistanceFade: { value: this.params.distanceFade },
          uShoreFadeSmoothness: { value: this.params.shoreFadeSmoothness },
          uPeak: { value: rgbaUniform(this.params.peak) },
          uNormalStrength: { value: this.params.normalStrength },
          uNormalPan: { value: this.params.normalPan },
          uNormalScale: { value: this.params.normalScale },
          uNormalDistanceStrength: { value: this.params.normalDistanceStrength },
          uShadow: { value: rgbaUniform(this.params.shadow) },
          uSpecular: { value: rgbaUniform(this.params.specular) },
          uSpecularSpread: { value: this.params.specularSpread },
          uSpecularHardness: { value: this.params.specularHardness },
          uSpecularSize: { value: this.params.specularSize },
          uRefractionStrength: { value: this.params.refractionStrength },
          uRefractionDistance: { value: this.params.refractionDistance },
          uRefractionFade: { value: this.params.refractionFade },
          uReflectionStrength: { value: this.params.reflectionStrength },
          uReflectionFresnel: { value: this.params.reflectionFresnel },
          uReflectionDistortion: { value: this.params.reflectionDistortion },
          uCausticsDepth: { value: this.params.causticsDepth },
          uCausticsPan: { value: this.params.causticsPan },
          uCausticsScale: { value: this.params.causticsScale },
          uCausticsStrength: { value: this.params.causticsStrength },
          uCausticsDistortion: { value: this.params.causticsDistortion },
          uCausticsDistortionScale: { value: this.params.causticsDistortionScale },
          uCausticsStart: { value: this.params.causticsStart },
          uCausticsFade: { value: this.params.causticsFade },
          uIntersection: { value: rgbaUniform(this.params.intersection) },
          uIntersectionWidth: { value: this.params.intersectionWidth },
          uIntersectionDissolve: { value: this.params.intersectionDissolve },
          uIntersectionScale: { value: this.params.intersectionScale },
          uIntersectionTile: { value: this.params.intersectionTile },
          uIntersectionPan: {
            value: new THREE.Vector2(this.params.intersectionPanX, this.params.intersectionPanY),
          },
          uIntersectionDistortion: { value: this.params.intersectionDistortion },
          uIntersectionSmoothness: { value: this.params.intersectionSmoothness },
          uIntersectionInvert: { value: this.params.intersectionInvert },
          uIntersectionGradient: { value: this.params.intersectionGradient },
          uIntersectionEdgeFade: { value: this.params.intersectionEdgeFade },
          uShorelineEnabled: { value: this.params.shorelineEnabled },
          uShorelineAlpha: { value: this.params.shorelineAlpha },
        },
      ]),
    });

    this.horizonMaterial = new THREE.ShaderMaterial({
      name: "Unity ocean horizon fill",
      vertexShader: HORIZON_VERTEX,
      fragmentShader: HORIZON_FRAGMENT,
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uNearColor: {
            value: new THREE.Color(this.params.deep.r, this.params.deep.g, this.params.deep.b),
          },
          uFarFogColor: { value: new THREE.Color(0.58, 0.79, 0.88) },
        },
      ]),
    });

    this.coverage = new THREE.Mesh(
      makeCoverageGeometry(
        opts.course,
        renderShore,
        this.seaLevel,
        lite ? 64 : COVERAGE_CELL,
      ),
      this.oceanMaterial,
    );
    this.coverage.name = "Unity deep-ocean course coverage";
    this.coverage.frustumCulled = false;
    this.coverage.renderOrder = 0;

    this.horizon = new THREE.Mesh(
      makeHorizonGeometry(renderShore, this.seaLevel),
      this.horizonMaterial,
    );
    this.horizon.name = "Unity ocean horizon fill";
    this.horizon.frustumCulled = false;
    this.horizon.renderOrder = 1;

    this.ribbon = new THREE.Mesh(
      makeRibbonGeometry(renderShore, this.seaLevel, lite ? 16 : LATERAL_SEGMENTS),
      this.oceanMaterial,
    );
    this.ribbon.name = "Unity curved shoreline ocean ribbon";
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 2;
    this.group.name = "Unity MatrixRex ocean";
    this.group.userData.noShadow = true;
    this.group.userData.editorGhost = true;
    this.group.add(this.coverage, this.horizon, this.ribbon);
    this.group.visible = this.pendingTextureLoads === 0;

    const geometries = [this.coverage.geometry, this.horizon.geometry, this.ribbon.geometry];
    this.stats = {
      verts: geometries.reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0),
      tris: geometries.reduce((sum, geometry) => sum + (geometry.getIndex()?.count ?? 0) / 3, 0),
      shoreSamples: this.shore.length,
      reflectionWidth: 0,
      reflectionHeight: 0,
      prepassWidth: 0,
      prepassHeight: 0,
      reflectionRenders: 0,
      prepassRenders: 0,
      quality: this.quality,
    };
    this.syncUniforms();
  }

  private loadTexture(file: string, srgb: boolean): THREE.Texture {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
    this.pendingTextureLoads++;
    const texture = new THREE.TextureLoader().load(
      `${base}water/matrixrex/${file}`,
      () => this.settleTextureLoad(),
      undefined,
      () => {
        this.textureLoadFailed = true;
        this.settleTextureLoad();
      },
    );
    texture.name = `MatrixRex ${file}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.ownedTextures.push(texture);
    return texture;
  }

  private settleTextureLoad(): void {
    this.pendingTextureLoads = Math.max(0, this.pendingTextureLoads - 1);
    if (
      !this.disposed &&
      !this.textureLoadFailed &&
      this.pendingTextureLoads === 0
    )
      this.group.visible = true;
  }

  private syncUniforms(): void {
    const p = this.params;
    const uniforms = this.oceanMaterial.uniforms;
    uniforms.uTime.value = this.time;
    uniforms.uSeaLevel.value = this.seaLevel;
    (uniforms.uWave1.value as THREE.Vector4).set(
      p.wave1Length, p.wave1Height, p.wave1Speed, p.wave1Sharpness,
    );
    (uniforms.uWave1Dir.value as THREE.Vector2).set(p.wave1DirX, p.wave1DirZ);
    (uniforms.uWave2.value as THREE.Vector4).set(
      p.wave2Length, p.wave2Height, p.wave2Speed, p.wave2Sharpness,
    );
    (uniforms.uWave2Dir.value as THREE.Vector2).set(p.wave2DirX, p.wave2DirZ);
    (uniforms.uShallow.value as THREE.Vector4).set(
      p.shallow.r, p.shallow.g, p.shallow.b, p.shallow.a,
    );
    (uniforms.uDeep.value as THREE.Vector4).set(p.deep.r, p.deep.g, p.deep.b, p.deep.a);
    (uniforms.uPeak.value as THREE.Vector4).set(p.peak.r, p.peak.g, p.peak.b, p.peak.a);
    (uniforms.uShadow.value as THREE.Vector4).set(
      p.shadow.r, p.shadow.g, p.shadow.b, p.shadow.a,
    );
    (uniforms.uSpecular.value as THREE.Vector4).set(
      p.specular.r, p.specular.g, p.specular.b, p.specular.a,
    );
    (uniforms.uIntersection.value as THREE.Vector4).set(
      p.intersection.r, p.intersection.g, p.intersection.b, p.intersection.a,
    );
    uniforms.uDepthDistance.value = p.depthDistance;
    uniforms.uDistanceStart.value = p.distanceStart;
    uniforms.uDistanceFade.value = p.distanceFade;
    uniforms.uShoreFadeSmoothness.value = p.shoreFadeSmoothness;
    uniforms.uNormalStrength.value = p.normalStrength;
    uniforms.uNormalPan.value = p.normalPan;
    uniforms.uNormalScale.value = p.normalScale;
    uniforms.uNormalDistanceStrength.value = p.normalDistanceStrength;
    uniforms.uSpecularSpread.value = p.specularSpread;
    uniforms.uSpecularHardness.value = p.specularHardness;
    uniforms.uSpecularSize.value = p.specularSize;
    uniforms.uRefractionStrength.value = p.refractionStrength;
    uniforms.uRefractionDistance.value = p.refractionDistance;
    uniforms.uRefractionFade.value = p.refractionFade;
    uniforms.uReflectionStrength.value = p.reflectionStrength;
    uniforms.uReflectionFresnel.value = p.reflectionFresnel;
    uniforms.uReflectionDistortion.value = p.reflectionDistortion;
    uniforms.uCausticsDepth.value = p.causticsDepth;
    uniforms.uCausticsPan.value = p.causticsPan;
    uniforms.uCausticsScale.value = p.causticsScale;
    uniforms.uCausticsStrength.value = p.causticsStrength;
    uniforms.uCausticsDistortion.value = p.causticsDistortion;
    uniforms.uCausticsDistortionScale.value = p.causticsDistortionScale;
    uniforms.uCausticsStart.value = p.causticsStart;
    uniforms.uCausticsFade.value = p.causticsFade;
    uniforms.uIntersectionWidth.value = p.intersectionWidth;
    uniforms.uIntersectionDissolve.value = p.intersectionDissolve;
    uniforms.uIntersectionScale.value = p.intersectionScale;
    uniforms.uIntersectionTile.value = p.intersectionTile;
    (uniforms.uIntersectionPan.value as THREE.Vector2).set(
      p.intersectionPanX, p.intersectionPanY,
    );
    uniforms.uIntersectionDistortion.value = p.intersectionDistortion;
    uniforms.uIntersectionSmoothness.value = p.intersectionSmoothness;
    uniforms.uIntersectionInvert.value = p.intersectionInvert;
    uniforms.uIntersectionGradient.value = p.intersectionGradient;
    uniforms.uIntersectionEdgeFade.value = p.intersectionEdgeFade;
    uniforms.uShorelineEnabled.value = p.shorelineEnabled;
    uniforms.uShorelineAlpha.value = p.shorelineAlpha;
    uniforms.uRefractionOn.value = this.debug.refraction ? 1 : 0;
    uniforms.uCausticsOn.value = this.debug.caustics ? 1 : 0;
    uniforms.uIntersectionOn.value = this.debug.intersection ? 1 : 0;
    this.oceanMaterial.wireframe = this.debug.wireframe;
    this.horizonMaterial.wireframe = this.debug.wireframe;
    this.ribbon.visible = this.debug.water;
    this.coverage.visible = this.debug.water;
    this.horizon.visible = this.debug.horizon;
    this.horizonMaterial.uniforms.uTime.value = this.time;
    (this.horizonMaterial.uniforms.uNearColor.value as THREE.Color).setRGB(
      p.deep.r, p.deep.g, p.deep.b,
    );
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.disposed) return;
    if (!this.debug.freeze) this.time += dt;
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      this.oceanMaterial.uniforms.uCameraNear.value = camera.near;
      this.oceanMaterial.uniforms.uCameraFar.value = camera.far;
      camera.updateMatrixWorld(true);
      (this.oceanMaterial.uniforms.uInverseProjection.value as THREE.Matrix4)
        .copy(camera.projectionMatrixInverse);
      (this.oceanMaterial.uniforms.uInverseView.value as THREE.Matrix4)
        .copy(camera.matrixWorld);
    }
    this.syncUniforms();
  }

  sampleWaterSurface(x: number, z: number, time = this.time): SurfaceSample {
    const wave = evaluateWavePair(x, z, time, this.params);
    return {
      height: this.seaLevel + wave.height,
      nx: wave.nx,
      ny: wave.ny,
      nz: wave.nz,
      depth: 0,
      shorePhase: 0,
      shoreInfluence: 0,
      displacementX: wave.dx,
      displacementZ: wave.dz,
    };
  }

  heightAt(x: number, z: number, time = this.time): number {
    return this.sampleWaterSurface(x, z, time).height;
  }

  /** Uniforms are synchronized each frame; retained for old studio callers. */
  markWavesDirty(): void {
    this.syncUniforms();
  }

  setQuality(quality: OceanQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.stats.quality = quality;
    if (quality === "lite") {
      this.reflectionScale = 0.15;
      this.prepassScale = 0.5;
      this.debug.reflection = false;
      this.debug.prepass = false;
      this.debug.refraction = false;
      this.debug.caustics = false;
      this.debug.intersection = false;
    } else {
      this.reflectionScale = 0.3;
      this.prepassScale = 1;
      this.debug.reflection = true;
      this.debug.prepass = true;
      this.debug.refraction = true;
      this.debug.caustics = true;
      this.debug.intersection = true;
    }
    this.disposeTargets();
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    this.bufferWidth = Math.max(1, Math.floor(width * pixelRatio));
    this.bufferHeight = Math.max(1, Math.floor(height * pixelRatio));
    this.bufferPixelRatio = Math.max(1, pixelRatio);
    this.allocateTargets();
  }

  resizeFromRenderer(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.bufferWidth = Math.max(1, Math.floor(size.x));
    this.bufferHeight = Math.max(1, Math.floor(size.y));
    this.bufferPixelRatio = Math.max(1, renderer.getPixelRatio());
    this.allocateTargets();
  }

  private allocateTargets(): void {
    if (this.disposed) return;
    // Unity scales from Game-view pixels. The web renderer may be Retina 2x;
    // dividing by DPR keeps the audited 30% reflection and 100% opaque copy
    // at display resolution instead of silently making both four times dearer.
    const displayScale = 1 / this.bufferPixelRatio;
    const reflectionWidth = Math.max(
      1,
      Math.floor(this.bufferWidth * this.reflectionScale * displayScale),
    );
    const reflectionHeight = Math.max(
      1,
      Math.floor(this.bufferHeight * this.reflectionScale * displayScale),
    );
    if (!this.reflectionRenderTarget) {
      this.reflectionRenderTarget = new THREE.WebGLRenderTarget(reflectionWidth, reflectionHeight, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: true,
      });
      this.reflectionRenderTarget.texture.name = "Unity ocean planar reflection 30 percent";
      this.reflectionRenderTarget.texture.generateMipmaps = true;
    } else {
      this.reflectionRenderTarget.setSize(reflectionWidth, reflectionHeight);
    }
    const prepassWidth = Math.max(
      1,
      Math.floor(this.bufferWidth * this.prepassScale * displayScale),
    );
    const prepassHeight = Math.max(
      1,
      Math.floor(this.bufferHeight * this.prepassScale * displayScale),
    );
    if (!this.prepassRenderTarget) {
      this.prepassRenderTarget = new THREE.WebGLRenderTarget(prepassWidth, prepassHeight, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: true,
      });
      this.prepassRenderTarget.texture.name = "Unity ocean opaque color prepass";
      this.prepassRenderTarget.depthTexture = new THREE.DepthTexture(
        prepassWidth, prepassHeight, THREE.UnsignedShortType,
      );
      this.prepassRenderTarget.depthTexture.name = "Unity ocean opaque depth prepass";
      this.prepassRenderTarget.depthTexture.minFilter = THREE.NearestFilter;
      this.prepassRenderTarget.depthTexture.magFilter = THREE.NearestFilter;
    } else {
      this.prepassRenderTarget.setSize(prepassWidth, prepassHeight);
    }
    this.stats.reflectionWidth = reflectionWidth;
    this.stats.reflectionHeight = reflectionHeight;
    this.stats.prepassWidth = prepassWidth;
    this.stats.prepassHeight = prepassHeight;
    const uniforms = this.oceanMaterial.uniforms;
    // The coast composer renders the main scene at Unity Game-view (display)
    // resolution even when the backing canvas is Retina 2x. gl_FragCoord and
    // the opaque prepass must therefore normalize against display pixels.
    uniforms.uViewport.value.set(
      this.bufferWidth * displayScale,
      this.bufferHeight * displayScale,
    );
    uniforms.uReflection.value = this.reflectionRenderTarget.texture;
    uniforms.uSceneColor.value = this.prepassRenderTarget.texture;
    uniforms.uSceneDepth.value = this.prepassRenderTarget.depthTexture;
  }

  private ensureSize(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));
    const pixelRatio = Math.max(1, renderer.getPixelRatio());
    if (width !== this.bufferWidth || height !== this.bufferHeight
      || pixelRatio !== this.bufferPixelRatio
      || !this.reflectionRenderTarget || !this.prepassRenderTarget) {
      this.bufferWidth = width;
      this.bufferHeight = height;
      this.bufferPixelRatio = pixelRatio;
      this.allocateTargets();
    }
  }

  private makeReflectionCamera(source: THREE.Camera): THREE.PerspectiveCamera | THREE.OrthographicCamera | null {
    let reflected: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (source instanceof THREE.PerspectiveCamera) {
      if (!(this.reflectionCamera instanceof THREE.PerspectiveCamera) || this.reflectedSource !== source) {
        this.reflectionCamera = new THREE.PerspectiveCamera();
      }
      reflected = this.reflectionCamera as THREE.PerspectiveCamera;
      reflected.copy(source, false);
    } else if (source instanceof THREE.OrthographicCamera) {
      if (!(this.reflectionCamera instanceof THREE.OrthographicCamera) || this.reflectedSource !== source) {
        this.reflectionCamera = new THREE.OrthographicCamera();
      }
      reflected = this.reflectionCamera as THREE.OrthographicCamera;
      reflected.copy(source, false);
    } else {
      return null;
    }
    this.reflectedSource = source;
    const position = source.getWorldPosition(new THREE.Vector3());
    const forward = source.getWorldDirection(new THREE.Vector3());
    const quaternion = source.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    position.y = this.seaLevel * 2 - position.y;
    forward.y = -forward.y;
    up.y = -up.y;
    reflected.position.copy(position);
    reflected.up.copy(up).normalize();
    reflected.lookAt(position.clone().add(forward));
    reflected.layers.mask = source.layers.mask;
    reflected.updateMatrixWorld(true);
    reflected.matrixWorldInverse.copy(reflected.matrixWorld).invert();

    // Unity clips with an oblique projection plane, not per-material shader
    // clipping. This catches custom/Basic materials too and prevents anything
    // below the sea from leaking into the mirrored capture.
    const waterPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -this.seaLevel - 0.01,
    ).applyMatrix4(reflected.matrixWorldInverse);
    const clip = new THREE.Vector4(
      waterPlane.normal.x,
      waterPlane.normal.y,
      waterPlane.normal.z,
      waterPlane.constant,
    );
    const projection = reflected.projectionMatrix;
    const elements = projection.elements;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + elements[8]) / elements[0],
      (Math.sign(clip.y) + elements[9]) / elements[5],
      -1,
      (1 + elements[10]) / elements[14],
    );
    const denominator = clip.dot(q);
    if (Math.abs(denominator) > 1e-6) {
      clip.multiplyScalar(2 / denominator);
      elements[2] = clip.x;
      elements[6] = clip.y;
      elements[10] = clip.z + 1;
      elements[14] = clip.w;
      reflected.projectionMatrixInverse.copy(projection).invert();
    }
    this.reflectionMatrix.multiplyMatrices(
      reflected.projectionMatrix,
      reflected.matrixWorldInverse,
    );
    return reflected;
  }

  /**
   * Render the audited 30%-scale planar reflection. Call before the main scene
   * render. This is a direct scene pass, so post-processing is intentionally
   * absent; ocean objects, fog, shadows, and geometry below sea level are
   * excluded for the pass and all renderer/scene state is restored.
   */
  renderReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.debug.reflection) {
      this.oceanMaterial.uniforms.uHasReflection.value = 0;
      return;
    }
    this.ensureSize(renderer);
    const target = this.reflectionRenderTarget;
    const reflected = this.makeReflectionCamera(camera);
    if (!target || !reflected) {
      this.oceanMaterial.uniforms.uHasReflection.value = 0;
      return;
    }
    const oldTarget = renderer.getRenderTarget();
    const oldXr = renderer.xr.enabled;
    const oldAutoClear = renderer.autoClear;
    const oldShadowEnabled = renderer.shadowMap.enabled;
    const oldShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const oldFog = scene.fog;
    const oldVisible = this.group.visible;
    try {
      this.group.visible = false;
      scene.fog = null;
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, reflected);
      this.stats.reflectionRenders++;
      this.oceanMaterial.uniforms.uHasReflection.value = 1;
    } finally {
      renderer.setRenderTarget(oldTarget);
      renderer.xr.enabled = oldXr;
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.enabled = oldShadowEnabled;
      renderer.shadowMap.autoUpdate = oldShadowAutoUpdate;
      scene.fog = oldFog;
      this.group.visible = oldVisible;
    }
  }

  /**
   * Render opaque scene color plus hardware depth for refraction, depth tint,
   * caustics and intersection foam. Transparent drawables are omitted and the
   * ocean group is excluded. Call after renderReflection and before the main
   * scene render.
   */
  renderPrepass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.debug.prepass) {
      this.oceanMaterial.uniforms.uHasPrepass.value = 0;
      return;
    }
    this.ensureSize(renderer);
    const target = this.prepassRenderTarget;
    if (!target) {
      this.oceanMaterial.uniforms.uHasPrepass.value = 0;
      return;
    }
    const hidden: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (!object.visible || object === this.group || this.group.getObjectById(object.id)) return;
      const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      const materials = renderable.material
        ? Array.isArray(renderable.material) ? renderable.material : [renderable.material]
        : [];
      if (materials.some((material) => material.transparent || material.opacity < 1)) {
        hidden.push(object);
        object.visible = false;
      }
    });
    const oldTarget = renderer.getRenderTarget();
    const oldXr = renderer.xr.enabled;
    const oldAutoClear = renderer.autoClear;
    const oldShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const oldVisible = this.group.visible;
    try {
      this.group.visible = false;
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      // Unity copies the opaque buffer; it does not rerender its shadow map.
      // Reuse the previous/main shadow texture for this extra scene pass.
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      this.stats.prepassRenders++;
      this.oceanMaterial.uniforms.uHasPrepass.value = 1;
    } finally {
      renderer.setRenderTarget(oldTarget);
      renderer.xr.enabled = oldXr;
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.autoUpdate = oldShadowAutoUpdate;
      this.group.visible = oldVisible;
      for (const object of hidden) object.visible = true;
    }
  }

  renderPasses(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    // Paused/editor/model-studio frames bypass the normal water update but can
    // still move the camera. Refresh matrices without advancing wave time.
    this.update(0, camera);
    this.renderReflection(renderer, scene, camera);
    this.renderPrepass(renderer, scene, camera);
  }

  get reflectionTarget(): THREE.WebGLRenderTarget | null {
    return this.reflectionRenderTarget;
  }

  get prepassTarget(): THREE.WebGLRenderTarget | null {
    return this.prepassRenderTarget;
  }

  /** The Unity shader does not sample the sky panorama; kept for main.ts. */
  setSkyUrl(url: string, _fogHex: number, _horizonV = 1 - 600 / 887): void {
    this.currentSkyUrl = url;
  }

  get skyUrl(): string {
    return this.currentSkyUrl;
  }

  get skyReady(): boolean {
    return true;
  }

  private disposeTargets(): void {
    this.reflectionRenderTarget?.dispose();
    this.prepassRenderTarget?.depthTexture?.dispose();
    this.prepassRenderTarget?.dispose();
    this.reflectionRenderTarget = null;
    this.prepassRenderTarget = null;
    this.oceanMaterial.uniforms.uReflection.value = this.fallbackColor;
    this.oceanMaterial.uniforms.uSceneColor.value = this.fallbackColor;
    this.oceanMaterial.uniforms.uSceneDepth.value = this.fallbackDepth;
    this.oceanMaterial.uniforms.uHasReflection.value = 0;
    this.oceanMaterial.uniforms.uHasPrepass.value = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeTargets();
    this.ribbon.geometry.dispose();
    this.coverage.geometry.dispose();
    this.horizon.geometry.dispose();
    this.oceanMaterial.dispose();
    this.horizonMaterial.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    this.group.clear();
  }
}

/** Drop-in class name for the old `CoastWater` import. */
export { UnityOcean as CoastWater };

function detectQuality(): OceanQuality {
  if (typeof window === "undefined") return "full";
  return new URLSearchParams(window.location.search).has("lite") ? "lite" : "full";
}
